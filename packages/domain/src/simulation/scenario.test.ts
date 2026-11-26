import { describe, expect, it } from 'vitest'
import { getCalendar } from '../calendar/calendar'
import { analyzePlan } from '../engine/analyze'
import { originalBaseline, releaseActivity } from '../model/publication'
import { SCENARIOS } from './library'
import { runScenario, type ScenarioRun, type ScenarioSnapshot } from './scenario'

const RELEASE = '2027-10-15'
const scenario = (id: string) => SCENARIOS.find((s) => s.id === id)!
const run = (id: string) =>
  runScenario(scenario(id), { releaseDate: RELEASE, recordedAt: '2026-11-26T12:00:00.000Z' })

const runs = new Map<string, ScenarioRun>(SCENARIOS.map((s) => [s.id, run(s.id)]))
const get = (id: string) => runs.get(id)!
const released = (r: ScenarioRun) => releaseActivity(r.publication)!.actualFinish

/** One line per week: compact enough to review in a snapshot diff. */
function timeline(snapshots: ScenarioSnapshot[]) {
  return snapshots.map(
    (s) =>
      `${s.date}  target ${s.target}  forecast ${s.forecastRelease} (${s.releaseSlipWorkdays! > 0 ? '+' : ''}${s.releaseSlipWorkdays})  ` +
      `done ${s.done}/${s.total}  late ${s.late}  risk ${s.atRisk}  wait ${s.waiting}  ${s.lifecycle}/${s.planState}`,
  )
}

describe('scenario library', () => {
  it('has unique ids and Danish names', () => {
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length)
  })

  it('on plan: releases on the date, never forecasts a slip', () => {
    const r = get('on-plan')
    expect(released(r)).toBe(RELEASE)
    expect(r.snapshots.every((s) => s.releaseSlipWorkdays! <= 0 && s.late === 0)).toBe(true)
    expect(r.publication.lifecycle).toBe('released')
  })

  it('author 3 weeks late: the delay is logged and absorbed', () => {
    const r = get('author-3-weeks-late')
    const postponed = r.history.log.filter(
      (e) => e.type === 'activity_rescheduled' && e.payload.activityId === 'first-draft',
    )
    expect(postponed).toHaveLength(1)
    expect(postponed[0]!.reasonCategory).toBe('author')
    expect(released(r)).toBe(RELEASE)
    // The original deadline is kept in baseline 0... once the plan is binding (it already is).
    const base = originalBaseline(r.publication)!
    const draft = r.publication.activities.find((a) => a.id === 'first-draft')!
    expect(
      getCalendar(r.publication.calendar).workdaysBetween(
        base.activities['first-draft']!.deadline,
        draft.deadline,
      ),
    ).toBe(15)
  })

  it('funding HOLD for 6 weeks: the plan and the release move by 30 working days', () => {
    const r = get('funding-hold-6-weeks')
    const cal = getCalendar(r.publication.calendar)
    const types = r.history.log.map((e) => e.type)
    expect(types).toContain('paused')
    expect(types).toContain('resumed')
    expect(r.publication.pauses).toHaveLength(1)
    expect(cal.workdaysBetween(RELEASE, released(r)!)).toBe(30)
    // The plan became binding after the pause, so baseline 0 holds the moved dates.
    expect(originalBaseline(r.publication)!.releaseDate).toBe(released(r))
    expect(r.snapshots.some((s) => s.lifecycle === 'paused')).toBe(true)
  })

  it('printer 1 week late: the stock buffer takes it', () => {
    const r = get('printer-1-week-late')
    expect(released(r)).toBe(RELEASE)
    const stock = r.publication.activities.find((a) => a.id === 'm-books-in-stock')!
    const base = originalBaseline(r.publication)!.activities['m-books-in-stock']!
    // 5 days late at the printer, minus the 1 day of slack between printing and stock.
    expect(
      getCalendar(r.publication.calendar).workdaysBetween(base.deadline, stock.actualFinish!),
    ).toBe(4)
  })

  it('realistic: slips happen, are logged, and show up as a forecast before the release', () => {
    const r = get('realistic')
    expect(r.history.log.filter((e) => e.type === 'activity_rescheduled').length).toBeGreaterThan(3)
    const slip = getCalendar(r.publication.calendar).workdaysBetween(RELEASE, released(r)!)
    expect(slip).toBeGreaterThan(0)
    // The slip was visible as a forecast while there was still time to act.
    const warned = r.snapshots.find((s) => s.releaseSlipWorkdays! > 0)!
    expect(warned.date < released(r)!).toBe(true)
    // Nothing that leads to the release is left open.
    expect(analyzePlan(r.publication, r.snapshots.at(-1)!.date).criticalPath).toEqual([])
  })

  it('replays week by week to the same timeline', () => {
    for (const s of SCENARIOS) {
      expect(timeline(get(s.id).snapshots)).toMatchSnapshot(s.id)
    }
  })

  it('is reproducible', () => {
    expect(run('realistic').publication).toEqual(get('realistic').publication)
  })
})
