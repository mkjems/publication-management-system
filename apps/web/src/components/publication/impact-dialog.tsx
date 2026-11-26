import {
  ReasonCategorySchema,
  getCalendar,
  previewReschedule,
  reasonCategoryFor,
  reschedule,
  type Activity,
  type Impact,
  type Publication,
  type ReasonCategory,
  type ScheduleChange,
  type Strategy,
} from '@pms/domain'
import { ArrowRight, Lock, TriangleAlert } from 'lucide-react'
import { useId, useMemo, useState, type FormEvent } from 'react'
import { SlipBadge } from '@/components/status/status'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { useCommand } from '@/hooks/use-command'
import { REASON_CATEGORY_LABELS, STRATEGY_LABELS, da } from '@/i18n/da'
import { formatDate, formatDateCompact } from '@/lib/format'
import { cn } from '@/lib/utils'
import { DateWithWorkdays } from './plan-dialogs'

const STRATEGIES: Strategy[] = ['absorb', 'push', 'compress', 'move_release']
const SHOWN_MOVES = 6

/**
 * Move an activity's deadline (or change its duration) with a live impact preview: what moves,
 * what happens to the release, pinned conflicts. Nothing changes until "Flyt" is pressed.
 * `initial` pre-fills the change, e.g. from a drag in the Gantt chart.
 */
