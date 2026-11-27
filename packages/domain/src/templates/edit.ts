/**
 * Edits to a template draft (the master plan editor, PLAN §5.1 screen 9). Each function returns a
 * new template and throws a `TemplateEditError` when the edit is not allowed. Whole-network
 * problems that an edit can leave behind (a milestone outside its window, an activity without
 * predecessors) are reported by `validateTemplate`; publishing a draft requires no errors.
 *
 * Schedule edits keep the dependency network consistent by moving neighbours as little as
 * possible: successors move later, predecessors move earlier. The release milestone stays on
 * day 0, so a change that would push it is left for the validator to report.
 *
 * Like the commands, these never generate ids: new phases, tracks and activities get their id
 * from the caller.
 */
import { earliestFinish, latestFinish } from '../engine/constraints'
import { successorMap, topologicalOrder } from '../engine/graph'
import type { ActivityKind, Dependency } from '../model/common'
import type { Responsibility } from '../model/roles'
import {
  type ActivityTemplate,
  type PhaseTemplate,
  type Template,
  type TrackTemplate,
} from '../model/template'

export type TemplateEditErrorCode =
  | 'unknown'
  | 'duplicate-id'
  | 'gate-locked'
  | 'release-locked'
  | 'kind-locked'
  | 'invalid-duration'
  | 'invalid-window'
  | 'self-dependency'
  | 'duplicate-dependency'
  | 'cycle'
  | 'milestone-track'

export class TemplateEditError extends Error {
  constructor(
    readonly code: TemplateEditErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'TemplateEditError'
  }
}

/** A schedule edit and the activities it moved to keep the dependencies valid. */
export interface TemplateEditResult {
  template: Template
  /** Other activities whose deadline moved, by id: old → new offset. */
  moved: { id: string; from: number; to: number }[]
}

// ── Template and phases ───────────────────────────────────────────────────────

export function updateTemplateInfo(
  t: Template,
  patch: Partial<Pick<Template, 'name' | 'description' | 'changeNote'>>,
): Template {
  return { ...t, ...patch }
}

export function updateTemplatePhase(
  t: Template,
  phaseId: string,
  patch: Partial<Pick<PhaseTemplate, 'name' | 'period' | 'description' | 'window'>>,
): Template {
  const phase = mustPhase(t, phaseId)
  const window = patch.window ?? phase.window
  if (!Number.isInteger(window.startOffset) || !Number.isInteger(window.endOffset))
    throw new TemplateEditError('invalid-window', 'Window offsets must be whole working days')
  if (window.startOffset > window.endOffset)
    throw new TemplateEditError('invalid-window', 'A phase window cannot end before it starts')
  return {
    ...t,
    phases: t.phases.map((p) => (p.id === phaseId ? { ...p, ...patch, window } : p)),
  }
}

// ── Tracks ────────────────────────────────────────────────────────────────────

/** Adds a track at the end of a phase. */
export function addTemplateTrack(
  t: Template,
  input: { id: string; phaseId: string; name: string; description?: string },
): Template {
  mustPhase(t, input.phaseId)
  assertNewId(t, input.id)
  const track: TrackTemplate = {
    id: input.id,
    phaseId: input.phaseId,
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
  }
  const lastInPhase = t.tracks.findLastIndex((tr) => tr.phaseId === input.phaseId)
  const tracks = [...t.tracks]
  tracks.splice(lastInPhase >= 0 ? lastInPhase + 1 : tracks.length, 0, track)
  return { ...t, tracks }
}

export function updateTemplateTrack(
  t: Template,
  trackId: string,
  patch: Partial<Pick<TrackTemplate, 'name' | 'description'>>,
): Template {
  mustTrack(t, trackId)
  return { ...t, tracks: t.tracks.map((tr) => (tr.id === trackId ? { ...tr, ...patch } : tr)) }
}

/** Removes a track and its activities (see `removeTemplateActivity`). */
export function removeTemplateTrack(t: Template, trackId: string): Template {
  mustTrack(t, trackId)
  let next = t
  for (const a of t.activities.filter((x) => x.trackId === trackId))
    next = removeTemplateActivity(next, a.id)
  return { ...next, tracks: next.tracks.filter((tr) => tr.id !== trackId) }
}

/** Moves a track one place up (-1) or down (+1) within its phase. */
export function moveTemplateTrack(t: Template, trackId: string, direction: -1 | 1): Template {
  const track = mustTrack(t, trackId)
  return {
    ...t,
    tracks: swapWithin(t.tracks, track, (x) => x.phaseId === track.phaseId, direction),
  }
}

// ── Activities ────────────────────────────────────────────────────────────────

