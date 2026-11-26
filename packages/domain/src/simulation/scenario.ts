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
import { updateFundingApplication } from '../commands/funding'
import { emptyHistory, record, type History } from '../commands/history'
import type { CommandResult } from '../commands/transaction'
import { generatePlan } from '../engine/generate'
import { assessHealth } from '../engine/health'
import type { RescheduleOptions, ScheduleChange } from '../engine/reschedule'
import type { ActivityStatus, IsoDate } from '../model/common'
import type { ReasonCategory } from '../model/events'
import type { FundingApplication, Publication, WaitingFor } from '../model/publication'
import type { RoleId } from '../model/roles'
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
  /** Funding story: applications are submitted and decided on the given dates. */
  funding?: ScenarioFunding
  events: { at: RelativeDate; action: ScenarioAction }[]
}

export interface ScenarioFunding {
  /** DKK. */
  minimumRequired: number
  applications: {
    funder: string
    amount: number
    submit: RelativeDate
    /** When the decision is expected (shown while waiting). Default: `decision`. */
    expectedDecision?: RelativeDate
    decision: RelativeDate
    outcome: 'granted' | 'rejected'
  }[]
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
  projectLeadId?: string | null
  roleAssignments?: Partial<Record<RoleId, string[]>>
}

/** A scripted action with absolute dates, ready to run. */
export type ScriptAction =
  | Exclude<ScenarioAction, { kind: 'resume' } | { kind: 'change_release' }>
  | { kind: 'resume'; mode: ResumeMode }
  | { kind: 'change_release'; releaseDate: IsoDate; reason: string }
  | {
      kind: 'funding'
      applicationId: string
      status: 'submitted' | 'granted' | 'rejected'
      expectedDecisionAt?: IsoDate
    }

/** Everything needed to keep playing a book forward in time. */
export interface SimulationSetup {
  policy: SimulationPolicy
  seed: number
  replan: boolean
  /** Scripted events that have not happened yet. */
  script: { on: IsoDate; action: ScriptAction }[]
  state: SimulationState
}

export interface SimulatedBook {
  publication: Publication
  history: History
  simulation: SimulationSetup
}

export interface ScenarioRun extends SimulatedBook {
  snapshots: ScenarioSnapshot[]
}

export function runScenario(scenario: Scenario, options: ScenarioRunOptions): ScenarioRun {
  let n = 0
  const newId = options.newId ?? (() => `${scenario.id}-${++n}`)
  const generated = generatePlan({
    id: options.publicationId ?? scenario.id,
    workingTitle: options.workingTitle ?? scenario.name,
    template: options.template ?? MASTERPLAN_V1,
    desiredReleaseDate: options.releaseDate,
    projectLeadId: options.projectLeadId ?? null,
    ...(options.roleAssignments ? { roleAssignments: options.roleAssignments } : {}),
    ...(scenario.skipOptional ? { skipOptional: scenario.skipOptional } : {}),
  }).publication
  const cal = getCalendar(generated.calendar)
  const resolve = (r: RelativeDate): IsoDate =>
    cal.addWorkdays(r.from === 'kickoff' ? generated.kickoffDate : options.releaseDate, r.workdays)
  const funding = fundingSetup(scenario, generated.id, resolve)
  const publication: Publication = funding
    ? {
        ...generated,
        funding: {
          ...generated.funding,
          minimumRequired: funding.minimumRequired,
          applications: funding.applications,
        },
      }
    : generated
  const until = options.until ?? cal.addWorkdays(options.releaseDate, 70)
  const every = options.snapshotEveryWorkdays ?? 5

  const start: SimulatedBook = {
    publication,
    history: emptyHistory,
    simulation: {
      policy: scenario.policy,
      seed: scenario.seed,
      replan: scenario.replan ?? true,
      script: [
        ...scenario.events.map((e) => ({
          on: resolve(e.at),
          action: resolveAction(e.action, resolve),
        })),
        ...(funding?.script ?? []),
      ].sort((a, b) => a.on.localeCompare(b.on)),
      state: {},
    },
  }
  const snapshots: ScenarioSnapshot[] = []
  let workday = 0
  const lastDay = cal.previousWorkingDay(until)
  const book = advanceSimulation(start, {
    from: publication.kickoffDate,
    to: until,
    recordedAt: options.recordedAt,
    newId,
    by: 'scenario',
    onDay: (pub, d) => {
      if (workday % every === 0 || d === lastDay) snapshots.push(snapshot(pub, d))
      workday++
    },
  })
  return { ...book, snapshots }
}

