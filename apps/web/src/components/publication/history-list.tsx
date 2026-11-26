import type { ChangeEvent, Publication } from '@pms/domain'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { EVENT_LABELS, REASON_CATEGORY_LABELS, da } from '@/i18n/da'
import { formatDateCompact } from '@/lib/format'
import { describeEvent, eventAuthor } from '@/lib/publication'

const PAGE = 100

/** Change events, in the order given (the history view passes newest first). */
export function HistoryList({
  events,
  publication,
  empty = da.history.empty,
}: {
  events: ChangeEvent[]
  publication: Publication
  empty?: string
}) {
  const [limit, setLimit] = useState(PAGE)
  if (!events.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>
  }
  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
      <table className="w-full min-w-[760px] text-sm">
        <tbody>
          {events.slice(0, limit).map((e) => (
            <tr key={e.id} className="border-t align-top first:border-t-0">
              <td className="w-24 py-2 pl-5 whitespace-nowrap text-muted-foreground tabular-nums">
                {formatDateCompact(e.effectiveDate)}
              </td>
              <td className="w-44 px-3 py-2 font-medium">{EVENT_LABELS[e.type]}</td>
              <td className="px-3 py-2">
                {describeEvent(e, publication)}
                {e.reason && <div className="text-xs text-muted-foreground">“{e.reason}”</div>}
              </td>
              <td className="w-40 px-3 py-2 text-xs text-muted-foreground">
                {e.reasonCategory && REASON_CATEGORY_LABELS[e.reasonCategory]}
              </td>
              <td className="w-24 py-2 pr-5 text-right text-xs text-muted-foreground">
                {eventAuthor(e)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {events.length > limit && (
        <div className="border-t p-3 text-center">
          <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
            {da.history.showMore(events.length - limit)}
          </Button>
        </div>
      )}
    </div>
  )
}
