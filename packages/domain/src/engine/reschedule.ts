/**
 * Delay propagation with a preview (PLAN §4.1.3) and the resolution strategies (§4.1.4).
 *
 * `previewReschedule` never changes the input. It returns the resulting plan and what moved, so
 * the UI can show the impact before the user applies it (see `commands/reschedule.ts`).
 *
 * Rules shared by all strategies:
 * - Only activities downstream of the change move. Unrelated parts of the plan stay put, even if
 *   they already violate a dependency (e.g. a compressed plan from `generatePlan`).
 * - Done activities never move. Pinned activities never move; a required move is reported as a
 *   conflict instead.
 * - A task that has started keeps its actual start: moving its deadline changes its duration.
 * - "Absorb" moves are minimal and never pull work earlier.
 */
import { getCalendar, type WorkCalendar } from '../calendar/calendar'
import type { IsoDate } from '../model/common'
import {
  findActivity,
  releaseActivity,
  targetReleaseDate,
  type Activity,
  type Publication,
} from '../model/publication'
import { constrainsStart, earliestFinish, type Span } from './constraints'
import { descendants, successorMap, topologicalOrder } from './graph'
import { plannedSpan, withSpan } from './spans'

export type ScheduleChange =
  /** Move the deadline, keeping the duration (drag a bar). */
  | { kind: 'set_deadline'; activityId: string; deadline: IsoDate }
  /** Move the deadline by n working days, keeping the duration. */
  | { kind: 'delay'; activityId: string; workdays: number }
  /** Change the duration, keeping the start (resize a bar). Tasks only. */
  | { kind: 'set_duration'; activityId: string; durationWorkdays: number }
  /** Mark as waiting until a date; the work is moved to fit after it. */
  | { kind: 'wait'; activityId: string; until: IsoDate; text: string }

export type Strategy =
  /** Move only what must move; downstream slack takes the delay. */
  | 'absorb'
  /** Shift every downstream activity before the release by the same amount, keeping spacing. */
  | 'push'
  /** Shorten downstream tasks on the critical chain to protect the release date. */
  | 'compress'
  /** Let the release move, and make its new date the target. */
  | 'move_release'

export interface RescheduleOptions {
  strategy: Strategy
  /** compress: explicit new durations by activity id. Without it the engine picks. */
  compress?: Record<string, number>
  /** compress: the shortest a task may become, as a fraction of its duration (default 0.5). */
  minDurationFraction?: number
  /** move_release: an explicit new release date. Default: wherever the plan pushes it. */
  releaseDate?: IsoDate
}

export type MoveCause = 'change' | 'pushed' | 'shifted' | 'compressed'

export interface PlannedDates {
  start: IsoDate | null
  deadline: IsoDate
  durationWorkdays: number
}

export interface MovedActivity {
  activityId: string
  from: PlannedDates
  to: PlannedDates
  /** Working days the deadline moved (positive = later). */
  deltaWorkdays: number
  cause: MoveCause
}

export interface PinnedConflict {
  activityId: string
  pinnedDeadline: IsoDate
  /** Where the dependencies would put it. */
  requiredDeadline: IsoDate
}

export interface Impact {
  change: ScheduleChange
  options: RescheduleOptions
  /** The plan after the change. Not applied. */
  publication: Publication
  moved: MovedActivity[]
  /** Compressed tasks (also listed in `moved`). */
  compressed: { activityId: string; fromDuration: number; toDuration: number }[]
  pinnedConflicts: PinnedConflict[]
  release: {
    /** Target before the change. */
    target: IsoDate
    /** Target after the change (differs only with move_release). */
    newTarget: IsoDate
    before: IsoDate | null
    after: IsoDate | null
    /** Working days the release milestone ends up after the new target. */
    slipWorkdays: number | null
  }
}

