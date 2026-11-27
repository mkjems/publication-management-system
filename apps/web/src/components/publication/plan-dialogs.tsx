/**
 * Dialogs for changes to the whole plan (PLAN §4.1.4–6, §5.1.5): move the release date, pause
 * and resume, make the plan binding and capture a baseline. Each previews its effect with the
 * same command it will run, and applies it as one undoable change.
 */
import {
  ReasonCategorySchema,
  changeReleaseDate,
  getCalendar,
  makeBinding,
  openPause,
  pause,
  previewCommand,
  rebaseline,
  releaseActivity,
  resume,
  targetReleaseDate,
  type CommandPreview,
  type CommandResult,
  type IsoDate,
  type PinnedConflict,
  type Publication,
  type ReasonCategory,
  type ResumeMode,
} from '@pms/domain'
import { ArrowRight, TriangleAlert } from 'lucide-react'
import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
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
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { useCommand } from '@/hooks/use-command'
import { REASON_CATEGORY_LABELS, da } from '@/i18n/da'
import { errorText } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/store'
import { PlanComparisonView } from './plan-comparison'

export type PlanDialogKind = 'release' | 'pause' | 'resume' | 'make_binding' | 'rebaseline'

/** Opens the dialog for `kind`; `onClose` is called when it closes. */
export function PlanDialog({
  kind,
  publication,
  onClose,
}: {
  kind: PlanDialogKind
  publication: Publication
  onClose: () => void
}) {
  const onOpenChange = (open: boolean) => !open && onClose()
  switch (kind) {
    case 'release':
      return <ReleaseDialog publication={publication} onOpenChange={onOpenChange} />
    case 'pause':
      return <PauseDialog publication={publication} onOpenChange={onOpenChange} />
    case 'resume':
      return <ResumeDialog publication={publication} onOpenChange={onOpenChange} />
    case 'make_binding':
    case 'rebaseline':
      return <BindingDialog mode={kind} publication={publication} onOpenChange={onOpenChange} />
  }
}

interface DialogProps {
  publication: Publication
  onOpenChange: (open: boolean) => void
}

type Preview = CommandPreview<CommandResult & { pinnedConflicts: PinnedConflict[] }>

/** Runs a preview, turning a refused command into a message. Cheap enough for every render. */
function tryPreview(run: () => Preview | null) {
  try {
    const p = run()
    return p ? { preview: p, error: null } : { preview: null, error: null }
  } catch (e) {
    return { preview: null, error: errorText(e) }
  }
}

// ── Release date ────────────────────────────────────────────────────────────

function ReleaseDialog({ publication: pub, onOpenChange }: DialogProps) {
  const asOf = useWorkspace((s) => s.asOf)
  const run = useCommand(pub.id)
  const cal = getCalendar(pub.calendar)
  const current = releaseActivity(pub)?.deadline ?? targetReleaseDate(pub)
  const id = useId()
  const [date, setDate] = useState<IsoDate>(current)
  const [reason, setReason] = useState<ReasonState>({ category: 'other', text: '' })
  const [accept, setAccept] = useState(false)
  const binding = pub.planState === 'binding'
  const changed = Boolean(date) && cal.previousWorkingDay(date) !== current

  const { preview, error } = tryPreview(() =>
    changed
      ? previewCommand(pub, asOf, (p, c) =>
          changeReleaseDate(p, date, c, { reason: 'preview', acceptConflicts: true }),
        )
      : null,
  )
  const conflicts = preview?.pinnedConflicts ?? []
  const canApply =
    preview !== null &&
    (!binding || reason.text.trim().length > 0) &&
    (conflicts.length === 0 || accept)

  function apply(e: FormEvent) {
    e.preventDefault()
    if (!canApply) return
    const ok = run((p, c) =>
      changeReleaseDate(p, date, c, { ...meta(reason), acceptConflicts: accept }),
    )
    if (ok) onOpenChange(false)
  }

  const nextBaseline = pub.baselines.length
    ? Math.max(...pub.baselines.map((b) => b.number)) + 1
    : 0

  return (
    <FormDialog
      title={da.releaseDialog.title}
      description={da.releaseDialog.description}
      onOpenChange={onOpenChange}
      onSubmit={apply}
      submit={da.releaseDialog.apply}
      canSubmit={canApply}
    >
      <div className="grid gap-2">
        <Label htmlFor={id}>{da.releaseDialog.newDate}</Label>
        <DateWithWorkdays
          id={id}
          from={current}
          value={date}
          onChange={setDate}
          calendar={pub.calendar}
        />
      </div>
      {error && <ErrorLine>{error}</ErrorLine>}
      {preview && (
        <PlanComparisonView
          comparison={preview.comparison}
          publication={pub}
          conflicts={conflicts}
          acceptConflicts={accept}
          onAcceptConflicts={setAccept}
        />
      )}
      {binding && changed && (
        <p className="text-sm text-muted-foreground">{da.releaseDialog.rebaseline(nextBaseline)}</p>
      )}
      <ReasonFields value={reason} onChange={setReason} required={binding} />
    </FormDialog>
  )
}

