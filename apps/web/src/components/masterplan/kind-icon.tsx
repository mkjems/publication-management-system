import type { ActivityKind } from '@pms/domain'
import { CalendarRange, Diamond, Flag } from 'lucide-react'
import { da } from '@/i18n/da'
import { KIND_LABELS } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * The kind of an activity as an icon, for lists, tables and panels: a period for a task, a flag
 * for a deadline, a diamond for a milestone. Optional activities are drawn faded. (Chart legends
 * use `KindGlyph`, which mimics the chart's own marks.)
 */
export function KindIcon({
  kind,
  optional,
  className,
}: {
  kind: ActivityKind
  optional?: boolean
  className?: string
}) {
  const label = optional
    ? `${KIND_LABELS[kind]} (${da.masterplan.optional.toLowerCase()})`
    : KIND_LABELS[kind]
  const common = {
    role: 'img',
    'aria-label': label,
    className: cn(
      'size-4 shrink-0',
      kind === 'task' && 'text-bar-task',
      kind === 'deadline' && 'text-bar-deadline',
      kind === 'milestone' && 'size-3.5 fill-milestone text-milestone',
      optional && 'opacity-45',
      className,
    ),
  } as const
  return (
    <span title={label} className="inline-flex h-4 w-5 shrink-0 items-center justify-center">
      {kind === 'task' ? (
        <CalendarRange {...common} />
      ) : kind === 'deadline' ? (
        <Flag {...common} />
      ) : (
        <Diamond {...common} />
      )}
    </span>
  )
}
