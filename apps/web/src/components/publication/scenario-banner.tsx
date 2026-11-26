import { comparePlans, type Publication } from '@pms/domain'
import { FlaskConical } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { useSandbox } from '@/hooks/use-publication'
import { da } from '@/i18n/da'
import { useWorkspace } from '@/store'
import { useFlash } from '@/store/flash'
import { PlanComparisonView } from './plan-comparison'

/**
 * Shown while a publication is in scenario mode: what has changed compared with the live plan,
 * and the choice to apply or discard.
 */
export function ScenarioBanner({ publication: pub }: { publication: Publication }) {
  const sandbox = useSandbox(pub.id)
  const asOf = useWorkspace((s) => s.asOf)
  const applySandbox = useWorkspace((s) => s.applySandbox)
  const discardSandbox = useWorkspace((s) => s.discardSandbox)
  const show = useFlash((s) => s.show)
  const [comparing, setComparing] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const comparison = useMemo(
    () =>
      sandbox ? comparePlans(sandbox.base.publication, sandbox.record.publication, asOf) : null,
    [sandbox, asOf],
  )
  if (!sandbox || !comparison) return null

  const changes = new Set(
    sandbox.record.history.log.slice(sandbox.base.history.log.length).map((e) => e.txId),
  ).size
  const changed = sandbox.record !== sandbox.base

  function apply() {
    try {
      applySandbox()
    } catch {
      show(da.sandbox.conflict)
    }
  }

  return (
    <div
      className="grid gap-3 rounded-lg border-2 border-dashed border-status-active/60 bg-status-active/5 px-4 py-3 text-sm"
      data-testid="scenario-banner"
    >
      <div className="flex flex-wrap items-start gap-3">
        <FlaskConical className="mt-0.5 size-4 shrink-0 text-status-active" />
        <div className="min-w-0 flex-1">
          <div className="font-medium">
            {da.sandbox.title}
            <span className="ml-2 font-normal text-muted-foreground">
              {changes ? da.sandbox.changes(changes) : da.sandbox.noChanges}
            </span>
          </div>
          <p className="text-muted-foreground">{da.sandbox.body}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => setComparing((c) => !c)}>
            {comparing ? da.sandbox.hideCompare : da.sandbox.compare}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => (changed ? setConfirmDiscard(true) : discardSandbox())}
          >
            {da.sandbox.discard}
          </Button>
          <Button size="sm" onClick={apply} disabled={!changed}>
            {da.sandbox.apply}
          </Button>
        </div>
      </div>
      {comparing && (
        <div className="max-w-3xl">
          <PlanComparisonView comparison={comparison} publication={pub} />
        </div>
      )}
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={da.sandbox.discardConfirmTitle}
        body={da.sandbox.discardConfirmBody}
        confirm={da.sandbox.discard}
        cancel={da.impact.cancel}
        destructive
        onConfirm={discardSandbox}
      />
    </div>
  )
}
