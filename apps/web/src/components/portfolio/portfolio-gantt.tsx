/**
 * Portfolio Gantt (PLAN §5.1.1): one line per book across the coming year. Phases are bands in
 * an ordinal ramp of one hue (light = early, dark = late), so books in the same phase at the
 * same time line up visibly: release clusters and overlapping crunch periods stand out.
 */
import { addDays, type IsoDate } from '@pms/domain'
import { Link } from '@tanstack/react-router'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { createScale, monthTicks } from '@/components/gantt/scale'
import { LifecycleBadge } from '@/components/status/status'
import type { PortfolioEntry } from '@/hooks/use-portfolio'
import { da } from '@/i18n/da'
import { formatDate } from '@/lib/format'
import { templateOf } from '@/lib/publication'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/store'
import { portfolioRow } from './rows'

const LEFT = 220
const ROW = 40
const HEADER = 28
const PHASES = 11

/** Ordinal ramp: phase 1 lightest, phase 11 darkest. */
function phaseColor(n: number): string {
  const pct = Math.round(22 + ((n - 1) / (PHASES - 1)) * 70)
  return `color-mix(in oklch, var(--bar-task) ${pct}%, var(--card))`
}

export function PortfolioGantt({ entries, asOf }: { entries: PortfolioEntry[]; asOf: IsoDate }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const templates = useWorkspace((s) => s.templates)
  const rows = useMemo(
    () =>
      entries.map((e) => ({
        ...e,
        row: portfolioRow(
          e.record.publication,
          e.health,
          templateOf(e.record.publication, templates),
        ),
      })),
    [entries, templates],
  )
  const scale = useMemo(() => {
    // From a couple of months back to the last release, at least a year ahead.
    const last = rows.reduce((m, r) => (r.row.last > m ? r.row.last : m), addDays(asOf, 365))
    const first = rows.reduce((m, r) => (r.row.first < m ? r.row.first : m), asOf)
    const start = first < addDays(asOf, -60) ? addDays(asOf, -60) : first
    return createScale(start, addDays(last, 21), 'quarter')
  }, [rows, asOf])
  const ticks = monthTicks(scale)
  const mid = (d: IsoDate) => scale.x(d) + scale.ppd / 2

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = Math.max(0, scale.x(asOf) - 120)
  }, [scale, asOf])

  return (
    <div className="grid gap-2">
      <div
        ref={scrollRef}
        className="relative overflow-x-auto rounded-lg border bg-card"
        data-testid="portfolio-gantt"
      >
        {/* Bottom padding keeps overlay scrollbars off the last row. */}
        <div className="relative pb-3" style={{ width: LEFT + scale.width }}>
          {/* Month header */}
          <div className="sticky top-0 z-10 flex border-b bg-card" style={{ height: HEADER }}>
            <div className="sticky left-0 z-20 shrink-0 border-r bg-card" style={{ width: LEFT }} />
            <div className="relative" style={{ width: scale.width }}>
              {ticks.map((t) => (
                <div
                  key={t.date}
                  className="absolute top-0 h-full border-l px-1 pt-1.5 text-[11px] text-muted-foreground"
                  style={{ left: t.x, width: t.width }}
                >
                  {t.width > 24 ? t.label : ''}
                </div>
              ))}
            </div>
          </div>

          {/* Today */}
          <div
            className="pointer-events-none absolute z-0 w-px bg-status-active"
            style={{ left: LEFT + mid(asOf), top: HEADER, height: rows.length * ROW }}
            aria-hidden
          />

          {rows.map(({ record, health, row }) => {
            const pub = record.publication
            const stopped = pub.lifecycle === 'no_go' || pub.lifecycle === 'closed'
            const slipped = row.release.forecast && row.release.forecast > row.release.target
            const paused = health.paused || pub.lifecycle === 'hold'
            return (
              <div key={pub.id} className="flex border-b last:border-b-0" style={{ height: ROW }}>
                <div
                  className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r bg-card px-3"
                  style={{ width: LEFT }}
                >
                  <Link
                    to="/publications/$publicationId"
                    params={{ publicationId: pub.id }}
                    search={{ tab: 'gantt' }}
                    className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary hover:underline"
                    title={pub.workingTitle}
                  >
                    {pub.workingTitle}
                  </Link>
                  {(paused || stopped) && <LifecycleBadge lifecycle={pub.lifecycle} />}
                </div>
                <div
                  className={cn('relative', stopped && 'opacity-40')}
                  style={{ width: scale.width }}
                >
                  {row.phases.map((p) => (
                    <div
                      key={p.phase.id}
                      className="absolute top-[13px] h-3.5 border-r-2 border-card first:rounded-l-sm last:rounded-r-sm"
                      style={{
                        left: scale.x(p.start),
                        width: Math.max(2, scale.x(p.end) + scale.ppd - scale.x(p.start)),
                        background: phaseColor(p.phase.number),
                      }}
                      title={`${da.portfolioGantt.phase(p.phase.number, p.phase.name)} · ${formatDate(p.start)} – ${formatDate(p.end)}`}
                    />
                  ))}
                  {row.pauses.map((p) => (
                    <div
                      key={p.from}
                      className="absolute inset-y-1 rounded-sm bg-status-waiting/15"
                      style={{
                        left: scale.x(p.from),
                        width: scale.x(p.to ?? asOf) + scale.ppd - scale.x(p.from),
                        backgroundImage:
                          'repeating-linear-gradient(135deg, var(--status-waiting) 0 1px, transparent 1px 8px)',
                      }}
                      title={da.portfolioGantt.pause}
                    />
                  ))}
                  {row.milestones.map((m) => (
                    <span
                      key={m.id}
                      className={cn(
                        'absolute top-[15px] size-2.5 -translate-x-1/2 rotate-45 border-2',
                        m.done ? 'border-card bg-milestone' : 'border-milestone bg-card',
                        m.late && 'border-status-late',
                      )}
                      style={{ left: mid(m.date) }}
                      title={`${m.name} · ${formatDate(m.date)}`}
                    />
                  ))}
                  {/* Release: target, and the forecast if it is later */}
                  {slipped && (
                    <div
                      className="absolute top-[19px] h-0 border-t-2 border-dashed border-status-late"
                      style={{
                        left: mid(row.release.target),
                        width: mid(row.release.forecast!) - mid(row.release.target),
                      }}
                    />
                  )}
                  <span
                    className={cn(
                      'absolute top-[12px] size-4 -translate-x-1/2 rotate-45 border-2 border-card',
                      row.release.done ? 'bg-status-done' : 'bg-primary',
                    )}
                    style={{ left: mid(row.release.target) }}
                    title={`${da.portfolioGantt.release} ${formatDate(row.release.target)}`}
                  />
                  {slipped && (
                    <span
                      className="absolute top-[12px] size-4 -translate-x-1/2 rotate-45 border-2 border-status-late bg-card"
                      style={{ left: mid(row.release.forecast!) }}
                      title={`${da.portfolioGantt.forecast} ${formatDate(row.release.forecast)}`}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="flex">
            {Array.from({ length: PHASES }, (_, i) => (
              <span key={i} className="h-3 w-2" style={{ background: phaseColor(i + 1) }} />
            ))}
          </span>
          {da.portfolioGantt.phases}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rotate-45 border-2 border-milestone bg-card" />
          {da.portfolioGantt.milestone}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rotate-45 bg-primary" />
          {da.portfolioGantt.release}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rotate-45 border-2 border-status-late bg-card" />
          {da.portfolioGantt.forecast}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-px bg-status-active" />
          {da.portfolioGantt.today}
        </span>
      </div>
    </div>
  )
}
