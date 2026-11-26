import { MASTERPLAN_V1, assessHealth, generatePlan } from '@pms/domain'
import { describe, expect, it } from 'vitest'
import { groupActivities } from '@/lib/publication'
import { layoutRows, ROW_HEIGHT } from './rows'
import { createScale, dayTicks, isoWeek, monthTicks, planRange, weekTicks } from './scale'

describe('scale', () => {
  const scale = createScale('2026-11-26', '2027-01-10', 'month')

  it('starts on a Monday and maps days to pixels', () => {
    expect(scale.start).toBe('2026-11-23')
    expect(scale.x('2026-11-23')).toBe(0)
    expect(scale.x('2026-11-30')).toBe(7 * 8)
    expect(scale.dayAt(7 * 8 + 3)).toBe('2026-11-30')
    expect(scale.width).toBe(49 * 8)
  })

  it('computes ISO week numbers across year boundaries', () => {
    expect(isoWeek('2026-11-26')).toBe(48)
    expect(isoWeek('2026-12-31')).toBe(53)
    expect(isoWeek('2027-01-04')).toBe(1)
    expect(isoWeek('2027-01-01')).toBe(53)
  })

  it('makes month, week and day ticks', () => {
    expect(monthTicks(scale).map((t) => t.label)).toEqual(['nov. 2026', 'dec. 2026', 'jan. 2027'])
    expect(monthTicks(scale)[0]).toMatchObject({ x: 0, width: 8 * 8 })
    expect(weekTicks(scale).map((t) => t.label)).toEqual(['48', '49', '50', '51', '52', '53', '1'])
    expect(dayTicks(createScale('2026-11-23', '2026-11-25', 'week')).map((t) => t.label)).toEqual([
      '23',
      '24',
      '25',
    ])
  })
})

describe('planRange and layoutRows', () => {
  const { publication } = generatePlan({
    id: 'p',
    workingTitle: 'Bog',
    template: MASTERPLAN_V1,
    desiredReleaseDate: '2027-10-15',
  })
  const health = assessHealth(publication, '2026-11-26')

  it('covers the whole plan with margins', () => {
    const range = planRange(publication, health, '2026-11-26')
    expect(range.start < publication.kickoffDate).toBe(true)
    expect(range.end > '2027-10-15').toBe(true)
  })

  it('lays out phases, tracks and activities, skipping closed phases', () => {
    const groups = groupActivities(publication)
    const open = layoutRows(groups, () => true, 'Milepæle')
    expect(open.rows[0]).toMatchObject({ kind: 'phase', y: 0 })
    expect(open.rows[1]).toMatchObject({ kind: 'track', y: ROW_HEIGHT.phase })
    expect(open.rows.filter((r) => r.kind === 'activity')).toHaveLength(
      publication.activities.length,
    )
    expect(open.centerY.get('kickoff-meeting')).toBe(ROW_HEIGHT.phase + ROW_HEIGHT.track + 15)

    const closed = layoutRows(groups, (id) => id !== 'p01', 'Milepæle')
    expect(closed.centerY.has('kickoff-meeting')).toBe(false)
    expect(closed.rows[1]).toMatchObject({ kind: 'phase', y: ROW_HEIGHT.phase })
  })
})
