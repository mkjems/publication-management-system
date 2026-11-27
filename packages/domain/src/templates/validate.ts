import { constrainsStart, earliestFinish } from '../engine/constraints'
import { topologicalOrder } from '../engine/graph'
import { GateSchema, startOffset, type Gate, type Template } from '../model/template'

export type TemplateIssueCode =
  | 'duplicate-id'
  | 'unknown-phase'
  | 'unknown-track'
  | 'track-phase-mismatch'
  | 'unknown-predecessor'
  | 'self-dependency'
  | 'cycle'
  | 'dependency-violated'
  | 'duplicate-gate'
  | 'release-not-at-zero'
  | 'milestone-outside-window'
  | 'before-kickoff'
  | 'empty-track'
  | 'orphan'

export interface TemplateIssue {
  severity: 'error' | 'warning'
  code: TemplateIssueCode
  /** English, for logs and tests. The editor builds its own Danish text from the fields below. */
  message: string
  activityId?: string
  /** The other activity involved (the predecessor of a violated dependency). */
  relatedId?: string
  trackId?: string
  /** The ids on a dependency cycle, in precedence order and closed. */
  cycle?: string[]
  gate?: Gate
  /** dependency-violated: how many working days short. */
  workdays?: number
}

/** How far (in working days) a milestone may sit outside its phase's nominal window. */
export const MILESTONE_WINDOW_TOLERANCE = 5

/**
 * Structural and scheduling checks for a template. Used by tests and later by the
 * template editor to show problems while the user edits the master plan.
 */
export function validateTemplate(t: Template): TemplateIssue[] {
  const issues: TemplateIssue[] = []
  type Extra = Omit<TemplateIssue, 'severity' | 'code' | 'message' | 'activityId'>
  const err = (code: TemplateIssueCode, message: string, activityId?: string, extra?: Extra) =>
    issues.push({
      severity: 'error',
      code,
      message,
      ...(activityId ? { activityId } : {}),
      ...extra,
    })
  const warn = (code: TemplateIssueCode, message: string, activityId?: string, extra?: Extra) =>
    issues.push({
      severity: 'warning',
      code,
      message,
      ...(activityId ? { activityId } : {}),
      ...extra,
    })

  // Unique ids across all entity types.
  const seen = new Set<string>()
  for (const id of [
    ...t.phases.map((p) => p.id),
    ...t.tracks.map((tr) => tr.id),
    ...t.activities.map((a) => a.id),
  ]) {
    if (seen.has(id)) err('duplicate-id', `Duplicate id "${id}"`)
    seen.add(id)
  }

  const phases = new Map(t.phases.map((p) => [p.id, p]))
  const tracks = new Map(t.tracks.map((tr) => [tr.id, tr]))
  const activities = new Map(t.activities.map((a) => [a.id, a]))

  for (const tr of t.tracks) {
    if (!phases.has(tr.phaseId))
      err('unknown-phase', `Track "${tr.id}" has unknown phase`, undefined, { trackId: tr.id })
    else if (!t.activities.some((a) => a.trackId === tr.id))
      warn('empty-track', `Track "${tr.id}" has no activities`, undefined, { trackId: tr.id })
  }

  for (const a of t.activities) {
    if (!phases.has(a.phaseId)) err('unknown-phase', `Unknown phase "${a.phaseId}"`, a.id)
    if (a.trackId !== null) {
      const tr = tracks.get(a.trackId)
      if (!tr) err('unknown-track', `Unknown track "${a.trackId}"`, a.id)
      else if (tr.phaseId !== a.phaseId)
        err('track-phase-mismatch', `Track "${tr.id}" is not in phase "${a.phaseId}"`, a.id)
    }
    for (const d of a.predecessors) {
      if (d.activityId === a.id) err('self-dependency', 'Activity depends on itself', a.id)
      else if (!activities.has(d.activityId))
        err('unknown-predecessor', `Unknown predecessor "${d.activityId}"`, a.id, {
          relatedId: d.activityId,
        })
    }
  }

  const topo = topologicalOrder(t.activities)
  if (!topo.ok)
    err('cycle', `Dependency cycle: ${topo.cycle.join(' → ')}`, topo.cycle[0], {
      cycle: topo.cycle,
    })

  // Default offsets must respect the dependencies.
  for (const a of t.activities) {
    for (const d of a.predecessors) {
      const p = activities.get(d.activityId)
      if (!p) continue
      const required = earliestFinish(
        d,
        { start: startOffset(p), finish: p.deadlineOffset },
        a.durationWorkdays,
      )
      const short = required - a.deadlineOffset
      if (short > 0) {
        const label = constrainsStart(d) ? 'start' : 'deadline'
        const actual = constrainsStart(d) ? startOffset(a) : a.deadlineOffset
        err(
          'dependency-violated',
          `${d.type} from "${p.id}" violated: ${label} ${actual} < ${actual + short} (short by ${short} workdays)`,
          a.id,
          { relatedId: p.id, workdays: short },
        )
      }
    }
  }

  // The engine gives the gates meaning; the release is day 0 by definition. (The editor never
  // removes a gate milestone, so a missing gate is not checked here.)
  for (const gate of GateSchema.options) {
    for (const extra of t.activities.filter((a) => a.gate === gate).slice(1))
      err('duplicate-gate', `Gate "${gate}" is on more than one milestone`, extra.id, { gate })
  }
  const release = t.activities.find((a) => a.gate === 'release')
  if (release && release.deadlineOffset !== 0)
    err('release-not-at-zero', 'The release milestone must be at offset 0', release.id)

  // Nothing should start before the kickoff meeting.
  for (const a of t.activities) {
    if (startOffset(a) < t.nominalKickoffOffset)
      warn(
        'before-kickoff',
        `Starts ${t.nominalKickoffOffset - startOffset(a)} workdays before the kickoff`,
        a.id,
        {
          workdays: t.nominalKickoffOffset - startOffset(a),
        },
      )
  }

  // Milestones should sit inside their phase's nominal window.
  for (const a of t.activities) {
    if (a.kind !== 'milestone') continue
    const p = phases.get(a.phaseId)
    if (!p) continue
    const { startOffset: s, endOffset: e } = p.window
    if (
      a.deadlineOffset < s - MILESTONE_WINDOW_TOLERANCE ||
      a.deadlineOffset > e + MILESTONE_WINDOW_TOLERANCE
    ) {
      warn(
        'milestone-outside-window',
        `Milestone at ${a.deadlineOffset} is outside phase window [${s}, ${e}]`,
        a.id,
      )
    }
  }

  // Exactly one root: everything else must hang off the dependency network.
  const roots = t.activities.filter((a) => a.predecessors.length === 0)
  if (roots.length > 1) {
    for (const r of roots.slice(1)) warn('orphan', 'Activity has no predecessors', r.id)
  }

  return issues
}
