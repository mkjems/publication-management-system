/**
 * Commands: every change to a publication goes through one of these (PLAN §4.2). Each returns
 * the new publication and the events that describe the change. Commands are pure; the caller
 * stores the result and records the events in its history.
 */
import { getCalendar } from '../calendar/calendar'
import type { Dependency, IsoDate, ActivityStatus } from '../model/common'
import {
  findActivity,
  openPause,
  releaseActivity,
  targetReleaseDate,
  type Activity,
  type Baseline,
  type Lifecycle,
  type Publication,
  type WaitingFor,
} from '../model/publication'
import { topologicalOrder } from '../engine/graph'
import {
  previewReschedule,
  shiftPlan,
  type Impact,
  type PinnedConflict,
  type RescheduleOptions,
  type ScheduleChange,
} from '../engine/reschedule'
import type { CommandContext } from './context'
import { Transaction, type ChangeMeta, type CommandResult } from './transaction'

export class CommandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CommandError'
  }
}

// ── Rescheduling ────────────────────────────────────────────────────────────────

export interface RescheduleMeta extends ChangeMeta {
  /** Apply even though pinned activities would be in conflict. */
  acceptConflicts?: boolean
}

/** Applies a reschedule. Same inputs as `previewReschedule`; the impact is returned too. */
export function reschedule(
  pub: Publication,
  change: ScheduleChange,
  options: RescheduleOptions,
  ctx: CommandContext,
  meta: RescheduleMeta = {},
): CommandResult & { impact: Impact } {
  const impact = previewReschedule(pub, change, options)
  assertNoConflicts(impact.pinnedConflicts, meta)
  const releaseMoves = impact.release.newTarget !== impact.release.target
  if (releaseMoves && pub.planState === 'binding' && !meta.reason) {
    throw new CommandError('A reason is required to move a binding release date')
  }

  const tx = new Transaction(ctx, pub)
  tx.record(
    'activity_rescheduled',
    { ...pub, activities: impact.publication.activities },
    {
      activityId: change.activityId,
      change,
      strategy: options.strategy,
      moved: impact.moved.map((m) => ({
        activityId: m.activityId,
        deltaWorkdays: m.deltaWorkdays,
        cause: m.cause,
      })),
      release: { before: impact.release.before, after: impact.release.after },
    },
    meta,
  )
  if (releaseMoves) releaseTargetStep(tx, impact.release.newTarget, meta)
  return { ...tx.result(), impact }
}

/**
 * Moves the release date and shifts all remaining work with it (replan backwards). Work that is
 * already overdue stays where it is, so lateness is not hidden.
 */
export function changeReleaseDate(
  pub: Publication,
  releaseDate: IsoDate,
  ctx: CommandContext,
  meta: RescheduleMeta = {},
): CommandResult & { pinnedConflicts: PinnedConflict[] } {
  const cal = getCalendar(pub.calendar)
  const release = releaseActivity(pub)
  if (!release) throw new CommandError('The plan has no release milestone')
  if (pub.planState === 'binding' && !meta.reason) {
    throw new CommandError('A reason is required to move a binding release date')
  }
  const delta = cal.ordinal(releaseDate) - cal.ordinal(release.deadline)
  const shifted = shiftPlan(pub, { deltaWorkdays: delta, from: ctx.asOf, notBefore: ctx.asOf })
  assertNoConflicts(shifted.pinnedConflicts, meta)

  const tx = new Transaction(ctx, pub)
  tx.record(
    'activity_rescheduled',
    shifted.publication,
    { reason: 'release_date_changed', deltaWorkdays: delta, moved: shifted.moved.length },
    meta,
  )
  releaseTargetStep(tx, cal.previousWorkingDay(releaseDate), meta)
  return { ...tx.result(), pinnedConflicts: shifted.pinnedConflicts }
}

function assertNoConflicts(conflicts: PinnedConflict[], meta: RescheduleMeta) {
  if (conflicts.length && !meta.acceptConflicts) {
    throw new CommandError(
      `Pinned activities would be in conflict: ${conflicts.map((c) => c.activityId).join(', ')}`,
    )
  }
}

