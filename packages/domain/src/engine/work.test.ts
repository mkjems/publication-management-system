import { describe, expect, it } from 'vitest'
import { assignRole, setStatus } from '../commands/commands'
import { ctx, day, milestone, patch, plan, task } from '../testing/fixtures'
import { assessHealth } from './health'
import { endOfWeek, workItems } from './work'

const base = plan(
  [
    task('late', 'Skrivning', 'Forfatter', 5, -20),
    task('due', 'Redaktion', 'Redaktør', 5, -12),
    task('starts', 'Layout', 'Grafiker', 5, -8),
    task('next', 'Korrektur', 'Redaktør', 3, -7),
    task('far', 'Tryk', 'Trykker', 5, -1),
    task('wait', 'Billeder', 'Billedansvarlig', 10, -2),
  ],
  [milestone('rel', 'Udgivelse', 'Forlaget', 0, [], { gate: 'release' })],
)

describe('workItems', () => {
  // day(-14) is Monday 8 March 2027.
  const asOf = day(-14)

  it('sorts open work into buckets by urgency', () => {
    expect(endOfWeek(asOf)).toBe('2027-03-14')
    let p = setStatus(base, 'wait', 'waiting', ctx(asOf), {
      waitingFor: { text: 'Rettigheder', expectedDate: null },
    }).publication
    p = setStatus(p, 'far', 'in_progress', ctx(asOf)).publication
    const items = workItems(p, assessHealth(p, asOf))
    expect(items.map((i) => [i.activity.id, i.bucket])).toEqual([
      ['late', 'overdue'],
      ['wait', 'waiting'],
      ['due', 'due_this_week'],
      ['starts', 'starting_this_week'],
      ['next', 'due_next_week'],
      ['far', 'in_progress'],
    ])
    expect(items[0]!.state).toBe('late')
  })

  it('filters by role and by person (assignee, role holder or project lead)', () => {
    const h = (p: typeof base) => assessHealth(p, asOf)
    const ids = (p: typeof base, f: Parameters<typeof workItems>[2]) =>
      workItems(p, h(p), f).map((i) => i.activity.id)
    expect(ids(base, { kind: 'role', roleId: 'editor' })).toEqual(['due', 'next'])
    expect(ids(base, { kind: 'person', personId: 'mikkel' })).toEqual([])
    const assigned = assignRole(base, 'editor', ['mikkel'], ctx(asOf)).publication
    expect(ids(assigned, { kind: 'person', personId: 'mikkel' })).toEqual(['due', 'next'])
    const direct = patch(base, 'starts', { assigneeIds: ['mikkel'] })
    expect(ids(direct, { kind: 'person', personId: 'mikkel' })).toEqual(['starts'])
  })

  it('has no current work for a paused or stopped book', () => {
    const paused = {
      ...base,
      lifecycle: 'paused' as const,
      pauses: [{ from: asOf, to: null, reason: '' }],
    }
    expect(workItems(paused, assessHealth(paused, asOf))).toEqual([])
    const stopped = { ...base, lifecycle: 'no_go' as const }
    expect(workItems(stopped, assessHealth(stopped, asOf))).toEqual([])
  })
})
