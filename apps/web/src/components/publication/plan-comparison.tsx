import type { PinnedConflict, PlanComparison, Publication } from '@pms/domain'
import { ArrowRight, Lock } from 'lucide-react'
import { SlipBadge } from '@/components/status/status'
import { da } from '@/i18n/da'
import { formatDate, formatDateCompact } from '@/lib/format'
import { cn } from '@/lib/utils'

const SHOWN_MILESTONES = 8

/**
 * What a whole-plan change does: release target and forecast before → after, the milestones
 * whose forecast moves, how many activities move, and pinned conflicts.
 */
export function PlanComparisonView({
  comparison: c,
  publication: pub,
  conflicts = [],
  acceptConflicts,
  onAcceptConflicts,
}: {
  comparison: PlanComparison
  /** For activity names (either version will do). */
  publication: Publication
  conflicts?: PinnedConflict[]
  acceptConflicts?: boolean
  onAcceptConflicts?: (accept: boolean) => void
}) {
  const name = (id: string) => pub.activities.find((a) => a.id === id)?.name ?? id
  const r = c.release
  const milestones = c.milestones.filter((m) => m.forecastDeltaWorkdays !== 0)
  const nothing = c.moved.length === 0 && r.targetBefore === r.targetAfter && !milestones.length

  return (
    <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
      <div className="grid gap-1">
        <Line label={da.comparison.target} before={r.targetBefore} after={r.targetAfter} />
        <Line
          label={da.comparison.forecast}
          before={r.forecastBefore}
          after={r.forecastAfter}
          delta={r.forecastDeltaWorkdays}
          late={(r.slipAfter ?? 0) > 0}
        />
      </div>

      {nothing ? (
        <p className="text-muted-foreground">{da.comparison.nothing}</p>
      ) : (
        <>
          {c.moved.length > 0 && (
            <div className="text-muted-foreground">
              {da.comparison.moved(c.moved.length)}
              {c.statusChanged.length > 0 &&
                ` · ${da.comparison.statusChanged(c.statusChanged.length)}`}
            </div>
          )}
          <div>
            <div className="mb-1.5 font-medium">{da.comparison.milestones}</div>
            {milestones.length === 0 ? (
              <p className="text-muted-foreground">{da.comparison.noMilestoneChanges}</p>
            ) : (
              <ul className="grid gap-1">
                {milestones.slice(0, SHOWN_MILESTONES).map((m) => (
                  <li key={m.activityId} className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate">{name(m.activityId)}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatDateCompact(m.before.forecast)} → {formatDateCompact(m.after.forecast)}
                    </span>
                    <SlipBadge workdays={m.forecastDeltaWorkdays} />
                  </li>
                ))}
              </ul>
            )}
            {milestones.length > SHOWN_MILESTONES && (
              <div className="mt-1 text-xs text-muted-foreground">
                {da.comparison.andMore(milestones.length - SHOWN_MILESTONES)}
              </div>
            )}
          </div>
        </>
      )}

      {conflicts.length > 0 && (
        <div className="grid gap-1.5 rounded-md border border-status-late/40 bg-status-late/10 p-3">
          <div className="flex items-center gap-2 font-medium">
            <Lock className="size-3.5" />
            {da.comparison.pinnedConflicts}
          </div>
          {conflicts.map((x) => (
            <div key={x.activityId} className="flex gap-2 tabular-nums">
              <span className="flex-1">{name(x.activityId)}</span>
              {formatDateCompact(x.pinnedDeadline)} → {formatDateCompact(x.requiredDeadline)}
            </div>
          ))}
          {onAcceptConflicts && (
            <label className="mt-1 flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(acceptConflicts)}
                onChange={(e) => onAcceptConflicts(e.target.checked)}
                className="accent-primary"
              />
              {da.comparison.acceptConflicts}
            </label>
          )}
        </div>
      )}
    </div>
  )
}

function Line({
  label,
  before,
  after,
  delta,
  late,
}: {
  label: string
  before: string | null
  after: string | null
  delta?: number | null
  late?: boolean
}) {
  const same = before === after
  return (
    <div className={cn('flex flex-wrap items-center gap-2', late && !same && 'text-status-late')}>
      <span className="w-28 text-muted-foreground">{label}</span>
      {same ? (
        <>
          <span className="tabular-nums">{formatDate(after)}</span>
          <span className="text-xs text-muted-foreground">({da.comparison.unchanged})</span>
        </>
      ) : (
        <>
          <span className="text-muted-foreground tabular-nums">{formatDate(before)}</span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span className="font-medium tabular-nums">{formatDate(after)}</span>
          {delta != null && delta !== 0 && <SlipBadge workdays={delta} />}
        </>
      )}
    </div>
  )
}