export interface NewTemplateActivity {
  id: string
  /** The track to add to, or a phase for a milestone. */
  place: { trackId: string } | { milestoneOf: string }
  name: string
  kind: ActivityKind
  responsible: Responsibility
  /** Tasks only. Default 5. */
  durationWorkdays?: number
  /**
   * Placed after this activity (finish-to-start). Default: the last activity in the track, or
   * the phase's last milestone. Without one the activity starts the phase window.
   */
  after?: string | null
}

/**
 * Adds an activity at the end of a track (or a milestone to a phase). It depends on the
 * activity before it, finish-to-start, and is placed right after it.
 */
export function addTemplateActivity(t: Template, input: NewTemplateActivity): Template {
  assertNewId(t, input.id)
  const isMilestone = 'milestoneOf' in input.place
  if (isMilestone !== (input.kind === 'milestone'))
    throw new TemplateEditError('milestone-track', 'Milestones sit on a phase, not in a track')
  const trackId = 'trackId' in input.place ? input.place.trackId : null
  const phaseId =
    'trackId' in input.place ? mustTrack(t, input.place.trackId).phaseId : input.place.milestoneOf
  const phase = mustPhase(t, phaseId)
  const duration = input.kind === 'task' ? (input.durationWorkdays ?? 5) : 0
  assertDuration(input.kind, duration)

  const siblings = t.activities.filter((a) => a.phaseId === phaseId && a.trackId === trackId)
  const after =
    input.after === null
      ? undefined
      : input.after !== undefined
        ? mustActivity(t, input.after)
        : siblings.at(-1)
  const deadlineOffset = after
    ? after.deadlineOffset + duration
    : Math.min(phase.window.startOffset + duration, phase.window.endOffset)

  const activity: ActivityTemplate = {
    id: input.id,
    phaseId,
    trackId,
    name: input.name,
    kind: input.kind,
    responsible: input.responsible,
    durationWorkdays: duration,
    deadlineOffset,
    predecessors: after ? [{ activityId: after.id, type: 'FS', lagWorkdays: 0 }] : [],
    optional: false,
  }
  // Insert after the last sibling so the activity shows at the end of its track.
  const last = siblings.at(-1)
  const index = last ? t.activities.indexOf(last) + 1 : t.activities.length
  const activities = [...t.activities]
  activities.splice(index, 0, activity)
  return { ...t, activities }
}

/** Fields that do not affect the schedule. */
export function updateTemplateActivity(
  t: Template,
  id: string,
  patch: Partial<
    Pick<ActivityTemplate, 'name' | 'responsible' | 'optional' | 'note' | 'compressible'>
  >,
): Template {
  const a = mustActivity(t, id)
  if (patch.optional && a.kind === 'milestone')
    throw new TemplateEditError('kind-locked', 'Milestones cannot be optional')
  const next: ActivityTemplate = { ...a, ...patch }
  if (next.note === '') delete next.note
  // Absent means compressible; only tasks carry the flag.
  if (next.compressible !== false || next.kind !== 'task') delete next.compressible
  return replaceActivity(t, next)
}

/**
 * Changes duration and/or deadline, then moves neighbours so every dependency holds again.
 * The release milestone cannot move.
 */
export function rescheduleTemplateActivity(
  t: Template,
  id: string,
  change: { durationWorkdays?: number; deadlineOffset?: number },
): TemplateEditResult {
  const a = mustActivity(t, id)
  const duration = change.durationWorkdays ?? a.durationWorkdays
  const deadline = change.deadlineOffset ?? a.deadlineOffset
  assertDuration(a.kind, duration)
  if (!Number.isInteger(deadline))
    throw new TemplateEditError('invalid-duration', 'Offsets are whole working days')
  if (a.gate === 'release' && deadline !== 0)
    throw new TemplateEditError('release-locked', 'The release milestone is always day 0')
  return fitTemplateAround(
    replaceActivity(t, { ...a, durationWorkdays: duration, deadlineOffset: deadline }),
    id,
  )
}

/**
 * Switches between task and deadline (milestones keep their kind). A task becoming a deadline
 * keeps its deadline; a deadline becoming a task gets `durationWorkdays` (default 5) before it.
 */
export function changeTemplateActivityKind(
  t: Template,
  id: string,
  kind: Exclude<ActivityKind, 'milestone'>,
  durationWorkdays = 5,
): TemplateEditResult {
  const a = mustActivity(t, id)
  if (a.kind === 'milestone')
    throw new TemplateEditError('kind-locked', 'A milestone stays a milestone')
  if (a.kind === kind) return { template: t, moved: [] }
  const duration = kind === 'task' ? durationWorkdays : 0
  assertDuration(kind, duration)
  const rest: ActivityTemplate = { ...a }
  delete rest.compressible
  return fitTemplateAround(replaceActivity(t, { ...rest, kind, durationWorkdays: duration }), id)
}

