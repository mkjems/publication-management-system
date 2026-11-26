/**
 * The workspace store: the publications of the current workspace (real or demo), the clock, and
 * every way to change them. All plan changes go through domain commands via `execute`, so they
 * are logged, undoable and persisted the same way.
 */
import {
  MASTERPLAN_V1,
  SCENARIOS,
  addDays,
  advanceSimulation,
  generatePlan,
  record,
  redo as redoHistory,
  scenarioBook,
  seedDemoWorkspace,
  undo as undoHistory,
  emptyHistory,
  type CommandContext,
  type CommandResult,
  type IsoDate,
  type Person,
  type Publication,
  type PublicationRecord,
  type WorkspaceKind,
  type WorkspaceSnapshot,
} from '@pms/domain'
import { create } from 'zustand'
import type { WorkspaceData, WorkspaceRepository } from '@/data/repository'
import type { SystemClock } from '@/lib/clock'

export interface NewPublicationInput {
  workingTitle: string
  desiredReleaseDate: IsoDate
  kickoffDate?: IsoDate
  skipOptional: string[]
  /** An existing person, a new person by name, or nobody. */
  projectLead: { id: string } | { name: string } | null
}

export interface NewScenarioBookInput {
  scenarioId: string
  workingTitle: string
  desiredReleaseDate: IsoDate
  projectLeadId?: string | null
}

/**
 * Scenario mode (PLAN §6, Phase 4): a sandbox copy of one publication. Changes to that
 * publication go to the copy until they are applied to the live plan or discarded. Kept in
 * memory only.
 */
export interface Sandbox {
  publicationId: string
  /** The live record when the sandbox was opened. */
  base: PublicationRecord
  record: PublicationRecord
}

export interface WorkspaceState {
  kind: WorkspaceKind
  status: 'loading' | 'ready' | 'error'
  error: string | null
  people: Person[]
  /** Publication ids in display order. */
  order: string[]
  records: Record<string, PublicationRecord>
  /** Demo workspace: the date the data has been simulated to. null in the real workspace. */
  simulatedDate: IsoDate | null
  realToday: IsoDate
  /** The business date for everything that depends on "today". */
  asOf: IsoDate
  sandbox: Sandbox | null

  load(kind?: WorkspaceKind): Promise<void>
  createPublication(input: NewPublicationInput): string
  /** Adds a person to the workspace and returns them. */
  addPerson(name: string): Person
  /** Demo only. Adds a book that follows a scenario from the library, played up to `asOf`. */
  addScenarioBook(input: NewScenarioBookInput): string
  /**
   * Runs a domain command on a publication (on its sandbox copy in scenario mode). Throws the
   * command's error, if any.
   */
  execute(
    id: string,
    command: (pub: Publication, ctx: CommandContext) => CommandResult,
  ): CommandResult
  undo(id: string): void
  redo(id: string): void
  deletePublication(id: string): void
  /** Opens scenario mode for a publication. Replaces any open sandbox. */
  openSandbox(id: string): void
  /** Applies the sandbox to the live plan. Throws if the live plan changed in the meantime. */
  applySandbox(): void
  discardSandbox(): void
  /** Demo only. Forward plays the books on; backward rebuilds the demo data as of that date. */
  travelTo(date: IsoDate): void
  /** Demo only. Rebuilds the demo data as of today. */
  resetDemo(): void
  exportSnapshot(): WorkspaceSnapshot
  /** Replaces the current workspace with an imported one. */
  importSnapshot(snapshot: WorkspaceSnapshot): Promise<void>
}

export interface StoreDeps {
  repository: (kind: WorkspaceKind) => WorkspaceRepository
  clock: SystemClock
  newId: () => string
  /** Remembers the chosen workspace between visits. */
  onKindChange?: (kind: WorkspaceKind) => void
}

