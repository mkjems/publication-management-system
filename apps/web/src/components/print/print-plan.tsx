import type { IsoDate, Publication, PublicationHealth, Template } from '@pms/domain'
import type { ReactNode } from 'react'
import { KindGlyph } from '@/components/masterplan/kind-glyph'
import { LIFECYCLE_LABELS, PLAN_STATE_LABELS, da } from '@/i18n/da'
import { formatDate } from '@/lib/format'
import { groupActivities } from '@/lib/publication'
import { printScale } from './layout'
import { PrintGantt } from './print-gantt'
import { PrintTable } from './print-table'

const p = da.print

/** The printable plan: a header with the key dates, then the Gantt and/or the table. */
export function PrintPlan({
  publication: pub,
  health,
  template,
  asOf,
  simulated,
  projectLead,
  parts,
}: {
  publication: Publication
  health: PublicationHealth
  template: Template
  asOf: IsoDate
  simulated: boolean
  projectLead: string | null
  parts: { gantt: boolean; table: boolean }
}) {
  const groups = groupActivities(pub, pub.activities, template)
  const { release } = health
  const slipping = release.forecast !== null && release.forecast > release.target
  return (
    <article className="bg-card text-foreground">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-2 border-b-2 border-foreground/70 pb-3">
        <div>
          <div className="text-xs tracking-wide text-muted-foreground uppercase">{p.title}</div>
          <h1 className="text-2xl font-semibold">{pub.workingTitle}</h1>
          <div className="mt-1 text-xs text-muted-foreground">
            {LIFECYCLE_LABELS[pub.lifecycle]} · {PLAN_STATE_LABELS[pub.planState]} ·{' '}
            {p.template(pub.templateVersion)}
          </div>
        </div>
        <dl className="grid grid-flow-col gap-x-6 text-xs">
          <Fact label={p.kickoff}>{formatDate(pub.kickoffDate)}</Fact>
          <Fact label={p.release}>{formatDate(release.target)}</Fact>
          {release.forecast && (
            <Fact label={p.forecast}>
              <span className={slipping ? 'font-semibold text-status-late' : undefined}>
                {formatDate(release.forecast)}
              </span>
            </Fact>
          )}
          {projectLead && <Fact label={p.projectLead}>{projectLead}</Fact>}
          <Fact label={p.asOfLabel}>
            {formatDate(asOf)}
            {simulated && <span className="text-muted-foreground"> ({p.simulated})</span>}
          </Fact>
        </dl>
      </header>

      {parts.gantt && (
        <>
          <Legend />
          <PrintGantt
            publication={pub}
            health={health}
            groups={groups}
            scale={printScale(pub, health, asOf)}
            asOf={asOf}
          />
        </>
      )}
      {parts.gantt && parts.table && <div className="break-before-page" />}
      {parts.table && (
        <div className={parts.gantt ? 'mt-6 print:mt-0' : undefined}>
          <PrintTable publication={pub} health={health} groups={groups} />
        </div>
      )}
    </article>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{children}</dd>
    </div>
  )
}

function Legend() {
  const l = p.legend
  const swatch = (className: string) => (
    <span className={`inline-block h-2 w-5 rounded-sm ${className}`} />
  )
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
      <li className="flex items-center gap-1.5">
        {swatch('bg-bar-task/60')} {l.planned}
      </li>
      <li className="flex items-center gap-1.5">
        {swatch('bg-bar-task')} {l.inProgress}
      </li>
      <li className="flex items-center gap-1.5">
        {swatch('bg-status-done/70')} {l.done}
      </li>
      <li className="flex items-center gap-1.5">
        {swatch('bg-status-waiting')} {l.waiting}
      </li>
      <li className="flex items-center gap-1.5">
        {swatch('bg-status-risk/50')} {l.forecast}
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-5 bg-muted-foreground/50" /> {l.baseline}
      </li>
      <li className="flex items-center gap-1.5">
        <KindGlyph kind="deadline" /> {l.deadline}
      </li>
      <li className="flex items-center gap-1.5">
        <KindGlyph kind="milestone" /> {l.milestone}
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-px bg-status-active" /> {l.today}
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-0.5 bg-milestone" /> {l.release}
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-5 rounded-sm outline outline-1 outline-status-late" />{' '}
        {l.late}
      </li>
    </ul>
  )
}
