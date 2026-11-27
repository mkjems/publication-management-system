import type { ActualDurationStats, Template, TemplateEditResult, TemplateIssue } from '@pms/domain'
import { createContext, useContext } from 'react'

export type TemplateEdit = (draft: Template) => Template | TemplateEditResult

export interface EditorContextValue {
  draft: Template
  /** Applies an edit to the draft. A refused edit shows a message and returns false. */
  edit: (fn: TemplateEdit) => boolean
  nameOf: (id: string) => string
  /** Actual durations measured in this workspace, by template activity id. */
  actuals: Map<string, ActualDurationStats>
  issuesByActivity: Map<string, TemplateIssue[]>
  /** Activities moved by the last edit; highlighted briefly. */
  moved: ReadonlySet<string>
  openActivity: (id: string) => void
}

export const EditorContext = createContext<EditorContextValue | null>(null)

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditor outside the master plan editor')
  return ctx
}

/** A new id for a phase, track or activity in the draft. */
export const newTemplateId = () => crypto.randomUUID()
