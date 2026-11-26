import type { WorkspaceKind } from '@pms/domain'
import { useNavigate } from '@tanstack/react-router'
import { da } from '@/i18n/da'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/store'

const KINDS: WorkspaceKind[] = ['demo', 'real']

export function WorkspaceSwitcher({ compact }: { compact?: boolean }) {
  const kind = useWorkspace((s) => s.kind)
  const load = useWorkspace((s) => s.load)
  const navigate = useNavigate()

  function choose(next: WorkspaceKind) {
    if (next === kind) return
    void load(next)
    void navigate({ to: '/publications' })
  }

  return (
    <div className={cn(!compact && 'grid gap-2')}>
      {!compact && (
        <div className="text-xs font-medium text-muted-foreground">{da.workspace.switchLabel}</div>
      )}
      <div
        role="radiogroup"
        aria-label={da.workspace.switchLabel}
        className="flex rounded-md border bg-background p-0.5 text-xs"
      >
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={k === kind}
            onClick={() => choose(k)}
            className={cn(
              'flex-1 rounded px-2 py-1 whitespace-nowrap transition-colors',
              k === kind
                ? 'bg-primary font-medium text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {da.workspace[k]}
          </button>
        ))}
      </div>
      {!compact && (
        <p className="text-xs text-muted-foreground">
          {kind === 'demo' ? da.workspace.demoHint : da.workspace.realHint}
        </p>
      )}
    </div>
  )
}
