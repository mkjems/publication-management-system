import type { PublicationDiff } from '../model/events'
import type { Activity, Publication } from '../model/publication'

export class DiffConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DiffConflictError'
  }
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    const bb = b as unknown[]
    return a.length === bb.length && a.every((x, i) => deepEqual(x, bb[i]))
  }
  const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined)
  const kb = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined)
  return (
    ka.length === kb.length &&
    ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  )
}

function fieldDiff<T extends object>(before: T, after: T, skip: (keyof T)[] = []) {
  const out: Record<string, { from: unknown; to: unknown }> = {}
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]) as Set<keyof T & string>
  for (const k of keys) {
    if (skip.includes(k)) continue
    if (!deepEqual(before[k], after[k])) out[k] = { from: before[k], to: after[k] }
  }
  return out
}

/** Field-level difference between two versions of a publication. */
export function diffPublication(before: Publication, after: Publication): PublicationDiff {
  const fields = fieldDiff(before, after, ['activities'])
  const activities: PublicationDiff['activities'] = []
  const afterIds = new Set(after.activities.map((a) => a.id))
  const beforeById = new Map(before.activities.map((a) => [a.id, a]))
  before.activities.forEach((a, index) => {
    if (!afterIds.has(a.id)) activities.push({ op: 'remove', index, activity: a })
  })
  after.activities.forEach((a, index) => {
    const prev = beforeById.get(a.id)
    if (!prev) {
      activities.push({ op: 'add', index, activity: a })
      return
    }
    if (prev === a) return
    const changed = fieldDiff(prev, a)
    if (Object.keys(changed).length) activities.push({ op: 'update', id: a.id, fields: changed })
  })
  return { fields, activities }
}

export function isEmptyDiff(d: PublicationDiff): boolean {
  return Object.keys(d.fields).length === 0 && d.activities.length === 0
}

export function invertDiff(d: PublicationDiff): PublicationDiff {
  const swap = (f: Record<string, { from: unknown; to: unknown }>) =>
    Object.fromEntries(Object.entries(f).map(([k, v]) => [k, { from: v.to, to: v.from }]))
  return {
    fields: swap(d.fields),
    activities: d.activities.map((op) =>
      op.op === 'update'
        ? { op: 'update', id: op.id, fields: swap(op.fields) }
        : { op: op.op === 'add' ? 'remove' : 'add', index: op.index, activity: op.activity },
    ),
  }
}

/**
 * Applies a diff. Every `from` value must match the current state; otherwise the publication
 * has changed in between and a DiffConflictError is thrown.
 */
export function applyDiff(pub: Publication, d: PublicationDiff): Publication {
  const next: Record<string, unknown> = { ...pub }
  for (const [k, v] of Object.entries(d.fields)) {
    if (!deepEqual(next[k], v.from)) throw new DiffConflictError(`Field "${k}" has changed`)
    next[k] = v.to
  }

  let activities = [...pub.activities]
  const removes = d.activities.filter((o) => o.op === 'remove').sort((a, b) => b.index - a.index)
  for (const o of removes) {
    const a = o.activity as Activity
    const i = activities.findIndex((x) => x.id === a.id)
    if (i < 0 || !deepEqual(activities[i], a)) {
      throw new DiffConflictError(`Activity "${a.id}" has changed`)
    }
    activities.splice(i, 1)
  }
  const adds = d.activities.filter((o) => o.op === 'add').sort((a, b) => a.index - b.index)
  for (const o of adds) {
    const a = o.activity as Activity
    if (activities.some((x) => x.id === a.id)) {
      throw new DiffConflictError(`Activity "${a.id}" already exists`)
    }
    activities.splice(o.index, 0, a)
  }
  const updates = new Map(
    d.activities.flatMap((o) => (o.op === 'update' ? [[o.id, o.fields] as const] : [])),
  )
  if (updates.size) {
    activities = activities.map((a) => {
      const fields = updates.get(a.id)
      if (!fields) return a
      const updated: Record<string, unknown> = { ...a }
      for (const [k, v] of Object.entries(fields)) {
        if (!deepEqual(updated[k], v.from)) {
          throw new DiffConflictError(`Activity "${a.id}" field "${k}" has changed`)
        }
        updated[k] = v.to
      }
      updates.delete(a.id)
      return updated as Activity
    })
    if (updates.size) {
      throw new DiffConflictError(`Unknown activities: ${[...updates.keys()].join(', ')}`)
    }
  }
  next.activities = activities
  return next as Publication
}