/**
 * Removes an activity. Its successors lose the dependency on it; they keep their dates. Gates
 * cannot be removed: the scheduling engine relies on them.
 */
export function removeTemplateActivity(t: Template, id: string): Template {
  const a = mustActivity(t, id)
  if (a.gate) throw new TemplateEditError('gate-locked', 'Gate milestones cannot be removed')
  return {
    ...t,
    activities: t.activities
      .filter((x) => x.id !== id)
      .map((x) =>
        x.predecessors.some((d) => d.activityId === id)
          ? { ...x, predecessors: x.predecessors.filter((d) => d.activityId !== id) }
          : x,
      ),
  }
}

/** Moves an activity one place up (-1) or down (+1) among the activities of its track. */
export function moveTemplateActivity(t: Template, id: string, direction: -1 | 1): Template {
  const a = mustActivity(t, id)
  return {
    ...t,
    activities: swapWithin(
      t.activities,
      a,
      (x) => x.phaseId === a.phaseId && x.trackId === a.trackId,
      direction,
    ),
  }
}

/** Moves an activity to the end of another track, possibly in another phase. Dates stay. */
export function moveTemplateActivityToTrack(t: Template, id: string, trackId: string): Template {
  const a = mustActivity(t, id)
  const track = mustTrack(t, trackId)
  if (a.kind === 'milestone')
    throw new TemplateEditError('milestone-track', 'Milestones sit on a phase, not in a track')
  if (a.trackId === trackId) return t
  const moved: ActivityTemplate = { ...a, trackId, phaseId: track.phaseId }
  const rest = t.activities.filter((x) => x.id !== id)
  const last = rest.findLastIndex((x) => x.trackId === trackId)
  rest.splice(last >= 0 ? last + 1 : rest.length, 0, moved)
  return { ...t, activities: rest }
}

// ── Dependencies ──────────────────────────────────────────────────────────────

/** Adds a dependency, refusing cycles, then moves neighbours so it holds. */
export function addTemplateDependency(
  t: Template,
  id: string,
  dep: Dependency,
): TemplateEditResult {
  const a = mustActivity(t, id)
  mustActivity(t, dep.activityId)
  if (dep.activityId === id)
    throw new TemplateEditError('self-dependency', 'An activity cannot depend on itself')
  if (a.predecessors.some((d) => d.activityId === dep.activityId))
    throw new TemplateEditError('duplicate-dependency', 'The dependency already exists')
  assertLag(dep)
  const next = replaceActivity(t, { ...a, predecessors: [...a.predecessors, { ...dep }] })
  const topo = topologicalOrder(next.activities)
  if (!topo.ok) throw new TemplateEditError('cycle', `Dependency cycle: ${topo.cycle.join(' → ')}`)
  return fitTemplateAround(next, id, { moveSelf: true })
}

/** Changes the type or lag of an existing dependency, then moves neighbours so it holds. */
export function updateTemplateDependency(
  t: Template,
  id: string,
  predecessorId: string,
  patch: Partial<Pick<Dependency, 'type' | 'lagWorkdays'>>,
): TemplateEditResult {
  const a = mustActivity(t, id)
  const existing = a.predecessors.find((d) => d.activityId === predecessorId)
  if (!existing) throw new TemplateEditError('unknown', `No dependency on "${predecessorId}"`)
  const dep = { ...existing, ...patch }
  assertLag(dep)
  const next = replaceActivity(t, {
    ...a,
    predecessors: a.predecessors.map((d) => (d.activityId === predecessorId ? dep : d)),
  })
  return fitTemplateAround(next, id, { moveSelf: true })
}

export function removeTemplateDependency(t: Template, id: string, predecessorId: string): Template {
  const a = mustActivity(t, id)
  return replaceActivity(t, {
    ...a,
    predecessors: a.predecessors.filter((d) => d.activityId !== predecessorId),
  })
}

// ── Fitting ───────────────────────────────────────────────────────────────────

/**
 * Restores the dependencies around `id` after its dates or links changed: activities downstream
 * of it move later where a dependency requires it, activities upstream move earlier. Each moves
 * the least it must. The release milestone never moves; a violation it would need to resolve is
 * left for `validateTemplate` to report. With `moveSelf`, `id` itself also moves later if its own
 * predecessors require it (after a dependency was added to it); otherwise its dates are kept.
 */
