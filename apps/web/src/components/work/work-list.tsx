import { DEFAULT_CALENDAR, WORK_BUCKETS, getCalendar, type WorkBucket } from '@pms/domain'
import { Link } from '@tanstack/react-router'
import { HealthDot, SlipBadge } from '@/components/status/status'
import { StatusSelect } from '@/components/publication/status-select'
import type { PortfolioWorkItem } from '@/hooks/use-portfolio'
import { STATUS_LABELS, WORK_BUCKET_LABELS, da } from '@/i18n/da'
import { formatDateCompact } from '@/lib/format'
import { useWorkspace } from '@/store'

const cal = getCalendar(DEFAULT_CALENDAR)

/**
 * Work across books: one row per activity with its book, deadline, forecast and an inline
 * status editor. `grouped` adds a heading per bucket.
 */
export function WorkList({
  items,
  grouped = true,
  showBook = true,
  empty,
}: {
  items: PortfolioWorkItem[]
  grouped?: boolean
  showBook?: boolean
  empty: string
}) {
  const sandboxId = useWorkspace((s) => s.sandbox?.publicationId ?? null)
  if (!items.length) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
  }
  const groups: { bucket: WorkBucket | null; items: PortfolioWorkItem[] }[] = grouped
    ? WORK_BUCKETS.map((bucket) => ({
        bucket,
        items: items.filter((i) => i.bucket === bucket),
      })).filter((g) => g.items.length > 0)
    : [{ bucket: null, items }]
  const c = da.myWork.columns
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">{c.activity}</th>
            {showBook && <th className="px-3 py-2 font-medium">{c.publication}</th>}
            <th className="px-3 py-2 font-medium">{c.deadline}</th>
            <th className="px-3 py-2 font-medium">{c.forecast}</th>
            <th className="w-36 py-2 pl-3 font-medium">{c.status}</th>
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.bucket ?? 'all'}>
            {g.bucket && (
              <tr>
                <th
                  colSpan={showBook ? 5 : 4}
                  className="border-t pt-4 pb-1.5 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {WORK_BUCKET_LABELS[g.bucket]}{' '}
                  <span className="font-normal tabular-nums">({g.items.length})</span>
                </th>
              </tr>
            )}
            {g.items.map((w) => {
              const slip = cal.workdaysBetween(w.activity.deadline, w.forecast)
              return (
                <tr key={`${w.publicationId}:${w.activity.id}`} className="border-t align-top">
                  <td className="py-2 pr-3">
                    <div className="flex items-start gap-2">
                      <HealthDot state={w.state} className="mt-1.5" />
                      <div className="min-w-0">
                        <Link
                          to="/publications/$publicationId"
                          params={{ publicationId: w.publicationId }}
                          search={{ activity: w.activity.id }}
                          className="hover:text-primary hover:underline"
                        >
                          {w.activity.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {w.activity.responsible.label}
                          {w.activity.waitingFor && ` · ${w.activity.waitingFor.text}`}
                        </div>
                      </div>
                    </div>
                  </td>
                  {showBook && (
                    <td className="px-3 py-2">
                      <Link
                        to="/publications/$publicationId"
                        params={{ publicationId: w.publicationId }}
                        className="text-muted-foreground hover:text-primary hover:underline"
                      >
                        {w.publication.workingTitle}
                      </Link>
                    </td>
                  )}
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                    {formatDateCompact(w.activity.deadline)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                    <span className="flex items-center gap-1.5">
                      {formatDateCompact(w.forecast)}
                      <SlipBadge workdays={slip} />
                    </span>
                  </td>
                  <td className="py-1.5 pl-3">
                    {w.publicationId === sandboxId ? (
                      // A scenario is open for this book: edits belong on its page.
                      <span className="text-xs text-muted-foreground" title={da.sandbox.title}>
                        {STATUS_LABELS[w.activity.status]}
                      </span>
                    ) : (
                      <StatusSelect publicationId={w.publicationId} activity={w.activity} />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        ))}
      </table>
    </div>
  )
}
