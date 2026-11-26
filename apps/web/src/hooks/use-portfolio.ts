import {
  assessHealth,
  workItems,
  type IsoDate,
  type Publication,
  type PublicationHealth,
  type PublicationRecord,
  type WorkFilter,
  type WorkItem,
} from '@pms/domain'
import { useMemo } from 'react'
import { useWorkspace } from '@/store'

export interface PortfolioEntry {
  record: PublicationRecord
  health: PublicationHealth
}

// Health per publication version and date. Publications are immutable, so a changed book is a
// new object and the rest of the portfolio is not recomputed.
const cache = new WeakMap<Publication, { asOf: IsoDate; health: PublicationHealth }>()

export function healthOf(pub: Publication, asOf: IsoDate): PublicationHealth {
  const hit = cache.get(pub)
  if (hit?.asOf === asOf) return hit.health
  const health = assessHealth(pub, asOf)
  cache.set(pub, { asOf, health })
  return health
}

/** Every live publication (not sandbox copies) with its health, in portfolio order. */
export function usePortfolio(): PortfolioEntry[] {
  const records = useWorkspace((s) => s.records)
  const order = useWorkspace((s) => s.order)
  const asOf = useWorkspace((s) => s.asOf)
  return useMemo(
    () =>
      order.flatMap((id) => {
        const record = records[id]
        return record ? [{ record, health: healthOf(record.publication, asOf) }] : []
      }),
    [records, order, asOf],
  )
}

export interface PortfolioWorkItem extends WorkItem {
  publication: Publication
}

/** Work items across the portfolio, most urgent first. Pass a memoized `filter`. */
export function usePortfolioWork(filter: WorkFilter): PortfolioWorkItem[] {
  const portfolio = usePortfolio()
  return useMemo(
    () =>
      portfolio
        .flatMap(({ record, health }) =>
          workItems(record.publication, health, filter).map((w) => ({
            ...w,
            publication: record.publication,
          })),
        )
        .sort(
          (x, y) =>
            bucketRank(x) - bucketRank(y) || x.activity.deadline.localeCompare(y.activity.deadline),
        ),
    [portfolio, filter],
  )
}

const BUCKET_ORDER = [
  'overdue',
  'waiting',
  'due_this_week',
  'starting_this_week',
  'due_next_week',
  'in_progress',
] as const
const bucketRank = (w: WorkItem) => BUCKET_ORDER.indexOf(w.bucket)
