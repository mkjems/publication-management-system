import {
  actualDurations,
  addTemplateTrack,
  findTemplate,
  validateTemplate,
  type PhaseTemplate,
  type Template,
  type TemplateIssue,
} from '@pms/domain'
import {
  ChevronsDownUp,
  ChevronsUpDown,
  CircleAlert,
  CircleCheck,
  Info,
  Trash2,
  TriangleAlert,
  Undo2,
  Upload,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { da } from '@/i18n/da'
import { errorText } from '@/lib/errors'
import { issueText, templateNames } from '@/lib/template'
import { useWorkspace } from '@/store'
import { useFlash } from '@/store/flash'
import { ActivitySheet } from './activity-sheet'
import { EditorContext, newTemplateId, type EditorContextValue, type TemplateEdit } from './context'
import { NameDialog, PhaseDialog, PublishDialog } from './dialogs'
import { EditorPhase } from './editor-phase'

const t = da.templateEditor
/** How long rows moved by an edit stay highlighted. */
const HIGHLIGHT_MS = 2500

/**
 * The master plan editor (PLAN §5.1 screen 9) for the draft of `templateId`. `onClose` is called
 * after the draft is published or discarded.
 */
export function TemplateEditor({
  templateId,
  onClose,
}: {
  templateId: string
  onClose: () => void
}) {
  const draft = useWorkspace((s) => s.templateDrafts[templateId])
  // Gone right after publishing or discarding, until the page navigates away.
  if (!draft) return null
  return <EditorBody templateId={templateId} draft={draft} onClose={onClose} />
}

function EditorBody({
  templateId,
  draft,
  onClose,
}: {
  templateId: string
  draft: Template
  onClose: () => void
}) {
  const templates = useWorkspace((s) => s.templates)
  const records = useWorkspace((s) => s.records)
  const canUndo = useWorkspace((s) => (s.templateUndo[templateId]?.length ?? 0) > 0)
  const editDraft = useWorkspace((s) => s.editTemplateDraft)
  const undo = useWorkspace((s) => s.undoTemplateEdit)
  const discard = useWorkspace((s) => s.discardTemplateDraft)
  const publish = useWorkspace((s) => s.publishTemplateDraft)
  const showFlash = useFlash((s) => s.show)

  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [selected, setSelected] = useState<string | null>(null)
  const [phaseDialog, setPhaseDialog] = useState<PhaseTemplate | null>(null)
  const [trackFor, setTrackFor] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [moved, setMoved] = useState<{ ids: Set<string>; count: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const base = draft.basedOnVersion
    ? findTemplate(templates, templateId, draft.basedOnVersion)
    : undefined
  const nameOf = useMemo(() => templateNames(draft), [draft])
  const issues = useMemo(() => validateTemplate(draft), [draft])
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')
  const issuesByActivity = useMemo(() => {
    const map = new Map<string, TemplateIssue[]>()
    for (const i of issues) {
      if (!i.activityId) continue
      map.set(i.activityId, [...(map.get(i.activityId) ?? []), i])
    }
    return map
  }, [issues])
  const actuals = useMemo(
    () =>
      actualDurations(
        Object.values(records).map((r) => r.publication),
        templateId,
      ),
    [records, templateId],
  )

  const edit = useCallback(
    (fn: TemplateEdit) => {
      try {
        const result = editDraft(templateId, fn)
        clearTimeout(timer.current)
        if (result.moved.length) {
          setMoved({ ids: new Set(result.moved.map((m) => m.id)), count: result.moved.length })
          timer.current = setTimeout(
            () => setMoved((m) => m && { ...m, ids: new Set() }),
            HIGHLIGHT_MS,
          )
        } else setMoved(null)
        return true
      } catch (e) {
        showFlash(errorText(e))
        return false
      }
    },
    [editDraft, showFlash, templateId],
  )

  const openActivity = useCallback(
    (id: string) => {
      const a = useWorkspace
        .getState()
        .templateDrafts[templateId]?.activities.find((x) => x.id === id)
      if (!a) return
      setOpen((s) => new Set(s).add(a.phaseId))
      setSelected(id)
    },
    [templateId],
  )

  // Undo from the keyboard, unless typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return
      e.preventDefault()
      undo(templateId)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, templateId])

  const ctx: EditorContextValue = {
    draft,
    edit,
    nameOf,
    actuals,
    issuesByActivity,
    moved: moved?.ids ?? new Set(),
    openActivity,
  }
  const allOpen = draft.phases.every((p) => open.has(p.id))

  return (
    <EditorContext.Provider value={ctx}>
      <PageHeader
        title={t.title(draft.version)}
        description={t.description(draft.basedOnVersion ?? draft.version - 1)}
        actions={
          <>
            <Button variant="outline" disabled={!canUndo} onClick={() => undo(templateId)}>
              <Undo2 /> {t.undo}
            </Button>
            <Button variant="outline" onClick={() => setConfirmDiscard(true)}>
              <Trash2 /> {t.discard}
            </Button>
            <Button onClick={() => setPublishing(true)}>
              <Upload /> {t.publish(draft.version)}
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {t.issues}
              {errors.length > 0 && (
                <span className="inline-flex items-center gap-1 text-sm font-normal text-status-late">
                  <CircleAlert className="size-4" /> {t.errors(errors.length)}
                </span>
              )}
              {warnings.length > 0 && (
                <span className="inline-flex items-center gap-1 text-sm font-normal text-status-waiting">
                  <TriangleAlert className="size-4" /> {t.warnings(warnings.length)}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {issues.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CircleCheck className="size-4 text-status-done" /> {t.noIssues}
              </p>
            ) : (
              <ul className="grid max-h-48 gap-1.5 overflow-y-auto pr-1 text-sm">
                {[...errors, ...warnings].map((i, n) => (
                  <li key={n} className="flex items-start gap-2">
                    {i.severity === 'error' ? (
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-status-late" />
                    ) : (
                      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-waiting" />
                    )}
                    <span className="min-w-0">
                      {i.activityId || i.trackId ? (
                        <button
                          type="button"
                          className="font-medium hover:text-primary hover:underline"
                          onClick={() => {
                            if (i.activityId) openActivity(i.activityId)
                            else if (i.trackId) {
                              const tr = draft.tracks.find((x) => x.id === i.trackId)
                              if (tr) setOpen((s) => new Set(s).add(tr.phaseId))
                            }
                          }}
                        >
                          {nameOf(i.activityId ?? i.trackId ?? '')}
                        </button>
                      ) : null}{' '}
                      <span className="text-muted-foreground">{issueText(i, nameOf)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-3">
          <p className="flex gap-2 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            {t.hint}
          </p>
          {moved && moved.count > 0 && (
            <p
              role="status"
              className="flex items-center gap-2 rounded-lg border border-milestone/50 bg-milestone/10 px-4 py-3 text-sm"
            >
              <span className="flex-1">{t.moved(moved.count)}</span>
              <Button size="sm" variant="outline" onClick={() => undo(templateId)}>
                <Undo2 /> {t.undo}
              </Button>
            </p>
          )}
        </div>
      </div>

      <div className="mb-3 flex justify-end">
        <Button
          variant="outline"
          onClick={() => setOpen(allOpen ? new Set() : new Set(draft.phases.map((p) => p.id)))}
        >
          {allOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
          {allOpen ? da.masterplan.collapseAll : da.masterplan.expandAll}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {draft.phases.map((phase) => (
          <EditorPhase
            key={phase.id}
            phase={phase}
            open={open.has(phase.id)}
            onToggle={() =>
              setOpen((s) => {
                const next = new Set(s)
                if (next.has(phase.id)) next.delete(phase.id)
                else next.add(phase.id)
                return next
              })
            }
            onEditPhase={() => setPhaseDialog(phase)}
            onAddTrack={() => setTrackFor(phase.id)}
          />
        ))}
      </div>

      <ActivitySheet activityId={selected} onClose={() => setSelected(null)} />
      <PhaseDialog
        phase={phaseDialog}
        onOpenChange={(o) => !o && setPhaseDialog(null)}
        edit={edit}
      />
      <NameDialog
        open={trackFor !== null}
        onOpenChange={(o) => !o && setTrackFor(null)}
        title={t.newTrack}
        label={t.trackName}
        onSave={(name) => {
          const phaseId = trackFor!
          if (edit((d) => addTemplateTrack(d, { id: newTemplateId(), phaseId, name })))
            setOpen((s) => new Set(s).add(phaseId))
        }}
      />
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={t.discardTitle}
        body={t.discardBody}
        confirm={t.discard}
        cancel={t.cancel}
        destructive
        onConfirm={() => {
          discard(templateId)
          onClose()
        }}
      />
      <PublishDialog
        open={publishing}
        onOpenChange={setPublishing}
        draft={draft}
        base={base}
        errors={errors}
        onPublish={(note) => {
          try {
            publish(templateId, note)
            setPublishing(false)
            onClose()
          } catch (e) {
            showFlash(errorText(e))
          }
        }}
      />
    </EditorContext.Provider>
  )
}