export function previewReschedule(
  pub: Publication,
  change: ScheduleChange,
  options: RescheduleOptions,
): Impact {
  const cal = getCalendar(pub.calendar)
  const target = findActivity(pub, change.activityId)
  if (target.status === 'done' || target.status === 'skipped') {
    throw new Error(`Cannot reschedule a ${target.status} activity`)
  }
  const topo = topologicalOrder(pub.activities)
  if (!topo.ok) throw new Error(`Dependency cycle: ${topo.cycle.join(' → ')}`)

  const ctx = new Planner(cal, pub, topo.order)
  ctx.applyChange(change)

  const release = releaseActivity(pub)
  const afterRelease = release ? descendants(ctx.succ, [release.id]) : new Set<string>()

  if (options.strategy === 'push') {
    const delta = ctx.finish(target.id) - plannedSpan(cal, target).finish
    if (delta !== 0) {
      for (const id of ctx.downstream) {
        if (id === release?.id || afterRelease.has(id)) continue
        ctx.shift(id, delta)
      }
    }
  }

  if (options.strategy === 'compress') {
    ctx.compress(options, release, cal.ordinal(targetReleaseDate(pub)))
  } else {
    ctx.propagate()
  }

  let newTarget = targetReleaseDate(pub)
  if (options.strategy === 'move_release' && release) {
    if (options.releaseDate) {
      const wanted = cal.ordinal(options.releaseDate)
      if (wanted < ctx.finish(release.id)) {
        throw new Error(
          `The plan cannot reach the release by ${options.releaseDate}; earliest is ${cal.dateOf(ctx.finish(release.id))}`,
        )
      }
      ctx.moveTo(release.id, wanted, 'pushed')
      ctx.propagateFrom([release.id])
    }
    if (options.releaseDate || ctx.get(release.id).deadline !== release.deadline) {
      newTarget = ctx.get(release.id).deadline
    }
  }

  let next: Publication = { ...pub, activities: pub.activities.map((a) => ctx.get(a.id)) }
  if (newTarget !== targetReleaseDate(pub)) {
    next =
      pub.planState === 'binding'
        ? { ...next, bindingReleaseDate: newTarget }
        : { ...next, desiredReleaseDate: newTarget }
  }

  const moved = ctx.movedList()
  const releaseAfter = release ? ctx.get(release.id).deadline : null
  return {
    change,
    options,
    publication: next,
    moved,
    compressed: moved
      .filter((m) => m.from.durationWorkdays !== m.to.durationWorkdays && m.cause === 'compressed')
      .map((m) => ({
        activityId: m.activityId,
        fromDuration: m.from.durationWorkdays,
        toDuration: m.to.durationWorkdays,
      })),
    pinnedConflicts: ctx.conflictList(),
    release: {
      target: targetReleaseDate(pub),
      newTarget,
      before: release?.deadline ?? null,
      after: releaseAfter,
      slipWorkdays: releaseAfter ? cal.workdaysBetween(newTarget, releaseAfter) : null,
    },
  }
}

export interface ShiftOptions {
  /** Working days to move the remaining plan (negative = earlier). */
  deltaWorkdays: number
  /** Only open activities with a deadline on or after this date move. Default: all open work. */
  from?: IsoDate
  /** Work that has not started may not start before this date (e.g. the resume date). */
  notBefore?: IsoDate
}

export interface ShiftResult {
  /** The publication with shifted activities. Release targets are left to the caller. */
  publication: Publication
  moved: MovedActivity[]
  pinnedConflicts: PinnedConflict[]
}

/**
 * Shifts all remaining work by a number of working days, then repairs dependencies and the
 * `notBefore` limit with minimal moves. Used by resume after a pause and by release date changes.
 * Done, skipped and pinned activities stay where they are.
 */
export function shiftPlan(pub: Publication, options: ShiftOptions): ShiftResult {
  const cal = getCalendar(pub.calendar)
  const topo = topologicalOrder(pub.activities)
  if (!topo.ok) throw new Error(`Dependency cycle: ${topo.cycle.join(' → ')}`)
  const ctx = new Planner(cal, pub, topo.order)
  const shifted = pub.activities
    .filter(
      (a) =>
        a.status !== 'done' &&
        a.status !== 'skipped' &&
        !a.pinned &&
        (!options.from || a.deadline >= options.from),
    )
    .map((a) => a.id)
  for (const id of shifted) ctx.shift(id, options.deltaWorkdays)
  const scope = new Set([...shifted, ...descendants(ctx.succ, shifted)])
  ctx.propagateScope(scope, options.notBefore ? cal.startBoundary(options.notBefore) : undefined)
  return {
    publication: { ...pub, activities: pub.activities.map((a) => ctx.get(a.id)) },
    moved: ctx.movedList(),
    pinnedConflicts: ctx.conflictList(),
  }
}

function dates(a: Activity): PlannedDates {
  return { start: a.start, deadline: a.deadline, durationWorkdays: a.durationWorkdays }
}

