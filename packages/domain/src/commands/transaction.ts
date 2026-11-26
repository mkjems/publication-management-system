import type { ChangeEvent, ChangeEventType, ReasonCategory } from '../model/events'
import type { Publication } from '../model/publication'
import type { CommandContext } from './context'
import { diffPublication, isEmptyDiff } from './diff'

export interface CommandResult {
  publication: Publication
  /** Empty when the command changed nothing. */
  events: ChangeEvent[]
}

export interface ChangeMeta {
  reason?: string
  reasonCategory?: ReasonCategory
}

/**
 * Builds one transaction: a sequence of steps, each producing the next publication and one
 * event whose diff is exactly that step's change.
 */
export class Transaction {
  readonly txId: string
  private current: Publication
  private readonly events: ChangeEvent[] = []

  constructor(
    private readonly ctx: CommandContext,
    start: Publication,
  ) {
    this.txId = ctx.newId()
    this.current = start
  }

  get publication(): Publication {
    return this.current
  }

  get context(): CommandContext {
    return this.ctx
  }

  record(
    type: ChangeEventType,
    next: Publication,
    payload: Record<string, unknown>,
    meta: ChangeMeta = {},
  ): void {
    const diff = diffPublication(this.current, next)
    if (isEmptyDiff(diff)) return
    this.events.push({
      id: this.ctx.newId(),
      txId: this.txId,
      publicationId: this.current.id,
      effectiveDate: this.ctx.asOf,
      recordedAt: this.ctx.recordedAt,
      by: this.ctx.by,
      type,
      payload,
      ...(meta.reason ? { reason: meta.reason } : {}),
      ...(meta.reasonCategory ? { reasonCategory: meta.reasonCategory } : {}),
      diff,
    })
    this.current = next
  }

  result(): CommandResult {
    return { publication: this.current, events: [...this.events] }
  }
}
