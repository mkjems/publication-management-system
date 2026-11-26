import type { ActivityTemplate, PhaseTemplate, TrackTemplate } from '@pms/domain'
import { ChevronRight, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { da } from '@/i18n/da'
import { formatDependencyType, formatDuration, formatOffset } from '@/lib/format'
import { cn } from '@/lib/utils'
import { KindGlyph } from './kind-glyph'

export interface PhaseGroup {
  phase: PhaseTemplate
  tracks: { track: TrackTemplate; activities: ActivityTemplate[] }[]
  milestones: ActivityTemplate[]
  total: number
}

export function PhaseSection({
  group,
  open,
  onToggle,
  activityById,
  focusedId,
  onFocusActivity,
}: {
  group: PhaseGroup
  open: boolean
  onToggle: () => void
  activityById: Map<string, ActivityTemplate>
  focusedId: string | null
  onFocusActivity: (id: string) => void
}) {
  const { phase } = group
  return (
    <section id={phase.id} className="scroll-mt-6 rounded-xl border bg-card shadow-xs">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left md:px-5"
      >
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground tabular-nums">
          {phase.number}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-semibold">{phase.name}</span>
            <span className="text-sm text-muted-foreground">{phase.period}</span>
          </span>
          {phase.description && (
            <span className="mt-0.5 block text-sm text-muted-foreground">{phase.description}</span>
          )}
          {group.milestones.length > 0 && (
            <span className="mt-2 flex flex-wrap gap-1.5">
              {group.milestones.map((m) => (
                <Badge key={m.id} variant="milestone">
                  <KindGlyph kind="milestone" /> {m.name}
                </Badge>
              ))}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
          <span className="hidden tabular-nums sm:inline">
            {group.total} {da.masterplan.activities}
          </span>
          <ChevronRight className={cn('size-4 transition-transform', open && 'rotate-90')} />
        </span>
      </button>

      {open && (
        <div className="overflow-x-auto border-t">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 pl-5 font-medium">{da.masterplan.columns.activity}</th>
                <th className="w-52 px-3 py-2 font-medium">{da.masterplan.columns.responsible}</th>
                <th className="w-24 px-3 py-2 font-medium">{da.masterplan.columns.duration}</th>
                <th className="w-32 px-3 py-2 font-medium">{da.masterplan.columns.deadline}</th>
                <th className="w-72 py-2 pr-5 pl-3 font-medium">
                  {da.masterplan.columns.dependsOn}
                </th>
              </tr>
            </thead>
            <tbody>
              {group.tracks.map(({ track, activities }) => (
                <TrackRows
                  key={track.id}
                  track={track}
                  activities={activities}
                  activityById={activityById}
                  focusedId={focusedId}
                  onFocusActivity={onFocusActivity}
                />
              ))}
              {group.milestones.length > 0 && (
                <>
                  <tr>
                    <td
                      colSpan={5}
                      className="bg-muted/60 py-1.5 pl-5 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                    >
                      {da.masterplan.milestone}
                    </td>
                  </tr>
                  {group.milestones.map((a) => (
                    <ActivityRow
                      key={a.id}
                      activity={a}
                      activityById={activityById}
                      focused={focusedId === a.id}
                      onFocusActivity={onFocusActivity}
                    />
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function TrackRows({
  track,
  activities,
  activityById,
  focusedId,
  onFocusActivity,
}: {
  track: TrackTemplate
  activities: ActivityTemplate[]
  activityById: Map<string, ActivityTemplate>
  focusedId: string | null
  onFocusActivity: (id: string) => void
}) {
  return (
    <>
      <tr>
        <td
          colSpan={5}
          className="bg-muted/60 py-1.5 pl-5 text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          {track.name}
          {track.description && (
            <span className="ml-2 font-normal normal-case">· {track.description}</span>
          )}
        </td>
      </tr>
      {activities.map((a) => (
        <ActivityRow
          key={a.id}
          activity={a}
          activityById={activityById}
          focused={focusedId === a.id}
          onFocusActivity={onFocusActivity}
        />
      ))}
    </>
  )
}

function ActivityRow({
  activity: a,
  activityById,
  focused,
  onFocusActivity,
}: {
  activity: ActivityTemplate
  activityById: Map<string, ActivityTemplate>
  focused: boolean
  onFocusActivity: (id: string) => void
}) {
  return (
    <tr
      id={`activity-${a.id}`}
      className={cn(
        'scroll-mt-24 border-t align-top transition-colors duration-700',
        focused ? 'bg-milestone/20' : 'hover:bg-muted/40',
      )}
    >
      <td className="py-2 pr-3 pl-5">
        <div className="flex items-start gap-2">
          <span className="mt-0.5">
            <KindGlyph kind={a.kind} optional={a.optional} />
          </span>
          <span className={cn(a.kind === 'milestone' && 'font-medium')}>{a.name}</span>
          {a.optional && <Badge variant="muted">{da.masterplan.optional}</Badge>}
          {a.note && (
            <Tooltip>
              <TooltipTrigger className="mt-0.5 text-muted-foreground hover:text-foreground">
                <Info className="size-3.5" />
                <span className="sr-only">Note</span>
              </TooltipTrigger>
              <TooltipContent>{a.note}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-muted-foreground">{a.responsible.label}</td>
      <td className="px-3 py-2 whitespace-nowrap tabular-nums">
        {formatDuration(a.durationWorkdays)}
      </td>
      <td
        className="px-3 py-2 whitespace-nowrap tabular-nums"
        title={`${a.deadlineOffset} arbejdsdage`}
      >
        {formatOffset(a.deadlineOffset)}
      </td>
      <td className="py-2 pr-5 pl-3">
        <div className="flex flex-wrap gap-1">
          {a.predecessors.map((d) => {
            const pred = activityById.get(d.activityId)
            const suffix = formatDependencyType(d)
            return (
              <button
                key={d.activityId}
                type="button"
                onClick={() => onFocusActivity(d.activityId)}
                className="max-w-64 truncate rounded border bg-background px-1.5 py-0.5 text-left text-xs hover:border-ring hover:text-primary"
                title={pred?.name}
              >
                {pred?.name ?? d.activityId}
                {suffix && <span className="ml-1 text-muted-foreground">{suffix}</span>}
              </button>
            )
          })}
        </div>
      </td>
    </tr>
  )
}
