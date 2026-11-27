import {
  ROLE_IDS,
  ROLE_LABELS,
  addTemplateDependency,
  changeTemplateActivityKind,
  moveTemplateActivityToTrack,
  removeTemplateDependency,
  rescheduleTemplateActivity,
  updateTemplateActivity,
  updateTemplateDependency,
  type ActivityTemplate,
  type DependencyType,
  type Responsibility,
  type RoleId,
} from '@pms/domain'
import { CircleAlert, Lock, TriangleAlert, X } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { da } from '@/i18n/da'
import { KIND_LABELS, formatDuration, formatOffset } from '@/lib/format'
import { issueText, responsibilityFor } from '@/lib/template'
import { KindIcon } from '../kind-icon'
import { useEditor } from './context'
import { NumberField } from './number-field'

const t = da.templateEditor
const p = t.panel
const DEP_TYPES: DependencyType[] = ['FS', 'SS', 'FF']

/** Edits one activity of the draft. */
export function ActivitySheet({
  activityId,
  onClose,
}: {
  activityId: string | null
  onClose: () => void
}) {
  const { draft } = useEditor()
  const a = activityId ? draft.activities.find((x) => x.id === activityId) : undefined
  return (
    <Sheet open={Boolean(a)} onOpenChange={(o) => !o && onClose()}>
      {/* Wider than the plan's side panel: roles, dependencies and long names need the room. */}
      <SheetContent className="sm:max-w-2xl">{a && <ActivityForm key={a.id} a={a} />}</SheetContent>
    </Sheet>
  )
}

