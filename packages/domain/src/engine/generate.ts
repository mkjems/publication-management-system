import { DEFAULT_CALENDAR, getCalendar, type CalendarSpec } from '../calendar/calendar'
import type { IsoDate } from '../model/common'
import type { Activity, Publication } from '../model/publication'
import type { RoleId } from '../model/roles'
import type { Template } from '../model/template'
import { validateTemplate } from '../templates/validate'
import { earliestFinish } from './constraints'
import { plannedSpan, datesForSpan } from './spans'

export interface GeneratePlanInput {
  id: string
  workingTitle: string
  template: Template
  desiredReleaseDate: IsoDate
  /** First day of the kickoff meeting. Defaults to the template's nominal distance from release. */
  kickoffDate?: IsoDate
  calendar?: CalendarSpec
  /** Optional template activities this book will not do. They are kept with status "skipped". */
  skipOptional?: readonly string[]
  projectLeadId?: string | null
  roleAssignments?: Partial<Record<RoleId, string[]>>
}

export interface DependencyViolation {
  activityId: string
  predecessorId: string
  /** Working days the successor would have to move later to satisfy the dependency. */
  shortWorkdays: number
}

export interface GeneratedPlan {
  publication: Publication
  /**
   * How many working days the plan is short between the kickoff-anchored phases (1–2) and the
   * release-anchored phases (3–11). 0 when everything fits.
   */
  compressionWorkdays: number
  violations: DependencyViolation[]
}

/**
 * Generates a publication's plan from a template (PLAN §4.1.1).
 *
 * Release-anchored phases are placed backwards from the release date using the template's
 * offsets; kickoff-anchored phases are placed forwards from the kickoff meeting. If the kickoff
 * is later than the template assumes, the two halves overlap: the plan keeps the anchored dates
 * and reports the overlap as compression, so the user can decide (move the release, shorten work).
 */
export function generatePlan(input: GeneratePlanInput): GeneratedPlan {
  const { template } = input
  const errors = validateTemplate(template).filter((i) => i.severity === 'error')
  if (errors.length) {
    throw new Error(`Template has errors: ${errors.map((e) => e.message).join('; ')}`)
  }

  const calendarSpec = input.calendar ?? DEFAULT_CALENDAR
  const cal = getCalendar(calendarSpec)
  const release = cal.ordinal(input.desiredReleaseDate)
  const kickoffBoundary = input.kickoffDate
    ? cal.startBoundary(input.kickoffDate)
    : release + template.nominalKickoffOffset
  const kickoffDate = cal.dateOf(kickoffBoundary + 1)

  const skip = new Set(input.skipOptional ?? [])
  for (const id of skip) {
    const a = template.activities.find((x) => x.id === id)
    if (!a) throw new Error(`Unknown activity "${id}" in skipOptional`)
    if (!a.optional) throw new Error(`Activity "${id}" is not optional`)
  }

  const anchors = new Map(template.phases.map((p) => [p.id, p.anchor]))
  const activities: Activity[] = template.activities.map((t) => {
    const finish =
      anchors.get(t.phaseId) === 'kickoff'
        ? kickoffBoundary + (t.deadlineOffset - template.nominalKickoffOffset)
        : release + t.deadlineOffset
    return {
      id: t.id,
      templateActivityId: t.id,
      phaseId: t.phaseId,
      trackId: t.trackId,
      name: t.name,
      kind: t.kind,
      responsible: t.responsible,
      assigneeIds: [],
      durationWorkdays: t.durationWorkdays,
      ...datesForSpan(cal, t.kind, finish, t.durationWorkdays),
      actualStart: null,
      actualFinish: null,
      status: skip.has(t.id) ? 'skipped' : 'not_started',
      waitingFor: null,
      pinned: false,
      optional: t.optional,
      gate: t.gate ?? null,
      note: t.note ?? '',
      predecessors: t.predecessors.map((d) => ({ ...d })),
    }
  })

  const byId = new Map(activities.map((a) => [a.id, a]))
  const violations: DependencyViolation[] = []
  for (const a of activities) {
    const finish = plannedSpan(cal, a).finish
    for (const d of a.predecessors) {
      const required = earliestFinish(
        d,
        plannedSpan(cal, byId.get(d.activityId)!),
        a.durationWorkdays,
      )
      if (required > finish) {
        violations.push({
          activityId: a.id,
          predecessorId: d.activityId,
          shortWorkdays: required - finish,
        })
      }
    }
  }

  const publication: Publication = {
    id: input.id,
    workingTitle: input.workingTitle,
    templateId: template.id,
    templateVersion: template.version,
    projectLeadId: input.projectLeadId ?? null,
    kickoffDate,
    desiredReleaseDate: input.desiredReleaseDate,
    bindingReleaseDate: null,
    planState: 'preliminary',
    lifecycle: 'idea',
    funding: { minimumRequired: 0, secured: 0, riskAccepted: false, applications: [] },
    roleAssignments: input.roleAssignments ?? {},
    pauses: [],
    calendar: calendarSpec,
    baselines: [],
    activities,
  }

  return {
    publication,
    compressionWorkdays: Math.max(0, ...violations.map((v) => v.shortWorkdays)),
    violations,
  }
}
