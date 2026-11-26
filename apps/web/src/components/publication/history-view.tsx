import {
  ReasonCategorySchema,
  milestoneTrend,
  type ChangeEvent,
  type ChangeEventType,
  type IsoDate,
  type PublicationRecord,
  type ReasonCategory,
} from '@pms/domain'
import { useMemo, useState, type ReactNode } from 'react'
import { NativeSelect } from '@/components/ui/native-select'
import { REASON_CATEGORY_LABELS, da } from '@/i18n/da'
import { formatDate } from '@/lib/format'
import { HistoryList } from './history-list'
import { SlipChart } from './slip-chart'

const GROUPS = ['all', 'planning', 'status', 'other'] as const
type Group = (typeof GROUPS)[number]
type Author = 'all' | 'user' | 'simulation'

const PLANNING: ReadonlySet<ChangeEventType> = new Set([
  'activity_rescheduled',
  'release_date_changed',
  'plan_made_binding',
  'rebaselined',
  'paused',
  'resumed',
])

function groupOf(e: ChangeEvent): Group {
  if (PLANNING.has(e.type)) return 'planning'
  if (e.type === 'status_changed') return 'status'
  return 'other'
}

/** Historik (PLAN §5.1.7): milestone slip chart, baselines and the filterable change log. */
export function HistoryView({ record, asOf }: { record: PublicationRecord; asOf: IsoDate }) {
  const pub = record.publication
  const [group, setGroup] = useState<Group>('all')
  const [category, setCategory] = useState<ReasonCategory | 'all'>('all')
  const [author, setAuthor] = useState<Author>('all')

  const trend = useMemo(
    () => milestoneTrend(pub, record.history, { asOf }),
    [pub, record.history, asOf],
  )
  const events = useMemo(
    () =>
      [...record.history.log].reverse().filter((e) => {
        if (group !== 'all' && groupOf(e) !== group) return false
        if (category !== 'all' && e.reasonCategory !== category) return false
        if (author === 'user' && e.by !== null) return false
        if (author === 'simulation' && e.by === null) return false
        return true
      }),
    [record.history.log, group, category, author],
  )
  const hasSimulation = record.history.log.some((e) => e.by !== null)
  const baselines = [...pub.baselines].sort((a, b) => a.number - b.number)

  return (
    <div className="grid gap-6">
      <Section title={da.trend.title} description={da.trend.description}>
        {!trend.complete && (
          <p className="mb-2 text-xs text-muted-foreground">{da.trend.incomplete}</p>
        )}
        <SlipChart trend={trend} publication={pub} />
      </Section>

      <Section title={da.history.baselines}>
        {baselines.length === 0 ? (
          <p className="text-sm text-muted-foreground">{da.history.noBaselines}</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {baselines.map((b) => (
                <tr key={b.number} className="border-t first:border-t-0">
                  <td className="py-1.5 pr-3 font-medium">{da.history.baselineName(b.number)}</td>
                  <td className="px-3 py-1.5 text-muted-foreground tabular-nums">
                    {formatDate(b.capturedOn)}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {da.history.baselineRelease} {formatDate(b.releaseDate)}
                  </td>
                  <td className="py-1.5 pl-3 text-muted-foreground">{b.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-medium">{da.history.log}</h2>
          <NativeSelect
            value={group}
            onChange={(e) => setGroup(e.target.value as Group)}
            aria-label={da.history.filter.all}
          >
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                {da.history.filter[g]}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            value={category}
            onChange={(e) => setCategory(e.target.value as ReasonCategory | 'all')}
            aria-label={da.history.allCategories}
          >
            <option value="all">{da.history.allCategories}</option>
            {ReasonCategorySchema.options.map((k) => (
              <option key={k} value={k}>
                {REASON_CATEGORY_LABELS[k]}
              </option>
            ))}
          </NativeSelect>
          {hasSimulation && (
            <NativeSelect
              value={author}
              onChange={(e) => setAuthor(e.target.value as Author)}
              aria-label={da.history.allAuthors}
            >
              <option value="all">{da.history.allAuthors}</option>
              <option value="user">{da.history.authors.user}</option>
              <option value="simulation">{da.history.authors.simulation}</option>
            </NativeSelect>
          )}
        </div>
        <HistoryList
          key={`${group}-${category}-${author}`}
          events={events}
          publication={pub}
          empty={record.history.log.length ? da.history.noMatches : da.history.empty}
        />
      </div>
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-xs">
      <h2 className="font-medium">{title}</h2>
      {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}