/** Mutable working state for one preview. */
class Planner {
  readonly succ
  readonly causes = new Map<string, MoveCause>()
  readonly pinnedConflicts = new Map<string, number>()
  /** Activities downstream of the change (the only ones allowed to move). */
  downstream = new Set<string>()
  private readonly acts: Map<string, Activity>
  private changedId: string | null = null

  constructor(
    private readonly cal: WorkCalendar,
    private readonly pub: Publication,
    private readonly order: string[],
  ) {
    this.acts = new Map(pub.activities.map((a) => [a.id, a]))
    this.succ = successorMap(pub.activities)
  }

  get(id: string): Activity {
    return this.acts.get(id)!
  }

  finish(id: string): number {
    return plannedSpan(this.cal, this.get(id)).finish
  }

  applyChange(change: ScheduleChange) {
    const a = this.get(change.activityId)
    const span = plannedSpan(this.cal, a)
    this.changedId = a.id
    this.downstream = descendants(this.succ, [a.id])
    switch (change.kind) {
      case 'set_deadline':
        this.moveTo(a.id, this.cal.ordinal(change.deadline), 'change')
        break
      case 'delay':
        this.moveTo(a.id, span.finish + change.workdays, 'change')
        break
      case 'set_duration': {
        if (a.kind !== 'task') throw new Error('Only tasks have a duration')
        if (!Number.isInteger(change.durationWorkdays) || change.durationWorkdays < 1) {
          throw new Error('Duration must be a positive whole number of working days')
        }
        this.set(
          a.id,
          withSpan(this.cal, a, span.start + change.durationWorkdays, change.durationWorkdays),
          'change',
        )
        break
      }
      case 'wait': {
        const clears = this.cal.startBoundary(change.until)
        const need = clears + (a.actualStart !== null ? 1 : Math.max(a.durationWorkdays, 1))
        const waiting: Activity = {
          ...a,
          status: 'waiting',
          waitingFor: { text: change.text, expectedDate: change.until },
        }
        this.acts.set(a.id, waiting)
        this.causes.set(a.id, 'change')
        if (need > span.finish) this.moveTo(a.id, need, 'change')
        break
      }
    }
  }

  /**
   * Moves an activity's deadline. Work that has not started keeps its duration; a task that has
   * started keeps its actual start and stretches (or shrinks) instead.
   */
  moveTo(id: string, finish: number, cause: MoveCause) {
    const a = this.get(id)
    if (a.kind === 'task' && a.actualStart !== null) {
      const start = this.cal.startBoundary(a.actualStart)
      const duration = Math.max(1, finish - start)
      this.set(id, withSpan(this.cal, a, start + duration, duration), cause)
    } else {
      this.set(id, withSpan(this.cal, a, finish), cause)
    }
  }

  shift(id: string, delta: number) {
    const a = this.get(id)
    if (a.status === 'done' || a.status === 'skipped' || a.pinned) return
    this.moveTo(id, this.finish(id) + delta, 'shifted')
  }

  /** Minimal moves downstream of the change so that every dependency holds. */
  propagate() {
    this.propagateFrom([this.changedId!])
  }

  propagateFrom(seeds: string[]) {
    this.propagateScope(descendants(this.succ, seeds))
  }

  /**
   * Minimal moves within `scope` so that every dependency holds. With `notBefore` (an axis
   * position), work that has not started is also kept from starting before it.
   */
  propagateScope(scope: Set<string>, notBefore?: number) {
    for (const id of this.order) {
      if (!scope.has(id)) continue
      const a = this.get(id)
      if (a.status === 'done' || a.status === 'skipped') continue
      let required = this.requiredFinish(a)
      if (notBefore !== undefined && a.actualStart === null) {
        required = Math.max(required, notBefore + Math.max(a.durationWorkdays, 1))
      }
      if (required <= this.finish(id)) continue
      if (a.pinned) this.pinnedConflicts.set(id, required)
      else this.moveTo(id, required, this.causes.get(id) ?? 'pushed')
    }
  }

  movedList(): MovedActivity[] {
    const moved: MovedActivity[] = []
    for (const before of this.pub.activities) {
      const after = this.get(before.id)
      if (
        after.deadline === before.deadline &&
        after.start === before.start &&
        after.durationWorkdays === before.durationWorkdays
      ) {
        continue
      }
      moved.push({
        activityId: before.id,
        from: dates(before),
        to: dates(after),
        deltaWorkdays: this.cal.workdaysBetween(before.deadline, after.deadline),
        cause: this.causes.get(before.id) ?? 'pushed',
      })
    }
    return moved
  }

