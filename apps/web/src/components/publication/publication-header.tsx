import {
  canRedo,
  canUndo,
  openPause,
  type PublicationHealth,
  type PublicationRecord,
} from '@pms/domain'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronLeft, PauseCircle, Redo2, Trash2, Undo2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  HealthBadge,
  LifecycleBadge,
  PlanStateBadge,
  ProgressBar,
  SlipBadge,
} from '@/components/status/status'
import { Button } from '@/components/ui/button'
import { usePersonName } from '@/hooks/use-publication'
import { da } from '@/i18n/da'
import { formatDate } from '@/lib/format'
import { useWorkspace } from '@/store'
import { useFlash } from '@/store/flash'

export function PublicationHeader({
  record,
  health,
}: {
  record: PublicationRecord
  health: PublicationHealth
}) {
  const pub = record.publication
  const lead = usePersonName(pub.projectLeadId)
  const undo = useWorkspace((s) => s.undo)
  const redo = useWorkspace((s) => s.redo)
  const deletePublication = useWorkspace((s) => s.deletePublication)
  const show = useFlash((s) => s.show)
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { overall, release } = health
  const pause = openPause(pub)

  const guard = (f: () => void) => () => {
    try {
      f()
    } catch (e) {
      show(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <header className="mb-6 grid gap-4">
      <Link
        to="/publications"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        {da.publication.back}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{pub.workingTitle}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <LifecycleBadge lifecycle={pub.lifecycle} />
            <PlanStateBadge planState={pub.planState} />
            {lead && <span>{lead}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={guard(() => undo(pub.id))}
            disabled={!canUndo(record.history)}
            title={`${da.publication.undo} (⌘Z)`}
          >
            <Undo2 />
            {da.publication.undo}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={guard(() => redo(pub.id))}
            disabled={!canRedo(record.history)}
            title={`${da.publication.redo} (⇧⌘Z)`}
          >
            <Redo2 />
            {da.publication.redo}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            title={da.publication.delete}
          >
            <Trash2 />
            <span className="sr-only">{da.publication.delete}</span>
          </Button>
        </div>
      </div>

      {pause && (
        <div className="flex items-center gap-2 rounded-lg border border-status-waiting/50 bg-status-waiting/10 px-4 py-2.5 text-sm">
          <PauseCircle className="size-4 text-status-waiting" />
          {da.publication.paused(formatDate(pause.from))}
          {pause.reason && <span className="text-muted-foreground">· {pause.reason}</span>}
        </div>
      )}

      <div className="grid gap-px overflow-hidden rounded-xl border bg-border shadow-xs sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={`${da.publication.target} (${pub.planState === 'binding' ? da.publication.binding : da.publication.desired})`}
        >
          {formatDate(release.target)}
        </Stat>
        <Stat label={da.publication.forecast}>
          <span className="flex items-center gap-2">
            {formatDate(release.forecast)}
            {(release.slipWorkdays ?? 0) > 0 ? (
              <SlipBadge workdays={release.slipWorkdays} />
            ) : (
              <span className="text-xs font-normal text-muted-foreground">
                {da.publication.onTime}
              </span>
            )}
          </span>
        </Stat>
        <Stat label={da.publication.progress}>
          <span className="flex items-center gap-3">
            <ProgressBar value={overall.progress} className="w-24" />
            <span className="tabular-nums">{Math.round(overall.progress * 100)} %</span>
          </span>
        </Stat>
        <Stat label={da.publications.columns.health}>
          <span className="flex flex-wrap items-center gap-2">
            <HealthBadge state={overall.state} />
            <span className="text-xs font-normal text-muted-foreground tabular-nums">
              {[
                overall.late && `${overall.late} forsinket`,
                overall.atRisk && `${overall.atRisk} i risiko`,
                overall.waiting && `${overall.waiting} afventer`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
        </Stat>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={da.publication.deleteConfirmTitle}
        body={da.publication.deleteConfirmBody}
        confirm={da.publication.deleteConfirm}
        cancel={da.wizard.cancel}
        destructive
        onConfirm={() => {
          deletePublication(pub.id)
          void navigate({ to: '/publications' })
        }}
      />
    </header>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{children}</div>
    </div>
  )
}
