/**
 * Finansiering (PLAN §5.1.6): secured versus the minimum, the funding gate, the applications
 * and their decisions, and the "pause the project" action for a funding HOLD.
 */
import {
  addFundingApplication,
  fundingStatus,
  openPause,
  removeFundingApplication,
  setFundingTarget,
  updateFundingApplication,
  type FundingApplication,
  type FundingApplicationInput,
  type IsoDate,
  type Publication,
} from '@pms/domain'
import { CircleCheck, CircleAlert, PauseCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ProgressBar } from '@/components/status/status'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { useCommand } from '@/hooks/use-command'
import { FUNDING_STATUS_LABELS, da } from '@/i18n/da'
import { formatDate, formatDateCompact, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PlanDialog } from './plan-dialogs'

const STATUSES = ['planned', 'submitted', 'granted', 'rejected'] as const

export function FundingView({
  publication: pub,
  asOf,
}: {
  publication: Publication
  asOf: IsoDate
}) {
  const run = useCommand(pub.id)
  const status = fundingStatus(pub, asOf)
  const gate = pub.activities.find((a) => a.gate === 'funding_secured')
  const [editing, setEditing] = useState<FundingApplication | 'new' | null>(null)
  const [removing, setRemoving] = useState<FundingApplication | null>(null)
  const [pausing, setPausing] = useState(false)
  const f = da.funding
  const share = status.minimumRequired ? Math.min(1, status.secured / status.minimumRequired) : 1
  const stopped = ['released', 'closed', 'no_go'].includes(pub.lifecycle)

  function commitMinimum(input: HTMLInputElement) {
    const n = Number(input.value)
    if (input.value === '' || !Number.isFinite(n) || n < 0) {
      input.value = String(pub.funding.minimumRequired)
      return
    }
    if (n === pub.funding.minimumRequired) return
    run((p, c) => setFundingTarget(p, { minimumRequired: n }, c, { reasonCategory: 'funding' }))
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-5 rounded-xl border bg-card p-5 shadow-xs lg:grid-cols-[1fr_320px]">
        <div className="grid content-start gap-4">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <Amount label={f.secured} value={status.secured} strong />
            <Amount label={f.pending} value={status.pending} />
            <Amount label={f.planned} value={status.planned} />
            {status.gap > 0 && <Amount label={f.gap} value={status.gap} late />}
          </div>
          <div className="grid gap-1.5">
            <ProgressBar value={share} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>{formatMoney(status.secured)}</span>
              <span>
                {f.minimum} {formatMoney(status.minimumRequired)}
              </span>
            </div>
          </div>
          <GateLine
            done={gate?.status === 'done'}
            sufficient={status.sufficient}
            riskAccepted={status.riskAccepted && status.gap > 0}
            gap={status.gap}
          />
          {status.overdueDecisions.length > 0 ? (
            <p className="flex items-center gap-2 text-sm text-status-late">
              <CircleAlert className="size-4" />
              {f.overdue}: {status.overdueDecisions.map((a) => a.funder).join(', ')}
            </p>
          ) : (
            status.awaiting[0]?.expectedDecisionAt && (
              <p className="text-sm text-muted-foreground">
                {f.nextDecision(
                  status.awaiting[0].funder,
                  formatDate(status.awaiting[0].expectedDecisionAt),
                )}
              </p>
            )
          )}
        </div>

        <div className="grid content-start gap-4 border-t pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
          <div className="grid gap-1.5">
            <Label htmlFor="funding-minimum">{f.minimum}</Label>
            <Input
              // Uncontrolled, reset whenever the stored value changes (e.g. undo).
              key={pub.funding.minimumRequired}
              id="funding-minimum"
              type="number"
              min={0}
              step={10_000}
              defaultValue={pub.funding.minimumRequired}
              onBlur={(e) => commitMinimum(e.currentTarget)}
              onKeyDown={(e) => e.key === 'Enter' && commitMinimum(e.currentTarget)}
              className="w-44"
            />
            <p className="text-xs text-muted-foreground">{f.minimumHint}</p>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={pub.funding.riskAccepted}
              onChange={(e) =>
                run((p, c) =>
                  setFundingTarget(p, { riskAccepted: e.target.checked }, c, {
                    reasonCategory: 'funding',
                  }),
                )
              }
              className="mt-0.5 accent-primary"
            />
            <span>
              <span className="block">{f.riskAccepted}</span>
              <span className="block text-xs text-muted-foreground">{f.riskAcceptedHint}</span>
            </span>
          </label>
          {!openPause(pub) && !stopped && (
            <Button variant="outline" size="sm" className="w-fit" onClick={() => setPausing(true)}>
              <PauseCircle />
              {f.pause}
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-xl border bg-card shadow-xs">
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <h2 className="font-medium">{f.applications}</h2>
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus />
            {f.add}
          </Button>
        </div>
        {pub.funding.applications.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">{f.noApplications}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 pl-5 font-medium">{f.columns.funder}</th>
                  <th className="px-3 py-2 text-right font-medium">{f.columns.amount}</th>
                  <th className="w-36 px-3 py-2 font-medium">{f.columns.status}</th>
                  <th className="px-3 py-2 font-medium">{f.columns.submitted}</th>
                  <th className="px-3 py-2 font-medium">{f.columns.expected}</th>
                  <th className="px-3 py-2 font-medium">{f.columns.decided}</th>
                  <th className="py-2 pr-5 pl-3" />
                </tr>
              </thead>
              <tbody>
                {pub.funding.applications.map((a) => {
                  const overdue = status.overdueDecisions.some((o) => o.id === a.id)
                  return (
                    <tr key={a.id} className="border-t align-top first:border-t-0">
                      <td className="py-2 pr-3 pl-5">
                        <div className="font-medium">{a.funder}</div>
                        {a.conditions && (
                          <div className="text-xs text-muted-foreground">{a.conditions}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(a.amount)}</td>
                      <td className="px-3 py-1.5">
                        <NativeSelect
                          value={a.status}
                          aria-label={`${f.columns.status}: ${a.funder}`}
                          onChange={(e) =>
                            run((p, c) =>
                              updateFundingApplication(
                                p,
                                a.id,
                                { status: e.target.value as FundingApplication['status'] },
                                c,
                                { reasonCategory: 'funding' },
                              ),
                            )
                          }
                          className="h-8 text-xs"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {FUNDING_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </NativeSelect>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{formatDateCompact(a.submittedAt)}</td>
                      <td
                        className={cn('px-3 py-2 tabular-nums', overdue && 'text-status-late')}
                        title={overdue ? f.overdue : undefined}
                      >
                        {formatDateCompact(a.expectedDecisionAt)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{formatDateCompact(a.decidedAt)}</td>
                      <td className="py-1.5 pr-5 pl-3 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(a)}
                          title={f.edit}
                        >
                          <Pencil />
                          <span className="sr-only">{f.edit}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRemoving(a)}
                          title={f.remove}
                        >
                          <Trash2 />
                          <span className="sr-only">{f.remove}</span>
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <ApplicationDialog
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(input) =>
            editing === 'new'
              ? run((p, c) => addFundingApplication(p, input, c))
              : run((p, c) =>
                  updateFundingApplication(p, editing.id, input, c, { reasonCategory: 'funding' }),
                )
          }
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={removing ? f.removeConfirm(removing.funder) : ''}
        body=""
        confirm={f.remove}
        cancel={da.impact.cancel}
        destructive
        onConfirm={() => removing && run((p, c) => removeFundingApplication(p, removing.id, c))}
      />
      {pausing && <PlanDialog kind="pause" publication={pub} onClose={() => setPausing(false)} />}
    </div>
  )
}

function Amount({
  label,
  value,
  strong,
  late,
}: {
  label: string
  value: number
  strong?: boolean
  late?: boolean
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          'tabular-nums',
          strong ? 'text-xl font-semibold' : 'font-medium',
          late && 'text-status-late',
        )}
      >
        {formatMoney(value)}
      </div>
    </div>
  )
}

function GateLine({
  done,
  sufficient,
  riskAccepted,
  gap,
}: {
  done: boolean
  sufficient: boolean
  riskAccepted: boolean
  gap: number
}) {
  const f = da.funding
  const ok = done || sufficient
  return (
    <div className="grid gap-0.5 text-sm">
      <p className={cn('flex items-center gap-2 font-medium', !ok && 'text-status-late')}>
        {ok ? (
          <CircleCheck className="size-4 text-status-done" />
        ) : (
          <CircleAlert className="size-4" />
        )}
        {sufficient
          ? riskAccepted
            ? f.riskAcceptedState
            : f.sufficient
          : f.insufficient(formatMoney(gap))}
      </p>
      <p className="pl-6 text-muted-foreground">
        {done ? f.gateDone : sufficient ? f.gateOpen : f.gateBlocked}
      </p>
    </div>
  )
}

function ApplicationDialog({
  initial,
  onClose,
  onSave,
}: {
  initial: FundingApplication | null
  onClose: () => void
  onSave: (input: FundingApplicationInput) => boolean
}) {
  const ids = {
    funder: useId(),
    amount: useId(),
    status: useId(),
    submitted: useId(),
    expected: useId(),
    decided: useId(),
    conditions: useId(),
  }
  const [form, setForm] = useState({
    funder: initial?.funder ?? '',
    amount: String(initial?.amount ?? ''),
    status: initial?.status ?? ('planned' as FundingApplication['status']),
    submittedAt: initial?.submittedAt ?? '',
    expectedDecisionAt: initial?.expectedDecisionAt ?? '',
    decidedAt: initial?.decidedAt ?? '',
    conditions: initial?.conditions ?? '',
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))
  const f = da.funding.fields
  const amount = Number(form.amount)
  const valid = form.funder.trim() !== '' && form.amount !== '' && amount >= 0

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    const ok = onSave({
      funder: form.funder.trim(),
      amount,
      status: form.status,
      submittedAt: form.submittedAt || null,
      expectedDecisionAt: form.expectedDecisionAt || null,
      decidedAt: form.decidedAt || null,
      conditions: form.conditions.trim(),
    })
    if (ok) onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{initial ? da.funding.edit : da.funding.add}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <Field id={ids.funder} label={f.funder}>
              <Input
                id={ids.funder}
                value={form.funder}
                onChange={(e) => set({ funder: e.target.value })}
                autoFocus
                required
              />
            </Field>
            <Field id={ids.amount} label={f.amount}>
              <Input
                id={ids.amount}
                type="number"
                min={0}
                step={5_000}
                value={form.amount}
                onChange={(e) => set({ amount: e.target.value })}
                required
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={ids.status} label={f.status}>
              <NativeSelect
                id={ids.status}
                value={form.status}
                onChange={(e) => set({ status: e.target.value as FundingApplication['status'] })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {FUNDING_STATUS_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id={ids.submitted} label={f.submitted}>
              <Input
                id={ids.submitted}
                type="date"
                value={form.submittedAt}
                onChange={(e) => set({ submittedAt: e.target.value })}
              />
            </Field>
            <Field id={ids.expected} label={f.expected}>
              <Input
                id={ids.expected}
                type="date"
                value={form.expectedDecisionAt}
                onChange={(e) => set({ expectedDecisionAt: e.target.value })}
              />
            </Field>
            <Field id={ids.decided} label={f.decided}>
              <Input
                id={ids.decided}
                type="date"
                value={form.decidedAt}
                onChange={(e) => set({ decidedAt: e.target.value })}
              />
            </Field>
          </div>
          <Field id={ids.conditions} label={f.conditions}>
            <Textarea
              id={ids.conditions}
              value={form.conditions}
              onChange={(e) => set({ conditions: e.target.value })}
              rows={2}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {da.impact.cancel}
            </Button>
            <Button type="submit" disabled={!valid}>
              {da.funding.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
