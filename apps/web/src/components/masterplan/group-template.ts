import type { RoleId, Template } from '@pms/domain'
import type { PhaseGroup } from './phase-section'

export interface TemplateFilter {
  query?: string
  role?: RoleId
}

/** Groups a template into phases → tracks → activities, applying the filter. Empty groups are dropped. */
export function groupTemplate(template: Template, filter: TemplateFilter = {}): PhaseGroup[] {
  const q = filter.query?.trim().toLocaleLowerCase('da-DK') ?? ''
  const matches = (a: Template['activities'][number]) =>
    (!q ||
      a.name.toLocaleLowerCase('da-DK').includes(q) ||
      a.responsible.label.toLocaleLowerCase('da-DK').includes(q)) &&
    (!filter.role || a.responsible.roles.includes(filter.role))

  const groups: PhaseGroup[] = []
  for (const phase of template.phases) {
    const tracks = template.tracks
      .filter((t) => t.phaseId === phase.id)
      .map((track) => ({
        track,
        activities: template.activities.filter((a) => a.trackId === track.id && matches(a)),
      }))
      .filter((t) => t.activities.length > 0)
    const milestones = template.activities.filter(
      (a) => a.phaseId === phase.id && a.kind === 'milestone' && matches(a),
    )
    const total = tracks.reduce((n, t) => n + t.activities.length, 0) + milestones.length
    if (total > 0) groups.push({ phase, tracks, milestones, total })
  }
  return groups
}
