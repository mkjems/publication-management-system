import { describe, expect, it } from 'vitest'
import { generatePlan } from './generate'
import { analyzePlan } from './analyze'
import { MASTERPLAN_V1 } from '../templates/masterplan-v1'
import { R, cal, day, milestone, patch, plan, point, task } from '../testing/fixtures'

// a (5d) → b (5d) → c (point) → release; "side" is an unconnected side track.
const base = plan(
  [
    task('a', 'A', 'Redaktør', 5, -20),
    task('b', 'B', 'Redaktør', 5, -10, ['a']),
    point('c', 'C', 'Redaktør', -5, ['b']),
    task('side', 'S', 'Redaktør', 3, -8),
  ],
  [milestone('rel', 'Udgivelse', 'Forlaget', 0, ['c'], { gate: 'release' })],
)

const slack = (an: ReturnType<typeof analyzePlan>, id: string) =>
  an.activities.get(id)!.slackWorkdays

describe('analyzePlan', () => {
  it('forecasts the plan unchanged before work starts, with slack to the release', () => {
    const an = analyzePlan(base, day(-40))
    for (const f of an.activities.values()) {
      expect(f.slipWorkdays).toBe(0)
      expect(f.pushedBy).toBeNull()
    }
    expect(['rel', 'c', 'b', 'a', 'side'].map((id) => slack(an, id))).toEqual([0, 5, 10, 15, 0])
    expect(an.activities.get('a')!.latestDeadline).toBe(day(-5))
    expect(an.criticalPath).toEqual(['a', 'b', 'c', 'rel'])
    expect(an.release).toEqual({
      target: day(0),
      planned: day(0),
      forecast: day(0),
      slipWorkdays: 0,
    })
  })

  it('pushes work that has not started by today, and its successors', () => {
    // a should have started at day(-24); it is now day(-17) and a has not started.
    const an = analyzePlan(base, day(-17))
    const a = an.activities.get('a')!
    expect(a).toMatchObject({ deadline: day(-13), start: day(-17), slipWorkdays: 7 })
    expect(a.pushedBy).toEqual({ reason: 'today' })
    const b = an.activities.get('b')!
    expect(b).toMatchObject({ deadline: day(-8), slipWorkdays: 2 })
    expect(b.pushedBy).toEqual({ reason: 'predecessor', activityId: 'a' })
    // c has 3 days of its 5 left; the release is untouched.
    expect(an.activities.get('c')!.slipWorkdays).toBe(0)
    expect(an.release.slipWorkdays).toBe(0)
    expect(slack(an, 'a')).toBe(8)
  })

  it('uses actual dates for finished work', () => {
    const p = patch(base, 'a', {
      status: 'done',
      actualStart: day(-24),
      actualFinish: day(-15),
    })
    const an = analyzePlan(p, day(-14))
    expect(an.activities.get('a')).toMatchObject({
      deadline: day(-15),
      slipWorkdays: 5,
      slackWorkdays: null,
      latestDeadline: null,
    })
    expect(an.activities.get('b')!.slipWorkdays).toBe(0)
    expect(an.criticalPath).toEqual(['b', 'c', 'rel'])
  })

  it('pushes the release when an activity waits too long', () => {
    const p = patch(base, 'b', {
      status: 'waiting',
      waitingFor: { text: 'Fondssvar', expectedDate: day(-3) },
    })
    const an = analyzePlan(p, day(-30))
    expect(an.activities.get('b')).toMatchObject({ deadline: day(1), slipWorkdays: 11 })
    expect(an.activities.get('b')!.pushedBy).toEqual({ reason: 'waiting' })
    expect(an.release).toMatchObject({ forecast: day(1), slipWorkdays: 1 })
    expect(slack(an, 'b')).toBe(-1)
    expect(an.criticalPath).toEqual(['a', 'b', 'c', 'rel'])
  })

  it('flags pinned activities the forecast runs past', () => {
    const p = patch(
      patch(base, 'b', {
        status: 'waiting',
        waitingFor: { text: 'Fondssvar', expectedDate: day(-3) },
      }),
      'c',
      { pinned: true },
    )
    const an = analyzePlan(p, day(-30))
    expect(an.activities.get('c')).toMatchObject({ pinnedConflict: true, slackWorkdays: -6 })
  })

  it('counts the full duration from a late actual start, and ignores start rules once started', () => {
    const p = patch(base, 'b', { status: 'in_progress', actualStart: day(-12) })
    const an = analyzePlan(p, day(-11))
    expect(an.activities.get('b')).toMatchObject({ deadline: day(-8), slipWorkdays: 2 })
    expect(an.activities.get('b')!.pushedBy).toEqual({ reason: 'started_late' })
    expect(an.activities.get('b')!.start).toBe(day(-12))
  })

  it('treats skipped activities as zero-length pass-throughs', () => {
    const chain = plan(
      [
        task('a', 'A', 'Redaktør', 5, -20),
        task('x', 'X', 'Redaktør', 3, -15, ['a'], { optional: true }),
        task('b', 'B', 'Redaktør', 5, -8, ['x']),
        point('c', 'C', 'Redaktør', -5, ['b']),
      ],
      [milestone('rel', 'Udgivelse', 'Forlaget', 0, ['c'], { gate: 'release' })],
    )
    // a is late (forecast day(-13)). With x in the plan, b slips; with x skipped, it does not.
    expect(analyzePlan(chain, day(-17)).activities.get('b')!.slipWorkdays).toBe(3)
    const skipped = analyzePlan(patch(chain, 'x', { status: 'skipped' }), day(-17))
    expect(skipped.activities.get('b')!.slipWorkdays).toBe(0)
    expect(skipped.activities.get('x')!.slackWorkdays).toBeNull()
    expect(skipped.criticalPath).toEqual(['a', 'b', 'c', 'rel'])
  })

  it('does not let side tracks eat into the release chain’s slack', () => {
    // "press" hangs off b with no buffer before its own deadline, but does not lead to the release.
    const p = plan(
      [
        task('a', 'A', 'Redaktør', 5, -20),
        task('b', 'B', 'Redaktør', 5, -10, ['a']),
        point('c', 'C', 'Redaktør', -5, ['b']),
        task('press', 'P', 'Presseansvarlig', 2, -8, ['b']),
      ],
      [milestone('rel', 'Udgivelse', 'Forlaget', 0, ['c'], { gate: 'release' })],
    )
    const an = analyzePlan(p, day(-40))
    expect(slack(an, 'b')).toBe(10)
    expect(slack(an, 'press')).toBe(0)
  })

  it('measures the release against the binding date once set', () => {
    const p = { ...base, bindingReleaseDate: day(-2), planState: 'binding' as const }
    const an = analyzePlan(p, day(-40))
    expect(an.release).toMatchObject({ target: day(-2), slipWorkdays: 2 })
    expect(slack(an, 'rel')).toBe(-2)
    expect(R).toBe(cal.ordinal(day(0)))
  })
})

