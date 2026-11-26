import type { WorkspaceKind } from '@pms/domain'
import { IndexedDbWorkspaceRepository, type WorkspaceRepository } from '@/data/repository'
import { systemClock } from '@/lib/clock'
import { createWorkspaceStore } from './workspace-store'

const KIND_KEY = 'pms-workspace'
const repositories = new Map<WorkspaceKind, WorkspaceRepository>()

function initialKind(): WorkspaceKind {
  try {
    return localStorage.getItem(KIND_KEY) === 'real' ? 'real' : 'demo'
  } catch {
    return 'demo'
  }
}

/** The app's workspace store, backed by IndexedDB. */
export const useWorkspace = createWorkspaceStore(
  {
    repository: (kind) => {
      let repo = repositories.get(kind)
      if (!repo) {
        repo = new IndexedDbWorkspaceRepository(kind)
        repositories.set(kind, repo)
      }
      return repo
    },
    clock: systemClock,
    newId: () => crypto.randomUUID(),
    onKindChange: (kind) => {
      try {
        localStorage.setItem(KIND_KEY, kind)
      } catch {
        // Private mode or blocked storage: the choice just isn't remembered.
      }
    },
  },
  initialKind(),
)
