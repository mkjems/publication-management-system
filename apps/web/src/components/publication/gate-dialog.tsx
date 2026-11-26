import { decideGate, type Activity, type GateDecision } from '@pms/domain'
import { TriangleAlert } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCommand } from '@/hooks/use-command'
import { da } from '@/i18n/da'
import { cn } from '@/lib/utils'

const DECISIONS: GateDecision[] = ['go', 'hold', 'no_go']

/** The GO / HOLD / NO-GO decision on the gate milestone (PLAN §5.1.6). */
export function GateDialog({
  publicationId,
  activity,
  onClose,
}: {
  publicationId: string
  activity: Activity
  onClose: () => void
}) {
  const run = useCommand(publicationId)
  const id = useId()
  const [decision, setDecision] = useState<GateDecision>('go')
  const [reason, setReason] = useState('')
  const needsReason = decision !== 'go'
  const canApply = !needsReason || reason.trim().length > 0

  function apply(e: FormEvent) {
    e.preventDefault()
    if (!canApply) return
    const ok = run((p, c) =>
      decideGate(p, activity.id, decision, c, {
        reasonCategory: 'funding',
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      }),
    )
    if (ok) onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <form onSubmit={apply} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{da.gate.title}</DialogTitle>
            <DialogDescription>{da.gate.description}</DialogDescription>
          </DialogHeader>
          <fieldset className="grid gap-2 sm:grid-cols-3">
            {DECISIONS.map((d) => (
              <label
                key={d}
                className={cn(
                  'flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition-colors',
                  decision === d ? 'border-ring bg-accent' : 'hover:bg-muted/50',
                )}
              >
                <input
                  type="radio"
                  name="gate-decision"
                  checked={decision === d}
                  onChange={() => setDecision(d)}
                  className="mt-0.5 accent-primary"
                />
                <span>
                  <span className="block font-medium">{da.gate[d].label}</span>
                  <span className="block text-xs text-muted-foreground">{da.gate[d].hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="grid gap-2">
            <Label htmlFor={id}>{da.impact.reason}</Label>
            <Textarea
              id={id}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={da.gate.reasonPlaceholder}
              rows={2}
            />
            {needsReason && !reason.trim() && (
              <p className="flex items-center gap-1.5 text-xs text-status-late">
                <TriangleAlert className="size-3.5" />
                {da.gate.reasonRequired}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {da.impact.cancel}
            </Button>
            <Button type="submit" disabled={!canApply}>
              {da.gate.apply}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
