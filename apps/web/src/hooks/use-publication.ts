import { assessHealth, type IsoDate, type Publication } from '@pms/domain'
import { useMemo } from 'react'
import { useWorkspace } from '@/store'

export function usePublicationRecord(id: string) {
  return useWorkspace((s) => s.records[id])
}

/** Health and analysis of a publication as of the workspace date. Recomputed only on change. */
export function useHealth(publication: Publication, asOf: IsoDate) {
  return useMemo(() => assessHealth(publication, asOf), [publication, asOf])
}

export function usePersonName(id: string | null) {
  return useWorkspace((s) => (id ? (s.people.find((p) => p.id === id)?.name ?? null) : null))
}
