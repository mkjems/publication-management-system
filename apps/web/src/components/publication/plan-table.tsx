import {
  getCalendar,
  updateActivity,
  type Activity,
  type Publication,
  type PublicationHealth,
} from '@pms/domain'
import { ChevronRight, Lock, Route as RouteIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { KindIcon } from '@/components/masterplan/kind-icon'
import { HealthDot, ProgressBar, SlipBadge } from '@/components/status/status'
import { Badge } from '@/components/ui/badge'
import { useCommand } from '@/hooks/use-command'
import { da } from '@/i18n/da'
import { formatDateCompact } from '@/lib/format'
import { baselineDeadline, type PhaseRows } from '@/lib/publication'
import { cn } from '@/lib/utils'
import { StatusSelect } from './status-select'

const COLUMNS = 7

export function PlanTable({
  publication: pub,
  health,
  groups,
  isOpen,
  onToggle,
  onOpenActivity,
  onMove,
}: {
  publication: Publication
  health: PublicationHealth
  groups: PhaseRows[]
  isOpen: (phaseId: string) => boolean
  onToggle: (phaseId: string) => void
  onOpenActivity: (id: string) => void
  onMove: (id: string) => void
}) {
  const row = (a: Activity) => (
    <ActivityRow
      key={a.id}
      publication={pub}
      activity={a}
      health={health}
      onOpen={() => onOpenActivity(a.id)}
      onMove={() => onMove(a.id)}
    />
  )
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => {
        const phaseHealth = health.phases.get(g.phase.id)!
        const open = isOpen(g.phase.id)
        const dates = g.activities.flatMap((a) => [a.start ?? a.deadline, a.deadline]).sort()
        return (
          <section key={g.phase.id} className="rounded-xl border bg-card shadow-xs">
            <button
              type="button"
              onClick={() => onToggle(g.phase.id)}
              aria-expanded={open}
              className="flex w-full items-center gap-3 px-4 py-3 text-left md:px-5"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground tabular-nums">
                {g.phase.number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-semibold">{g.phase.name}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {formatDateCompact(dates[0])} – {formatDateCompact(dates.at(-1))}
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                <HealthDot state={phaseHealth.state} />
                <ProgressBar value={phaseHealth.progress} className="hidden w-20 sm:block" />
                <span className="hidden w-24 tabular-nums sm:inline">
                  {phaseHealth.done}/{phaseHealth.total - phaseHealth.skipped}{' '}
                  {da.publication.phaseDone}
                </span>
                <ChevronRight className={cn('size-4 transition-transform', open && 'rotate-90')} />
              </span>
            </button>
            {open && (
              <div className="overflow-x-auto border-t">
                <table className="w-full min-w-[1080px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 pl-5 font-medium">
                        {da.publication.columns.activity}
                      </th>
                      <th className="w-44 px-3 py-2 font-medium">
                        {da.publication.columns.responsible}
                      </th>
                      <th className="w-24 px-3 py-2 font-medium">{da.publication.columns.start}</th>
                      <th className="w-28 px-3 py-2 font-medium">
                        {da.publication.columns.baseline}
                      </th>
                      <th className="w-40 px-3 py-2 font-medium">
                        {da.publication.columns.deadline}
                      </th>
                      <th className="w-36 px-3 py-2 font-medium">
                        {da.publication.columns.status}
                      </th>
                      <th className="w-56 py-2 pr-5 pl-3 font-medium">
                        {da.publication.columns.note}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.tracks.map(({ track, activities }) => (
                      <TrackGroup key={track.id} label={track.name}>
                        {activities.map(row)}
                      </TrackGroup>
                    ))}
                    {g.milestones.length > 0 && (
                      <TrackGroup label={da.publication.milestones}>
                        {g.milestones.map(row)}
                      </TrackGroup>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

function TrackGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <tr>
        <td
          colSpan={COLUMNS}
          className="bg-muted/60 py-1.5 pl-5 text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          {label}
        </td>
      </tr>
      {children}
    </>
  )
}

function ActivityRow({
  publication: pub,
  activity: a,
  health,
  onOpen,
  onMove,
}: {
  publication: Publication
  activity: Activity
  health: PublicationHealth
  onOpen: () => void
  onMove: () => void
}) {
  const h = health.activities.get(a.id)!
  const f = health.analysis.activities.get(a.id)!
  const baseline = baselineDeadline(pub, a.id)
  const skipped = a.status === 'skipped'
  const done = a.status === 'done'

  return (
    <tr
      className={cn('border-t align-middle hover:bg-muted/40', skipped && 'text-muted-foreground')}
    >
      <td className="py-1.5 pr-3 pl-5">
        <div className="flex items-center gap-2">
          <HealthDot state={h.state} />
          <KindIcon kind={a.kind} optional={a.optional} />
          <button
            type="button"
            onClick={onOpen}
            className={cn(
              'min-w-0 text-left hover:text-primary hover:underline',
              a.kind === 'milestone' && 'font-medium',
              skipped && 'line-through',
            )}
          >
            {a.name}
          </button>
          {a.pinned && (
            <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label="Fastlåst" />
          )}
          {f.critical && (
            <RouteIcon className="size-3.5 shrink-0 text-status-risk" aria-label="Kritisk vej" />
          )}
          {a.status === 'waiting' && a.waitingFor && (
            <Badge variant="milestone" className="max-w-48 truncate" title={a.waitingFor.text}>
              {a.waitingFor.text}
            </Badge>
          )}
        </div>
      </td>
      <td className="px-3 py-1.5 text-muted-foreground">{a.responsible.label}</td>
      <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">{formatDateCompact(a.start)}</td>
      <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground tabular-nums">
        {formatDateCompact(baseline)}
      </td>
      <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">
        {done || skipped ? (
          <span className="flex items-center gap-1.5">
            {formatDateCompact(done ? a.actualFinish : a.deadline)}
            {done && baseline && (
              <SlipBadge
                workdays={getCalendar(pub.calendar).workdaysBetween(baseline, a.actualFinish!)}
                title={da.publication.doneVsBaseline}
              />
            )}
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={onMove}
              className="flex items-center gap-1.5 rounded underline decoration-dotted underline-offset-4 hover:text-primary"
              title={da.panel.move}
            >
              {formatDateCompact(a.deadline)}
              <SlipBadge workdays={h.slipVsBaselineWorkdays} title={da.publication.vsBaseline} />
            </button>
            {f.slipWorkdays > 0 && (
              <div className="text-xs text-status-risk">
                {da.publication.forecastShort} {formatDateCompact(f.deadline)}
              </div>
            )}
          </>
        )}
      </td>
      <td className="px-3 py-1.5">
        <StatusSelect publicationId={pub.id} activity={a} />
      </td>
      <td className="py-1.5 pr-5 pl-3">
        <NoteInput key={a.note} publicationId={pub.id} activity={a} />
      </td>
    </tr>
  )
}

function NoteInput({ publicationId, activity: a }: { publicationId: string; activity: Activity }) {
  const run = useCommand(publicationId)
  // Keyed by the note, so it resets when the note changes elsewhere (undo, side panel).
  const [value, setValue] = useState(a.note)

  const commit = () => {
    if (value !== a.note) run((p, c) => updateActivity(p, a.id, { note: value }, c))
  }
  return (
    <input
      aria-label={`${da.publication.columns.note}: ${a.name}`}
      value={value}
      placeholder={da.publication.notePlaceholder}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') setValue(a.note)
      }}
      className="h-8 w-full truncate rounded-md border border-transparent bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground/60 hover:border-input focus:border-ring focus:bg-card"
    />
  )
}