// ── Pause and resume ────────────────────────────────────────────────────────

function PauseDialog({ publication: pub, onOpenChange }: DialogProps) {
  const asOf = useWorkspace((s) => s.asOf)
  const run = useCommand(pub.id)
  const id = useId()
  const [from, setFrom] = useState<IsoDate>(asOf)
  const [reason, setReason] = useState<ReasonState>({ category: 'funding', text: '' })
  const canApply = Boolean(from) && reason.text.trim().length > 0

  function apply(e: FormEvent) {
    e.preventDefault()
    if (!canApply) return
    const ok = run((p, c) =>
      pause(p, c, { from, reason: reason.text.trim(), reasonCategory: reason.category }),
    )
    if (ok) onOpenChange(false)
  }

  return (
    <FormDialog
      title={da.pauseDialog.title}
      description={da.pauseDialog.description}
      onOpenChange={onOpenChange}
      onSubmit={apply}
      submit={da.pauseDialog.apply}
      canSubmit={canApply}
    >
      <div className="grid gap-2">
        <Label htmlFor={id}>{da.pauseDialog.from}</Label>
        <Input
          id={id}
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-44"
        />
      </div>
      <ReasonFields
        value={reason}
        onChange={setReason}
        required
        requiredText={da.pauseDialog.reasonRequired}
        placeholder={da.pauseDialog.reasonPlaceholder}
        autoFocus
      />
    </FormDialog>
  )
}

