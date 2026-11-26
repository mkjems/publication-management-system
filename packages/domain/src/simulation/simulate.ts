/**
 * Progress simulation (PLAN §4.3): plays the team's work forward day by day. Every change goes
 * through the normal commands, so history, health and undo behave exactly as with real use.
 *
 * Deterministic: random draws depend only on (seed, activity id, day), never on call order. The
 * only memory is when each started task is expected to finish (`state`); pass the returned state
 * back in to continue a run, and simulating A→C gives the same result as A→B then B→C.
 */
import { addDays } from '../calendar/dates'
import { getCalendar, type WorkCalendar } from '../calendar/calendar'
import { reschedule, setStatus } from '../commands/commands'
import type { CommandContext } from '../commands/context'
import type { CommandResult } from '../commands/transaction'
import type { IsoDate } from '../model/common'
import type { ChangeEvent, ReasonCategory } from '../model/events'
import { openPause, type Activity, type Publication } from '../model/publication'
import type { RoleId } from '../model/roles'
import { topologicalOrder } from '../engine/graph'
import { rngFor } from './random'

export type SimulationPolicy =
  /** Everything starts and finishes exactly as planned (when its predecessors allow). */
  | { kind: 'on_plan' }
  /** Some tasks overrun, mostly long ones and those that depend on authors, images or print. */
  | { kind: 'realistic' }
  /** Fixed overruns in working days for some tasks; everything else follows `base`. */
  | { kind: 'custom'; delays: Record<string, number>; base?: 'on_plan' | 'realistic' }

/** Expected finish date of each started task, fixed when it starts. */
export type SimulationState = Record<string, IsoDate>

export interface SimulateOptions {
  /** First and last day to simulate, inclusive. */
  from: IsoDate
  to: IsoDate
  policy: SimulationPolicy
  seed: number
  /**
   * When a task runs past its deadline, the project lead postpones it to the expected finish
   * (absorb strategy). This creates a realistic change history. Default true.
   */
  replan?: boolean
  /** Wall-clock time to stamp on events. */
  recordedAt: string
  newId: () => string
  /** Recorded as the author of simulated changes. Default "simulation". */
  by?: string | null
  /** State from a previous run, to continue it. */
  state?: SimulationState
}

export interface SimulationResult {
  publication: Publication
  events: ChangeEvent[]
  state: SimulationState
}

const SLOW_ROLES: RoleId[] = ['author', 'picture-editor', 'photographer', 'printer']

/** Working days a task overruns its duration under a policy. */
export function taskOverrun(policy: SimulationPolicy, seed: number, a: Activity): number {
  if (policy.kind === 'custom' && policy.delays[a.id] !== undefined) return policy.delays[a.id]!
  const kind = policy.kind === 'custom' ? (policy.base ?? 'on_plan') : policy.kind
  if (kind === 'on_plan') return 0
  const rng = rngFor(seed, `overrun:${a.id}`)
  const slow = a.responsible.roles.some((r) => SLOW_ROLES.includes(r)) ? 1.5 : 1
  const p = Math.min(0.8, (0.15 + a.durationWorkdays / 50) * slow)
  if (rng() >= p) return 0
  return Math.max(1, Math.round(a.durationWorkdays * (0.1 + 0.4 * rng()) * slow))
}

/** Chance that a deadline or milestone that is ready slips by another day. */
function pointSlipChance(policy: SimulationPolicy): number {
  const kind = policy.kind === 'custom' ? (policy.base ?? 'on_plan') : policy.kind
  return kind === 'realistic' ? 0.15 : 0
}

export function reasonCategoryFor(a: Activity): ReasonCategory {
  const role = a.responsible.roles[0]
  switch (role) {
    case 'author':
      return 'author'
    case 'editor':
    case 'proofreader':
    case 'indexer':
      return 'editorial'
    case 'picture-editor':
    case 'photographer':
      return 'images_rights'
    case 'designer':
    case 'repro':
      return 'design'
    case 'printer':
    case 'warehouse':
      return 'printer'
    default:
      return 'other'
  }
}

