/**
 * Critical path analysis (PLAN §4.1.2).
 *
 * - Forward pass: the FORECAST. Planned dates, pushed later where predecessors, progress or
 *   "today" (`asOf`) require it. Activities are never pulled earlier than planned: the team works
 *   to the plan's dates.
 * - Backward pass: the LATEST ALLOWED finish of every activity that does not delay the target
 *   release (binding, or desired while preliminary). Activities that do not lead to the release
 *   (side tracks, post-release follow-up) are measured against their own deadlines instead.
 * - Slack = latest allowed − forecast, in working days.
 * - Critical path: from the release milestone back through the predecessor with least slack.
 */
import { getCalendar, type WorkCalendar } from '../calendar/calendar'
import type { IsoDate } from '../model/common'
import {
  releaseActivity,
  targetReleaseDate,
  type Activity,
  type Publication,
} from '../model/publication'
import { constrainsStart, earliestFinish, latestFinish, type Span } from './constraints'
import { ancestors, successorMap, topologicalOrder, type Edge } from './graph'
import { plannedSpan } from './spans'

export type PushReason =
  | { reason: 'predecessor'; activityId: string }
  /** Not done yet, and the planned date has passed or is too close to fit the work. */
  | { reason: 'today' }
  /** Waiting for something expected later. */
  | { reason: 'waiting' }
  /** Started later than planned; the full duration is counted from the actual start. */
  | { reason: 'started_late' }

export interface ActivityForecast {
  id: string
  /** Forecast first working day (tasks only). The actual start once started. */
  start: IsoDate | null
  /** Forecast deadline. The actual finish once done. */
  deadline: IsoDate
  /** Working days from the current deadline to the forecast. Negative if done early. */
  slipWorkdays: number
  /** Why the forecast is later than planned, if it is. */
  pushedBy: PushReason | null
  /** Latest deadline that keeps the release (or the side track's own deadline). null if done. */
  latestDeadline: IsoDate | null
  /** Working days of buffer before this activity delays the release. null if done or skipped. */
  slackWorkdays: number | null
  critical: boolean
  /** Pinned activity whose forecast is later than its fixed date. */
  pinnedConflict: boolean
}

export interface ReleaseForecast {
  target: IsoDate
  /** The release milestone's current deadline. */
  planned: IsoDate | null
  forecast: IsoDate | null
  /** Working days the forecast is later than the target (negative = buffer). */
  slipWorkdays: number | null
}

export interface PlanAnalysis {
  asOf: IsoDate
  /** Activity ids in dependency order. */
  order: string[]
  activities: Map<string, ActivityForecast>
  release: ReleaseForecast
  /** Activity ids from the start of the critical chain to the release milestone. */
  criticalPath: string[]
}

interface Internal {
  span: Span
  slip: number
  pushedBy: PushReason | null
  latest: number | null
}

export function analyzePlan(pub: Publication, asOf: IsoDate): PlanAnalysis {
  const cal = getCalendar(pub.calendar)
  const topo = topologicalOrder(pub.activities)
  if (!topo.ok) throw new Error(`Dependency cycle: ${topo.cycle.join(' → ')}`)
  const order = topo.order
  const byId = new Map(pub.activities.map((a) => [a.id, a]))
  const succ = successorMap(pub.activities)
  const today = cal.startBoundary(asOf)
  const release = releaseActivity(pub)
  const target = cal.ordinal(targetReleaseDate(pub))

  // Forward pass.
  const st = new Map<string, Internal>()
  for (const id of order) {
    const a = byId.get(id)!
    st.set(
      id,
      forward(cal, a, today, (pid) => st.get(pid)!.span),
    )
  }

  // Backward pass. Activities that lead to the release are measured against the release only;
  // side tracks hanging off them (press, funding follow-up) get their own slack and warnings
  // instead of eating into the main chain's.
  const leadsToRelease = release ? ancestors(pub.activities, release.id) : new Set<string>()
  if (release) leadsToRelease.add(release.id)
  for (const id of [...order].reverse()) {
    const a = byId.get(id)!
    const s = st.get(id)!
    if (a.status === 'done') continue
    const edges = leadsToRelease.has(id)
      ? succ.get(id)!.filter((e) => leadsToRelease.has(e.id))
      : succ.get(id)!
    let latest = latestFromSuccessors(a, edges, byId, st)
    if (a.status === 'skipped') {
      // A skipped activity only passes constraints through; it has no deadline of its own.
      s.latest = latest
      continue
    }
    if (latest === null) latest = plannedSpan(cal, a).finish
    if (a.id === release?.id) latest = Math.min(latest, target)
    if (a.pinned) latest = Math.min(latest, plannedSpan(cal, a).finish)
    s.latest = latest
  }

  const activities = new Map<string, ActivityForecast>()
  for (const id of order) {
    const a = byId.get(id)!
    const s = st.get(id)!
    const isOpen = a.status !== 'done' && a.status !== 'skipped'
    activities.set(id, {
      id,
      start: a.kind === 'task' ? (a.actualStart ?? cal.dateOf(s.span.start + 1)) : null,
      deadline: a.status === 'done' ? a.actualFinish! : cal.dateOf(s.span.finish),
      slipWorkdays: s.slip,
      pushedBy: s.pushedBy,
      latestDeadline: isOpen && s.latest !== null ? cal.dateOf(s.latest) : null,
      slackWorkdays: isOpen && s.latest !== null ? s.latest - s.span.finish : null,
      critical: false,
      pinnedConflict: a.pinned && isOpen && s.slip > 0,
    })
  }

  const criticalPath = release ? criticalChain(release, byId, activities) : []
  for (const id of criticalPath) activities.get(id)!.critical = true

  const releaseState = release ? st.get(release.id)! : null
  return {
    asOf,
    order,
    activities,
    release: {
      target: targetReleaseDate(pub),
      planned: release?.deadline ?? null,
      forecast: release ? activities.get(release.id)!.deadline : null,
      slipWorkdays: releaseState
        ? (release!.status === 'done'
            ? cal.ordinal(release!.actualFinish!)
            : releaseState.span.finish) - target
        : null,
    },
    criticalPath,
  }
}