  conflictList(): PinnedConflict[] {
    return [...this.pinnedConflicts].map(([activityId, required]) => ({
      activityId,
      pinnedDeadline: this.get(activityId).deadline,
      requiredDeadline: this.cal.dateOf(required),
    }))
  }

  /**
   * Absorb, then shorten tasks on the chain that drives the release until the release is back
   * on target or nothing more can be compressed.
   */
  compress(options: RescheduleOptions, release: Activity | undefined, target: number) {
    const original = new Map(this.pub.activities.map((a) => [a.id, a.durationWorkdays]))
    const durations = new Map<string, number>()
    const snapshot = new Map(this.acts)
    const run = () => {
      for (const [id, a] of snapshot) this.acts.set(id, a)
      this.pinnedConflicts.clear()
      for (const [id, d] of durations) {
        const a = this.get(id)
        const span = plannedSpan(this.cal, a)
        // Keep the deadline, start later.
        this.set(id, withSpan(this.cal, a, span.finish, d), 'compressed')
      }
      this.propagate()
    }

    if (options.compress) {
      for (const [id, d] of Object.entries(options.compress)) {
        const a = this.get(id)
        if (a.kind !== 'task' || !Number.isInteger(d) || d < 1) {
          throw new Error(`Cannot compress "${id}" to ${d} working days`)
        }
        durations.set(id, d)
      }
      run()
      return
    }

    run()
    if (!release) return
    const fraction = options.minDurationFraction ?? 0.5
    for (let guard = 0; guard < 1000; guard++) {
      const overrun = this.finish(release.id) - target
      if (overrun <= 0) return
      const candidates = this.drivingChain(release.id).filter((id) => {
        const a = this.get(id)
        if (a.kind !== 'task' || a.pinned || a.status !== 'not_started') return false
        if (a.compressible === false) return false
        if (!this.downstream.has(id)) return false
        return a.durationWorkdays > minDuration(original.get(id)!, fraction)
      })
      if (!candidates.length) return
      // Longest compressible task first.
      candidates.sort(
        (x, y) =>
          this.get(y).durationWorkdays -
          minDuration(original.get(y)!, fraction) -
          (this.get(x).durationWorkdays - minDuration(original.get(x)!, fraction)),
      )
      const id = candidates[0]!
      const a = this.get(id)
      const room = a.durationWorkdays - minDuration(original.get(id)!, fraction)
      durations.set(id, a.durationWorkdays - Math.min(room, overrun))
      run()
    }
  }

  /** Activities whose finish directly determines `id`'s finish, walking back recursively. */
  private drivingChain(id: string): string[] {
    const out: string[] = []
    const seen = new Set<string>()
    const visit = (x: string) => {
      const a = this.get(x)
      const finish = this.finish(x)
      for (const d of a.predecessors) {
        if (seen.has(d.activityId)) continue
        const p = this.get(d.activityId)
        if (earliestFinish(d, this.span(p), a.durationWorkdays) === finish) {
          seen.add(p.id)
          out.push(p.id)
          visit(p.id)
        }
      }
    }
    visit(id)
    return out
  }

  /** Span used for constraints: actual dates for done work, pass-through for skipped work. */
  private span(a: Activity): Span {
    if (a.status === 'done') {
      const finish = this.cal.ordinal(a.actualFinish!)
      const start = a.actualStart
        ? this.cal.startBoundary(a.actualStart)
        : finish - a.durationWorkdays
      return { start, finish }
    }
    if (a.status === 'skipped') {
      let finish = -Infinity
      for (const d of a.predecessors) {
        finish = Math.max(finish, earliestFinish(d, this.span(this.get(d.activityId)), 0))
      }
      if (finish === -Infinity) finish = this.finish(a.id)
      return { start: finish, finish }
    }
    return plannedSpan(this.cal, a)
  }

  private requiredFinish(a: Activity): number {
    let required = -Infinity
    for (const d of a.predecessors) {
      if (a.actualStart !== null && constrainsStart(d)) continue
      required = Math.max(
        required,
        earliestFinish(d, this.span(this.get(d.activityId)), a.durationWorkdays),
      )
    }
    return required
  }

  private set(id: string, a: Activity, cause: MoveCause) {
    this.acts.set(id, a)
    const prev = this.causes.get(id)
    // Keep the most specific cause.
    if (prev !== 'change' && prev !== 'compressed') this.causes.set(id, cause)
  }
}

function minDuration(original: number, fraction: number): number {
  return Math.max(1, Math.ceil(original * fraction))
}
