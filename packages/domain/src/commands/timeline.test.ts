import { describe, expect, it } from 'vitest'
import { comparePlans, isSamePlan } from '../engine/compare'
import { SCENARIOS } from '../simulation/library'
import { runScenario } from '../simulation/scenario'
import { ctx, day, get, milestone, plan, point, task } from '../testing/fixtures'
import { scenarioBook } from '../workspace/demo'
import { changeReleaseDate, pause, reschedule, resume, setStatus } from './commands'
import { emptyHistory, record, undo, type History } from './history'
import { previewCommand } from './preview'
import { milestoneTrend, planAt, planTimeline } from './timeline'

const base = plan(
  [
    task('a', 'Skrivning', 'Forfatter', 5, -30),
    task('b', 'Redaktion', 'Redaktør', 10, -20, ['a']),
    point('d', 'Tryk', 'Trykker', -8, ['b']),
  ],
  [
    milestone('m-ms', 'Manus låst', 'Forlaget', -19, ['b']),
    milestone('rel', 'Udgivelse', 'Forlaget', 0, ['d'], { gate: 'release' }),
  ],
)

describe('comparePlans', () => {
  it('lists moved activities, milestone forecasts and the release effect', () => {
    const after = changeReleaseDate(base, day(10), ctx(day(-40))).publication
    const c = comparePlans(base, after, day(-40))
    expect(c.moved.map((m) => m.activityId).sort()).toEqual(['a', 'b', 'd', 'm-ms', 'rel'])
    expect(c.moved.every((m) => m.deltaWorkdays === 10)).toBe(true)
    expect(c.milestones.map((m) => [m.activityId, m.forecastDeltaWorkdays])).toEqual([
      ['m-ms', 10],
      ['rel', 10],
    ])
    expect(c.release).toMatchObject({
      targetBefore: day(0),
      targetAfter: day(10),
      forecastDeltaWorkdays: 10,
      slipAfter: 0,
    })
    expect(isSamePlan(c)).toBe(false)
    expect(isSamePlan(comparePlans(base, base, day(-40)))).toBe(true)
  })

  it('reports status changes without moves', () => {
    const after = setStatus(base, 'a', 'in_progress', ctx(day(-34))).publication
    const c = comparePlans(base, after, day(-34))
    expect(c.statusChanged).toEqual(['a'])
    expect(c.moved).toEqual([])
  })
})

describe('previewCommand', () => {
  it('runs a command without touching the input and compares the result', () => {
    const paused = pause(base, ctx(day(-25)), { reason: 'Fond' }).publication
    const p = previewCommand(paused, day(-20), (pub, c) =>
      resume(pub, c, { mode: { kind: 'shift' }, acceptConflicts: true }),
    )
    expect(p.events.map((e) => e.type)).toEqual(['resumed', 'release_date_changed'])
    expect(p.comparison.release.targetAfter).toBe(day(5))
    expect(p.pinnedConflicts).toEqual([])
    expect(paused.pauses[0]!.to).toBeNull()
  })
})

describe('planTimeline', () => {
  function story() {
    let pub = base
    let history: History = emptyHistory
    const run = (r: { publication: typeof pub; events: History['log'] }) => {
      pub = r.publication
      history = record(history, r.events)
    }
    run(setStatus(pub, 'a', 'in_progress', ctx(day(-34))))
    run(
      reschedule(
        pub,
        { kind: 'delay', activityId: 'a', workdays: 15 },
        { strategy: 'absorb' },
        ctx(day(-31)),
      ),
    )
    // Two changes on the same day: the version is the state after both.
    run(setStatus(pub, 'a', 'done', ctx(day(-15))))
    run(setStatus(pub, 'b', 'in_progress', ctx(day(-15))))
    return { pub, history }
  }

  it('rebuilds the plan as it was at the end of each day with changes', () => {
    const { pub, history } = story()
    const t = planTimeline(pub, history)
    expect(t.complete).toBe(true)
    expect(t.initial).toEqual(base)
    expect(t.versions.map((v) => v.date)).toEqual([day(-34), day(-31), day(-15)])
    expect(get(planAt(t, day(-32)), 'a').status).toBe('in_progress')
    expect(get(planAt(t, day(-32)), 'a').deadline).toBe(day(-30))
    expect(get(planAt(t, day(-31)), 'a').deadline).toBe(day(-15))
    expect(planAt(t, day(-15))).toBe(pub)
    expect(planAt(t, day(-50))).toBe(t.initial)
  })

  it('includes undo and stops at a log it cannot replay', () => {
    const { pub, history } = story()
    const u = undo(pub, history, ctx(day(-14)))
    const t = planTimeline(u.publication, u.history)
    expect(t.versions.at(-1)!.date).toBe(day(-14))
    expect(get(t.versions.at(-1)!.publication, 'b').status).toBe('not_started')

    // A state that does not match the log: only the part that can be replayed is used.
    const tampered = {
      ...pub,
      activities: pub.activities.map((a) =>
        a.id === 'b' ? { ...a, status: 'not_started' as const, actualStart: null } : a,
      ),
    }
    const broken = planTimeline(tampered, history)
    expect(broken.complete).toBe(false)
    expect(broken.versions).toEqual([])
    expect(broken.initial).toBe(tampered)
  })
})