export function simulateProgress(pub: Publication, options: SimulateOptions): SimulationResult {
  const cal = getCalendar(pub.calendar)
  const topo = topologicalOrder(pub.activities)
  if (!topo.ok) throw new Error(`Dependency cycle: ${topo.cycle.join(' → ')}`)
  const replan = options.replan ?? true
  const events: ChangeEvent[] = []
  const state: SimulationState = { ...options.state }
  let current = pub
  let byId = new Map(current.activities.map((a) => [a.id, a]))

  const apply = (r: CommandResult) => {
    if (!r.events.length) return
    current = r.publication
    byId = new Map(current.activities.map((a) => [a.id, a]))
    events.push(...r.events)
  }

  for (let d = options.from; d <= options.to; d = addDays(d, 1)) {
    if (!cal.isWorkingDay(d) || openPause(current)) continue
    const ctx: CommandContext = {
      asOf: d,
      recordedAt: options.recordedAt,
      by: options.by === undefined ? 'simulation' : options.by,
      newId: options.newId,
    }
    const today = cal.ordinal(d)
    const view = new ProgressView(cal, () => byId)

    for (const id of topo.order) {
      let a = byId.get(id)!
      if (a.status === 'done' || a.status === 'skipped') continue

      if (a.status === 'waiting') {
        const until = a.waitingFor?.expectedDate
        if (!until || until > d) continue
        apply(setStatus(current, id, a.actualStart ? 'in_progress' : 'not_started', ctx))
        a = byId.get(id)!
      }

      if (a.kind !== 'task') {
        if (d < a.deadline || !view.pointReady(a, today)) continue
        if (rngFor(options.seed, `point:${a.id}:${d}`)() < pointSlipChance(options.policy)) continue
        apply(setStatus(current, id, 'done', ctx))
        continue
      }

      if (a.actualStart === null) {
        if (d < a.start! || !view.canStart(a, today - 1)) continue
        apply(setStatus(current, id, 'in_progress', ctx))
        a = byId.get(id)!
      }

      // Fixed when the work starts, so later replanning (which stretches the task) does not
      // change how long the work really takes.
      state[id] ??= cal.dateOf(
        cal.startBoundary(a.actualStart!) +
          a.durationWorkdays +
          taskOverrun(options.policy, options.seed, a),
      )
      const expectedFinish = cal.ordinal(state[id])
      if (today >= expectedFinish && view.canFinish(a, today)) {
        apply(setStatus(current, id, 'done', ctx))
        delete state[id]
        continue
      }
      // The deadline has passed and the work is not done: the project lead postpones it.
      if (replan && today > cal.ordinal(a.deadline) && expectedFinish > cal.ordinal(a.deadline)) {
        apply(
          reschedule(
            current,
            { kind: 'set_deadline', activityId: id, deadline: cal.dateOf(expectedFinish) },
            { strategy: 'absorb' },
            ctx,
            { reasonCategory: reasonCategoryFor(a), acceptConflicts: true },
          ),
        )
      }
    }
  }

  return { publication: current, events, state }
}

/** Answers "has this predecessor finished / started yet?" from actual dates. */
class ProgressView {
  constructor(
    private readonly cal: WorkCalendar,
    private readonly acts: () => Map<string, Activity>,
  ) {}

  /** Actual finish position, looking through skipped activities; null if not finished. */
  finish(id: string): number | null {
    const a = this.acts().get(id)!
    if (a.status === 'done') return this.cal.ordinal(a.actualFinish!)
    if (a.status !== 'skipped') return null
    let finish = -Infinity
    for (const d of a.predecessors) {
      const p = d.type === 'SS' ? this.start(d.activityId) : this.finish(d.activityId)
      if (p === null) return null
      finish = Math.max(finish, p + d.lagWorkdays)
    }
    return finish
  }

  /** Actual start position; null if not started. */
  start(id: string): number | null {
    const a = this.acts().get(id)!
    if (a.actualStart) return this.cal.startBoundary(a.actualStart)
    if (a.status === 'done') return this.cal.ordinal(a.actualFinish!) - a.durationWorkdays
    if (a.status === 'skipped') return this.finish(id)
    return null
  }

  /** Whether a task may start at axis position `at` (end of the previous day). */
  canStart(a: Activity, at: number): boolean {
    return a.predecessors.every((d) => {
      if (d.type === 'FF') return true
      const p = d.type === 'SS' ? this.start(d.activityId) : this.finish(d.activityId)
      return p !== null && p + d.lagWorkdays <= at
    })
  }

  canFinish(a: Activity, at: number): boolean {
    return a.predecessors.every((d) => {
      if (d.type !== 'FF') return true
      const p = this.finish(d.activityId)
      return p !== null && p + d.lagWorkdays <= at
    })
  }

  pointReady(a: Activity, at: number): boolean {
    return a.predecessors.every((d) => {
      const p = d.type === 'SS' ? this.start(d.activityId) : this.finish(d.activityId)
      return p !== null && p + d.lagWorkdays <= at
    })
  }
}
