import {
  BUILT_IN_TEMPLATES,
  MASTERPLAN_V1,
  ROLE_LABELS,
  findTemplate,
  latestTemplate,
  type RoleId,
  originalBaseline,
  type Activity,
  type ActivityStatus,
  type ChangeEvent,
  type IsoDate,
  type PhaseTemplate,
  type Publication,
  type Template,
  type TrackTemplate,
} from '@pms/domain'
import {
  EVENT_LABELS,
  FUNDING_STATUS_LABELS,
  GATE_DECISION_LABELS,
  STATUS_LABELS,
  da,
} from '@/i18n/da'
import { formatDate, formatMoney } from './format'

/**
 * The template version a publication was generated from (for phase and track names). Falls back
 * to the latest version of the same template, e.g. for a book imported without its version.
 */
export function templateOf(
  pub: Publication,
  templates: readonly Template[] = BUILT_IN_TEMPLATES,
): Template {
  return (
    findTemplate(templates, pub.templateId, pub.templateVersion) ??
    latestTemplate(templates, pub.templateId) ??
    MASTERPLAN_V1
  )
}

/**
 * The milestones the slip chart colours by default (master plan v1): the gates plus the two
 * hand-overs the client watches most. Fixed order, so each keeps its colour.
 */
export const KEY_MILESTONES = [
  'm-go',
  'm-funding',
  'm-production-start',
  'm-manuscript-locked',
  'm-print-approval',
  'm-release',
]

export interface PhaseRows {
  phase: PhaseTemplate
  tracks: { track: TrackTemplate; activities: Activity[] }[]
  milestones: Activity[]
  activities: Activity[]
}

/**
 * Activities grouped Phase → Track, in template order. Activities whose phase or track is not in
 * the template (a fallback template, see `templateOf`) are kept in an extra group at the end, so
 * nothing silently disappears from the plan.
 */
export function groupActivities(
  pub: Publication,
  activities = pub.activities,
  t: Template = templateOf(pub),
): PhaseRows[] {
  const trackIds = new Set(t.tracks.map((tr) => tr.id))
  const phaseIds = new Set(t.phases.map((p) => p.id))
  const known = (a: Activity) =>
    phaseIds.has(a.phaseId) && (a.trackId === null || trackIds.has(a.trackId))
  const groups = t.phases
    .map((phase) => {
      const inPhase = activities.filter((a) => a.phaseId === phase.id && known(a))
      return {
        phase,
        tracks: t.tracks
          .filter((tr) => tr.phaseId === phase.id)
          .map((track) => ({ track, activities: inPhase.filter((a) => a.trackId === track.id) }))
          .filter((g) => g.activities.length > 0),
        milestones: inPhase.filter((a) => a.trackId === null),
        activities: inPhase,
      }
    })
    .filter((g) => g.activities.length > 0)
  const unknown = activities.filter((a) => !known(a))
  if (unknown.length) {
    const phase: PhaseTemplate = {
      id: '__other',
      number: t.phases.length + 1,
      name: da.publication.otherActivities,
      period: '',
      window: { startOffset: 0, endOffset: 0 },
      anchor: 'release',
    }
    const track: TrackTemplate = { id: '__other-track', phaseId: phase.id, name: phase.name }
    groups.push({
      phase,
      tracks: [{ track, activities: unknown }],
      milestones: [],
      activities: unknown,
    })
  }
  return groups
}

export function nextMilestone(pub: Publication): Activity | undefined {
  return pub.activities
    .filter((a) => a.kind === 'milestone' && a.status !== 'done' && a.status !== 'skipped')
    .sort((a, b) => a.deadline.localeCompare(b.deadline))[0]
}

export function baselineDeadline(pub: Publication, activityId: string): IsoDate | null {
  return originalBaseline(pub)?.activities[activityId]?.deadline ?? null
}

