import {
  activityEvents,
  setPinned,
  updateActivity,
  type Activity,
  type PublicationHealth,
  type PublicationRecord,
} from '@pms/domain'
import { Lock, Route as RouteIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { KindIcon } from '@/components/masterplan/kind-icon'
import { HealthBadge, SlipBadge } from '@/components/status/status'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useCommand } from '@/hooks/use-command'
import { useTemplateOf } from '@/hooks/use-publication'
import { EVENT_LABELS, HEALTH_REASON_LABELS, PUSH_REASON_LABELS, da } from '@/i18n/da'
import {
  formatDate,
  formatDateCompact,
  formatDependencyType,
  formatDuration,
  formatWorkdays,
} from '@/lib/format'
import { baselineDeadline, describeEvent, eventAuthor } from '@/lib/publication'
import { StatusSelect } from './status-select'

/** Side panel with everything about one activity (PLAN §5.1.4). */
export function ActivityPanel({
  record,
  health,
  activityId,
  onClose,
  onOpenActivity,
  onMove,
}: {
  record: PublicationRecord
  health: PublicationHealth
  activityId: string
  onClose: () => void
  onOpenActivity: (id: string) => void
  onMove: (id: string) => void
}) {
  const pub = record.publication
  const run = useCommand(pub.id)
  const template = useTemplateOf(pub)
  const a = pub.activities.find((x) => x.id === activityId)
  if (!a) return null
  const h = health.activities.get(a.id)!
  const f = health.analysis.activities.get(a.id)!
  const phase = template.phases.find((p) => p.id === a.phaseId)
  const track = template.tracks.find((t) => t.id === a.trackId)
  const byId = new Map(pub.activities.map((x) => [x.id, x]))
  const successors = pub.activities.filter((x) => x.predecessors.some((d) => d.activityId === a.id))
  const open = a.status !== 'done' && a.status !== 'skipped'
  const events = activityEvents(record.history, a.id).reverse()

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-start gap-2">
            <span className="mt-0.5">
              <KindIcon kind={a.kind} optional={a.optional} />
            </span>
            {a.name}
          </SheetTitle>
          <SheetDescription>
            {phase ? `${phase.number}. ${phase.name}` : a.phaseId}
            {track && ` · ${track.name}`} · {a.responsible.label}
          </SheetDescription>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <HealthBadge state={h.state} />
            {f.critical && (
              <span className="flex items-center gap-1 text-xs text-status-risk">
                <RouteIcon className="size-3.5" />
                {da.panel.critical}
              </span>
            )}
            {h.reasons.map((r) => (
              <span key={r} className="text-xs text-muted-foreground">
                {HEALTH_REASON_LABELS[r]}
              </span>
            ))}
          </div>
        </SheetHeader>

        <div className="grid gap-6 p-5">
          <Section title={da.panel.status}>
            <StatusSelect publicationId={pub.id} activity={a} className="h-9 text-sm" />
            {a.waitingFor && (
              <p className="text-sm">
                {da.panel.waitingFor}: <span className="font-medium">{a.waitingFor.text}</span>
                {a.waitingFor.expectedDate && (
                  <span className="text-muted-foreground">
                    {' '}
                    ({da.panel.expected} {formatDate(a.waitingFor.expectedDate)})
                  </span>
                )}
              </p>
            )}
          </Section>

          <Section title={da.panel.dates}>
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-sm">
              {a.kind === 'task' && (
                <>
                  <Row label={da.panel.start}>{formatDate(a.start)}</Row>
                  <Row label={da.panel.duration}>{formatDuration(a.durationWorkdays)}</Row>
                </>
              )}
              <Row label={da.panel.baseline}>{formatDate(baselineDeadline(pub, a.id))}</Row>
              <Row label={da.panel.deadline}>
                <span className="flex items-center justify-end gap-1.5">
                  {formatDate(a.deadline)}
                  <SlipBadge workdays={h.slipVsBaselineWorkdays} />
                </span>
              </Row>
              {open && (
                <>
                  <Row label={da.panel.forecast}>
                    <span className="flex items-center justify-end gap-1.5">
                      {formatDate(f.deadline)}
                      <SlipBadge workdays={f.slipWorkdays} />
                    </span>
                  </Row>
                  {f.pushedBy && (
                    <dd className="col-span-2 -mt-1 text-right text-xs text-muted-foreground">
                      {da.panel.reasons}: {PUSH_REASON_LABELS[f.pushedBy.reason]}
                      {f.pushedBy.reason === 'predecessor' &&
                        ` ${byId.get(f.pushedBy.activityId)?.name ?? ''}`}
                    </dd>
                  )}
                  {f.latestDeadline && (
                    <Row label={da.panel.latest}>{formatDate(f.latestDeadline)}</Row>
                  )}
                  {f.slackWorkdays !== null && (
                    <Row label={da.panel.slack}>
                      <span className={f.slackWorkdays < 0 ? 'text-status-late' : ''}>
                        {formatWorkdays(f.slackWorkdays)}
                      </span>
                    </Row>
                  )}
                </>
              )}
              {a.actualStart && <Row label={da.panel.actualStart}>{formatDate(a.actualStart)}</Row>}
              {a.actualFinish && (
                <Row label={da.panel.actualFinish}>{formatDate(a.actualFinish)}</Row>
              )}
            </dl>
            {open && (
              <Button variant="outline" size="sm" className="w-fit" onClick={() => onMove(a.id)}>
                {da.panel.move}
              </Button>
            )}
          </Section>

          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={a.pinned}
              onChange={(e) => run((p, c) => setPinned(p, a.id, e.target.checked, c))}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              <span className="flex items-center gap-1.5 font-medium">
                <Lock className="size-3.5" />
                {da.panel.pinned}
              </span>
              <span className="text-xs text-muted-foreground">{da.panel.pinnedHint}</span>
            </span>
          </label>

          <div className="grid gap-6 sm:grid-cols-2">
            <Section title={da.panel.predecessors}>
              <Links
                items={a.predecessors.map((d) => ({
                  activity: byId.get(d.activityId),
                  suffix: formatDependencyType(d),
                }))}
                onOpen={onOpenActivity}
              />
            </Section>
            <Section title={da.panel.successors}>
              <Links
                items={successors.map((s) => ({
                  activity: s,
                  suffix: formatDependencyType(s.predecessors.find((d) => d.activityId === a.id)!),
                }))}
                onOpen={onOpenActivity}
              />
            </Section>
          </div>

          <Section title={da.panel.note}>
            <NoteEditor key={a.note} publicationId={pub.id} activity={a} />
          </Section>

          <Section title={da.panel.history}>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">{da.panel.noHistory}</p>
            ) : (
              <ol className="grid gap-2 text-sm">
                {events.map((e) => (
                  <li key={e.id} className="grid gap-0.5">
                    <span className="flex gap-2 text-xs text-muted-foreground">
                      <span className="tabular-nums">{formatDateCompact(e.effectiveDate)}</span>
                      <span>{EVENT_LABELS[e.type]}</span>
                      <span>· {eventAuthor(e)}</span>
                    </span>
                    <span>{describeEvent(e, pub)}</span>
                    {e.reason && (
                      <span className="text-xs text-muted-foreground">“{e.reason}”</span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{children}</dd>
    </>
  )
}

function Links({
  items,
  onOpen,
}: {
  items: { activity: Activity | undefined; suffix: string }[]
  onOpen: (id: string) => void
}) {
  if (!items.length) return <p className="text-sm text-muted-foreground">–</p>
  return (
    <ul className="grid gap-1">
      {items.map(({ activity, suffix }) =>
        activity ? (
          <li key={activity.id}>
            <button
              type="button"
              onClick={() => onOpen(activity.id)}
              className="text-left text-sm hover:text-primary hover:underline"
            >
              {activity.name}
              {suffix && <span className="ml-1 text-xs text-muted-foreground">{suffix}</span>}
            </button>
          </li>
        ) : null,
      )}
    </ul>
  )
}

function NoteEditor({ publicationId, activity: a }: { publicationId: string; activity: Activity }) {
  const run = useCommand(publicationId)
  const [value, setValue] = useState(a.note)
  return (
    <Textarea
      aria-label={da.panel.note}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value !== a.note && run((p, c) => updateActivity(p, a.id, { note: value }, c))}
      rows={3}
    />
  )
}
