import { describe, expect, it } from 'vitest'
import type { Publication } from '../model/publication'
import { day, milestone, patch, plan, point, task } from '../testing/fixtures'
import { assessHealth } from './health'

const base = plan(
  [
    task('a', 'A', 'Redaktør', 5, -20),
    task('b', 'B', 'Redaktør', 5, -10, ['a']),
    point('c', 'C', 'Redaktør', -5, ['b']),
  ],
  [milestone('rel', 'Udgivelse', 'Forlaget', 0, ['c'], { gate: 'release' })],
)

const state = (p: Publication, asOf: string, id: string) =>
  assessHealth(p, asOf).activities.get(id)!

describe('assessHealth', () => {
  it('is on track before anything is due', () => {
    const h = assessHealth(base, day(-40))
    expect([...h.activities.values()].map((x) => x.state)).toEqual([
      'on_track',
      'on_track',
      'on_track',
      'on_track',
    ])
    expect(h.overall).toMatchObject({ state: 'on_track', total: 4, done: 0, progress: 0 })
    expect(h.paused).toBe(false)
  })

  it('marks overdue work late and its successors at risk', () => {
    const h = assessHealth(base, day(-17))
    expect(h.activities.get('a')).toMatchObject({
      state: 'late',
      reasons: ['overdue', 'forecast_slip'],
    })
    expect(h.activities.get('b')).toMatchObject({ state: 'at_risk', reasons: ['forecast_slip'] })
    expect(h.activities.get('c')!.state).toBe('on_track')
    expect(h.overall.state).toBe('late')
  })

  it('is not late on the deadline day itself', () => {
    const p = patch(base, 'a', { status: 'in_progress', actualStart: day(-24) })
    expect(state(p, day(-20), 'a').state).toBe('on_track')
    expect(state(p, day(-19), 'a').state).toBe('late')
  })

  it('reports waiting work, and a release at risk', () => {
    const p = patch(base, 'b', {
      status: 'waiting',
      waitingFor: { text: 'Fondssvar', expectedDate: day(-3) },
    })
    const h = assessHealth(p, day(-30))
    expect(h.activities.get('b')).toMatchObject({
      state: 'waiting',
      reasons: ['waiting', 'forecast_slip', 'low_slack'],
    })
    expect(h.release.slipWorkdays).toBe(1)
    expect(h.activities.get('rel')!.state).toBe('at_risk')
  })

  it('uses a configurable slack threshold', () => {
    // c has 5 days of slack.
    expect(
      assessHealth(base, day(-40), { atRiskSlackWorkdays: 6 }).activities.get('c')!.state,
    ).toBe('at_risk')
  })

  it('rolls up progress per phase and overall', () => {
    let p = patch(base, 'a', { status: 'done', actualStart: day(-24), actualFinish: day(-20) })
    p = patch(p, 'c', { status: 'skipped' })
    const h = assessHealth(p, day(-15))
    // 1 of the 3 non-skipped activities is done.
    expect(h.phases.get('p1')).toMatchObject({ total: 4, done: 1, skipped: 1, progress: 1 / 3 })
    expect(h.activities.get('a')!.state).toBe('done')
  })

  it('measures slip against the original baseline', () => {
    const p: Publication = {
      ...patch(base, 'b', { deadline: day(-7), start: day(-11) }),
      planState: 'binding',
      bindingReleaseDate: day(0),
      baselines: [
        {
          number: 0,
          capturedOn: day(-60),
          reason: 'Finansiering på plads',
          releaseDate: day(0),
          activities: Object.fromEntries(
            base.activities.map((a) => [a.id, { start: a.start, deadline: a.deadline }]),
          ),
        },
      ],
    }
    const h = assessHealth(p, day(-40))
    expect(h.activities.get('b')!.slipVsBaselineWorkdays).toBe(3)
    expect(h.activities.get('a')!.slipVsBaselineWorkdays).toBe(0)
  })

  it('flags a paused publication', () => {
    const p: Publication = {
      ...base,
      pauses: [{ from: day(-30), to: null, reason: 'Afventer fond' }],
    }
    expect(assessHealth(p, day(-25)).paused).toBe(true)
  })
})
