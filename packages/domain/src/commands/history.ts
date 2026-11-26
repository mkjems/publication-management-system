/**
 * Change log with undo/redo by transaction.
 *
 * The log is append-only: undo does not delete events, it records an "undone" event whose diff
 * reverses the transaction. Redo records a "redone" event.
 */
import type { ChangeEvent } from '../model/events'
import type { Publication } from '../model/publication'
import type { CommandContext } from './context'
import { applyDiff, invertDiff } from './diff'
import { Transaction, type CommandResult } from './transaction'

export interface History {
  log: ChangeEvent[]
  /** Transaction ids that can be undone, most recent last. */
  undoable: string[]
  /** Transaction ids that can be redone, most recently undone last. */
  redoable: string[]
}

export const emptyHistory: History = { log: [], undoable: [], redoable: [] }

/** Appends a command's events. A new change clears the redo stack. */
export function record(history: History, events: readonly ChangeEvent[]): History {
  if (!events.length) return history
  const txIds = [...new Set(events.map((e) => e.txId))]
  return {
    log: [...history.log, ...events],
    undoable: [...history.undoable, ...txIds],
    redoable: [],
  }
}

export interface HistoryResult extends CommandResult {
  history: History
}

export function canUndo(history: History): boolean {
  return history.undoable.length > 0
}

export function canRedo(history: History): boolean {
  return history.redoable.length > 0
}

/** Undoes the most recent transaction. Throws DiffConflictError if the state no longer matches. */
export function undo(pub: Publication, history: History, ctx: CommandContext): HistoryResult {
  const txId = history.undoable.at(-1)
  if (!txId) throw new Error('Nothing to undo')
  const events = history.log.filter((e) => e.txId === txId)
  let next = pub
  for (const e of [...events].reverse()) next = applyDiff(next, invertDiff(e.diff))

  const tx = new Transaction(ctx, pub)
  tx.record('undone', next, { txId, types: events.map((e) => e.type) })
  const result = tx.result()
  return {
    ...result,
    history: {
      log: [...history.log, ...result.events],
      undoable: history.undoable.slice(0, -1),
      redoable: [...history.redoable, txId],
    },
  }
}

/** Redoes the most recently undone transaction. */
export function redo(pub: Publication, history: History, ctx: CommandContext): HistoryResult {
  const txId = history.redoable.at(-1)
  if (!txId) throw new Error('Nothing to redo')
  const events = history.log.filter((e) => e.txId === txId && e.type !== 'undone')
  let next = pub
  for (const e of events) next = applyDiff(next, e.diff)

  const tx = new Transaction(ctx, pub)
  tx.record('redone', next, { txId, types: events.map((e) => e.type) })
  const result = tx.result()
  return {
    ...result,
    history: {
      log: [...history.log, ...result.events],
      undoable: [...history.undoable, txId],
      redoable: history.redoable.slice(0, -1),
    },
  }
}
