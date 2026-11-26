/**
 * Work lists across publications (PLAN §5.1.8 "Mine opgaver", §6 Phase 5 Monday overview): open
 * activities for a person or a role, sorted into buckets by urgency relative to `asOf`.
 */
import { addDays, isoWeekday } from '../calendar/dates'
import type { IsoDate } from '../model/common'
import type { Activity, Publication } from '../model/publication'
import type { RoleId } from '../model/roles'
import type { HealthState, PublicationHealth } from './health'

export type WorkBucket =
  /** Past its deadline and not done. */
  | 'overdue'
  /** Waiting for something. */
  | 'waiting'
  /** Deadline later this week (up to Sunday). */
  | 'due_this_week'
  /** Planned to start this week and not started. */
  | 'starting_this_week'
  /** Deadline next week. */
  | 'due_next_week'
  /** Started, deadline later. */
  | 'in_progress'

export const WORK_BUCKETS: WorkBucket[] = [
  'overdue',
  'waiting',
  'due_this_week',
  'starting_this_week',
  'due_next_week',
  'in_progress',
]

export interface WorkItem {
  publicationId: string
  activity: Activity
  bucket: WorkBucket
  state: HealthState
  /** Forecast deadline. */
  forecast: IsoDate
}

export type WorkFilter =
  | { kind: 'all' }
  | { kind: 'role'; roleId: RoleId }
  /** Activities assigned to the person, or whose roles the person holds on that publication. */
  | { kind: 'person'; personId: string }

/** Sunday of the week `date` is in (weeks run Monday–Sunday). */
export function endOfWeek(date: IsoDate): IsoDate {
  return addDays(date, 7 - isoWeekday(date))
}

/** Whether `a` belongs to the filter on publication `pub`. */
export function matchesWork(pub: Publication, a: Activity, filter: WorkFilter): boolean {
  switch (filter.kind) {
    case 'all':
      return true
    case 'role':
      return a.responsible.roles.includes(filter.roleId)
    case 'person': {
      if (a.assigneeIds.includes(filter.personId)) return true
      return a.responsible.roles.some(
        (r) =>
          (pub.roleAssignments[r] ?? []).includes(filter.personId) ||
          (r === 'project-lead' && pub.projectLeadId === filter.personId),
      )
    }
  }
}

/**
 * Open work of one publication in the filter, with a bucket each (most urgent bucket wins).
 * Work beyond next week that has not started is left out. Paused and stopped publications have
 * no current work.
 */
export function workItems(
  pub: Publication,
  health: PublicationHealth,
  filter: WorkFilter = { kind: 'all' },
): WorkItem[] {
  if (health.paused || pub.lifecycle === 'no_go' || pub.lifecycle === 'closed') return []
  const asOf = health.asOf
  const weekEnd = endOfWeek(asOf)
  const nextWeekEnd = addDays(weekEnd, 7)
  const items: WorkItem[] = []
  for (const a of pub.activities) {
    if (a.status === 'done' || a.status === 'skipped') continue
    if (!matchesWork(pub, a, filter)) continue
    const bucket: WorkBucket | null =
      a.deadline < asOf
        ? 'overdue'
        : a.status === 'waiting'
          ? 'waiting'
          : a.deadline <= weekEnd
            ? 'due_this_week'
            : a.status === 'not_started' && a.start !== null && a.start <= weekEnd
              ? 'starting_this_week'
              : a.deadline <= nextWeekEnd
                ? 'due_next_week'
                : a.status === 'in_progress'
                  ? 'in_progress'
                  : null
    if (!bucket) continue
    items.push({
      publicationId: pub.id,
      activity: a,
      bucket,
      state: health.activities.get(a.id)!.state,
      forecast: health.analysis.activities.get(a.id)!.deadline,
    })
  }
  return items.sort(
    (x, y) =>
      WORK_BUCKETS.indexOf(x.bucket) - WORK_BUCKETS.indexOf(y.bucket) ||
      x.activity.deadline.localeCompare(y.activity.deadline),
  )
}
