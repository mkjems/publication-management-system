import { isFundingSufficient, setStatus, type Activity, type ActivityStatus } from '@pms/domain'
import { useState } from 'react'
import { NativeSelect } from '@/components/ui/native-select'
import { useCommand } from '@/hooks/use-command'
import { STATUS_LABELS, da } from '@/i18n/da'
import { statusOptions } from '@/lib/publication'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/store'
import { useFlash } from '@/store/flash'
import { selectRecord } from '@/store/workspace-store'
import { GateDialog } from './gate-dialog'
import { WaitingDialog } from './waiting-dialog'

/** Tint per status, so a column of statuses can be scanned at a glance. */
const TONE: Record<ActivityStatus, string> = {
  not_started: 'border-muted-foreground/30 bg-muted',
  in_progress: 'border-status-active/50 bg-status-active/10',
  waiting: 'border-status-late/50 bg-status-late/10 text-status-late font-medium',
  done: 'border-status-done/50 bg-status-done/15',
  skipped: 'bg-muted text-muted-foreground',
}

/**
 * Inline status editor. Choosing "Afventer" asks what the activity is waiting for; completing
 * the GO / HOLD / NO-GO gate asks for the decision; the funding gate explains what is missing.
 */
export function StatusSelect({
  publicationId,
  activity: a,
  className,
}: {
  publicationId: string
  activity: Activity
  className?: string
}) {
  const run = useCommand(publicationId)
  const [askWaiting, setAskWaiting] = useState(false)
  const [askDecision, setAskDecision] = useState(false)
  const show = useFlash((s) => s.show)

  function change(status: ActivityStatus) {
    if (status === 'waiting') return setAskWaiting(true)
    if (status === 'done' && a.gate === 'go_hold_nogo') return setAskDecision(true)
    if (status === 'done' && a.gate === 'funding_secured') {
      const pub = selectRecord(useWorkspace.getState(), publicationId)?.publication
      if (pub && !isFundingSufficient(pub)) return show(da.funding.gateNotSufficient)
    }
    run((p, c) => setStatus(p, a.id, status, c))
  }

  return (
    <>
      <NativeSelect
        aria-label={`${da.publication.columns.status}: ${a.name}`}
        value={a.status}
        onChange={(e) => change(e.target.value as ActivityStatus)}
        className={cn('h-8 w-full text-xs', TONE[a.status], className)}
      >
        {statusOptions(a).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </NativeSelect>
      {askDecision && (
        <GateDialog
          publicationId={publicationId}
          activity={a}
          onClose={() => setAskDecision(false)}
        />
      )}
      {askWaiting && (
        <WaitingDialog
          open
          onOpenChange={setAskWaiting}
          initial={a.waitingFor}
          onSave={(waitingFor) => run((p, c) => setStatus(p, a.id, 'waiting', c, { waitingFor }))}
        />
      )}
    </>
  )
}
