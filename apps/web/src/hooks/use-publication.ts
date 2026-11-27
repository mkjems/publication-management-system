import { assessHealth, type IsoDate, type Publication } from '@pms/domain'
import { useMemo } from 'react'
import { templateOf } from '@/lib/publication'
import { useWorkspace } from '@/store'
import { selectRecord } from '@/store/workspace-store'

/** The publication's record; its sandbox copy while in scenario mode. */
export function usePublicationRecord(id: string) {
  return useWorkspace((s) => selectRecord(s, id))
}

/** The sandbox if it belongs to this publication. */
export function useSandbox(id: string) {
  return useWorkspace((s) => (s.sandbox?.publicationId === id ? s.sandbox : null))
}

/** Health and analysis of a publication as of the workspace date. Recomputed only on change. */
export function useHealth(publication: Publication, asOf: IsoDate) {
  return useMemo(() => assessHealth(publication, asOf), [publication, asOf])
}

/** The master plan version the publication was generated from. */
export function useTemplateOf(publication: Publication) {
  const templates = useWorkspace((s) => s.templates)
  return useMemo(() => templateOf(publication, templates), [publication, templates])
}

export function usePersonName(id: string | null) {
  return useWorkspace((s) => (id ? (s.people.find((p) => p.id === id)?.name ?? null) : null))
}
