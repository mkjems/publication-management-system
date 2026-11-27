import { addDays } from '@pms/domain'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState, type ReactNode } from 'react'
import { GettingStarted, Hint } from '@/components/onboarding'
import { PageHeader } from '@/components/page-header'
import { PortfolioGantt } from '@/components/portfolio/portfolio-gantt'
import { Button } from '@/components/ui/button'
import { WorkList } from '@/components/work/work-list'
import { usePortfolio, usePortfolioWork, type PortfolioWorkItem } from '@/hooks/use-portfolio'
import { da } from '@/i18n/da'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/store'

export const Route = createFileRoute('/')({
  component: OverviewPage,
})

const ALL = { kind: 'all' } as const
const SHOWN = 8
/**
 * "At risk" counts only work due within this many calendar days. Everything downstream of a
 * slip has negative buffer, so a whole-plan count runs into the hundreds and says nothing.
 */
const RISK_HORIZON_DAYS = 14

/** Oversigt (PLAN §5.1.1): the publisher's Monday overview across all books. */
function OverviewPage() {
  const asOf = useWorkspace((s) => s.asOf)
  const kind = useWorkspace((s) => s.kind)
  const portfolio = usePortfolio()
  const work = usePortfolioWork(ALL)

  const active = useMemo(
    () =>
      portfolio.filter(
        ({ record }) => !['no_go', 'closed', 'released'].includes(record.publication.lifecycle),
      ),
    [portfolio],
  )
  const totals = useMemo(() => {
    let late = 0
    let atRisk = 0
    let waiting = 0
    let slipping = 0
    let paused = 0
    const horizon = addDays(asOf, RISK_HORIZON_DAYS)
    for (const { record, health } of active) {
      if (health.paused || record.publication.lifecycle === 'hold') {
        paused++
        continue
      }
      late += health.overall.late
      for (const a of record.publication.activities) {
        if (a.deadline <= horizon && health.activities.get(a.id)?.state === 'at_risk') atRisk++
      }
      waiting += health.overall.waiting
      if ((health.release.slipWorkdays ?? 0) > 0) slipping++
    }
    return { late, atRisk, waiting, slipping, paused }
  }, [active, asOf])
  const attention = work.filter((w) => w.bucket === 'overdue' || w.bucket === 'waiting')
  const thisWeek = work.filter(
    (w) => w.bucket === 'due_this_week' || w.bucket === 'starting_this_week',
  )
  const t = da.overview.tiles

  return (
    <>
      <PageHeader
        title={da.nav.overview}
        description={da.overview.description}
        actions={
          <Button asChild variant="outline">
            <Link to="/publications">{da.overview.allPublications}</Link>
          </Button>
        }
      />

      {kind === 'demo' && portfolio.length > 0 && <Hint id="demo">{da.onboarding.hints.demo}</Hint>}
      {portfolio.length === 0 ? (
        <GettingStarted />
      ) : (
        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border shadow-xs sm:grid-cols-3 lg:grid-cols-6">
            <Tile
              label={t.active}
              value={active.length}
              hint={da.overview.tileHint.active(totals.paused)}
            />
            <Tile label={t.late} value={totals.late} tone={totals.late ? 'late' : undefined} />
            <Tile
              label={t.atRisk}
              value={totals.atRisk}
              tone={totals.atRisk ? 'risk' : undefined}
              hint={da.overview.tileHint.atRisk}
            />
            <Tile label={t.waiting} value={totals.waiting} />
            <Tile
              label={t.dueThisWeek}
              value={work.filter((w) => w.bucket === 'due_this_week').length}
            />
            <Tile
              label={t.slipping}
              value={totals.slipping}
              tone={totals.slipping ? 'late' : undefined}
              hint={da.overview.tileHint.slipping}
            />
          </div>

          <Section title={da.overview.gantt} hint={da.overview.ganttHint}>
            <PortfolioGantt entries={portfolio} asOf={asOf} />
          </Section>

          <div className="grid gap-6">
            <Section title={da.overview.attention} hint={da.overview.attentionHint}>
              <Capped items={attention} empty={da.overview.nothingAttention} />
            </Section>
            <Section title={da.overview.thisWeek} hint={da.overview.thisWeekHint}>
              <Capped items={thisWeek} empty={da.overview.nothingThisWeek} />
            </Section>
          </div>
        </div>
      )}
    </>
  )
}

function Capped({ items, empty }: { items: PortfolioWorkItem[]; empty: string }) {
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, SHOWN)
  return (
    <>
      <WorkList items={shown} empty={empty} />
      {items.length > SHOWN && (
        <div className="pt-2 text-center">
          <Button variant="ghost" size="sm" onClick={() => setAll((a) => !a)}>
            {all ? da.trend.showKey : da.overview.showAll(items.length)}
          </Button>
        </div>
      )}
    </>
  )
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: number
  hint?: string
  tone?: 'late' | 'risk'
}) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          'mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums',
          tone === 'late' && 'text-status-late',
        )}
      >
        {tone && (
          <span
            className={cn(
              'size-2 rounded-full',
              tone === 'late' ? 'bg-status-late' : 'bg-status-risk',
            )}
            aria-hidden
          />
        )}
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-xs">
      <h2 className="font-medium">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}
