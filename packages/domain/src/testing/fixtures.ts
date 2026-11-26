/**
 * Test helpers: small plans written with the template DSL. Not exported from the package.
 */
import type { CalendarSpec } from '../calendar/calendar'
import { getCalendar } from '../calendar/calendar'
import type { CommandContext } from '../commands/context'
import type { IsoDate } from '../model/common'
import type { Activity, Publication } from '../model/publication'
import { generatePlan } from '../engine/generate'
import { buildTemplate, phase, track, type TrackDraft } from '../templates/builder'

export { milestone, point, task } from '../templates/builder'

/** Weekends only, so tests can count working days by eye. */
export const WEEKDAYS: CalendarSpec = { holidays: 'none', closures: [] }
export const cal = getCalendar(WEEKDAYS)

/** Friday. */
export const RELEASE: IsoDate = '2027-03-26'
export const R = cal.ordinal(RELEASE)

/** The working day at offset `n` from the release (0 = release day). */
export const day = (n: number): IsoDate => cal.dateOf(R + n)

type Drafts = TrackDraft['activities']

/** A one-phase, release-anchored plan from activity drafts (offsets relative to RELEASE). */
export function plan(activities: Drafts, milestones: Drafts = []): Publication {
  const template = buildTemplate(
    { id: 'mini', version: 1, name: 'Mini', nominalKickoffOffset: -1000 },
    [
      phase(
        { id: 'p1', number: 1, name: 'P', period: '', window: [-1000, 1000], anchor: 'release' },
        activities.length ? [track('t1', 'T', activities)] : [],
        milestones,
      ),
    ],
  )
  return generatePlan({
    id: 'pub',
    workingTitle: 'Mini',
    template,
    desiredReleaseDate: RELEASE,
    calendar: WEEKDAYS,
  }).publication
}

export function patch(p: Publication, id: string, changes: Partial<Activity>): Publication {
  return {
    ...p,
    activities: p.activities.map((a) => (a.id === id ? { ...a, ...changes } : a)),
  }
}

export function get(p: Publication, id: string): Activity {
  const a = p.activities.find((x) => x.id === id)
  if (!a) throw new Error(`No activity ${id}`)
  return a
}

let idCounter = 0

/** Command context for tests. Ids are unique across all contexts, like real ones. */
export function ctx(asOf: IsoDate, by = 'tester'): CommandContext {
  return {
    asOf,
    recordedAt: '2026-11-26T12:00:00.000Z',
    by,
    newId: () => `id-${++idCounter}`,
  }
}
