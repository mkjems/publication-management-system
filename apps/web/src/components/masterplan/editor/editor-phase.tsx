import {
  addTemplateActivity,
  moveTemplateActivity,
  moveTemplateTrack,
  removeTemplateActivity,
  removeTemplateTrack,
  rescheduleTemplateActivity,
  updateTemplateTrack,
  type ActivityTemplate,
  type PhaseTemplate,
  type TrackTemplate,
} from '@pms/domain'
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  CircleAlert,
  Diamond,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { da } from '@/i18n/da'
import { formatDependencyType, formatDuration, formatOffset } from '@/lib/format'
import { issueText, responsibilityFor } from '@/lib/template'
import { cn } from '@/lib/utils'
import { KindIcon } from '../kind-icon'
import { newTemplateId, useEditor } from './context'
import { NameDialog } from './dialogs'
import { NumberField } from './number-field'

const t = da.templateEditor
const COLS = 7

/** One phase of the draft: header, tracks with their activities, and the phase's milestones. */
export function EditorPhase({
  phase,
  open,
  onToggle,
  onEditPhase,
  onAddTrack,
}: {
  phase: PhaseTemplate
  open: boolean
  onToggle: () => void
  onEditPhase: () => void
  onAddTrack: () => void
}) {
  const { draft, edit, openActivity, issuesByActivity } = useEditor()
  const tracks = draft.tracks.filter((tr) => tr.phaseId === phase.id)
  const milestones = draft.activities.filter((a) => a.phaseId === phase.id && a.trackId === null)
  const inPhase = draft.activities.filter((a) => a.phaseId === phase.id)
  const issues = inPhase.flatMap((a) => issuesByActivity.get(a.id) ?? [])
  const errorCount = issues.filter((i) => i.severity === 'error').length
  const warningCount = issues.length - errorCount

  function addMilestone() {
    const id = newTemplateId()
    const ok = edit((d) =>
      addTemplateActivity(d, {
        id,
        place: { milestoneOf: phase.id },
        name: t.newMilestone,
        kind: 'milestone',
        responsible: responsibilityFor(['project-lead'], 'joint'),
      }),
    )
    if (ok) openActivity(id)
  }

  return (
    <section id={phase.id} className="scroll-mt-6 rounded-xl border bg-card shadow-xs">
      <div className="flex items-start gap-3 px-4 py-3.5 md:px-5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground tabular-nums">
            {phase.number}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-semibold">{phase.name}</span>
              <span className="text-sm text-muted-foreground">{phase.period}</span>
            </span>
            <span className="mt-0.5 block text-sm text-muted-foreground">
              {inPhase.length} {da.masterplan.activities}
              {errorCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-status-late">
                  <CircleAlert className="size-3.5" aria-label={t.error} />
                  {errorCount}
                </span>
              )}
              {warningCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-status-waiting">
                  <TriangleAlert className="size-3.5" aria-label={t.warning} />
                  {warningCount}
                </span>
              )}
            </span>
          </span>
          <ChevronRight
            className={cn('mt-1 size-4 shrink-0 transition-transform', open && 'rotate-90')}
          />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" aria-label={`${t.editPhase}: ${phase.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEditPhase}>
              <Pencil /> {t.editPhase}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onAddTrack}>
              <Plus /> {t.newTrack}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={addMilestone}>
              <Diamond /> {t.newMilestone}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {open && (
        <div className="overflow-x-auto border-t">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 pl-5 font-medium">{da.masterplan.columns.activity}</th>
                <th className="w-44 px-3 py-2 font-medium">{da.masterplan.columns.responsible}</th>
                <th className="w-28 px-3 py-2 font-medium">{t.durationLabel}</th>
                <th className="w-36 px-3 py-2 font-medium">{da.masterplan.columns.deadline}</th>
                <th className="w-20 px-3 py-2 font-medium">{t.actual}</th>
                <th className="w-64 px-3 py-2 font-medium">{da.masterplan.columns.dependsOn}</th>
                <th className="w-10 py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {tracks.map((track, i) => (
                <TrackRows
                  key={track.id}
                  track={track}
                  first={i === 0}
                  last={i === tracks.length - 1}
                  activities={draft.activities.filter((a) => a.trackId === track.id)}
                />
              ))}
              <tr>
                <td
                  colSpan={COLS}
                  className="bg-muted/60 py-1.5 pl-5 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                >
                  {da.masterplan.milestone}
                </td>
              </tr>
              {milestones.map((a, i) => (
                <ActivityRow
                  key={a.id}
                  activity={a}
                  first={i === 0}
                  last={i === milestones.length - 1}
                />
              ))}
              <tr>
                <td colSpan={COLS} className="py-1.5 pl-4">
                  <Button size="sm" variant="ghost" onClick={addMilestone}>
                    <Plus /> {t.addMilestone}
                  </Button>
                </td>
              </tr>
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
  first,
  last,
}: {
  track: TrackTemplate
  activities: ActivityTemplate[]
  first: boolean
  last: boolean
}) {
  const { edit, openActivity } = useEditor()
  const [renaming, setRenaming] = useState(false)
  const [removing, setRemoving] = useState(false)

  function addActivity() {
    const id = newTemplateId()
    const ok = edit((d) =>
      addTemplateActivity(d, {
        id,
        place: { trackId: track.id },
        name: t.newActivity,
        kind: 'task',
        responsible: responsibilityFor(['project-lead'], 'joint'),
      }),
    )
    if (ok) openActivity(id)
  }

  return (
    <>
      <tr>
        <td colSpan={COLS} className="bg-muted/60 py-1 pr-3 pl-5">
          <div className="flex items-center gap-2">
            <span className="flex-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {track.name}
            </span>
            <Button size="sm" variant="ghost" className="h-7" onClick={addActivity}>
              <Plus /> {t.addActivity}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  aria-label={t.moreActions(track.name)}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setRenaming(true)}>
                  <Pencil /> {t.rename}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={first}
                  onSelect={() => edit((d) => moveTemplateTrack(d, track.id, -1))}
                >
                  <ArrowUp /> {t.moveUp}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={last}
                  onSelect={() => edit((d) => moveTemplateTrack(d, track.id, 1))}
                >
                  <ArrowDown /> {t.moveDown}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(true)}>
                  <Trash2 /> {t.remove}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <NameDialog
            open={renaming}
            onOpenChange={setRenaming}
            title={t.rename}
            label={t.trackName}
            initial={track.name}
            onSave={(name) => edit((d) => updateTemplateTrack(d, track.id, { name }))}
          />
          <ConfirmDialog
            open={removing}
            onOpenChange={setRemoving}
            title={t.removeTrackTitle(track.name)}
            body={t.removeTrackBody(activities.length)}
            confirm={t.remove}
            cancel={t.cancel}
            destructive
            onConfirm={() => edit((d) => removeTemplateTrack(d, track.id))}
          />
        </td>
      </tr>
      {activities.map((a, i) => (
        <ActivityRow key={a.id} activity={a} first={i === 0} last={i === activities.length - 1} />
      ))}
    </>
  )
}

