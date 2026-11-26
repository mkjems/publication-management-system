import { MASTERPLAN_V1 } from '@pms/domain'
import { describe, expect, it } from 'vitest'
import { groupTemplate } from './group-template'

describe('groupTemplate', () => {
  it('keeps every activity when unfiltered', () => {
    const groups = groupTemplate(MASTERPLAN_V1)
    expect(groups).toHaveLength(11)
    expect(groups.reduce((n, g) => n + g.total, 0)).toBe(MASTERPLAN_V1.activities.length)
  })

  it('filters by text, case-insensitively, including Danish letters', () => {
    const groups = groupTemplate(MASTERPLAN_V1, { query: 'BILLEDUDVÆLGELSE' })
    const names = groups.flatMap((g) => g.tracks.flatMap((t) => t.activities.map((a) => a.name)))
    expect(names).toEqual(['Billedudvælgelse', 'Endelig billedudvælgelse'])
  })

  it('filters by role and drops empty phases', () => {
    const groups = groupTemplate(MASTERPLAN_V1, { role: 'photographer' })
    expect(groups.map((g) => g.phase.number)).toEqual([3])
  })
})
