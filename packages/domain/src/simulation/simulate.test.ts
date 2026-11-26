import { describe, expect, it } from 'vitest'
import { getCalendar } from '../calendar/calendar'
import { addDays } from '../calendar/dates'
import { pause } from '../commands/commands'
import { generatePlan } from '../engine/generate'
import { assessHealth } from '../engine/health'
import type { ChangeEvent } from '../model/events'
import { releaseActivity, type Publication } from '../model/publication'
import { MASTERPLAN_V1 } from '../templates/masterplan-v1'
import { ctx } from '../testing/fixtures'
import { mulberry32, rngFor } from './random'
import { simulateProgress, taskOverrun, type SimulateOptions } from './simulate'

const RELEASE = '2027-10-15'
const { publication: fresh } = generatePlan({
  id: 'book',
  workingTitle: 'Bog',
  template: MASTERPLAN_V1,
  desiredReleaseDate: RELEASE,
})
const cal = getCalendar(fresh.calendar)
const END = addDays(RELEASE, 100)

function sim(pub: Publication, extra: Partial<SimulateOptions> = {}) {
  let n = 0
  return simulateProgress(pub, {
    from: pub.kickoffDate,
    to: END,
    policy: { kind: 'on_plan' },
    seed: 1,
    recordedAt: '2026-11-26T12:00:00.000Z',
    newId: () => `sim-${++n}`,
    ...extra,
  })
}

const summary = (events: ChangeEvent[]) =>
  events.map((e) => `${e.effectiveDate} ${e.type} ${String(e.payload.activityId ?? '')}`)

describe('random', () => {
  it('is deterministic and independent per key', () => {
    const a = mulberry32(7)
    const b = mulberry32(7)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    expect(rngFor(1, 'x')()).toBe(rngFor(1, 'x')())
    expect(rngFor(1, 'x')()).not.toBe(rngFor(1, 'y')())
  })
})

describe('simulateProgress: on plan', () => {
  const { publication: p, events } = sim(fresh)

  it('finishes every activity exactly on its deadline', () => {
    for (const a of p.activities) {
      expect(a.status).toBe('done')
      expect(a.actualFinish).toBe(a.deadline)
      if (a.kind === 'task') expect(a.actualStart).toBe(a.start)
    }
    expect(events.some((e) => e.type === 'activity_rescheduled')).toBe(false)
  })

  it('passes the gates through the normal commands', () => {
    expect(p).toMatchObject({
      planState: 'binding',
      bindingReleaseDate: RELEASE,
      lifecycle: 'released',
    })
    expect(p.baselines.map((b) => b.number)).toEqual([0])
    expect(events.filter((e) => e.type === 'plan_made_binding')).toHaveLength(1)
    expect(events.every((e) => e.by === 'simulation')).toBe(true)
  })

  it('is healthy at every point along the way', () => {
    for (const asOf of ['2027-01-15', '2027-05-03', '2027-09-01']) {
      const mid = sim(fresh, { to: asOf }).publication
      expect(assessHealth(mid, asOf).overall).toMatchObject({ late: 0, atRisk: 0 })
    }
  })
})

describe('simulateProgress: realistic', () => {
  const realistic = { kind: 'realistic' } as const

  it('is deterministic for a seed, and splitting the run changes nothing', () => {
    const whole = sim(fresh, { policy: realistic, seed: 42 })
    expect(sim(fresh, { policy: realistic, seed: 42 }).publication).toEqual(whole.publication)

    const mid = '2027-04-01'
    const first = sim(fresh, { policy: realistic, seed: 42, to: mid })
    const second = sim(first.publication, {
      policy: realistic,
      seed: 42,
      from: addDays(mid, 1),
      state: first.state,
    })
    expect(second.publication).toEqual(whole.publication)
    expect(summary([...first.events, ...second.events])).toEqual(summary(whole.events))

    expect(sim(fresh, { policy: realistic, seed: 43 }).publication).not.toEqual(whole.publication)
  })

  it('overruns some tasks and postpones them with a reason category', () => {
    const { publication: p, events } = sim(fresh, { policy: realistic, seed: 42 })
    const postponed = events.filter((e) => e.type === 'activity_rescheduled')
    expect(postponed.length).toBeGreaterThan(0)
    for (const e of postponed) expect(e.reasonCategory).toBeDefined()
    // The original plan is untouched.
    expect(p.baselines[0]!.activities['first-draft']!.deadline).toBe(
      fresh.activities.find((a) => a.id === 'first-draft')!.deadline,
    )
    const late = p.activities.filter(
      (a) => a.actualFinish! > p.baselines[0]!.activities[a.id]!.deadline,
    )
    expect(late.length).toBeGreaterThan(0)
  })

  it('overruns long and author/image/print tasks more often', () => {
    const tasks = fresh.activities.filter((a) => a.kind === 'task')
    const share = (seedCount: number, pick: (a: (typeof tasks)[number]) => boolean) => {
      let hit = 0
      let total = 0
      for (let seed = 0; seed < seedCount; seed++) {
        for (const a of tasks.filter(pick)) {
          total++
          if (taskOverrun(realistic, seed, a) > 0) hit++
        }
      }
      return hit / total
    }
    const slow = share(
      50,
      (a) => a.responsible.roles.includes('author') && a.durationWorkdays >= 10,
    )
    const quick = share(
      50,
      (a) => a.responsible.roles.includes('project-lead') && a.durationWorkdays <= 3,
    )
    expect(slow).toBeGreaterThan(quick)
  })
})

describe('simulateProgress: custom delays', () => {
  it('absorbs a 3-week author delay in the slack before production', () => {
    const { publication: p, events } = sim(fresh, {
      policy: { kind: 'custom', delays: { 'first-draft': 15 } },
    })
    const draft = p.activities.find((a) => a.id === 'first-draft')!
    expect(cal.countWorkdays(draft.actualStart!, draft.actualFinish!)).toBe(22 + 15)
    // Replanned while in progress: stretched from the actual start.
    expect(draft).toMatchObject({
      start: draft.actualStart,
      deadline: draft.actualFinish,
      durationWorkdays: 37,
    })
    const e = events.find((x) => x.type === 'activity_rescheduled')!
    expect(e).toMatchObject({ payload: { activityId: 'first-draft' }, reasonCategory: 'author' })
    expect(releaseActivity(p)!.actualFinish).toBe(RELEASE)
  })

  it('pushes the release when the delay is larger than the slack', () => {
    const { publication: p } = sim(fresh, {
      policy: { kind: 'custom', delays: { 'image-research': 40 } },
    })
    expect(releaseActivity(p)!.actualFinish! > RELEASE).toBe(true)
  })
})

describe('simulateProgress: pause', () => {
  it('makes no progress while paused', () => {
    const paused = pause(fresh, ctx(fresh.kickoffDate), { reason: 'Afventer fond' }).publication
    const { events } = sim(paused, { to: addDays(fresh.kickoffDate, 30) })
    expect(events).toEqual([])
  })
})