function releaseTargetStep(tx: Transaction, releaseDate: IsoDate, meta: ChangeMeta) {
  const pub = tx.publication
  const from = targetReleaseDate(pub)
  if (from === releaseDate) return
  const field = pub.planState === 'binding' ? 'bindingReleaseDate' : 'desiredReleaseDate'
  tx.record(
    'release_date_changed',
    { ...pub, [field]: releaseDate },
    { field, from, to: releaseDate },
    meta,
  )
  if (pub.planState === 'binding') rebaselineStep(tx, meta.reason ?? '')
}

// ── Status and gates ────────────────────────────────────────────────────────────

export interface SetStatusOptions {
  /** Date of the actual start or finish. Defaults to `ctx.asOf`. */
  on?: IsoDate
  /** Required for "waiting". */
  waitingFor?: WaitingFor
}

/**
 * Changes an activity's status and records actual dates. Completing a gate milestone has
 * effects in the same transaction: GO moves the lifecycle on, _Finansiering tilstrækkelig_
 * makes the plan binding, _Udgivelse_ marks the book released.
 */
export function setStatus(
  pub: Publication,
  activityId: string,
  status: ActivityStatus,
  ctx: CommandContext,
  options: SetStatusOptions = {},
): CommandResult {
  const a = findActivity(pub, activityId)
  const on = options.on ?? ctx.asOf
  if (a.status === status && status !== 'waiting') return { publication: pub, events: [] }

  let next: Activity
  switch (status) {
    case 'not_started':
      next = { ...a, status, actualStart: null, actualFinish: null, waitingFor: null }
      break
    case 'in_progress':
      next = {
        ...a,
        status,
        actualStart: a.actualStart ?? on,
        actualFinish: null,
        waitingFor: null,
      }
      break
    case 'waiting':
      if (!options.waitingFor) throw new CommandError('"waiting" needs a waitingFor')
      next = { ...a, status, actualFinish: null, waitingFor: options.waitingFor }
      break
    case 'done':
      if (a.actualStart && a.actualStart > on) {
        throw new CommandError('An activity cannot finish before it started')
      }
      next = { ...a, status, actualFinish: on, waitingFor: null }
      break
    case 'skipped':
      if (!a.optional) throw new CommandError('Only optional activities can be skipped')
      next = { ...a, status, actualStart: null, actualFinish: null, waitingFor: null }
      break
  }

  let after = replaceActivity(pub, next)
  const lifecycle = status === 'done' ? lifecycleAfterGate(pub.lifecycle, a) : pub.lifecycle
  if (lifecycle !== pub.lifecycle) after = { ...after, lifecycle }

  const tx = new Transaction(ctx, pub)
  tx.record('status_changed', after, {
    activityId,
    from: a.status,
    to: status,
    on,
    ...(lifecycle !== pub.lifecycle ? { lifecycle: { from: pub.lifecycle, to: lifecycle } } : {}),
  })
  if (status === 'done' && a.gate === 'funding_secured' && pub.planState === 'preliminary') {
    makeBindingStep(tx, a.name)
  }
  return tx.result()
}

function lifecycleAfterGate(current: Lifecycle, a: Activity): Lifecycle {
  if (current === 'paused') return current
  switch (a.gate) {
    case 'go_hold_nogo':
      return current === 'idea' || current === 'hold' ? 'go' : current
    case 'production_start':
      return current === 'idea' || current === 'go' ? 'active' : current
    case 'release':
      return current === 'closed' ? current : 'released'
    default:
      return current
  }
}

/** The lifecycle implied by which gates are done (used when resuming after a pause). */
function lifecycleFromGates(pub: Publication): Lifecycle {
  const done = (gate: Activity['gate']) =>
    pub.activities.some((a) => a.gate === gate && a.status === 'done')
  if (done('release')) return 'released'
  if (done('production_start')) return 'active'
  if (done('go_hold_nogo')) return 'go'
  return 'idea'
}

// ── Binding plan and baselines ──────────────────────────────────────────────────

/**
 * Makes the plan binding: the release date becomes binding and the current plan is captured as
 * baseline 0 (_Oprindelig deadline_).
 */