export function fitTemplateAround(
  t: Template,
  id: string,
  options: { moveSelf?: boolean } = {},
): TemplateEditResult {
  const topo = topologicalOrder(t.activities)
  if (!topo.ok) return { template: t, moved: [] }
  const byId = new Map(t.activities.map((a) => [a.id, a]))
  const deadline = new Map(t.activities.map((a) => [a.id, a.deadlineOffset]))
  const succ = successorMap(t.activities)
  const span = (x: string) => {
    const a = byId.get(x)!
    const finish = deadline.get(x)!
    return { start: finish - a.durationWorkdays, finish }
  }
  const locked = (x: string) => byId.get(x)!.gate === 'release'

  const downstream = reach(id, (x) => succ.get(x)!.map((e) => e.id))
  for (const x of topo.order) {
    if (!downstream.has(x) || (x === id && !options.moveSelf) || locked(x)) continue
    const a = byId.get(x)!
    let required = deadline.get(x)!
    for (const d of a.predecessors) {
      if (!byId.has(d.activityId)) continue
      required = Math.max(required, earliestFinish(d, span(d.activityId), a.durationWorkdays))
    }
    deadline.set(x, required)
  }

  const upstream = reach(id, (x) =>
    byId
      .get(x)!
      .predecessors.map((d) => d.activityId)
      .filter((p) => byId.has(p)),
  )
  for (const x of [...topo.order].reverse()) {
    if (!upstream.has(x) || x === id || locked(x)) continue
    const a = byId.get(x)!
    let latest = deadline.get(x)!
    for (const e of succ.get(x)!) {
      const s = byId.get(e.id)!
      latest = Math.min(
        latest,
        latestFinish(e.dep, deadline.get(e.id)!, s.durationWorkdays, a.durationWorkdays),
      )
    }
    deadline.set(x, latest)
  }

  const moved = t.activities
    .filter((a) => deadline.get(a.id) !== a.deadlineOffset)
    .map((a) => ({ id: a.id, from: a.deadlineOffset, to: deadline.get(a.id)! }))
  if (!moved.length) return { template: t, moved }
  return {
    template: {
      ...t,
      activities: t.activities.map((a) =>
        deadline.get(a.id) === a.deadlineOffset ? a : { ...a, deadlineOffset: deadline.get(a.id)! },
      ),
    },
    moved,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function reach(id: string, next: (x: string) => string[]): Set<string> {
  const seen = new Set([id])
  const stack = [id]
  while (stack.length) {
    for (const n of next(stack.pop()!)) {
      if (seen.has(n)) continue
      seen.add(n)
      stack.push(n)
    }
  }
  return seen
}

function swapWithin<T>(list: readonly T[], item: T, same: (x: T) => boolean, dir: -1 | 1): T[] {
  const peers = list.filter(same)
  const i = peers.indexOf(item)
  const other = peers[i + dir]
  if (other === undefined) return [...list]
  const out = [...list]
  const a = out.indexOf(item)
  const b = out.indexOf(other)
  out[a] = other
  out[b] = item
  return out
}

function replaceActivity(t: Template, a: ActivityTemplate): Template {
  return { ...t, activities: t.activities.map((x) => (x.id === a.id ? a : x)) }
}

function mustPhase(t: Template, id: string): PhaseTemplate {
  const p = t.phases.find((x) => x.id === id)
  if (!p) throw new TemplateEditError('unknown', `Unknown phase "${id}"`)
  return p
}

function mustTrack(t: Template, id: string): TrackTemplate {
  const tr = t.tracks.find((x) => x.id === id)
  if (!tr) throw new TemplateEditError('unknown', `Unknown track "${id}"`)
  return tr
}

function mustActivity(t: Template, id: string): ActivityTemplate {
  const a = t.activities.find((x) => x.id === id)
  if (!a) throw new TemplateEditError('unknown', `Unknown activity "${id}"`)
  return a
}

function assertNewId(t: Template, id: string) {
  const taken =
    t.phases.some((p) => p.id === id) ||
    t.tracks.some((tr) => tr.id === id) ||
    t.activities.some((a) => a.id === id)
  if (taken) throw new TemplateEditError('duplicate-id', `The id "${id}" is already used`)
}

function assertDuration(kind: ActivityKind, duration: number) {
  const ok = kind === 'task' ? Number.isInteger(duration) && duration >= 1 : duration === 0
  if (!ok)
    throw new TemplateEditError(
      'invalid-duration',
      'Tasks need a whole number of working days, at least 1',
    )
}

function assertLag(dep: Dependency) {
  if (!Number.isInteger(dep.lagWorkdays))
    throw new TemplateEditError('invalid-duration', 'Lag is a whole number of working days')
}
