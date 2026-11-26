import 'fake-indexeddb/auto'
import {
  CommandError,
  getCalendar,
  DEFAULT_CALENDAR,
  reschedule,
  setStatus,
  type CommandContext,
  type Publication,
} from '@pms/domain'
import { describe, expect, it } from 'vitest'
import {
  IndexedDbWorkspaceRepository,
  MemoryWorkspaceRepository,
  type WorkspaceRepository,
} from '@/data/repository'
import { createWorkspaceStore, selectRecord } from './workspace-store'

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

describe('workspace store: scenario mode', () => {
  async function withBook() {
    const { store, repos } = setup()
    await store.getState().load()
    const id = store.getState().createPublication({
      workingTitle: 'Bog',
      desiredReleaseDate: '2027-11-05',
      skipOptional: [],
      projectLead: null,
    })
    return { store, repos, id }
  }
  const delay = (workdays: number) => (p: Publication, c: CommandContext) =>
    reschedule(p, { kind: 'delay', activityId: 'first-draft', workdays }, { strategy: 'absorb' }, c)

  it('sends changes to the sandbox copy and leaves the live plan alone', async () => {
    const { store, repos, id } = await withBook()
    const live = store.getState().records[id]!
    store.getState().openSandbox(id)
    store.getState().execute(id, delay(10))
    const s = store.getState()
    expect(s.records[id]).toBe(live)
    expect(selectRecord(s, id)!.history.log).toHaveLength(1)
    expect(selectRecord(s, id)!.publication).not.toEqual(live.publication)

    // Undo works inside the sandbox.
    store.getState().undo(id)
    expect(selectRecord(store.getState(), id)!.publication).toEqual(live.publication)
    store.getState().redo(id)

    store.getState().discardSandbox()
    expect(selectRecord(store.getState(), id)).toBe(live)
    await flush()
    expect(repos.real.data.publications[0]!.history.log).toHaveLength(0)
  })

  it('applies the sandbox as separate undoable changes', async () => {
    const { store, repos, id } = await withBook()
    store.getState().openSandbox(id)
    store.getState().execute(id, delay(5))
    store.getState().execute(id, delay(5))
    const scenario = selectRecord(store.getState(), id)!
    store.getState().applySandbox()
    expect(store.getState().sandbox).toBeNull()
    expect(store.getState().records[id]).toBe(scenario)
    expect(scenario.history.undoable).toHaveLength(2)
    await flush()
    expect(repos.real.data.publications[0]!.history.log).toHaveLength(2)
  })

  it('refuses to apply over a live plan that changed, and stops time while open', async () => {
    const { store, id } = await withBook()
    store.getState().openSandbox(id)
    store.getState().execute(id, delay(5))
    // Something changes the live record behind the sandbox's back.
    const live = store.getState().records[id]!
    store.setState({ records: { ...store.getState().records, [id]: { ...live } } })
    expect(() => store.getState().applySandbox()).toThrow('changed')

    const demo = setup('demo')
    await demo.store.getState().load()
    const book = demo.store.getState().order[0]!
    demo.store.getState().openSandbox(book)
    const date = demo.store.getState().asOf
    demo.store.getState().travelTo(cal.addWorkdays(date, 5))
    expect(demo.store.getState().asOf).toBe(date)
    demo.store.getState().discardSandbox()
    demo.store.getState().travelTo(cal.addWorkdays(date, 5))
    expect(demo.store.getState().asOf).toBe(cal.addWorkdays(date, 5))
  })
})

describe('workspace store: scenario library', () => {
  it('adds a demo book that follows a library scenario', async () => {
    const { store } = setup('demo')
    await store.getState().load()
    const asOf = store.getState().asOf
    const id = store.getState().addScenarioBook({
      scenarioId: 'funding-hold-6-weeks',
      workingTitle: 'Havebogen',
      desiredReleaseDate: cal.addWorkdays(asOf, 230),
    })
    const r = store.getState().records[id]!
    expect(r.publication.workingTitle).toBe('Havebogen')
    expect(r.simulation!.script.map((e) => e.action.kind).filter((k) => k !== 'funding')).toEqual([
      'pause',
      'resume',
    ])

    const real = setup('real')
    await real.store.getState().load()
    expect(() =>
      real.store.getState().addScenarioBook({
        scenarioId: 'on-plan',
        workingTitle: 'x',
        desiredReleaseDate: '2027-11-05',
      }),
    ).toThrow('demo')
  })
})