function ActivityRow({
  activity: a,
  first,
  last,
}: {
  activity: ActivityTemplate
  first: boolean
  last: boolean
}) {
  const { edit, nameOf, actuals, issuesByActivity, moved, openActivity } = useEditor()
  const [removing, setRemoving] = useState(false)
  const issues = issuesByActivity.get(a.id) ?? []
  const hasError = issues.some((i) => i.severity === 'error')
  const actual = actuals.get(a.id)
  const deviates = actual && a.kind === 'task' && Math.abs(actual.median - a.durationWorkdays) >= 3

  return (
    <tr
      id={`activity-${a.id}`}
      className={cn(
        'scroll-mt-24 border-t align-top transition-colors duration-700',
        moved.has(a.id) ? 'bg-milestone/20' : 'hover:bg-muted/40',
      )}
    >
      <td className="py-2 pr-3 pl-5">
        <div className="flex items-start gap-2">
          <span className="mt-0.5">
            <KindIcon kind={a.kind} optional={a.optional} />
          </span>
          <button
            type="button"
            onClick={() => openActivity(a.id)}
            className={cn(
              'text-left hover:text-primary hover:underline',
              a.kind === 'milestone' && 'font-medium',
            )}
          >
            {a.name}
          </button>
          {issues.length > 0 && (
            <span
              title={issues.map((i) => issueText(i, nameOf)).join('\n')}
              className={hasError ? 'text-status-late' : 'text-status-waiting'}
            >
              {hasError ? (
                <CircleAlert className="mt-0.5 size-3.5" aria-label={t.error} />
              ) : (
                <TriangleAlert className="mt-0.5 size-3.5" aria-label={t.warning} />
              )}
            </span>
          )}
          {a.optional && <Badge variant="muted">{da.masterplan.optional}</Badge>}
          {a.compressible === false && <Badge variant="muted">{t.fixedDuration}</Badge>}
        </div>
      </td>
      <td className="px-3 py-2 text-muted-foreground">{a.responsible.label}</td>
      <td className="px-3 py-1.5">
        {a.kind === 'task' ? (
          <div>
            <NumberField
              value={a.durationWorkdays}
              min={1}
              aria-label={`${t.durationLabel}: ${a.name}`}
              onCommit={(n) =>
                edit((d) => rescheduleTemplateActivity(d, a.id, { durationWorkdays: n }))
              }
            />
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {formatDuration(a.durationWorkdays)}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">–</span>
        )}
      </td>
      <td className="px-3 py-1.5">
        <NumberField
          value={a.deadlineOffset}
          disabled={a.gate === 'release'}
          aria-label={`${t.deadlineLabel}: ${a.name}`}
          onCommit={(n) => edit((d) => rescheduleTemplateActivity(d, a.id, { deadlineOffset: n }))}
        />
        <div className="mt-0.5 text-[11px] whitespace-nowrap text-muted-foreground">
          {formatOffset(a.deadlineOffset)}
        </div>
      </td>
      <td
        className={cn(
          'px-3 py-2 whitespace-nowrap tabular-nums',
          deviates ? 'font-medium text-status-waiting' : 'text-muted-foreground',
        )}
        title={actual ? t.actualHint(actual.count, actual.min, actual.max) : undefined}
      >
        {actual ? `${actual.median} d` : '–'}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {a.predecessors.map((d) => {
            const suffix = formatDependencyType(d)
            return (
              <button
                key={d.activityId}
                type="button"
                onClick={() => openActivity(d.activityId)}
                className="max-w-56 truncate rounded border bg-background px-1.5 py-0.5 text-left text-xs hover:border-ring hover:text-primary"
                title={nameOf(d.activityId)}
              >
                {nameOf(d.activityId)}
                {suffix && <span className="ml-1 text-muted-foreground">{suffix}</span>}
              </button>
            )
          })}
        </div>
      </td>
      <td className="py-1.5 pr-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label={t.moreActions(a.name)}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => openActivity(a.id)}>
              <Pencil /> {t.editActivity}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={first}
              onSelect={() => edit((d) => moveTemplateActivity(d, a.id, -1))}
            >
              <ArrowUp /> {t.moveUp}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={last}
              onSelect={() => edit((d) => moveTemplateActivity(d, a.id, 1))}
            >
              <ArrowDown /> {t.moveDown}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={Boolean(a.gate)}
              onSelect={() => setRemoving(true)}
            >
              <Trash2 /> {t.remove}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ConfirmDialog
          open={removing}
          onOpenChange={setRemoving}
          title={t.removeActivityTitle(a.name)}
          body={t.removeActivityBody}
          confirm={t.remove}
          cancel={t.cancel}
          destructive
          onConfirm={() => edit((d) => removeTemplateActivity(d, a.id))}
        />
      </td>
    </tr>
  )
}
