import { constrainsStart, earliestFinish } from '../engine/constraints'
import { topologicalOrder } from '../engine/graph'
import { startOffset, type Template } from '../model/template'

export interface TemplateIssue {
  severity: 'error' | 'warning'
  code:
    | 'duplicate-id'
    | 'unknown-phase'
    | 'unknown-track'
    | 'track-phase-mismatch'
    | 'unknown-predecessor'
    | 'self-dependency'
    | 'cycle'
    | 'dependency-violated'
    | 'milestone-outside-window'
    | 'orphan'
  message: string
  activityId?: string
}

/** How far (in working days) a milestone may sit outside its phase's nominal window. */
export const MILESTONE_WINDOW_TOLERANCE = 5

/**
 * Structural and scheduling checks for a template. Used by tests and later by the
 * template editor to show problems while the user edits the master plan.
 */
export function validateTemplate(t: Template): TemplateIssue[] {
  const issues: TemplateIssue[] = []
  const err = (code: TemplateIssue['code'], message: string, activityId?: string) =>
    issues.push({ severity: 'error', code, message, ...(activityId ? { activityId } : {}) })
  const warn = (code: TemplateIssue['code'], message: string, activityId?: string) =>
    issues.push({ severity: 'warning', code, message, ...(activityId ? { activityId } : {}) })

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
    if (!phases.has(tr.phaseId)) err('unknown-phase', `Track "${tr.id}" has unknown phase`)
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
        err('unknown-predecessor', `Unknown predecessor "${d.activityId}"`, a.id)
    }
  }

  const topo = topologicalOrder(t.activities)
  if (!topo.ok) err('cycle', `Dependency cycle: ${topo.cycle.join(' → ')}`)

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
        )
      }
    }
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
