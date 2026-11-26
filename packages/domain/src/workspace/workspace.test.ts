import { describe, expect, it } from 'vitest'
import { getCalendar, DEFAULT_CALENDAR } from '../calendar/calendar'
import { assessHealth } from '../engine/health'
import { advanceSimulation } from '../simulation/scenario'
import { seedDemoWorkspace, DEMO_BOOKS } from './demo'
import { parseWorkspaceSnapshot, type WorkspaceSnapshot } from './workspace'

const TODAY = '2026-11-26'
const cal = getCalendar(DEFAULT_CALENDAR)
let n = 0
const opts = { today: TODAY, recordedAt: '2026-11-26T12:00:00.000Z', newId: () => `d-${++n}` }
const demo = seedDemoWorkspace(opts)
const byId = (id: string) => demo.publications.find((r) => r.publication.id === id)!

describe('seedDemoWorkspace', () => {
  it('creates every demo book, started, with history but nothing to undo', () => {
    expect(demo.publications.map((r) => r.publication.workingTitle)).toEqual(
      DEMO_BOOKS.map((b) => b.title),
    )
    for (const r of demo.publications) {
      expect(r.publication.kickoffDate <= TODAY).toBe(true)
      expect(r.history.log.length).toBeGreaterThan(0)
      expect(r.history.undoable).toEqual([])
      expect(r.publication.projectLeadId).toMatch(/^demo-/)
    }
  })

  it('has books in different situations today', () => {
    const health = (id: string) => assessHealth(byId(id).publication, TODAY)
    expect(health('demo-kunstnerens-hus').overall.progress).toBeGreaterThan(0.75)
    expect(health('demo-industriens-arkitektur').release.slipWorkdays).toBeGreaterThan(0)
    expect(byId('demo-den-danske-have').publication.lifecycle).toBe('paused')
    expect(byId('demo-nye-stemmer').publication.planState).toBe('preliminary')
    expect(byId('demo-fjordens-fugle').publication.planState).toBe('binding')
  })

  it('is deterministic for a date', () => {
    let m = 0
    const again = seedDemoWorkspace({ ...opts, newId: () => `d-${++m}` })
    expect(again.publications.map((r) => r.publication)).toEqual(
      demo.publications.map((r) => r.publication),
    )
  })

  it('keeps the scripted resume for the paused book, and plays it when time advances', () => {
    const hold = byId('demo-den-danske-have')
    expect(hold.simulation!.script.map((e) => e.action.kind)).toEqual(['resume'])
    const resumeOn = hold.simulation!.script[0]!.on
    const later = advanceSimulation(
      { ...hold, simulation: hold.simulation! },
      {
        from: cal.addWorkdays(TODAY, 1),
        to: resumeOn,
        recordedAt: opts.recordedAt,
        newId: opts.newId,
      },
    )
    expect(later.publication.lifecycle).not.toBe('paused')
    expect(later.simulation.script).toEqual([])
    expect(later.history.log.at(-1)!.effectiveDate <= resumeOn).toBe(true)
  })
})

describe('workspace snapshot', () => {
  it('round-trips through JSON', () => {
    const snapshot: WorkspaceSnapshot = {
      format: 'pms-workspace',
      version: 1,
      exportedAt: '2026-11-26T12:00:00.000Z',
      workspace: 'demo',
      simulatedDate: TODAY,
      people: demo.people,
      publications: demo.publications,
    }
    expect(parseWorkspaceSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot)
  })

  it('rejects other files with a readable message', () => {
    expect(() => parseWorkspaceSnapshot({ hello: 'world' })).toThrow(
      'Invalid workspace file at format',
    )
  })
})
