import type { HealthState, Lifecycle, PlanState } from '@pms/domain'
import { Badge } from '@/components/ui/badge'
import { HEALTH_LABELS, LIFECYCLE_LABELS, PLAN_STATE_LABELS } from '@/i18n/da'
import { formatSigned } from '@/lib/format'
import { cn } from '@/lib/utils'

const HEALTH_DOT: Record<HealthState, string> = {
  late: 'bg-status-late',
  waiting: 'bg-status-waiting',
  at_risk: 'bg-status-risk',
  on_track: 'bg-status-active',
  done: 'bg-status-done',
  skipped: 'bg-muted-foreground/40',
}

const HEALTH_BADGE: Record<HealthState, string> = {
  late: 'bg-status-late/15 text-status-late',
  waiting: 'bg-status-waiting/20 text-foreground',
  at_risk: 'bg-status-risk/15 text-foreground',
  on_track: 'bg-status-active/10 text-foreground',
  done: 'bg-status-done/15 text-foreground',
  skipped: 'bg-muted text-muted-foreground',
}

export function HealthDot({ state, className }: { state: HealthState; className?: string }) {
  return (
    <span
      role="img"
      aria-label={HEALTH_LABELS[state]}
      title={HEALTH_LABELS[state]}
      className={cn('inline-block size-2.5 shrink-0 rounded-full', HEALTH_DOT[state], className)}
    />
  )
}

export function HealthBadge({ state }: { state: HealthState }) {
  return (
    <Badge className={cn('border-transparent', HEALTH_BADGE[state])}>
      <span className={cn('size-1.5 rounded-full', HEALTH_DOT[state])} />
      {HEALTH_LABELS[state]}
    </Badge>
  )
}

export function LifecycleBadge({ lifecycle }: { lifecycle: Lifecycle }) {
  return (
    <Badge variant={lifecycle === 'paused' || lifecycle === 'hold' ? 'milestone' : 'secondary'}>
      {LIFECYCLE_LABELS[lifecycle]}
    </Badge>
  )
}

export function PlanStateBadge({ planState }: { planState: PlanState }) {
  return (
    <Badge variant={planState === 'binding' ? 'outline' : 'muted'}>
      {PLAN_STATE_LABELS[planState]}
    </Badge>
  )
}

/** Working days late (positive) or early (negative). Hidden when 0 unless `showZero`. */
export function SlipBadge({
  workdays,
  showZero,
  title,
}: {
  workdays: number | null
  showZero?: boolean
  title?: string
}) {
  if (workdays === null || (workdays === 0 && !showZero)) return null
  return (
    <span
      title={title ?? `${formatSigned(workdays)} arbejdsdage`}
      className={cn(
        'inline-flex items-center rounded px-1 text-xs font-medium tabular-nums',
        workdays > 0 ? 'bg-status-late/15 text-status-late' : 'bg-status-done/15 text-foreground',
      )}
    >
      {formatSigned(workdays)}
    </span>
  )
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div className="h-full rounded-full bg-status-done" style={{ width: `${value * 100}%` }} />
    </div>
  )
}
