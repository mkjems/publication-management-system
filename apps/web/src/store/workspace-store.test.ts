import 'fake-indexeddb/auto'
import { CommandError, getCalendar, DEFAULT_CALENDAR, reschedule, setStatus } from '@pms/domain'
import { describe, expect, it } from 'vitest'
import {
  IndexedDbWorkspaceRepository,
  MemoryWorkspaceRepository,
  type WorkspaceRepository,
} from '@/data/repository'
import { createWorkspaceStore } from './workspace-store'

const TODAY = '2026-11-26'
const cal = getCalendar(DEFAULT_CALENDAR)

function setup(kind: 'demo' | 'real' = 'real') {
  const repos = { demo: new MemoryWorkspaceRepository(), real: new MemoryWorkspaceRepository() }
  let n = 0
  const store = createWorkspaceStore(
    {
      repository: (k) => repos[k],
      clock: { today: () => TODAY, now: () => '2026-11-26T09:00:00.000Z' },
      newId: () => `id-${++n}`,
    },
    kind,
  )
  return { store, repos }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('workspace store: real workspace', () => {
  it('creates a publication and persists it with a new project lead', async () => {
    const { store, repos } = setup()
    await store.getState().load()
    const id = store.getState().createPublication({
      workingTitle: '  Havens historie ',
      desiredReleaseDate: '2027-11-05',
      skipOptional: ['photo-planning', 'photo-shoot'],
      projectLead: { name: 'Karen Vest' },
    })
    const s = store.getState()
    expect(s.order).toEqual([id])
    const pub = s.records[id]!.publication
    expect(pub.workingTitle).toBe('Havens historie')
    expect(s.people.map((p) => p.name)).toEqual(['Karen Vest'])
    expect(pub.projectLeadId).toBe(s.people[0]!.id)
    expect(s.records[id]!.simulation).toBeUndefined()
    await flush()
    expect(repos.real.data.publications).toHaveLength(1)
    expect(repos.real.data.people).toHaveLength(1)
  })

  it('runs commands, records history and supports undo/redo', async () => {
    const { store, repos } = setup()
    await store.getState().load()
    const id = store.getState().createPublication({
      workingTitle: 'Bog',
      desiredReleaseDate: '2027-11-05',
      skipOptional: [],
      projectLead: null,
    })
    const before = store.getState().records[id]!.publication
    store.getState().execute(id, (p, c) => setStatus(p, 'kickoff-meeting', 'in_progress', c))
    expect(store.getState().records[id]!.publication.activities[0]!.actualStart).toBe(TODAY)
    expect(store.getState().records[id]!.history.log).toHaveLength(1)

    store.getState().undo(id)
    expect(store.getState().records[id]!.publication).toEqual(before)
    store.getState().redo(id)
    expect(store.getState().records[id]!.publication.activities[0]!.status).toBe('in_progress')
    await flush()
    expect(repos.real.data.publications[0]!.history.log.map((e) => e.type)).toEqual([
      'status_changed',
      'undone',
      'redone',
    ])

    // Command errors reach the caller and change nothing.
    expect(() =>
      store.getState().execute(id, (p, c) => setStatus(p, 'first-draft', 'skipped', c)),
    ).toThrow(CommandError)
  })

  it('keeps real and demo workspaces apart', async () => {
    const { store, repos } = setup('real')
    await store.getState().load()
    store.getState().createPublication({
      workingTitle: 'Rigtig bog',
      desiredReleaseDate: '2027-11-05',
      skipOptional: [],
      projectLead: null,
    })
    await store.getState().load('demo')
    expect(store.getState().kind).toBe('demo')
    expect(
      Object.values(store.getState().records).map((r) => r.publication.workingTitle),
    ).not.toContain('Rigtig bog')
    await store.getState().load('real')
    expect(store.getState().order).toHaveLength(1)
    expect(repos.demo.data.publications.length).toBeGreaterThan(0)
  })

  it('has no time machine in the real workspace', async () => {
    const { store } = setup('real')
    await store.getState().load()
    store.getState().travelTo('2027-01-01')
    expect(store.getState()).toMatchObject({ simulatedDate: null, asOf: TODAY })
  })
})

describe('workspace store: demo workspace and time machine', () => {
  it('seeds the demo workspace on first load', async () => {
    const { store, repos } = setup('demo')
    await store.getState().load()
    const s = store.getState()
    expect(s.order.length).toBe(5)
    expect(s.simulatedDate).toBe(TODAY)
    expect(repos.demo.data.simulatedDate).toBe(TODAY)
  })

  it('plays books forward when time advances', async () => {
    const { store } = setup('demo')
    await store.getState().load()
    const id = 'demo-kunstnerens-hus'
    const doneBefore = store
      .getState()
      .records[id]!.publication.activities.filter((a) => a.status === 'done').length
    const inAMonth = cal.addWorkdays(TODAY, 21)
    store.getState().travelTo(inAMonth)
    const s = store.getState()
    expect(s.asOf).toBe(inAMonth)
    const doneAfter = s.records[id]!.publication.activities.filter(
      (a) => a.status === 'done',
    ).length
    expect(doneAfter).toBeGreaterThan(doneBefore)
    // Simulated changes are logged but not undoable.
    expect(s.records[id]!.history.undoable).toEqual([])
  })

  it('goes back in time by rebuilding the demo data, dropping user changes', async () => {
    const { store } = setup('demo')
    await store.getState().load()
    store.getState().travelTo(cal.addWorkdays(TODAY, 30))
    store.getState().createPublication({
      workingTitle: 'Min demobog',
      desiredReleaseDate: '2028-01-14',
      skipOptional: [],
      projectLead: null,
    })
    expect(store.getState().order).toHaveLength(6)
    const back = cal.addWorkdays(TODAY, -10)
    store.getState().travelTo(back)
    expect(store.getState()).toMatchObject({ simulatedDate: back, asOf: back })
    expect(store.getState().order).toHaveLength(5)
  })

  it('lets user-created demo books progress too', async () => {
    const { store } = setup('demo')
    await store.getState().load()
    const id = store.getState().createPublication({
      workingTitle: 'Min demobog',
      desiredReleaseDate: cal.addWorkdays(TODAY, 231),
      skipOptional: [],
      projectLead: null,
    })
    store.getState().travelTo(cal.addWorkdays(TODAY, 10))
    expect(store.getState().records[id]!.publication.activities[0]!.status).toBe('done')
  })

  it('exports and imports a workspace', async () => {
    const { store } = setup('demo')
    await store.getState().load()
    const id = 'demo-fjordens-fugle'
    store.getState().execute(id, (p, c) =>
      reschedule(
        p,
        { kind: 'delay', activityId: 'm-release', workdays: 5 },
        { strategy: 'absorb' },
        c,
        {
          reason: 'Bogmesse',
        },
      ),
    )
    const snapshot = JSON.parse(JSON.stringify(store.getState().exportSnapshot()))
    store.getState().resetDemo()
    expect(store.getState().records[id]!.history.undoable).toEqual([])

    const other = setup('real')
    await other.store.getState().load()
    await other.store.getState().importSnapshot(snapshot)
    const imported = other.store.getState().records[id]!
    expect(imported.history.undoable).toHaveLength(1)
    // Real books never simulate.
    expect(imported.simulation).toBeUndefined()
    expect(other.store.getState().simulatedDate).toBeNull()
  })
})

describe('IndexedDbWorkspaceRepository', () => {
  it('stores each workspace in its own database', async () => {
    const real: WorkspaceRepository = new IndexedDbWorkspaceRepository('real')
    const demo: WorkspaceRepository = new IndexedDbWorkspaceRepository('demo')
    const { store } = setup('real')
    await store.getState().load()
    const id = store.getState().createPublication({
      workingTitle: 'IDB-bog',
      desiredReleaseDate: '2027-11-05',
      skipOptional: [],
      projectLead: null,
    })
    const rec = store.getState().records[id]!
    await real.savePublication(rec)
    await real.saveSimulatedDate(null)
    expect((await real.load()).publications.map((r) => r.publication.id)).toEqual([id])
    expect((await demo.load()).publications).toEqual([])
    await real.deletePublication(id)
    expect((await real.load()).publications).toEqual([])
  })
})
