import {
  MASTERPLAN_V1,
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
import { EVENT_LABELS, STATUS_LABELS, da } from '@/i18n/da'
import { formatDate } from './format'

const TEMPLATES: Template[] = [MASTERPLAN_V1]

/** The template a publication was generated from (for phase and track names). */
export function templateOf(pub: Publication): Template {
  return (
    TEMPLATES.find((t) => t.id === pub.templateId && t.version === pub.templateVersion) ??
    MASTERPLAN_V1
  )
}

export interface PhaseRows {
  phase: PhaseTemplate
  tracks: { track: TrackTemplate; activities: Activity[] }[]
  milestones: Activity[]
  activities: Activity[]
}

/** Activities grouped Phase → Track, in template order. */
export function groupActivities(pub: Publication, activities = pub.activities): PhaseRows[] {
  const t = templateOf(pub)
  return t.phases
    .map((phase) => {
      const inPhase = activities.filter((a) => a.phaseId === phase.id)
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