/** Initial (planned) applications and the scripted submissions and decisions. */
function fundingSetup(
  scenario: Scenario,
  publicationId: string,
  resolve: (r: RelativeDate) => IsoDate,
) {
  if (!scenario.funding) return null
  const applications: FundingApplication[] = []
  const script: { on: IsoDate; action: ScriptAction }[] = []
  scenario.funding.applications.forEach((a, i) => {
    const id = `${publicationId}-funding-${i + 1}`
    applications.push({
      id,
      funder: a.funder,
      amount: a.amount,
      status: 'planned',
      submittedAt: null,
      expectedDecisionAt: null,
      decidedAt: null,
      conditions: '',
    })
    script.push(
      {
        on: resolve(a.submit),
        action: {
          kind: 'funding',
          applicationId: id,
          status: 'submitted',
          expectedDecisionAt: resolve(a.expectedDecision ?? a.decision),
        },
      },
      {
        on: resolve(a.decision),
        action: { kind: 'funding', applicationId: id, status: a.outcome },
      },
    )
  })
  return { minimumRequired: scenario.funding.minimumRequired, applications, script }
}

function resolveAction(
  action: ScenarioAction,
  resolve: (r: RelativeDate) => IsoDate,
): ScriptAction {
  switch (action.kind) {
    case 'resume':
      return {
        kind: 'resume',
        mode:
          action.mode.kind === 'shift'
            ? { kind: 'shift' }
            : { kind: 'new_release', releaseDate: resolve(action.mode.release) },
      }
    case 'change_release':
      return { kind: 'change_release', releaseDate: resolve(action.release), reason: action.reason }
    default:
      return action
  }
}

export interface AdvanceOptions {
  /** First and last day to play, inclusive. */
  from: IsoDate
  to: IsoDate
  recordedAt: string
  newId: () => string
  /** Author of scripted and simulated changes. Default "simulation". */
  by?: string
  /** Called after each working day has been played. */
  onDay?: (publication: Publication, date: IsoDate) => void
}

/**
 * Plays a book forward day by day: scripted events first, then simulated progress. Simulated
 * changes are logged but not undoable (time has moved on).
 */
export function advanceSimulation(book: SimulatedBook, options: AdvanceOptions): SimulatedBook {
  const cal = getCalendar(book.publication.calendar)
  const by = options.by ?? 'simulation'
  let pub = book.publication
  let history = book.history
  let state = book.simulation.state
  const apply = (r: CommandResult) => {
    pub = r.publication
    history = record(history, r.events, { undoable: false })
  }

  for (let d = options.from; d <= options.to; d = addDays(d, 1)) {
    if (!cal.isWorkingDay(d)) continue
    const ctx: CommandContext = {
      asOf: d,
      recordedAt: options.recordedAt,
      by,
      newId: options.newId,
    }
    for (const e of book.simulation.script) {
      if (e.on === d) apply(runAction(pub, e.action, ctx))
    }
    const r = simulateProgress(pub, {
      from: d,
      to: d,
      policy: book.simulation.policy,
      seed: book.simulation.seed,
      replan: book.simulation.replan,
      recordedAt: options.recordedAt,
      newId: options.newId,
      by,
      state,
    })
    apply(r)
    state = r.state
    options.onDay?.(pub, d)
  }
  return {
    publication: pub,
    history,
    simulation: {
      ...book.simulation,
      script: book.simulation.script.filter((e) => e.on > options.to),
      state,
    },
  }
}

function runAction(pub: Publication, action: ScriptAction, ctx: CommandContext): CommandResult {
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
    case 'resume':
      return resume(pub, ctx, { mode: action.mode, acceptConflicts: true })
    case 'change_release':
      return changeReleaseDate(pub, action.releaseDate, ctx, {
        reason: action.reason,
        acceptConflicts: true,
      })
    case 'funding':
      return updateFundingApplication(
        pub,
        action.applicationId,
        {
          status: action.status,
          ...(action.expectedDecisionAt ? { expectedDecisionAt: action.expectedDecisionAt } : {}),
        },
        ctx,
      )
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
