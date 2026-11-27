import type { Activity, Publication, PublicationHealth } from '@pms/domain'
import type { ReactNode } from 'react'
import { KindIcon } from '@/components/masterplan/kind-icon'
import { HEALTH_LABELS, STATUS_LABELS, da } from '@/i18n/da'
import { formatDateCompact } from '@/lib/format'
import { baselineDeadline, type PhaseRows } from '@/lib/publication'
import { cn } from '@/lib/utils'

const p = da.print
const COLUMNS = 7

/**
 * The plan as a table in the master plan PDF's own columns: Aktivitet · Ansvarlig · Start ·
 * Oprindelig deadline · Aktuel deadline · Status · Bemærkning/afhængighed. The header row repeats
 * on every printed page.
 */
export function PrintTable({
  publication: pub,
  health,
  groups,
}: {
  publication: Publication
  health: PublicationHealth
  groups: PhaseRows[]
}) {
  const nameOf = new Map(pub.activities.map((a) => [a.id, a.name]))
  const row = (a: Activity) => (
    <Row key={a.id} publication={pub} activity={a} health={health} nameOf={nameOf} />
  )
  return (
    <table className="w-full border-collapse text-[10px] leading-snug">
      <thead className="table-header-group">
        <tr className="border-b-2 border-foreground/70 text-left">
          <th className="py-1 pr-2 font-semibold">{da.publication.columns.activity}</th>
          <th className="w-[11%] px-2 py-1 font-semibold">{da.publication.columns.responsible}</th>
          <th className="w-[6%] px-2 py-1 font-semibold">{da.publication.columns.start}</th>
          <th className="w-[7%] px-2 py-1 font-semibold">{da.publication.columns.baseline}</th>
          <th className="w-[7%] px-2 py-1 font-semibold">{da.publication.columns.deadline}</th>
          <th className="w-[7%] px-2 py-1 font-semibold">{da.publication.columns.status}</th>
          <th className="w-[27%] py-1 pl-2 font-semibold">{p.noteColumn}</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <PhaseBlock
            key={g.phase.id}
            title={`${g.phase.number}. ${g.phase.name}`}
            period={g.phase.period}
          >
            {g.tracks.map(({ track, activities }) => (
              <Group key={track.id} label={track.name}>
                {activities.map(row)}
              </Group>
            ))}
            {g.milestones.length > 0 && (
              <Group label={da.publication.milestones}>{g.milestones.map(row)}</Group>
            )}
          </PhaseBlock>
        ))}
      </tbody>
    </table>
  )
}

function PhaseBlock({
  title,
  period,
  children,
}: {
  title: string
  period: string
  children: ReactNode
}) {
  return (
    <>
      <tr className="break-after-avoid">
        <td colSpan={COLUMNS} className="bg-muted px-1.5 pt-3 pb-1 text-[11px] font-semibold">
          {title}
          {period && <span className="ml-2 font-normal text-muted-foreground">{period}</span>}
        </td>
      </tr>
      {children}
    </>
  )
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <tr className="break-after-avoid">
        <td
          colSpan={COLUMNS}
          className="px-1.5 pt-1.5 pb-0.5 text-[9px] font-medium tracking-wide text-muted-foreground uppercase"
        >
          {label}
        </td>
      </tr>
      {children}
    </>
  )
}

function Row({
  publication: pub,
  activity: a,
  health,
  nameOf,
}: {
  publication: Publication
  activity: Activity
  health: PublicationHealth
  nameOf: Map<string, string>
}) {
  const h = health.activities.get(a.id)
  const f = health.analysis.activities.get(a.id)
  const baseline = baselineDeadline(pub, a.id)
  const late = h?.state === 'late'
  const open = a.status !== 'done' && a.status !== 'skipped'
  const remarks = [
    a.note,
    a.status === 'waiting' && a.waitingFor && `${p.waitingFor}: ${a.waitingFor.text}`,
    open && f && f.deadline > a.deadline && `${p.forecastShort} ${formatDateCompact(f.deadline)}`,
  ].filter(Boolean)
  const after = a.predecessors.map((d) => nameOf.get(d.activityId) ?? d.activityId)

  return (
    <tr
      className={cn(
        'break-inside-avoid border-b border-border align-top',
        a.status === 'skipped' && 'text-muted-foreground',
      )}
    >
      <td className="py-0.5 pr-2">
        <span className="flex items-start gap-1">
          <span className="mt-px scale-75">
            <KindIcon kind={a.kind} optional={a.optional} />
          </span>
          <span
            className={cn(
              a.kind === 'milestone' && 'font-semibold uppercase',
              a.status === 'skipped' && 'line-through',
            )}
          >
            {a.kind === 'milestone' && `${da.masterplan.milestone}: `}
            {a.name}
          </span>
        </span>
      </td>
      <td className="px-2 py-0.5">{a.responsible.label}</td>
      <td className="px-2 py-0.5 whitespace-nowrap tabular-nums">
        {formatDateCompact(a.actualStart ?? a.start)}
      </td>
      <td className="px-2 py-0.5 whitespace-nowrap text-muted-foreground tabular-nums">
        {formatDateCompact(baseline)}
      </td>
      <td
        className={cn(
          'px-2 py-0.5 whitespace-nowrap tabular-nums',
          baseline && baseline !== a.deadline && 'font-semibold',
        )}
      >
        {formatDateCompact(a.deadline)}
      </td>
      <td className={cn('px-2 py-0.5', late && 'font-semibold text-status-late')}>
        {late ? HEALTH_LABELS.late : STATUS_LABELS[a.status]}
      </td>
      <td className="py-0.5 pl-2">
        {remarks.length > 0 && <span className="block">{remarks.join(' · ')}</span>}
        {after.length > 0 && (
          <span className="block text-muted-foreground">
            {p.after}: {after.join(', ')}
          </span>
        )}
      </td>
    </tr>
  )
}