export function ImpactDialog({
  publication: pub,
  activity,
  initial,
  onOpenChange,
}: {
  publication: Publication
  activity: Activity
  initial?: ScheduleChange
  onOpenChange: (open: boolean) => void
}) {
  const run = useCommand(pub.id)
  const ids = { deadline: useId(), category: useId(), reason: useId() }
  const mode = initial?.kind === 'set_duration' ? 'duration' : 'deadline'
  const [deadline, setDeadline] = useState(
    initial?.kind === 'set_deadline' ? initial.deadline : activity.deadline,
  )
  const [duration, setDuration] = useState(
    initial?.kind === 'set_duration' ? initial.durationWorkdays : activity.durationWorkdays,
  )
  const [strategy, setStrategy] = useState<Strategy>('absorb')
  const [category, setCategory] = useState<ReasonCategory>(() => reasonCategoryFor(activity))
  const [reason, setReason] = useState('')
  const [acceptConflicts, setAcceptConflicts] = useState(false)

  const change = useMemo((): ScheduleChange | null => {
    if (mode === 'duration') {
      return Number.isInteger(duration) && duration >= 1 && duration !== activity.durationWorkdays
        ? { kind: 'set_duration', activityId: activity.id, durationWorkdays: duration }
        : null
    }
    return deadline && deadline !== activity.deadline
      ? { kind: 'set_deadline', activityId: activity.id, deadline }
      : null
  }, [mode, duration, deadline, activity])

  const preview = useMemo((): { impact: Impact } | { error: string } | null => {
    if (!change) return null
    try {
      return { impact: previewReschedule(pub, change, { strategy }) }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }, [pub, change, strategy])

  const impact = preview && 'impact' in preview ? preview.impact : null
  const releaseMoves = impact ? impact.release.newTarget !== impact.release.target : false
  const reasonRequired = releaseMoves && pub.planState === 'binding'
  const conflicts = impact?.pinnedConflicts ?? []
  const canApply =
    impact !== null &&
    (!reasonRequired || reason.trim().length > 0) &&
    (conflicts.length === 0 || acceptConflicts)
  const name = (id: string) => pub.activities.find((a) => a.id === id)?.name ?? id

  function apply(e: FormEvent) {
    e.preventDefault()
    if (!canApply || !change) return
    const ok = run((p, c) =>
      reschedule(p, change, { strategy }, c, {
        reasonCategory: category,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        acceptConflicts,
      }),
    )
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={apply} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>
              {mode === 'duration' ? da.impact.titleDuration : da.impact.title}
            </DialogTitle>
            <DialogDescription>{da.impact.description(activity.name)}</DialogDescription>
          </DialogHeader>

          {mode === 'deadline' ? (
            <div className="grid gap-2">
              <Label htmlFor={ids.deadline}>{da.impact.newDeadline}</Label>
              <DateWithWorkdays
                id={ids.deadline}
                from={activity.deadline}
                value={deadline}
                onChange={setDeadline}
                calendar={pub.calendar}
              />
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor={ids.deadline}>{da.impact.newDuration}</Label>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground tabular-nums">
                  {activity.durationWorkdays} {da.impact.workdays}
                </span>
                <ArrowRight className="size-4 text-muted-foreground" />
                <Input
                  id={ids.deadline}
                  type="number"
                  min={1}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-24"
                  autoFocus
                />
                <span>{da.impact.workdays}</span>
                {impact && (
                  <span className="text-muted-foreground">
                    · {da.impact.newDeadline.toLowerCase()}{' '}
                    {formatDate(
                      impact.publication.activities.find((a) => a.id === activity.id)?.deadline,
                    )}
                  </span>
                )}
              </div>
            </div>
          )}

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{da.impact.strategy}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {STRATEGIES.map((s) => (
                <label
                  key={s}
                  className={cn(
                    'flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition-colors',
                    strategy === s ? 'border-ring bg-accent' : 'hover:bg-muted/50',
                  )}
                >
                  <input
                    type="radio"
                    name="strategy"
                    value={s}
                    checked={strategy === s}
                    onChange={() => setStrategy(s)}
                    className="mt-0.5 accent-primary"
                  />
                  <span>
                    <span className="block font-medium">{STRATEGY_LABELS[s].label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {STRATEGY_LABELS[s].hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {preview && 'error' in preview && (
            <p className="rounded-lg bg-status-late/10 px-3 py-2 text-sm text-status-late">
              {preview.error}
            </p>
          )}

          {impact && (
            <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
              <ReleaseLine impact={impact} publication={pub} />
              {impact.moved.length > 0 && (
                <div>
                  <div className="mb-1.5 font-medium">{da.impact.moved(impact.moved.length)}</div>
                  <ul className="grid gap-1">
                    {[...impact.moved]
                      // What the user must agree to first: shortened tasks, then milestones.
                      .sort((x, y) => rank(x) - rank(y))
                      .slice(0, SHOWN_MOVES)
                      .map((m) => (
                        <li key={m.activityId} className="flex items-baseline gap-2">
                          <span className="min-w-0 flex-1 truncate">{name(m.activityId)}</span>
                          {m.cause === 'compressed' && (
                            <span className="text-xs text-muted-foreground">
                              {da.impact.compressed} {m.from.durationWorkdays} →{' '}
                              {m.to.durationWorkdays} d.
                            </span>
                          )}
                          <span className="text-muted-foreground tabular-nums">
                            {formatDateCompact(m.from.deadline)} →{' '}
                            {formatDateCompact(m.to.deadline)}
                          </span>
                          <SlipBadge workdays={m.deltaWorkdays} />
                        </li>
                      ))}
                  </ul>
                  {impact.moved.length > SHOWN_MOVES && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {da.impact.andMore(impact.moved.length - SHOWN_MOVES)}
                    </div>
                  )}
                </div>
              )}
              {conflicts.length > 0 && (
                <div className="grid gap-1.5 rounded-md border border-status-late/40 bg-status-late/10 p-3">
                  <div className="flex items-center gap-2 font-medium">
                    <Lock className="size-3.5" />
                    {da.impact.pinnedConflicts}
                  </div>
                  {conflicts.map((c) => (
                    <div key={c.activityId} className="flex gap-2 tabular-nums">
                      <span className="flex-1">{name(c.activityId)}</span>
                      {formatDateCompact(c.pinnedDeadline)} →{' '}
                      {formatDateCompact(c.requiredDeadline)}
                    </div>
                  ))}
                  <label className="mt-1 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={acceptConflicts}
                      onChange={(e) => setAcceptConflicts(e.target.checked)}
                      className="accent-primary"
                    />
                    {da.impact.acceptConflicts}
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
            <div className="grid gap-2">
              <Label htmlFor={ids.category}>{da.impact.reasonCategory}</Label>
              <NativeSelect
                id={ids.category}
                value={category}
                onChange={(e) => setCategory(e.target.value as ReasonCategory)}
              >
                {ReasonCategorySchema.options.map((k) => (
                  <option key={k} value={k}>
                    {REASON_CATEGORY_LABELS[k]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={ids.reason}>{da.impact.reason}</Label>
              <Textarea
                id={ids.reason}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={da.impact.reasonPlaceholder}
                rows={2}
              />
              {reasonRequired && !reason.trim() && (
                <p className="flex items-center gap-1.5 text-xs text-status-late">
                  <TriangleAlert className="size-3.5" />
                  {da.impact.reasonRequired}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {da.impact.cancel}
            </Button>
            <Button type="submit" disabled={!canApply}>
              {da.impact.apply}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function rank(m: Impact['moved'][number]) {
  if (m.cause === 'compressed') return 0
  if (m.cause === 'change') return 1
  return 2
}

function ReleaseLine({ impact, publication }: { impact: Impact; publication: Publication }) {
  const { release } = impact
  const moves = release.newTarget !== release.target
  const delta =
    release.before && release.after
      ? getCalendar(publication.calendar).workdaysBetween(release.before, release.after)
      : 0
  const slip = release.slipWorkdays ?? 0
  return (
    <div className="grid gap-0.5">
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 font-medium',
          delta > 0 && !moves && 'text-status-late',
        )}
      >
        <span className="text-muted-foreground">{da.impact.release}:</span>
        {moves
          ? da.impact.releaseMoves(formatDate(release.newTarget))
          : delta > 0
            ? da.impact.releaseSlips(delta)
            : da.impact.releaseUnchanged}
        {delta !== 0 && (
          <span className="text-sm font-normal tabular-nums">
            ({formatDate(release.before)} → {formatDate(release.after)})
          </span>
        )}
      </div>
      {!moves && slip > 0 && (
        <div className="text-xs text-muted-foreground">
          {da.impact.behindTarget(slip, formatDate(release.newTarget))}
        </div>
      )}
    </div>
  )
}
