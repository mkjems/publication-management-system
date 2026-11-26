import type { ActivityKind } from '@pms/domain'
import { KIND_LABELS } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Small symbol matching how the activity will be drawn in the Gantt chart. */
export function KindGlyph({ kind, optional }: { kind: ActivityKind; optional?: boolean }) {
  return (
    <span
      role="img"
      aria-label={KIND_LABELS[kind]}
      title={KIND_LABELS[kind]}
      className="inline-flex h-4 w-5 shrink-0 items-center justify-center"
    >
      {kind === 'task' && (
        <span
          className={cn(
            'h-2 w-5 rounded-sm',
            optional ? 'border border-dashed border-bar-task bg-transparent' : 'bg-bar-task',
          )}
        />
      )}
      {kind === 'deadline' && <span className="h-3.5 w-1 rounded-full bg-bar-deadline" />}
      {kind === 'milestone' && <span className="size-2.5 rotate-45 rounded-[2px] bg-milestone" />}
    </span>
  )
}