function ResumeDialog({ publication: pub, onOpenChange }: DialogProps) {
  const asOf = useWorkspace((s) => s.asOf)
  const run = useCommand(pub.id)
  const cal = getCalendar(pub.calendar)
  const current = openPause(pub)
  const ids = { on: useId(), release: useId() }
  const pauseFrom = current?.from ?? asOf
  const [on, setOn] = useState<IsoDate>(asOf < pauseFrom ? pauseFrom : asOf)
  const [modeKind, setModeKind] = useState<ResumeMode['kind']>('shift')
  const release = releaseActivity(pub)?.deadline ?? targetReleaseDate(pub)
  const [releaseDate, setReleaseDate] = useState<IsoDate>(() =>
    cal.addWorkdays(release, Math.max(0, cal.workdaysBetween(pauseFrom, on))),
  )
  const [reason, setReason] = useState<ReasonState>({
    category: 'funding',
    text: current?.reason ?? '',
  })
  const [accept, setAccept] = useState(false)

  const mode = useMemo(
    (): ResumeMode | null =>
      modeKind === 'shift'
        ? { kind: 'shift' }
        : releaseDate
          ? { kind: 'new_release', releaseDate }
          : null,
    [modeKind, releaseDate],
  )
  const { preview, error } = tryPreview(() =>
    current && mode && on
      ? previewCommand(pub, asOf, (p, c) =>
          resume(p, c, { mode, on, acceptConflicts: true, reason: 'preview' }),
        )
      : null,
  )
  const conflicts = preview?.pinnedConflicts ?? []
  const binding = pub.planState === 'binding'
  const releaseMoves =
    preview !== null &&
    preview.comparison.release.targetAfter !== preview.comparison.release.targetBefore
  const reasonRequired = binding && releaseMoves
  const canApply =
    preview !== null &&
    mode !== null &&
    (!reasonRequired || reason.text.trim().length > 0) &&
    (conflicts.length === 0 || accept)

  function apply(e: FormEvent) {
    e.preventDefault()
    if (!canApply || !mode) return
    const ok = run((p, c) => resume(p, c, { mode, on, ...meta(reason), acceptConflicts: accept }))
    if (ok) onOpenChange(false)
  }

  if (!current) return null
  const days = Math.max(0, cal.workdaysBetween(current.from, on))

  return (
    <FormDialog
      title={da.resumeDialog.title}
      description={da.resumeDialog.description(formatDate(current.from), days)}
      onOpenChange={onOpenChange}
      onSubmit={apply}
      submit={da.resumeDialog.apply}
      canSubmit={canApply}
    >
      <div className="grid gap-2">
        <Label htmlFor={ids.on}>{da.resumeDialog.on}</Label>
        <Input
          id={ids.on}
          type="date"
          value={on}
          min={current.from}
          onChange={(e) => setOn(e.target.value)}
          className="w-44"
        />
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">{da.resumeDialog.mode}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['shift', 'new_release'] as const).map((k) => {
            const text = k === 'shift' ? da.resumeDialog.shift : da.resumeDialog.newRelease
            return (
              <label
                key={k}
                className={cn(
                  'flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition-colors',
                  modeKind === k ? 'border-ring bg-accent' : 'hover:bg-muted/50',
                )}
              >
                <input
                  type="radio"
                  name="resume-mode"
                  checked={modeKind === k}
                  onChange={() => setModeKind(k)}
                  className="mt-0.5 accent-primary"
                />
                <span>
                  <span className="block font-medium">{text.label}</span>
                  <span className="block text-xs text-muted-foreground">{text.hint}</span>
                </span>
              </label>
            )
          })}
        </div>
        {modeKind === 'new_release' && (
          <div className="mt-2 grid gap-2">
            <Label htmlFor={ids.release}>{da.resumeDialog.releaseDate}</Label>
            <DateWithWorkdays
              id={ids.release}
              from={release}
              value={releaseDate}
              onChange={setReleaseDate}
              calendar={pub.calendar}
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground">{da.resumeDialog.notBefore}</p>
      </fieldset>
      {error && <ErrorLine>{error}</ErrorLine>}
      {preview && (
        <PlanComparisonView
          comparison={preview.comparison}
          publication={pub}
          conflicts={conflicts}
          acceptConflicts={accept}
          onAcceptConflicts={setAccept}
        />
      )}
      <ReasonFields value={reason} onChange={setReason} required={reasonRequired} />
    </FormDialog>
  )
}

// ── Binding plan and baselines ──────────────────────────────────────────────

