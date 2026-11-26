/**
 * Health classification per activity, phase and publication (PLAN §4.1.7).
 *
 * Precedence for open work: late > waiting > at_risk > on_track.
 * "Slipped" (current deadline later than the original) is reported separately as a variance,
 * because it can be true for any state.
 */
import { getCalendar } from '../calendar/calendar'
import type { IsoDate } from '../model/common'
import { openPause, originalBaseline, type Publication } from '../model/publication'
import { analyzePlan, type PlanAnalysis, type ReleaseForecast } from './analyze'

export type HealthState = 'done' | 'skipped' | 'late' | 'waiting' | 'at_risk' | 'on_track'

export type HealthReason =
  /** Past its current deadline and not done. */
  | 'overdue'
  | 'waiting'
  /** The forecast is later than the current deadline. */
  | 'forecast_slip'
  /** Slack below the threshold: slipping further delays the release (or its own deadline). */
  | 'low_slack'
  /** A pinned date the forecast runs past. */
  | 'pinned_conflict'

export interface ActivityHealth {
  id: string
  state: HealthState
  reasons: HealthReason[]
  /** Working days the current deadline is later than the original (baseline 0). */
  slipVsBaselineWorkdays: number | null
}

export interface GroupHealth {
  state: HealthState
  total: number
  done: number
  skipped: number
  late: number
  waiting: number
  atRisk: number
  /** Share of non-skipped activities that are done, 0–1. */
  progress: number
}

export interface PublicationHealth {
  asOf: IsoDate
  analysis: PlanAnalysis
  activities: Map<string, ActivityHealth>
  phases: Map<string, GroupHealth>
  overall: GroupHealth
  release: ReleaseForecast
  paused: boolean
}

export interface HealthOptions {
  /** At risk when slack is below this many working days (default 0: only when it is negative). */
  atRiskSlackWorkdays?: number
}

const RANK: Record<HealthState, number> = {
  late: 5,
  waiting: 4,
  at_risk: 3,
  on_track: 2,
  done: 1,
  skipped: 0,
}

export function assessHealth(
  pub: Publication,
  asOf: IsoDate,
  options: HealthOptions = {},
  analysis: PlanAnalysis = analyzePlan(pub, asOf),
): PublicationHealth {
  const cal = getCalendar(pub.calendar)
  const threshold = options.atRiskSlackWorkdays ?? 0
  const baseline = originalBaseline(pub)

  const activities = new Map<string, ActivityHealth>()
  for (const a of pub.activities) {
    const f = analysis.activities.get(a.id)!
    const base = baseline?.activities[a.id]
    const slipVsBaselineWorkdays = base ? cal.workdaysBetween(base.deadline, a.deadline) : null

    if (a.status === 'done' || a.status === 'skipped') {
      activities.set(a.id, { id: a.id, state: a.status, reasons: [], slipVsBaselineWorkdays })
      continue
    }
    const reasons: HealthReason[] = []
    if (a.deadline < asOf) reasons.push('overdue')
    if (a.status === 'waiting') reasons.push('waiting')
    if (f.slipWorkdays > 0) reasons.push('forecast_slip')
    if (f.slackWorkdays !== null && f.slackWorkdays < threshold) reasons.push('low_slack')
    if (f.pinnedConflict) reasons.push('pinned_conflict')

    const state: HealthState = reasons.includes('overdue')
      ? 'late'
      : reasons.includes('waiting')
        ? 'waiting'
        : reasons.length
          ? 'at_risk'
          : 'on_track'
    activities.set(a.id, { id: a.id, state, reasons, slipVsBaselineWorkdays })
  }

  const phases = new Map<string, GroupHealth>()
  for (const phaseId of new Set(pub.activities.map((a) => a.phaseId))) {
    phases.set(
      phaseId,
      rollup(pub.activities.filter((a) => a.phaseId === phaseId).map((a) => activities.get(a.id)!)),
    )
  }

  const overall = rollup([...activities.values()])
  // A forecast release after the target puts the whole publication at risk.
  if ((analysis.release.slipWorkdays ?? 0) > 0 && RANK[overall.state] < RANK.at_risk) {
    overall.state = 'at_risk'
  }

  return {
    asOf,
    analysis,
    activities,
    phases,
    overall,
    release: analysis.release,
    paused: openPause(pub) !== undefined,
  }
}

function rollup(items: ActivityHealth[]): GroupHealth {
  const count = (s: HealthState) => items.filter((i) => i.state === s).length
  const done = count('done')
  const skipped = count('skipped')
  const worst = items.reduce<HealthState>(
    (w, i) => (RANK[i.state] > RANK[w] ? i.state : w),
    items.length && done + skipped < items.length ? 'on_track' : done ? 'done' : 'skipped',
  )
  return {
    state: worst,
    total: items.length,
    done,
    skipped,
    late: count('late'),
    waiting: count('waiting'),
    atRisk: count('at_risk'),
    progress: items.length - skipped ? done / (items.length - skipped) : 1,
  }
}