/** Status options for an activity: "skipped" only for optional ones. */
export function statusOptions(a: Activity): ActivityStatus[] {
  const all: ActivityStatus[] = ['not_started', 'in_progress', 'waiting', 'done']
  return a.optional || a.status === 'skipped' ? [...all, 'skipped'] : all
}

/** A one-line Danish description of a change event. */
export function describeEvent(e: ChangeEvent, pub: Publication): string {
  const name = (id: unknown) =>
    pub.activities.find((a) => a.id === id)?.name ?? (typeof id === 'string' ? id : '?')
  const p = e.payload
  switch (e.type) {
    case 'activity_rescheduled': {
      const moved = Array.isArray(p.moved)
        ? p.moved.length
        : typeof p.moved === 'number'
          ? p.moved
          : 0
      if (!p.activityId) return da.history.moved(moved)
      const own = e.diff.activities.find((o) => o.op === 'update' && o.id === p.activityId)
      const deadline = own && own.op === 'update' ? own.fields.deadline : undefined
      const range = deadline
        ? `: ${formatDate(deadline.from as string)} → ${formatDate(deadline.to as string)}`
        : ''
      const others = moved > 1 ? ` (${da.history.moved(moved)})` : ''
      return `${name(p.activityId)}${range}${others}`
    }
    case 'status_changed':
      return `${name(p.activityId)}: ${STATUS_LABELS[p.from as ActivityStatus] ?? p.from} → ${STATUS_LABELS[p.to as ActivityStatus] ?? p.to}`
    case 'release_date_changed':
      return `${formatDate(p.from as string)} → ${formatDate(p.to as string)}`
    case 'plan_made_binding':
      return `Bindende udgivelsesdato ${formatDate(p.bindingReleaseDate as string)}. Oprindelig plan gemt.`
    case 'rebaselined':
      return `Baseline ${String(p.baseline)} gemt`
    case 'paused':
      return e.reason ?? ''
    case 'resumed':
      return da.history.moved(typeof p.moved === 'number' ? p.moved : 0)
    case 'pinned_changed':
      return `${name(p.activityId)}: ${p.pinned ? 'fastlåst' : 'ikke længere fastlåst'}`
    case 'dependency_added':
    case 'dependency_removed':
      return `${name(p.activityId)} ← ${name((p.dependency as { activityId?: string } | undefined)?.activityId)}`
    case 'activity_updated':
      return name(p.activityId)
    case 'funding_changed': {
      if (p.op === 'target') {
        return [
          typeof p.minimumRequired === 'number' && `Minimum ${formatMoney(p.minimumRequired)}`,
          typeof p.riskAccepted === 'boolean' &&
            (p.riskAccepted ? 'risikoen godkendt' : 'risikoen ikke længere godkendt'),
        ]
          .filter(Boolean)
          .join(', ')
      }
      const status = p.status as { from: string; to: string } | undefined
      const label = (s: string) =>
        FUNDING_STATUS_LABELS[s as keyof typeof FUNDING_STATUS_LABELS] ?? s
      const what =
        p.op === 'added'
          ? 'tilføjet'
          : p.op === 'removed'
            ? 'fjernet'
            : status
              ? `${label(status.from)} → ${label(status.to)}`
              : 'redigeret'
      return `${String(p.funder ?? '')}: ${what}`
    }
    case 'gate_decided':
      return `${name(p.activityId)}: ${GATE_DECISION_LABELS[p.decision as keyof typeof GATE_DECISION_LABELS] ?? String(p.decision)}`
    case 'roles_assigned':
      return ROLE_LABELS[p.roleId as RoleId] ?? String(p.roleId)
    case 'undone':
    case 'redone':
      return Array.isArray(p.types)
        ? p.types.map((t) => EVENT_LABELS[t as keyof typeof EVENT_LABELS] ?? t).join(', ')
        : ''
  }
}

export function eventAuthor(e: ChangeEvent): string {
  if (e.by === 'simulation') return da.history.by.simulation
  if (e.by === 'scenario') return da.history.by.scenario
  return da.history.by.user
}
