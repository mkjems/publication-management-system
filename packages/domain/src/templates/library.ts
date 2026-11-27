/**
 * Template versions (PLAN §5.1 screen 9). The built-in master plan is version 1. The editor works
 * on a draft that is a copy of the latest version; publishing the draft makes it the next
 * version, which never changes again. Publications keep the version they were generated from.
 */
import { getCalendar } from '../calendar/calendar'
import type { IsoDate } from '../model/common'
import type { Publication } from '../model/publication'
import type { Template } from '../model/template'
import { MASTERPLAN_V1 } from './masterplan-v1'
import { validateTemplate } from './validate'

/** Versions that ship with the app. Workspaces add their own published versions to these. */
export const BUILT_IN_TEMPLATES: readonly Template[] = [MASTERPLAN_V1]

/** All published versions of a template, oldest first. */
export function templateVersions(templates: readonly Template[], templateId: string): Template[] {
  return templates.filter((t) => t.id === templateId).sort((a, b) => a.version - b.version)
}

/** The newest published version of a template. */
export function latestTemplate(
  templates: readonly Template[],
  templateId: string,
): Template | undefined {
  return templateVersions(templates, templateId).at(-1)
}

export function findTemplate(
  templates: readonly Template[],
  templateId: string,
  version: number,
): Template | undefined {
  return templates.find((t) => t.id === templateId && t.version === version)
}

/** A draft of the next version, copied from `base`. */
export function createDraft(base: Template, nextVersion: number): Template {
  if (nextVersion <= base.version) throw new Error('A draft must have a newer version number')
  const copy = JSON.parse(JSON.stringify(base)) as Template
  delete copy.publishedOn
  delete copy.changeNote
  return { ...copy, version: nextVersion, basedOnVersion: base.version }
}

/** Publishes a draft. Refused while the validator reports errors. */
export function publishDraft(draft: Template, on: IsoDate, changeNote: string): Template {
  const errors = validateTemplate(draft).filter((i) => i.severity === 'error')
  if (errors.length)
    throw new Error(`The draft has ${errors.length} error(s): ${errors[0]!.message}`)
  return {
    ...draft,
    publishedOn: on,
    ...(changeNote.trim() ? { changeNote: changeNote.trim() } : {}),
  }
}

// ── Comparing versions ────────────────────────────────────────────────────────

export type TemplateField =
  | 'name'
  | 'period'
  | 'description'
  | 'window'
  | 'phase'
  | 'track'
  | 'kind'
  | 'responsible'
  | 'duration'
  | 'deadline'
  | 'predecessors'
  | 'optional'
  | 'compressible'
  | 'note'

export interface TemplateChange {
  entity: 'phase' | 'track' | 'activity'
  op: 'added' | 'removed' | 'changed'
  id: string
  /** The name in the newer version (the older one if removed). */
  name: string
  fields: TemplateField[]
  /** Activities: the deadline offset before and after, when it changed. */
  deadline?: { from: number; to: number }
  /** Tasks: the duration before and after, when it changed. */
  duration?: { from: number; to: number }
}

/** What changed from one version to another, in template order. */
export function compareTemplates(from: Template, to: Template): TemplateChange[] {
  const changes: TemplateChange[] = []
  const diff = <T extends { id: string; name: string }>(
    entity: TemplateChange['entity'],
    before: readonly T[],
    after: readonly T[],
    fields: (a: T, b: T) => TemplateField[],
    extra?: (a: T, b: T) => Partial<TemplateChange>,
  ) => {
    const old = new Map(before.map((x) => [x.id, x]))
    const now = new Set(after.map((x) => x.id))
    for (const b of after) {
      const a = old.get(b.id)
      if (!a) {
        changes.push({ entity, op: 'added', id: b.id, name: b.name, fields: [] })
        continue
      }
      const f = fields(a, b)
      if (f.length)
        changes.push({ entity, op: 'changed', id: b.id, name: b.name, fields: f, ...extra?.(a, b) })
    }
    for (const a of before) {
      if (!now.has(a.id))
        changes.push({ entity, op: 'removed', id: a.id, name: a.name, fields: [] })
    }
  }
  const differs = (pairs: [TemplateField, unknown, unknown][]) =>
    pairs.filter(([, x, y]) => JSON.stringify(x) !== JSON.stringify(y)).map(([f]) => f)

  diff('phase', from.phases, to.phases, (a, b) =>
    differs([
      ['name', a.name, b.name],
      ['period', a.period, b.period],
      ['description', a.description, b.description],
      ['window', a.window, b.window],
    ]),
  )
  diff('track', from.tracks, to.tracks, (a, b) =>
    differs([
      ['name', a.name, b.name],
      ['description', a.description, b.description],
      ['phase', a.phaseId, b.phaseId],
    ]),
  )
  diff(
    'activity',
    from.activities,
    to.activities,
    (a, b) =>
      differs([
        ['name', a.name, b.name],
        ['phase', a.phaseId, b.phaseId],
        ['track', a.trackId, b.trackId],
        ['kind', a.kind, b.kind],
        ['responsible', a.responsible.label, b.responsible.label],
        ['duration', a.durationWorkdays, b.durationWorkdays],
        ['deadline', a.deadlineOffset, b.deadlineOffset],
        ['predecessors', a.predecessors, b.predecessors],
        ['optional', a.optional, b.optional],
        ['compressible', a.compressible !== false, b.compressible !== false],
        ['note', a.note ?? '', b.note ?? ''],
      ]),
    (a, b) => ({
      ...(a.deadlineOffset !== b.deadlineOffset
        ? { deadline: { from: a.deadlineOffset, to: b.deadlineOffset } }
        : {}),
      ...(a.durationWorkdays !== b.durationWorkdays
        ? { duration: { from: a.durationWorkdays, to: b.durationWorkdays } }
        : {}),
    }),
  )
  return changes
}

// ── Learning from finished work ───────────────────────────────────────────────

export interface ActualDurationStats {
  /** Finished tasks measured. */
  count: number
  /** Working days, median of the measured tasks. */
  median: number
  min: number
  max: number
}

/**
 * How long finished tasks actually took (actual start to actual finish, in working days of each
 * book's calendar), by template activity id. Feeds the editor's "Faktisk" column, so experience
 * flows back into the master plan ("Erfaringer føres tilbage i masterplanen").
 */
export function actualDurations(
  publications: readonly Publication[],
  templateId: string,
): Map<string, ActualDurationStats> {
  const samples = new Map<string, number[]>()
  for (const pub of publications) {
    if (pub.templateId !== templateId) continue
    const cal = getCalendar(pub.calendar)
    for (const a of pub.activities) {
      if (a.kind !== 'task' || a.status !== 'done' || !a.templateActivityId) continue
      if (!a.actualStart || !a.actualFinish) continue
      const days = Math.max(1, cal.countWorkdays(a.actualStart, a.actualFinish))
      const list = samples.get(a.templateActivityId) ?? []
      list.push(days)
      samples.set(a.templateActivityId, list)
    }
  }
  const out = new Map<string, ActualDurationStats>()
  for (const [id, list] of samples) {
    const sorted = [...list].sort((x, y) => x - y)
    const mid = sorted.length >> 1
    const median =
      sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    out.set(id, { count: sorted.length, median, min: sorted[0]!, max: sorted.at(-1)! })
  }
  return out
}
