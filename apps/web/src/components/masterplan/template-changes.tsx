import type { TemplateChange } from '@pms/domain'
import { ChevronRight, Minus, MoveHorizontal, Pencil, Plus } from 'lucide-react'
import { TEMPLATE_FIELD_LABELS, da } from '@/i18n/da'
import { formatDuration, formatOffset } from '@/lib/format'

const t = da.templateEditor

/** A change that only moved an activity's deadline, usually as a knock-on of another edit. */
const onlyMoved = (c: TemplateChange) =>
  c.op === 'changed' && c.fields.length === 1 && c.fields[0] === 'deadline'

/**
 * The changes between two template versions as a compact list. Real edits come first; activities
 * that only moved (to keep the dependencies) are folded into one line that can be opened.
 */
export function TemplateChanges({ changes }: { changes: TemplateChange[] }) {
  if (!changes.length) return <p className="text-sm text-muted-foreground">{t.noChanges}</p>
  const edits = changes.filter((c) => !onlyMoved(c))
  const moved = changes.filter(onlyMoved)
  return (
    <div className="grid max-h-80 gap-1.5 overflow-y-auto pr-1 text-sm">
      {edits.length > 0 && (
        <ul className="grid gap-1.5">
          {edits.map((c) => (
            <Change key={`${c.entity}-${c.id}`} change={c} />
          ))}
        </ul>
      )}
      {moved.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-muted-foreground hover:text-foreground">
            <MoveHorizontal className="size-3.5" />
            <span className="flex-1">{t.movedSummary(moved.length)}</span>
            <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
          </summary>
          <ul className="mt-1.5 grid gap-1.5 pl-5.5">
            {moved.map((c) => (
              <Change key={`${c.entity}-${c.id}`} change={c} />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function Change({ change: c }: { change: TemplateChange }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">
        {c.op === 'added' ? (
          <Plus className="size-3.5 text-status-done" aria-label={t.change.added} />
        ) : c.op === 'removed' ? (
          <Minus className="size-3.5 text-status-late" aria-label={t.change.removed} />
        ) : (
          <Pencil className="size-3.5" aria-label={t.change.changed} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        {t.entity[c.entity] && (
          <span className="mr-1 text-muted-foreground">{t.entity[c.entity]}</span>
        )}
        <span className={c.op === 'removed' ? 'line-through' : undefined}>{c.name}</span>
        {c.op === 'changed' && (
          <span className="block text-xs text-muted-foreground">
            {[
              c.duration &&
                `${TEMPLATE_FIELD_LABELS.duration} ${formatDuration(c.duration.from)} → ${formatDuration(c.duration.to)}`,
              c.deadline &&
                `${TEMPLATE_FIELD_LABELS.deadline} ${formatOffset(c.deadline.from)} → ${formatOffset(c.deadline.to)}`,
              ...c.fields
                .filter((f) => f !== 'duration' && f !== 'deadline')
                .map((f) => TEMPLATE_FIELD_LABELS[f]),
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        )}
      </span>
    </li>
  )
}
