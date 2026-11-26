import { assessHealth, generatePlan, MASTERPLAN_V1, setStatus } from '@pms/domain'
import { describe, expect, it } from 'vitest'
import { portfolioRow } from './rows'

const { publication } = generatePlan({
  id: 'b',
  workingTitle: 'Bog',
  template: MASTERPLAN_V1,
  desiredReleaseDate: '2027-10-15',
})
const ctx = (asOf: string) => ({
  asOf,
  recordedAt: '2026-11-26T12:00:00Z',
  by: null,
  newId: () => 'x',
})

describe('portfolioRow', () => {
  it('has one band per phase in order, the key milestones and the release', () => {
    const asOf = publication.kickoffDate
    const row = portfolioRow(publication, assessHealth(publication, asOf))
    expect(row.phases.map((p) => p.phase.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(row.phases.every((p) => p.start <= p.end)).toBe(true)
    expect(row.milestones.map((m) => m.id)).toEqual([
      'm-go',
      'm-funding',
      'm-production-start',
      'm-manuscript-locked',
      'm-print-approval',
    ])
    expect(row.release).toEqual({ target: '2027-10-15', forecast: '2027-10-15', done: false })
    expect(row.first <= row.phases[0]!.start).toBe(true)
  })

  it('draws done work at its actual dates and open work at its forecast', () => {
    const late = '2026-12-31'
    const p = setStatus(publication, 'kickoff-meeting', 'done', ctx(late)).publication
    const row = portfolioRow(p, assessHealth(p, late))
    const first = row.phases[0]!
    expect(first.end >= late).toBe(true)
    // The GO milestone is now forecast later than planned.
    expect(row.milestones[0]!.late).toBe(true)
  })
})
