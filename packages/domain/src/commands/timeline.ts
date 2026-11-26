/**
 * The plan over time, reconstructed from the change log. Every event carries a diff, so the
 * publication as it was on any earlier date is found by undoing the log backwards from the
 * current state. The milestone slip chart (PLAN §5.1.7) is built on this.
 */
import { getCalendar } from '../calendar/calendar'
import { analyzePlan } from '../engine/analyze'
import type { IsoDate } from '../model/common'
import type { ChangeEventType } from '../model/events'
import { targetReleaseDate, type Publication } from '../model/publication'
import { applyDiff, invertDiff } from './diff'
import type { History } from './history'

export interface PlanVersion {
  /** The publication at the end of this day. */
  date: IsoDate
  publication: Publication
}

export interface PlanTimeline {
  /** The plan before the first logged change. */
  initial: Publication
  /** One version per day with changes, oldest first. */
  versions: PlanVersion[]
  /** False if the log could not be replayed all the way back (e.g. an inconsistent import). */
  complete: boolean
}

/**
 * Rebuilds the plan as it was after each day with changes. Days are taken in log order; a date
 * earlier than the one before it counts as that earlier day (the log is the source of truth).
 */
export function planTimeline(pub: Publication, history: History): PlanTimeline {
  const log = history.log
  // Undo the log backwards; states[i] = the publication after event i.
  const states: Publication[] = new Array(log.length)
  let current = pub
  let complete = true
  let first = 0
  for (let i = log.length - 1; i >= 0; i--) {
    states[i] = current
    try {
      current = applyDiff(current, invertDiff(log[i]!.diff))
    } catch {
      // Event i cannot be undone: the oldest known state is the one after it.
      complete = false
      first = i + 1
      break
    }
  }

  const versions: PlanVersion[] = []
  let date: IsoDate | null = null
  for (let i = first; i < log.length; i++) {
    const d: IsoDate = date && log[i]!.effectiveDate < date ? date : log[i]!.effectiveDate
    const version = { date: d, publication: states[i]! }
    if (versions.at(-1)?.date === d) versions[versions.length - 1] = version
    else versions.push(version)
    date = d
  }
  return { initial: current, versions, complete }
}

/** The plan as it was at the end of `date`, from a timeline. */
export function planAt(timeline: PlanTimeline, date: IsoDate): Publication {
  let pub = timeline.initial
  for (const v of timeline.versions) {
    if (v.date > date) break
    pub = v.publication
  }
  return pub
}

export interface TrendPoint {
  date: IsoDate
  /** Forecast deadline as of `date` (the actual date once done). */
  forecast: IsoDate
  /** The planned (current) deadline as of `date`. */
  planned: IsoDate
  done: boolean
}

export interface MilestoneTrend {
  activityId: string
  points: TrendPoint[]
}

export interface PlanTrend {
  /** Sample dates, oldest first. */
  dates: IsoDate[]
  /** The release target (binding or desired) on each sample date. */
  target: { date: IsoDate; target: IsoDate }[]
  /** One series per milestone in the current plan (skipped ones left out), by current deadline. */
  milestones: MilestoneTrend[]
  complete: boolean
}

/** Changes that are worth their own sample in the trend, besides the weekly ones. */
const PLANNING_EVENTS: ReadonlySet<ChangeEventType> = new Set([
  'activity_rescheduled',
  'release_date_changed',
  'plan_made_binding',
  'rebaselined',
  'paused',
  'resumed',
  'undone',
  'redone',
])

/**
 * Forecast per milestone over time: x = the date it was forecast on, y = the forecast date. The
 * standard milestone slip chart. Sampled weekly from the first change up to `asOf`, plus every
 * day with a planning change.
 */
export function milestoneTrend(
  pub: Publication,
  history: History,
  options: { asOf: IsoDate; everyWorkdays?: number },
): PlanTrend {
  const cal = getCalendar(pub.calendar)
  const { asOf } = options
  const every = options.everyWorkdays ?? 5
  const timeline = planTimeline(pub, history)
  const logged = timeline.versions.filter((v) => v.date <= asOf)
  const start = logged[0]?.date ?? asOf

  const sample = new Set<IsoDate>([asOf])
  for (let d = cal.nextWorkingDay(start); d < asOf; d = cal.addWorkdays(d, every)) sample.add(d)
  for (const e of history.log) {
    if (PLANNING_EVENTS.has(e.type) && e.effectiveDate <= asOf && e.effectiveDate >= start) {
      sample.add(e.effectiveDate)
    }
  }
  const dates = [...sample].sort()

  const ids = pub.activities
    .filter((a) => a.kind === 'milestone' && a.status !== 'skipped')
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .map((a) => a.id)
  const series = new Map(ids.map((id) => [id, [] as TrendPoint[]]))
  const target: PlanTrend['target'] = []

  for (const date of dates) {
    const at = planAt(timeline, date)
    const analysis = analyzePlan(at, date)
    target.push({ date, target: targetReleaseDate(at) })
    for (const a of at.activities) {
      const points = series.get(a.id)
      const f = analysis.activities.get(a.id)
      if (!points || !f) continue
      points.push({ date, forecast: f.deadline, planned: a.deadline, done: a.status === 'done' })
    }
  }

  return {
    dates,
    target,
    milestones: ids.map((activityId) => ({ activityId, points: series.get(activityId)! })),
    complete: timeline.complete,
  }
}