describe('analyzePlan on the master plan', () => {
  const { publication } = generatePlan({
    id: 'p',
    workingTitle: 'Bog',
    template: MASTERPLAN_V1,
    desiredReleaseDate: '2028-06-01',
  })
  const an = analyzePlan(publication, '2026-11-26')

  it('has no slip and no negative slack in a freshly generated plan', () => {
    expect(an.release.slipWorkdays).toBe(0)
    for (const f of an.activities.values()) {
      expect(f.slipWorkdays).toBe(0)
      expect(f.slackWorkdays).toBeGreaterThanOrEqual(0)
    }
  })

  it('finds the critical chain described in masterplan-defaults.md', () => {
    const path = an.criticalPath
    expect(path[0]).toBe('kickoff-meeting')
    expect(path.at(-1)).toBe('m-release')
    for (const id of [
      'm-go',
      'detailed-budget',
      'm-funding',
      'binding-release-date',
      'm-production-start',
      'image-research',
      'm-images-complete',
      'm-layout-approved',
      'm-first-proof',
      'm-second-proof',
      'm-book-closed',
      'm-print-approval',
      'm-books-in-stock',
    ]) {
      expect(path).toContain(id)
    }
    // The two documented buffers: 10 working days between "på lager" and release.
    expect(an.activities.get('m-books-in-stock')!.slackWorkdays).toBe(10)
  })
})