function ActivityForm({ a }: { a: ActivityTemplate }) {
  const { draft, edit, nameOf, issuesByActivity, actuals, openActivity } = useEditor()
  const ids = { name: useId(), kind: useId(), track: useId(), note: useId(), add: useId() }
  const [name, setName] = useState(a.name)
  const [note, setNote] = useState(a.note ?? '')
  // Follow outside changes (undo).
  const [shown, setShown] = useState(a)
  if (shown !== a) {
    setShown(a)
    if (shown.name !== a.name) setName(a.name)
    if (shown.note !== a.note) setNote(a.note ?? '')
  }

  const phase = draft.phases.find((x) => x.id === a.phaseId)
  const issues = issuesByActivity.get(a.id) ?? []
  const actual = actuals.get(a.id)
  const successors = draft.activities.filter((x) =>
    x.predecessors.some((d) => d.activityId === a.id),
  )
  const candidates = draft.phases.map((ph) => ({
    phase: ph,
    activities: draft.activities.filter(
      (x) =>
        x.phaseId === ph.id && x.id !== a.id && !a.predecessors.some((d) => d.activityId === x.id),
    ),
  }))

  const setResponsible = (roles: RoleId[], mode: Responsibility['mode']) => {
    if (roles.length)
      edit((d) => updateTemplateActivity(d, a.id, { responsible: responsibilityFor(roles, mode) }))
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-start gap-2">
          <span className="mt-0.5">
            <KindIcon kind={a.kind} optional={a.optional} />
          </span>
          {a.name}
        </SheetTitle>
        <SheetDescription>
          {phase && t.phaseOf(phase.number, phase.name)}
          {' · '}
          {formatOffset(a.deadlineOffset)}
        </SheetDescription>
      </SheetHeader>

      <div className="grid grid-cols-1 gap-5 p-5">
        {issues.length > 0 && (
          <ul className="grid gap-1.5">
            {issues.map((i, n) => (
              <li
                key={n}
                className="flex gap-2 rounded-md border border-status-late/30 bg-status-late/5 px-3 py-2 text-sm"
              >
                {i.severity === 'error' ? (
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-status-late" />
                ) : (
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-waiting" />
                )}
                {issueText(i, nameOf)}
              </li>
            ))}
          </ul>
        )}
        {a.gate && (
          <p className="flex gap-2 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" />
            {a.gate === 'release' ? `${p.gate} ${p.releaseLocked}` : p.gate}
          </p>
        )}

        <Field label={p.name} htmlFor={ids.name}>
          <Input
            id={ids.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name.trim() && name.trim() !== a.name)
                edit((d) => updateTemplateActivity(d, a.id, { name: name.trim() }))
              else setName(a.name)
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={p.kind} htmlFor={ids.kind}>
            <NativeSelect
              id={ids.kind}
              className="w-full"
              value={a.kind}
              disabled={a.kind === 'milestone'}
              onChange={(e) =>
                edit((d) =>
                  changeTemplateActivityKind(d, a.id, e.target.value as 'task' | 'deadline'),
                )
              }
            >
              {(a.kind === 'milestone'
                ? (['milestone'] as const)
                : (['task', 'deadline'] as const)
              ).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {a.kind !== 'milestone' && (
            <Field label={p.track} htmlFor={ids.track}>
              <NativeSelect
                id={ids.track}
                className="w-full"
                value={a.trackId ?? ''}
                onChange={(e) => edit((d) => moveTemplateActivityToTrack(d, a.id, e.target.value))}
              >
                {draft.phases.map((ph) => (
                  <optgroup key={ph.id} label={`${ph.number}. ${ph.name}`}>
                    {draft.tracks
                      .filter((tr) => tr.phaseId === ph.id)
                      .map((tr) => (
                        <option key={tr.id} value={tr.id}>
                          {tr.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </NativeSelect>
            </Field>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {a.kind === 'task' && (
            <div className="grid gap-2">
              <span className="text-sm font-medium">{t.durationLabel}</span>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <NumberField
                  value={a.durationWorkdays}
                  min={1}
                  aria-label={t.durationLabel}
                  onCommit={(n) =>
                    edit((d) => rescheduleTemplateActivity(d, a.id, { durationWorkdays: n }))
                  }
                />
                {formatDuration(a.durationWorkdays)}
              </div>
              {actual && (
                <span className="text-xs text-muted-foreground">
                  {t.actual}: {actual.median} {t.workdays} ·{' '}
                  {t.actualHint(actual.count, actual.min, actual.max)}
                </span>
              )}
            </div>
          )}
          <div className="grid gap-2">
            <span className="text-sm font-medium">{t.deadlineLabel}</span>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <NumberField
                value={a.deadlineOffset}
                disabled={a.gate === 'release'}
                aria-label={t.deadlineLabel}
                onCommit={(n) =>
                  edit((d) => rescheduleTemplateActivity(d, a.id, { deadlineOffset: n }))
                }
              />
              {formatOffset(a.deadlineOffset)}
            </div>
            <span className="text-xs text-muted-foreground">{t.deadlineHint}</span>
          </div>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">
            {p.responsible}: <span className="font-normal">{a.responsible.label}</span>
          </legend>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
            {ROLE_IDS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={a.responsible.roles.includes(r)}
                  disabled={a.responsible.roles.length === 1 && a.responsible.roles[0] === r}
                  onChange={(e) =>
                    setResponsible(
                      e.target.checked
                        ? [...a.responsible.roles, r]
                        : a.responsible.roles.filter((x) => x !== r),
                      a.responsible.mode,
                    )
                  }
                />
                {ROLE_LABELS[r]}
              </label>
            ))}
          </div>
          {a.responsible.roles.length > 1 && (
            <div className="mt-1 flex gap-4 text-sm" role="radiogroup" aria-label={p.mode}>
              {(['joint', 'either'] as const).map((m) => (
                <label key={m} className="flex items-center gap-2">
                  <input
                    type="radio"
                    className="size-4 accent-primary"
                    checked={a.responsible.mode === m}
                    onChange={() => setResponsible(a.responsible.roles, m)}
                  />
                  {p[m]}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        {a.kind !== 'milestone' && (
          <div className="grid gap-3">
            <Check
              checked={a.optional}
              onChange={(optional) => edit((d) => updateTemplateActivity(d, a.id, { optional }))}
              label={p.optional}
              hint={p.optionalHint}
            />
            {a.kind === 'task' && (
              <Check
                checked={a.compressible !== false}
                onChange={(compressible) =>
                  edit((d) => updateTemplateActivity(d, a.id, { compressible }))
                }
                label={p.compressible}
                hint={p.compressibleHint}
              />
            )}
          </div>
        )}

        <section className="grid gap-2">
          <h3 className="text-sm font-medium">{p.predecessors}</h3>
          {a.predecessors.length === 0 && (
            <p className="text-sm text-muted-foreground">{p.noPredecessors}</p>
          )}
          <ul className="grid gap-2">
            {a.predecessors.map((dep) => (
              <li key={dep.activityId} className="grid gap-1.5 rounded-md border p-2.5 text-sm">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left hover:text-primary hover:underline"
                    onClick={() => openActivity(dep.activityId)}
                  >
                    {nameOf(dep.activityId)}
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label={`${p.removeDependency}: ${nameOf(dep.activityId)}`}
                    onClick={() => edit((d) => removeTemplateDependency(d, a.id, dep.activityId))}
                  >
                    <X />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                  <NativeSelect
                    className="h-8 max-w-full"
                    value={dep.type}
                    aria-label={`${p.kind}: ${nameOf(dep.activityId)}`}
                    onChange={(e) =>
                      edit((d) =>
                        updateTemplateDependency(d, a.id, dep.activityId, {
                          type: e.target.value as DependencyType,
                        }),
                      )
                    }
                  >
                    {DEP_TYPES.map((ty) => (
                      <option key={ty} value={ty}>
                        {p.depTypes[ty]}
                      </option>
                    ))}
                  </NativeSelect>
                  {p.lag}
                  <NumberField
                    value={dep.lagWorkdays}
                    aria-label={`${p.lag}: ${nameOf(dep.activityId)}`}
                    onCommit={(lagWorkdays) =>
                      edit((d) =>
                        updateTemplateDependency(d, a.id, dep.activityId, { lagWorkdays }),
                      )
                    }
                  />
                  {t.workdays}
                </div>
              </li>
            ))}
          </ul>
          <NativeSelect
            id={ids.add}
            className="w-full"
            value=""
            aria-label={p.addDependency}
            onChange={(e) => {
              const pred = e.target.value
              if (pred)
                edit((d) =>
                  addTemplateDependency(d, a.id, { activityId: pred, type: 'FS', lagWorkdays: 0 }),
                )
            }}
          >
            <option value="">{p.addDependency}</option>
            {candidates.map(({ phase: ph, activities }) => (
              <optgroup key={ph.id} label={`${ph.number}. ${ph.name}`}>
                {activities.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </NativeSelect>
        </section>

        {successors.length > 0 && (
          <section className="grid gap-2">
            <h3 className="text-sm font-medium">{p.successors}</h3>
            <div className="flex flex-wrap gap-1">
              {successors.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => openActivity(s.id)}
                  className="max-w-full truncate rounded border bg-background px-1.5 py-0.5 text-left text-xs hover:border-ring hover:text-primary"
                >
                  {s.name}
                </button>
              ))}
            </div>
          </section>
        )}

        <Field label={p.note} htmlFor={ids.note}>
          <Textarea
            id={ids.note}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (note.trim() !== (a.note ?? ''))
                edit((d) => updateTemplateActivity(d, a.id, { note: note.trim() }))
            }}
          />
        </Field>
      </div>
    </>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function Check({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  hint: string
}) {
  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 size-4 accent-primary"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        {label}
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  )
}