export function makeBinding(
  pub: Publication,
  ctx: CommandContext,
  meta: ChangeMeta = {},
): CommandResult {
  const tx = new Transaction(ctx, pub)
  makeBindingStep(tx, meta.reason ?? '', meta)
  return tx.result()
}

function makeBindingStep(tx: Transaction, reason: string, meta: ChangeMeta = {}) {
  const pub = tx.publication
  if (pub.planState === 'binding') throw new CommandError('The plan is already binding')
  const bindingReleaseDate = releaseActivity(pub)?.deadline ?? pub.desiredReleaseDate
  const baseline = snapshot(pub, tx.context.asOf, reason, bindingReleaseDate)
  tx.record(
    'plan_made_binding',
    {
      ...pub,
      planState: 'binding',
      bindingReleaseDate,
      baselines: [...pub.baselines, baseline],
    },
    { bindingReleaseDate, baseline: baseline.number },
    { ...meta, reason },
  )
}

/** Captures the current plan as a new baseline. Earlier baselines are kept. */
export function rebaseline(pub: Publication, ctx: CommandContext, reason: string): CommandResult {
  if (pub.planState !== 'binding') throw new CommandError('Only a binding plan has baselines')
  const tx = new Transaction(ctx, pub)
  rebaselineStep(tx, reason)
  return tx.result()
}

function rebaselineStep(tx: Transaction, reason: string) {
  const pub = tx.publication
  const baseline = snapshot(pub, tx.context.asOf, reason, targetReleaseDate(pub))
  tx.record(
    'rebaselined',
    { ...pub, baselines: [...pub.baselines, baseline] },
    { baseline: baseline.number },
    { reason },
  )
}

function snapshot(pub: Publication, on: IsoDate, reason: string, releaseDate: IsoDate): Baseline {
  return {
    number: pub.baselines.length ? Math.max(...pub.baselines.map((b) => b.number)) + 1 : 0,
    capturedOn: on,
    reason,
    releaseDate,
    activities: Object.fromEntries(
      pub.activities.map((a) => [a.id, { start: a.start, deadline: a.deadline }]),
    ),
  }
}

// ── Pause and resume ────────────────────────────────────────────────────────────

export function pause(
  pub: Publication,
  ctx: CommandContext,
  options: { reason: string; from?: IsoDate } & ChangeMeta,
): CommandResult {
  if (openPause(pub)) throw new CommandError('The publication is already paused')
  if (['released', 'closed', 'no_go'].includes(pub.lifecycle)) {
    throw new CommandError(`A ${pub.lifecycle} publication cannot be paused`)
  }
  const from = options.from ?? ctx.asOf
  const tx = new Transaction(ctx, pub)
  tx.record(
    'paused',
    {
      ...pub,
      lifecycle: 'paused',
      pauses: [...pub.pauses, { from, to: null, reason: options.reason }],
    },
    { from },
    {
      reason: options.reason,
      ...(options.reasonCategory ? { reasonCategory: options.reasonCategory } : {}),
    },
  )
  return tx.result()
}

export type ResumeMode =
  /** Shift all unfinished work by the length of the pause. The release moves with it. */
  | { kind: 'shift' }
  /** Replan the unfinished work backwards from a new release date. */
  | { kind: 'new_release'; releaseDate: IsoDate }

/**
 * Ends the pause. Unfinished work planned from the pause start onwards is shifted; nothing that
 * has not started may start before the resume date.
 */
