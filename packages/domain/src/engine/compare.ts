/**
 * Compares two versions of the same publication's plan: what moved, what happens to the
 * milestones and the release forecast. Used by every "what would this do?" preview (pause,
 * resume, release date changes) and by scenario mode to compare a sandbox with the live plan.
 */
import { getCalendar } from '../calendar/calendar'
import type { IsoDate } from '../model/common'
import { targetReleaseDate, type Activity, type Publication } from '../model/publication'
import { analyzePlan } from './analyze'
import type { PlannedDates } from './reschedule'

export interface ActivityDelta {
  activityId: string
  before: PlannedDates
  after: PlannedDates
  /** Working days the deadline moved (positive = later). */
  deltaWorkdays: number
}

export interface MilestoneDelta {
  activityId: string
  before: { deadline: IsoDate; forecast: IsoDate }
  after: { deadline: IsoDate; forecast: IsoDate }
  /** Working days the forecast moved (positive = later). */
  forecastDeltaWorkdays: number
}

export interface PlanComparison {
  /** Activities whose planned dates or duration differ, in plan order. */
  moved: ActivityDelta[]
  /** Every milestone present in both plans, by deadline in `after`. */
  milestones: MilestoneDelta[]
  /** Activities whose status differs. */
  statusChanged: string[]
  added: string[]
  removed: string[]
  release: {
    targetBefore: IsoDate
    targetAfter: IsoDate
    forecastBefore: IsoDate | null
    forecastAfter: IsoDate | null
    /** Working days the release forecast moved (positive = later). null without a release. */
    forecastDeltaWorkdays: number | null
    /** Working days the forecast ends up after the (new) target. */
    slipAfter: number | null
  }
}

export function comparePlans(
  before: Publication,
  after: Publication,
  asOf: IsoDate,
): PlanComparison {
  const cal = getCalendar(after.calendar)
  const fBefore = analyzePlan(before, asOf)
  const fAfter = analyzePlan(after, asOf)
  const beforeById = new Map(before.activities.map((a) => [a.id, a]))
  const afterIds = new Set(after.activities.map((a) => a.id))

  const moved: ActivityDelta[] = []
  const milestones: MilestoneDelta[] = []
  const statusChanged: string[] = []
  const added: string[] = []
  for (const a of after.activities) {
    const b = beforeById.get(a.id)
    if (!b) {
      added.push(a.id)
      continue
    }
    if (b.status !== a.status) statusChanged.push(a.id)
    if (
      b.deadline !== a.deadline ||
      b.start !== a.start ||
      b.durationWorkdays !== a.durationWorkdays
    ) {
      moved.push({
        activityId: a.id,
        before: dates(b),
        after: dates(a),
        deltaWorkdays: cal.workdaysBetween(b.deadline, a.deadline),
      })
    }
    if (a.kind === 'milestone') {
      const fb = fBefore.activities.get(a.id)!.deadline
      const fa = fAfter.activities.get(a.id)!.deadline
      milestones.push({
        activityId: a.id,
        before: { deadline: b.deadline, forecast: fb },
        after: { deadline: a.deadline, forecast: fa },
        forecastDeltaWorkdays: cal.workdaysBetween(fb, fa),
      })
    }
  }
  milestones.sort((x, y) => x.after.deadline.localeCompare(y.after.deadline))

  const rb = fBefore.release.forecast
  const ra = fAfter.release.forecast
  return {
    moved,
    milestones,
    statusChanged,
    added,
    removed: before.activities.filter((a) => !afterIds.has(a.id)).map((a) => a.id),
    release: {
      targetBefore: targetReleaseDate(before),
      targetAfter: targetReleaseDate(after),
      forecastBefore: rb,
      forecastAfter: ra,
      forecastDeltaWorkdays: rb && ra ? cal.workdaysBetween(rb, ra) : null,
      slipAfter: fAfter.release.slipWorkdays,
    },
  }
}

/** True when the comparison shows no difference at all. */
export function isSamePlan(c: PlanComparison): boolean {
  return (
    c.moved.length === 0 &&
    c.statusChanged.length === 0 &&
    c.added.length === 0 &&
    c.removed.length === 0 &&
    c.release.targetBefore === c.release.targetAfter
  )
}

function dates(a: Activity): PlannedDates {
  return { start: a.start, deadline: a.deadline, durationWorkdays: a.durationWorkdays }
}