function BindingDialog({
  mode,
  publication: pub,
  onOpenChange,
}: DialogProps & { mode: 'make_binding' | 'rebaseline' }) {
  const run = useCommand(pub.id)
  const id = useId()
  const [text, setText] = useState('')
  const next = pub.baselines.length ? Math.max(...pub.baselines.map((b) => b.number)) + 1 : 0
  const t = mode === 'make_binding' ? da.bindingDialog.makeBinding : da.bindingDialog.rebaseline
  const description =
    mode === 'make_binding'
      ? da.bindingDialog.makeBinding.description
      : da.bindingDialog.rebaseline.description(next)
  const release = releaseActivity(pub)?.deadline ?? targetReleaseDate(pub)
  const canApply = mode === 'make_binding' || text.trim().length > 0

  function apply(e: FormEvent) {
    e.preventDefault()
    if (!canApply) return
    const reason = text.trim()
    const ok = run((p, c) =>
      mode === 'make_binding'
        ? makeBinding(p, c, reason ? { reason } : {})
        : rebaseline(p, c, reason),
    )
    if (ok) onOpenChange(false)
  }

  return (
    <FormDialog
      title={t.title}
      description={description}
      onOpenChange={onOpenChange}
      onSubmit={apply}
      submit={t.apply}
      canSubmit={canApply}
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{da.bindingDialog.release}:</span>
        <span className="font-medium tabular-nums">{formatDate(release)}</span>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={id}>{da.impact.reason}</Label>
        <Textarea
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={da.bindingDialog.reasonPlaceholder}
          rows={2}
          autoFocus
        />
      </div>
    </FormDialog>
  )
}

// ── Shared parts ────────────────────────────────────────────────────────────

interface ReasonState {
  category: ReasonCategory
  text: string
}

function meta(r: ReasonState) {
  return { reasonCategory: r.category, ...(r.text.trim() ? { reason: r.text.trim() } : {}) }
}

function ReasonFields({
  value,
  onChange,
  required,
  requiredText,
  placeholder,
  autoFocus,
}: {
  value: ReasonState
  onChange: (v: ReasonState) => void
  required?: boolean
  requiredText?: string
  placeholder?: string
  autoFocus?: boolean
}) {
  const ids = { category: useId(), reason: useId() }
  return (
    <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
      <div className="grid content-start gap-2">
        <Label htmlFor={ids.category}>{da.impact.reasonCategory}</Label>
        <NativeSelect
          id={ids.category}
          value={value.category}
          onChange={(e) => onChange({ ...value, category: e.target.value as ReasonCategory })}
        >
          {ReasonCategorySchema.options.map((k) => (
            <option key={k} value={k}>
              {REASON_CATEGORY_LABELS[k]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={ids.reason}>{da.impact.reason}</Label>
        <Textarea
          id={ids.reason}
          value={value.text}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
          placeholder={placeholder ?? da.impact.reasonPlaceholder}
          rows={2}
          autoFocus={autoFocus}
        />
        {required && !value.text.trim() && (
          <p className="flex items-center gap-1.5 text-xs text-status-late">
            <TriangleAlert className="size-3.5" />
            {requiredText ?? da.impact.reasonRequired}
          </p>
        )}
      </div>
    </div>
  )
}

/** A date input with a working-day offset next to it; editing either updates the other. */
export function DateWithWorkdays({
  id,
  from,
  value,
  onChange,
  calendar,
}: {
  id: string
  from: IsoDate
  value: IsoDate
  onChange: (date: IsoDate) => void
  calendar: Publication['calendar']
}) {
  const cal = getCalendar(calendar)
  const offset = value ? cal.workdaysBetween(from, value) : 0
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted-foreground tabular-nums">{formatDate(from)}</span>
      <ArrowRight className="size-4 text-muted-foreground" />
      <Input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-44"
      />
      <span className="text-muted-foreground">{da.impact.orWorkdays}</span>
      <Input
        type="number"
        aria-label={da.impact.workdaysLater}
        value={offset}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isInteger(n)) onChange(cal.addWorkdays(from, n))
        }}
        className="w-20"
      />
      <span className="text-muted-foreground">{da.impact.workdaysLater}</span>
    </div>
  )
}

function FormDialog({
  title,
  description,
  onOpenChange,
  onSubmit,
  submit,
  canSubmit,
  children,
}: {
  title: string
  description: string
  onOpenChange: (open: boolean) => void
  onSubmit: (e: FormEvent) => void
  submit: string
  canSubmit: boolean
  children: ReactNode
}) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={onSubmit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {children}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {da.impact.cancel}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-status-late/10 px-3 py-2 text-sm text-status-late">{children}</p>
  )
}