export function createWorkspaceStore(deps: StoreDeps, initialKind: WorkspaceKind = 'demo') {
  return create<WorkspaceState>()((set, get) => {
    const repo = () => deps.repository(get().kind)
    const ctx = (): CommandContext => ({
      asOf: get().asOf,
      recordedAt: deps.clock.now(),
      by: null,
      newId: deps.newId,
    })
    /** The record commands for `id` act on: the sandbox copy in scenario mode. */
    const target = (id: string) => {
      const sb = get().sandbox
      return sb?.publicationId === id ? sb.record : mustGet(get().records, id)
    }
    const store = (r: PublicationRecord) => {
      const sb = get().sandbox
      if (sb?.publicationId === r.publication.id) set({ sandbox: { ...sb, record: r } })
      else putRecords([r])
    }
    const fail = (e: unknown) =>
      set({ error: e instanceof Error ? e.message : String(e), status: 'error' })
    const persist = (records: PublicationRecord[]) => {
      for (const r of records) repo().savePublication(r).catch(fail)
    }
    const putRecords = (records: PublicationRecord[]) => {
      const next = { ...get().records }
      for (const r of records) next[r.publication.id] = r
      const order = sortOrder(Object.values(next))
      set({ records: next, order })
      persist(records)
    }
    const applyData = (kind: WorkspaceKind, data: WorkspaceData) => {
      const realToday = deps.clock.today()
      const records = Object.fromEntries(data.publications.map((r) => [r.publication.id, r]))
      const simulatedDate = kind === 'demo' ? (data.simulatedDate ?? realToday) : null
      set({
        kind,
        status: 'ready',
        error: null,
        sandbox: null,
        people: data.people,
        records,
        order: sortOrder(data.publications),
        simulatedDate,
        realToday,
        asOf: simulatedDate ?? realToday,
      })
    }
    const seedDemo = (date: IsoDate): WorkspaceData => {
      const demo = seedDemoWorkspace({
        today: date,
        recordedAt: deps.clock.now(),
        newId: deps.newId,
      })
      return { ...demo, simulatedDate: date }
    }

    let inflight: { kind: WorkspaceKind; promise: Promise<void> } | null = null
    const today = deps.clock.today()
    return {
      kind: initialKind,
      status: 'loading',
      error: null,
      people: [],
      order: [],
      records: {},
      simulatedDate: null,
      realToday: today,
      asOf: today,
      sandbox: null,

      load(kind = get().kind) {
        // React StrictMode runs effects twice; share one load per workspace.
        if (inflight?.kind === kind) return inflight.promise
        set({ kind, status: 'loading', error: null, sandbox: null })
        deps.onKindChange?.(kind)
        const run = async () => {
          try {
            let data = await deps.repository(kind).load()
            if (kind === 'demo' && data.publications.length === 0 && data.simulatedDate === null) {
              data = seedDemo(deps.clock.today())
              await deps.repository(kind).replaceAll(data)
            }
            if (get().kind === kind) applyData(kind, data)
          } catch (e) {
            fail(e)
          }
        }
        const promise: Promise<void> = run().finally(() => {
          if (inflight?.promise === promise) inflight = null
        })
        inflight = { kind, promise }
        return promise
      },

      createPublication(input) {
        const { kind } = get()
        let people = get().people
        let projectLeadId: string | null = null
        if (input.projectLead && 'id' in input.projectLead) projectLeadId = input.projectLead.id
        if (input.projectLead && 'name' in input.projectLead && input.projectLead.name.trim()) {
          const person: Person = {
            id: deps.newId(),
            name: input.projectLead.name.trim(),
            email: null,
            defaultRoles: ['project-lead'],
          }
          people = [...people, person]
          projectLeadId = person.id
          set({ people })
          repo().savePeople(people).catch(fail)
        }
        const { publication } = generatePlan({
          id: deps.newId(),
          workingTitle: input.workingTitle.trim(),
          template: MASTERPLAN_V1,
          desiredReleaseDate: input.desiredReleaseDate,
          ...(input.kickoffDate ? { kickoffDate: input.kickoffDate } : {}),
          skipOptional: input.skipOptional,
          projectLeadId,
        })
        putRecords([
          {
            publication,
            history: emptyHistory,
            // In the demo, new books play forward with realistic delays like the others.
            ...(kind === 'demo'
              ? {
                  simulation: {
                    policy: { kind: 'realistic' as const },
                    seed: hashString(publication.id),
                    replan: true,
                    script: [],
                    state: {},
                  },
                }
              : {}),
          },
        ])
        return publication.id
      },

      addPerson(name) {
        const person: Person = {
          id: deps.newId(),
          name: name.trim(),
          email: null,
          defaultRoles: [],
        }
        if (!person.name) throw new Error('A person needs a name')
        const people = [...get().people, person]
        set({ people })
        repo().savePeople(people).catch(fail)
        return person
      },

      addScenarioBook(input) {
        if (get().kind !== 'demo') throw new Error('Scenario books exist only in the demo')
        const scenario = SCENARIOS.find((x) => x.id === input.scenarioId)
        if (!scenario) throw new Error(`Unknown scenario ${input.scenarioId}`)
        const r = scenarioBook(scenario, {
          releaseDate: input.desiredReleaseDate,
          today: get().asOf,
          recordedAt: deps.clock.now(),
          newId: deps.newId,
          publicationId: deps.newId(),
          workingTitle: input.workingTitle.trim() || scenario.name,
          projectLeadId: input.projectLeadId ?? null,
        })
        putRecords([r])
        return r.publication.id
      },

      execute(id, command) {
        const r = target(id)
        const result = command(r.publication, ctx())
        if (result.events.length) {
          store({
            ...r,
            publication: result.publication,
            history: record(r.history, result.events),
          })
        }
        return result
      },

      undo(id) {
        const r = target(id)
        const result = undoHistory(r.publication, r.history, ctx())
        store({ ...r, publication: result.publication, history: result.history })
      },

      redo(id) {
        const r = target(id)
        const result = redoHistory(r.publication, r.history, ctx())
        store({ ...r, publication: result.publication, history: result.history })
      },

      deletePublication(id) {
        const records = { ...get().records }
        delete records[id]
        set({
          records,
          order: get().order.filter((x) => x !== id),
          ...(get().sandbox?.publicationId === id ? { sandbox: null } : {}),
        })
        repo().deletePublication(id).catch(fail)
      },

      openSandbox(id) {
        const r = mustGet(get().records, id)
        set({ sandbox: { publicationId: id, base: r, record: r } })
      },

      applySandbox() {
        const sb = get().sandbox
        if (!sb) return
        if (get().records[sb.publicationId] !== sb.base) {
          throw new Error('The live plan has changed since the scenario was opened')
        }
        // The sandbox continued the live history, so it simply becomes the live record; each
        // change in it stays a separate, undoable transaction.
        set({ sandbox: null })
        if (sb.record !== sb.base) putRecords([sb.record])
      },

      discardSandbox() {
        set({ sandbox: null })
      },

      travelTo(date) {
        const { kind, simulatedDate, records } = get()
        if (kind !== 'demo' || !simulatedDate || date === simulatedDate) return
        // Time stands still while a scenario is open: the sandbox is compared with the live plan.
        if (get().sandbox) return
        if (date < simulatedDate) {
          const data = seedDemo(date)
          applyData('demo', data)
          repo().replaceAll(data).catch(fail)
          return
        }
        const recordedAt = deps.clock.now()
        const advanced = Object.values(records).map((r) =>
          r.simulation
            ? advanceSimulation(
                { ...r, simulation: r.simulation },
                { from: addDays(simulatedDate, 1), to: date, recordedAt, newId: deps.newId },
              )
            : r,
        )
        set({ simulatedDate: date, asOf: date })
        putRecords(advanced)
        repo().saveSimulatedDate(date).catch(fail)
      },

      resetDemo() {
        if (get().kind !== 'demo') return
        const data = seedDemo(deps.clock.today())
        applyData('demo', data)
        repo().replaceAll(data).catch(fail)
      },

      exportSnapshot() {
        const s = get()
        return {
          format: 'pms-workspace',
          version: 1,
          exportedAt: deps.clock.now(),
          workspace: s.kind,
          simulatedDate: s.simulatedDate,
          people: s.people,
          publications: s.order.map((id) => s.records[id]!),
        }
      },

      async importSnapshot(snapshot) {
        const kind = get().kind
        const data: WorkspaceData = {
          people: snapshot.people,
          // Real books never simulate.
          publications:
            kind === 'demo'
              ? snapshot.publications
              : snapshot.publications.map(({ simulation: _s, ...r }) => r),
          simulatedDate: kind === 'demo' ? (snapshot.simulatedDate ?? deps.clock.today()) : null,
        }
        await repo().replaceAll(data)
        applyData(kind, data)
      },
    }
  })
}

export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>

function mustGet(records: Record<string, PublicationRecord>, id: string): PublicationRecord {
  const r = records[id]
  if (!r) throw new Error(`Unknown publication ${id}`)
  return r
}

function sortOrder(records: PublicationRecord[]): string[] {
  return [...records]
    .sort((a, b) =>
      (a.publication.bindingReleaseDate ?? a.publication.desiredReleaseDate).localeCompare(
        b.publication.bindingReleaseDate ?? b.publication.desiredReleaseDate,
      ),
    )
    .map((r) => r.publication.id)
}

function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0
  return h | 0
}

/** The record shown for a publication: its sandbox copy while in scenario mode. */
export function selectRecord(s: WorkspaceState, id: string): PublicationRecord | undefined {
  return s.sandbox?.publicationId === id ? s.sandbox.record : s.records[id]
}
