import { describe, expect, it } from 'vitest'
import { getCalendar, DEFAULT_CALENDAR } from '../calendar/calendar'
import { PublicationSchema, releaseActivity } from '../model/publication'
import { MASTERPLAN_V1 as template } from '../templates/masterplan-v1'
import { earliestFinish } from './constraints'
import { generatePlan } from './generate'
import { plannedSpan } from './spans'

const cal = getCalendar(DEFAULT_CALENDAR)
const RELEASE = '2027-10-15' // a Friday

function generate(extra: Partial<Parameters<typeof generatePlan>[0]> = {}) {
  return generatePlan({
    id: 'pub-1',
    workingTitle: 'Testbog',
    template,
    desiredReleaseDate: RELEASE,
    ...extra,
  })
}

describe('generatePlan', () => {
  it('produces a valid publication with every template activity', () => {
    const { publication, compressionWorkdays, violations } = generate()
    expect(() => PublicationSchema.parse(publication)).not.toThrow()
    expect(publication.activities).toHaveLength(template.activities.length)
    expect(publication.planState).toBe('preliminary')
    expect(compressionWorkdays).toBe(0)
    expect(violations).toEqual([])
  })

  it('places the release milestone on the release date and the rest by working-day offsets', () => {
    const { publication } = generate()
    expect(releaseActivity(publication)?.deadline).toBe(RELEASE)
    const release = cal.ordinal(RELEASE)
    for (const t of template.activities) {
      const a = publication.activities.find((x) => x.id === t.id)!
      expect(cal.ordinal(a.deadline) - release).toBe(t.deadlineOffset)
      if (a.kind === 'task')
        expect(cal.countWorkdays(a.start!, a.deadline)).toBe(t.durationWorkdays)
    }
    // The kickoff meeting starts at the nominal kickoff offset.
    expect(publication.kickoffDate).toBe(cal.dateOf(release + template.nominalKickoffOffset + 1))
    expect(publication.activities[0]!.start).toBe(publication.kickoffDate)
  })

  it('skips holidays: a task spanning Christmas ends later in calendar days', () => {
    const { publication } = generate({ desiredReleaseDate: '2027-04-30' })
    for (const a of publication.activities) {
      expect(cal.isWorkingDay(a.deadline)).toBe(true)
      if (a.start) expect(cal.isWorkingDay(a.start)).toBe(true)
    }
  })

  it('moves the release milestone to the working day before a weekend release date', () => {
    const { publication } = generate({ desiredReleaseDate: '2027-10-16' })
    expect(releaseActivity(publication)?.deadline).toBe('2027-10-15')
  })

  it('places phases 1–2 forward from a given kickoff date', () => {
    const early = generate({ kickoffDate: '2026-09-01' })
    expect(early.publication.kickoffDate).toBe('2026-09-01')
    expect(early.publication.activities.find((a) => a.id === 'kickoff-meeting')?.start).toBe(
      '2026-09-01',
    )
    expect(early.compressionWorkdays).toBe(0)
    // Phase 3 still hangs off the release date.
    expect(
      early.publication.activities.find((a) => a.id === 'm-revised-manuscript')?.deadline,
    ).toBe(generate().publication.activities.find((a) => a.id === 'm-revised-manuscript')?.deadline)
  })

  it('reports compression when the kickoff is too late', () => {
    const nominal = generate().publication.kickoffDate
    const late = generate({ kickoffDate: cal.addWorkdays(nominal, 10) })

    // Independently: the tightest gap between a kickoff-anchored predecessor and a
    // release-anchored successor in the template.
    const kickoffPhases = new Set(
      template.phases.filter((p) => p.anchor === 'kickoff').map((p) => p.id),
    )
    const byId = new Map(template.activities.map((a) => [a.id, a]))
    let minGap = Infinity
    for (const a of template.activities) {
      if (kickoffPhases.has(a.phaseId)) continue
      for (const d of a.predecessors) {
        const p = byId.get(d.activityId)!
        if (!kickoffPhases.has(p.phaseId)) continue
        const required = earliestFinish(
          d,
          { start: p.deadlineOffset - p.durationWorkdays, finish: p.deadlineOffset },
          a.durationWorkdays,
        )
        minGap = Math.min(minGap, a.deadlineOffset - required)
      }
    }
    expect(late.compressionWorkdays).toBe(10 - minGap)
    expect(late.violations.length).toBeGreaterThan(0)
    for (const v of late.violations) {
      const a = late.publication.activities.find((x) => x.id === v.activityId)!
      expect(kickoffPhases.has(a.phaseId)).toBe(false)
    }
  })

  it('keeps skipped optional activities in the plan', () => {
    const { publication } = generate({ skipOptional: ['photo-planning', 'photo-shoot'] })
    expect(publication.activities.filter((a) => a.status === 'skipped').map((a) => a.id)).toEqual([
      'photo-planning',
      'photo-shoot',
    ])
    expect(() => generate({ skipOptional: ['first-draft'] })).toThrow('not optional')
    expect(() => generate({ skipOptional: ['nope'] })).toThrow('Unknown activity')
  })

  it('keeps every dependency satisfied in the generated dates', () => {
    const { publication } = generate({ desiredReleaseDate: '2028-03-01' })
    const byId = new Map(publication.activities.map((a) => [a.id, a]))
    for (const a of publication.activities) {
      for (const d of a.predecessors) {
        const required = earliestFinish(
          d,
          plannedSpan(cal, byId.get(d.activityId)!),
          a.durationWorkdays,
        )
        expect(plannedSpan(cal, a).finish).toBeGreaterThanOrEqual(required)
      }
    }
  })
})