export function resume(
  pub: Publication,
  ctx: CommandContext,
  options: { mode: ResumeMode; on?: IsoDate } & RescheduleMeta,
): CommandResult & { pinnedConflicts: PinnedConflict[] } {
  const current = openPause(pub)
  if (!current) throw new CommandError('The publication is not paused')
  const on = options.on ?? ctx.asOf
  if (on < current.from) throw new CommandError('Cannot resume before the pause started')
  const cal = getCalendar(pub.calendar)
  const release = releaseActivity(pub)

  const delta =
    options.mode.kind === 'shift'
      ? cal.workdaysBetween(current.from, on)
      : release
        ? cal.ordinal(options.mode.releaseDate) - cal.ordinal(release.deadline)
        : 0
  const shifted = shiftPlan(pub, { deltaWorkdays: delta, from: current.from, notBefore: on })
  assertNoConflicts(shifted.pinnedConflicts, options)

  const meta: ChangeMeta = {
    reason: options.reason ?? current.reason,
    ...(options.reasonCategory ? { reasonCategory: options.reasonCategory } : {}),
  }
  const tx = new Transaction(ctx, pub)
  tx.record(
    'resumed',
    {
      ...shifted.publication,
      lifecycle: lifecycleFromGates(pub),
      pauses: pub.pauses.map((p) => (p === current ? { ...p, to: on } : p)),
    },
    {
      from: current.from,
      to: on,
      mode: options.mode.kind,
      deltaWorkdays: delta,
      moved: shifted.moved.length,
    },
    meta,
  )
  const newRelease =
    options.mode.kind === 'new_release'
      ? cal.previousWorkingDay(options.mode.releaseDate)
      : release
        ? tx.publication.activities.find((a) => a.id === release.id)!.deadline
        : null
  if (newRelease) releaseTargetStep(tx, newRelease, meta)
  return { ...tx.result(), pinnedConflicts: shifted.pinnedConflicts }
}

// ── Activity edits ──────────────────────────────────────────────────────────────

export function setPinned(
  pub: Publication,
  activityId: string,
  pinned: boolean,
  ctx: CommandContext,
): CommandResult {
  const a = findActivity(pub, activityId)
  const tx = new Transaction(ctx, pub)
  tx.record('pinned_changed', replaceActivity(pub, { ...a, pinned }), { activityId, pinned })
  return tx.result()
}

export function updateActivity(
  pub: Publication,
  activityId: string,
  changes: Partial<Pick<Activity, 'name' | 'note' | 'assigneeIds'>>,
  ctx: CommandContext,
): CommandResult {
  const a = findActivity(pub, activityId)
  const tx = new Transaction(ctx, pub)
  tx.record('activity_updated', replaceActivity(pub, { ...a, ...changes }), {
    activityId,
    fields: Object.keys(changes),
  })
  return tx.result()
}

/**
 * Adds a dependency. Rejects unknown activities, duplicates and cycles (naming the cycle). The
 * dates are not changed; the forecast shows the effect, and the user can reschedule.
 */
export function addDependency(
  pub: Publication,
  activityId: string,
  dependency: Dependency,
  ctx: CommandContext,
): CommandResult {
  const a = findActivity(pub, activityId)
  findActivity(pub, dependency.activityId)
  if (dependency.activityId === activityId)
    throw new CommandError('An activity cannot depend on itself')
  if (a.predecessors.some((d) => d.activityId === dependency.activityId)) {
    throw new CommandError('The dependency already exists')
  }
  const next = replaceActivity(pub, { ...a, predecessors: [...a.predecessors, dependency] })
  const topo = topologicalOrder(next.activities)
  if (!topo.ok) {
    const names = topo.cycle.map((id) => findActivity(pub, id).name)
    throw new CommandError(`The dependency would create a cycle: ${names.join(' → ')}`)
  }
  const tx = new Transaction(ctx, pub)
  tx.record('dependency_added', next, { activityId, dependency })
  return tx.result()
}

export function removeDependency(
  pub: Publication,
  activityId: string,
  predecessorId: string,
  ctx: CommandContext,
): CommandResult {
  const a = findActivity(pub, activityId)
  const dependency = a.predecessors.find((d) => d.activityId === predecessorId)
  if (!dependency) throw new CommandError('No such dependency')
  const tx = new Transaction(ctx, pub)
  tx.record(
    'dependency_removed',
    replaceActivity(pub, {
      ...a,
      predecessors: a.predecessors.filter((d) => d.activityId !== predecessorId),
    }),
    { activityId, dependency },
  )
  return tx.result()
}

function replaceActivity(pub: Publication, next: Activity): Publication {
  return { ...pub, activities: pub.activities.map((a) => (a.id === next.id ? next : a)) }
}