function forward(
  cal: WorkCalendar,
  a: Activity,
  today: number,
  spanOf: (id: string) => Span,
): Internal {
  const planned = plannedSpan(cal, a)
  const dur = a.durationWorkdays

  if (a.status === 'done') {
    const finish = cal.ordinal(a.actualFinish!)
    const start = a.actualStart ? cal.startBoundary(a.actualStart) : finish - dur
    return { span: { start, finish }, slip: finish - planned.finish, pushedBy: null, latest: null }
  }

  if (a.status === 'skipped') {
    // A zero-length pass-through: it holds nothing up by its own date.
    let finish = -Infinity
    for (const d of a.predecessors)
      finish = Math.max(finish, earliestFinish(d, spanOf(d.activityId), 0))
    if (finish === -Infinity) finish = planned.finish
    return { span: { start: finish, finish }, slip: 0, pushedBy: null, latest: null }
  }

  const started = a.actualStart !== null
  let finish = planned.finish
  let pushedBy: PushReason | null = null
  const bump = (value: number, why: PushReason) => {
    if (value > finish) {
      finish = value
      pushedBy = why
    }
  }

  for (const d of a.predecessors) {
    if (started && constrainsStart(d)) continue
    bump(earliestFinish(d, spanOf(d.activityId), dur), {
      reason: 'predecessor',
      activityId: d.activityId,
    })
  }
  if (started) {
    bump(cal.startBoundary(a.actualStart!) + dur, { reason: 'started_late' })
    bump(today + 1, { reason: 'today' })
  } else {
    bump(today + Math.max(dur, 1), { reason: 'today' })
  }
  if (a.status === 'waiting' && a.waitingFor?.expectedDate) {
    const clears = cal.startBoundary(a.waitingFor.expectedDate)
    bump(clears + (started ? 1 : Math.max(dur, 1)), { reason: 'waiting' })
  }

  const start = started ? cal.startBoundary(a.actualStart!) : finish - dur
  return { span: { start, finish }, slip: finish - planned.finish, pushedBy, latest: null }
}

/** Latest finish allowed by the successors, or null if no open successor constrains it. */
function latestFromSuccessors(
  a: Activity,
  edges: Edge[],
  byId: Map<string, Activity>,
  st: Map<string, Internal>,
): number | null {
  let latest: number | null = null
  for (const e of edges) {
    const s = byId.get(e.id)!
    const sLatest = st.get(e.id)!.latest
    if (s.status === 'done' || sLatest === null) continue
    if (s.actualStart !== null && constrainsStart(e.dep)) continue
    const sDur = s.status === 'skipped' ? 0 : s.durationWorkdays
    const value = latestFinish(
      e.dep,
      sLatest,
      sDur,
      a.status === 'skipped' ? 0 : a.durationWorkdays,
    )
    latest = latest === null ? value : Math.min(latest, value)
  }
  return latest
}

function criticalChain(
  release: Activity,
  byId: Map<string, Activity>,
  fc: Map<string, ActivityForecast>,
): string[] {
  if (release.status === 'done') return []
  const chain = [release.id]
  const seen = new Set(chain)
  let current = release
  for (;;) {
    const candidates = openPredecessors(current, byId).filter((id) => !seen.has(id))
    if (!candidates.length) break
    candidates.sort((x, y) => {
      const a = fc.get(x)!
      const b = fc.get(y)!
      return a.slackWorkdays! - b.slackWorkdays! || (a.deadline < b.deadline ? 1 : -1)
    })
    current = byId.get(candidates[0]!)!
    chain.push(current.id)
    seen.add(current.id)
  }
  return chain.reverse()
}

/** Predecessors that are still open, looking through skipped activities. */
function openPredecessors(a: Activity, byId: Map<string, Activity>): string[] {
  const out = new Set<string>()
  const visit = (x: Activity) => {
    for (const d of x.predecessors) {
      const p = byId.get(d.activityId)
      if (!p || p.status === 'done') continue
      if (p.status === 'skipped') visit(p)
      else out.add(p.id)
    }
  }
  visit(a)
  return [...out]
}
