/**
 * Scenarios (PLAN §4.3): named, reproducible stories of a book's production. A scenario is a
 * seed, a simulation policy and a script of events. Event dates are relative to the kickoff or
 * the release, so the same scenario can be replayed for any release date (demo data that never
 * goes stale).
 *
 * Used for client demos, as end-to-end fixtures and as engine regression tests.
 */
import { getCalendar } from '../calendar/calendar'
import { addDays } from '../calendar/dates'
import {
  changeReleaseDate,
  pause,
  reschedule,
  resume,
  setStatus,
  type ResumeMode,
} from '../commands/commands'
import type { CommandContext } from '../commands/context'
import { emptyHistory, record, type History } from '../commands/history'
import type { CommandResult } from '../commands/transaction'
import { generatePlan } from '../engine/generate'
import { assessHealth } from '../engine/health'
import type { RescheduleOptions, ScheduleChange } from '../engine/reschedule'
import type { ActivityStatus, IsoDate } from '../model/common'
import type { ReasonCategory } from '../model/events'
import type { Publication, WaitingFor } from '../model/publication'
import type { Template } from '../model/template'
import { MASTERPLAN_V1 } from '../templates/masterplan-v1'
import { simulateProgress, type SimulationPolicy, type SimulationState } from './simulate'

/** A date relative to the plan, in working days. */
export interface RelativeDate {
  from: 'kickoff' | 'release'
  workdays: number
}

export type ScenarioAction =
  | {
      kind: 'reschedule'
      change: ScheduleChange
      options: RescheduleOptions
      reason?: string
      reasonCategory?: ReasonCategory
    }
  | { kind: 'set_status'; activityId: string; status: ActivityStatus; waitingFor?: WaitingFor }
  | { kind: 'pause'; reason: string; reasonCategory?: ReasonCategory }
  | { kind: 'resume'; mode: { kind: 'shift' } | { kind: 'new_release'; release: RelativeDate } }
  | { kind: 'change_release'; release: RelativeDate; reason: string }

export interface Scenario {
  id: string
  /** Danish, shown in the demo picker. */
  name: string
  description: string
  seed: number
  policy: SimulationPolicy
  /** Postpone overrunning work automatically (default true). */
  replan?: boolean
  /** Optional template activities this book skips. */
  skipOptional?: string[]
  events: { at: RelativeDate; action: ScenarioAction }[]
}

export interface ScenarioSnapshot {
  date: IsoDate
  target: IsoDate
  forecastRelease: IsoDate | null
  releaseSlipWorkdays: number | null
  done: number
  total: number
  late: number
  atRisk: number
  waiting: number
  lifecycle: Publication['lifecycle']
  planState: Publication['planState']
}

export interface ScenarioRunOptions {
  releaseDate: IsoDate
  template?: Template
  /** Stop after this date. Default: 70 working days after the release (end of follow-up). */
  until?: IsoDate
  /** Snapshot every n working days (default 5, i.e. weekly). */
  snapshotEveryWorkdays?: number
  /** Wall-clock time stamped on events. */
  recordedAt: string
  newId?: () => string
  publicationId?: string
  workingTitle?: string
}

export interface ScenarioRun {
  publication: Publication
  history: History
  snapshots: ScenarioSnapshot[]
  state: SimulationState
}

export function runScenario(scenario: Scenario, options: ScenarioRunOptions): ScenarioRun {
  let n = 0
  const newId = options.newId ?? (() => `${scenario.id}-${++n}`)
  const { publication: initial } = generatePlan({
    id: options.publicationId ?? scenario.id,
    workingTitle: options.workingTitle ?? scenario.name,
    template: options.template ?? MASTERPLAN_V1,
    desiredReleaseDate: options.releaseDate,
    ...(scenario.skipOptional ? { skipOptional: scenario.skipOptional } : {}),
  })
  const cal = getCalendar(initial.calendar)
  const kickoff = initial.kickoffDate
  const resolve = (r: RelativeDate): IsoDate =>
    cal.addWorkdays(r.from === 'kickoff' ? kickoff : options.releaseDate, r.workdays)
  const until = options.until ?? cal.addWorkdays(options.releaseDate, 70)
  const every = options.snapshotEveryWorkdays ?? 5

  const script = scenario.events.map((e) => ({ on: resolve(e.at), action: e.action }))
  let pub = initial
  let history = emptyHistory
  let state: SimulationState = {}
  const snapshots: ScenarioSnapshot[] = []
  const apply = (r: CommandResult) => {
    pub = r.publication
    history = record(history, r.events)
  }

  let workday = 0
  for (let d = kickoff; d <= until; d = addDays(d, 1)) {
    if (!cal.isWorkingDay(d)) continue
    const ctx: CommandContext = { asOf: d, recordedAt: options.recordedAt, by: 'scenario', newId }
    for (const e of script.filter((x) => x.on === d)) apply(runAction(pub, e.action, ctx, resolve))

    const r = simulateProgress(pub, {
      from: d,
      to: d,
      policy: scenario.policy,
      seed: scenario.seed,
      replan: scenario.replan ?? true,
      recordedAt: options.recordedAt,
      newId,
      state,
    })
    apply(r)
    state = r.state

    if (workday % every === 0 || d === cal.previousWorkingDay(until)) {
      snapshots.push(snapshot(pub, d))
    }
    workday++
  }
  return { publication: pub, history, snapshots, state }
}

function runAction(
  pub: Publication,
  action: ScenarioAction,
  ctx: CommandContext,
  resolve: (r: RelativeDate) => IsoDate,
): CommandResult {
  switch (action.kind) {
    case 'reschedule':
      return reschedule(pub, action.change, action.options, ctx, {
        acceptConflicts: true,
        reason: action.reason ?? 'Scenarie',
        ...(action.reasonCategory ? { reasonCategory: action.reasonCategory } : {}),
      })
    case 'set_status':
      return setStatus(pub, action.activityId, action.status, ctx, {
        ...(action.waitingFor ? { waitingFor: action.waitingFor } : {}),
      })
    case 'pause':
      return pause(pub, ctx, {
        reason: action.reason,
        ...(action.reasonCategory ? { reasonCategory: action.reasonCategory } : {}),
      })
    case 'resume': {
      const mode: ResumeMode =
        action.mode.kind === 'shift'
          ? { kind: 'shift' }
          : { kind: 'new_release', releaseDate: resolve(action.mode.release) }
      return resume(pub, ctx, { mode, acceptConflicts: true })
    }
    case 'change_release':
      return changeReleaseDate(pub, resolve(action.release), ctx, {
        reason: action.reason,
        acceptConflicts: true,
      })
  }
}

function snapshot(pub: Publication, date: IsoDate): ScenarioSnapshot {
  const h = assessHealth(pub, date)
  return {
    date,
    target: h.release.target,
    forecastRelease: h.release.forecast,
    releaseSlipWorkdays: h.release.slipWorkdays,
    done: h.overall.done,
    total: h.overall.total,
    late: h.overall.late,
    atRisk: h.overall.atRisk,
    waiting: h.overall.waiting,
    lifecycle: pub.lifecycle,
    planState: pub.planState,
  }
}