describe('milestoneTrend', () => {
  it('samples weekly and on planning changes, with the forecast as of each date', () => {
    let pub = base
    let history: History = emptyHistory
    const r = reschedule(
      pub,
      { kind: 'delay', activityId: 'b', workdays: 12 },
      { strategy: 'push' },
      ctx(day(-37)),
    )
    pub = r.publication
    history = record(history, r.events)
    const trend = milestoneTrend(pub, history, { asOf: day(-5) })

    expect(trend.dates[0]).toBe(day(-37))
    expect(trend.dates).toContain(day(-32))
    expect(trend.dates.at(-1)).toBe(day(-5))
    expect(trend.milestones.map((m) => m.activityId)).toEqual(['m-ms', 'rel'])
    const rel = trend.milestones.find((m) => m.activityId === 'rel')!
    // The push moved the release on day -37 and every sample after shows it.
    expect(rel.points[0]).toMatchObject({ date: day(-37), planned: day(4), done: false })
    // a has not started by day -5 (planned start day -34): its forecast pushes the release.
    const last = rel.points.at(-1)!
    expect(last.forecast > last.planned).toBe(true)
    // Push moves the release milestone but not the target: the plan now shows a slip.
    expect(trend.target.every((t) => t.target === day(0))).toBe(true)
  })

  it('handles a whole simulated book', () => {
    const scenario = SCENARIOS.find((s) => s.id === 'funding-hold-6-weeks')!
    const release = '2027-10-15'
    const r = runScenario(scenario, { releaseDate: release, recordedAt: '2026-11-26T12:00:00Z' })
    const asOf = r.history.log.at(-1)!.effectiveDate
    const trend = milestoneTrend(r.publication, r.history, { asOf })
    expect(trend.complete).toBe(true)
    expect(trend.milestones.length).toBeGreaterThan(10)
    const rel = trend.milestones.find((m) => m.activityId === 'm-release')!
    // The HOLD moved the release: the first forecast is the original date, the last is later.
    expect(rel.points[0]!.forecast).toBe(release)
    expect(rel.points.at(-1)!.forecast > release).toBe(true)
    expect(rel.points.at(-1)!.done).toBe(true)
  })
})

describe('scenarioBook', () => {
  it('plays a library scenario up to today and keeps the rest of the script', () => {
    const scenario = SCENARIOS.find((s) => s.id === 'funding-hold-6-weeks')!
    let n = 0
    const book = scenarioBook(scenario, {
      releaseDate: '2027-10-15',
      today: '2026-11-26',
      recordedAt: '2026-11-26T12:00:00Z',
      newId: () => `x-${++n}`,
      publicationId: 'book',
      workingTitle: 'Havebogen',
    })
    expect(book.publication).toMatchObject({ id: 'book', workingTitle: 'Havebogen' })
    expect(book.history.log.every((e) => e.effectiveDate <= '2026-11-26')).toBe(true)
    expect(
      book.simulation!.script.map((e) => e.action.kind).filter((k) => k !== 'funding'),
    ).toEqual(['pause', 'resume'])
    expect(book.publication.funding.applications.map((a) => a.status)).toEqual([
      'planned',
      'planned',
      'planned',
    ])
  })
})
