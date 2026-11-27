import {
  compareTemplates,
  updateTemplatePhase,
  type PhaseTemplate,
  type Template,
  type TemplateIssue,
} from '@pms/domain'
import { CircleAlert } from 'lucide-react'
import { useId, useMemo, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { da } from '@/i18n/da'
import { TemplateChanges } from '../template-changes'
import type { TemplateEdit } from './context'
import { NumberField } from './number-field'

const t = da.templateEditor

/** Asks for a single name (new track, rename). */
export function NameDialog({
  open,
  onOpenChange,
  title,
  label,
  initial = '',
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  label: string
  initial?: string
  onSave: (name: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {/* Mounted only while open, so it starts from `initial` each time. */}
        <NameForm
          title={title}
          label={label}
          initial={initial}
          onCancel={() => onOpenChange(false)}
          onSave={(name) => {
            onSave(name)
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function NameForm({
  title,
  label,
  initial,
  onCancel,
  onSave,
}: {
  title: string
  label: string
  initial: string
  onCancel: () => void
  onSave: (name: string) => void
}) {
  const id = useId()
  const [name, setName] = useState(initial)
  function submit(e: FormEvent) {
    e.preventDefault()
    if (name.trim()) onSave(name.trim())
  }
  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t.cancel}
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          {t.save}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Name, period text, description and nominal window of a phase. */
export function PhaseDialog({
  phase,
  onOpenChange,
  edit,
}: {
  phase: PhaseTemplate | null
  onOpenChange: (open: boolean) => void
  edit: (fn: TemplateEdit) => boolean
}) {
  return (
    <Dialog open={phase !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {phase && (
          <PhaseForm
            phase={phase}
            onCancel={() => onOpenChange(false)}
            onSave={(patch) => {
              if (edit((d) => updateTemplatePhase(d, phase.id, patch))) onOpenChange(false)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PhaseForm({
  phase,
  onCancel,
  onSave,
}: {
  phase: PhaseTemplate
  onCancel: () => void
  onSave: (patch: Parameters<typeof updateTemplatePhase>[2]) => void
}) {
  const ids = { name: useId(), period: useId(), description: useId() }
  const [form, setForm] = useState({
    name: phase.name,
    period: phase.period,
    description: phase.description ?? '',
    from: phase.window.startOffset,
    to: phase.window.endOffset,
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave({
      name: form.name.trim(),
      period: form.period.trim() || phase.period,
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      window: { startOffset: form.from, endOffset: form.to },
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{t.editPhase}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor={ids.name}>{t.phaseName}</Label>
        <Input
          id={ids.name}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={ids.period}>{t.phasePeriod}</Label>
        <Input
          id={ids.period}
          value={form.period}
          onChange={(e) => setForm({ ...form, period: e.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={ids.description}>{t.phaseDescription}</Label>
        <Textarea
          id={ids.description}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">{t.phaseWindow}</legend>
        <div className="flex items-center gap-2 text-sm">
          {t.windowFrom}
          <NumberField
            value={form.from}
            onCommit={(from) => setForm((f) => ({ ...f, from }))}
            aria-label={t.windowFrom}
          />
          {t.windowTo}
          <NumberField
            value={form.to}
            onCommit={(to) => setForm((f) => ({ ...f, to }))}
            aria-label={t.windowTo}
          />
        </div>
      </fieldset>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t.cancel}
        </Button>
        <Button type="submit">{t.save}</Button>
      </DialogFooter>
    </form>
  )
}

/** Shows what changed against the base version, asks for a note, and publishes. */
export function PublishDialog({
  open,
  onOpenChange,
  draft,
  base,
  errors,
  onPublish,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: Template
  base: Template | undefined
  errors: TemplateIssue[]
  onPublish: (changeNote: string) => void
}) {
  const id = useId()
  const [note, setNote] = useState(draft.changeNote ?? '')
  const changes = useMemo(
    () => (open && base ? compareTemplates(base, draft) : []),
    [open, base, draft],
  )
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.publishTitle(draft.version)}</DialogTitle>
          <DialogDescription>{t.publishBody}</DialogDescription>
        </DialogHeader>
        {base && (
          <div className="grid gap-2">
            <div className="text-xs font-medium text-muted-foreground">
              {da.masterplan.compareTitle(base.version, draft.version)}
            </div>
            <TemplateChanges changes={changes} />
          </div>
        )}
        {errors.length > 0 ? (
          <p className="flex gap-2 rounded-md border border-status-late/40 bg-status-late/10 px-3 py-2 text-sm">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-status-late" />
            {t.blocked} ({t.errors(errors.length)})
          </p>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor={id}>{t.changeNote}</Label>
            <Textarea
              id={id}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.changeNotePlaceholder}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button
            disabled={errors.length > 0 || changes.length === 0}
            onClick={() => onPublish(note)}
          >
            {t.publish(draft.version)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
