/**
 * Persistence behind an interface (PLAN §7). Stage A stores each workspace in its own IndexedDB
 * database; Stage B replaces this with an HTTP implementation.
 */
import {
  PersonSchema,
  PublicationRecordSchema,
  type IsoDate,
  type Person,
  type PublicationRecord,
  type WorkspaceKind,
} from '@pms/domain'
import { clear, createStore, del, entries, set, setMany, type UseStore } from 'idb-keyval'

export interface WorkspaceData {
  people: Person[]
  publications: PublicationRecord[]
  /** Demo workspace: the date the data has been simulated to. */
  simulatedDate: IsoDate | null
}

export interface WorkspaceRepository {
  load(): Promise<WorkspaceData>
  savePublication(record: PublicationRecord): Promise<void>
  deletePublication(id: string): Promise<void>
  savePeople(people: Person[]): Promise<void>
  saveSimulatedDate(date: IsoDate | null): Promise<void>
  replaceAll(data: WorkspaceData): Promise<void>
}

const PUB = 'pub:'
const PEOPLE = 'people'
const SIMULATED_DATE = 'simulatedDate'

export class IndexedDbWorkspaceRepository implements WorkspaceRepository {
  private readonly store: UseStore

  constructor(kind: WorkspaceKind) {
    this.store = createStore(`pms-${kind}`, 'kv')
  }

  async load(): Promise<WorkspaceData> {
    const data: WorkspaceData = { people: [], publications: [], simulatedDate: null }
    for (const [key, value] of await entries<string, unknown>(this.store)) {
      if (key === PEOPLE) {
        data.people = PersonSchema.array().catch([]).parse(value)
      } else if (key === SIMULATED_DATE) {
        data.simulatedDate = typeof value === 'string' ? value : null
      } else if (key.startsWith(PUB)) {
        const parsed = PublicationRecordSchema.safeParse(value)
        if (parsed.success) data.publications.push(parsed.data)
        else console.warn(`Skipping unreadable publication ${key}`, parsed.error)
      }
    }
    data.publications.sort((a, b) =>
      a.publication.desiredReleaseDate.localeCompare(b.publication.desiredReleaseDate),
    )
    return data
  }

  savePublication(record: PublicationRecord) {
    return set(PUB + record.publication.id, record, this.store)
  }

  deletePublication(id: string) {
    return del(PUB + id, this.store)
  }

  savePeople(people: Person[]) {
    return set(PEOPLE, people, this.store)
  }

  saveSimulatedDate(date: IsoDate | null) {
    return set(SIMULATED_DATE, date, this.store)
  }

  async replaceAll(data: WorkspaceData) {
    await clear(this.store)
    await setMany(
      [
        [PEOPLE, data.people],
        [SIMULATED_DATE, data.simulatedDate],
        ...data.publications.map((r) => [PUB + r.publication.id, r] as [string, unknown]),
      ],
      this.store,
    )
  }
}

/** For tests. */
export class MemoryWorkspaceRepository implements WorkspaceRepository {
  data: WorkspaceData = { people: [], publications: [], simulatedDate: null }

  async load() {
    return structuredClone(this.data)
  }

  async savePublication(record: PublicationRecord) {
    const i = this.data.publications.findIndex((r) => r.publication.id === record.publication.id)
    if (i >= 0) this.data.publications[i] = record
    else this.data.publications.push(record)
  }

  async deletePublication(id: string) {
    this.data.publications = this.data.publications.filter((r) => r.publication.id !== id)
  }

  async savePeople(people: Person[]) {
    this.data.people = people
  }

  async saveSimulatedDate(date: IsoDate | null) {
    this.data.simulatedDate = date
  }

  async replaceAll(data: WorkspaceData) {
    this.data = structuredClone(data)
  }
}
