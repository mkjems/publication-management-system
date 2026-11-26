/**
 * The publication Gantt chart (PLAN §5.1.2, §5.2): HTML bars in a scroll container with a sticky
 * activity column and header, and an SVG layer for dependency arrows.
 *
 * Changes are never applied here. Dragging, resizing or nudging with the keyboard produces a
 * pending `ScheduleChange`, previewed live (ghosts and the release marker); on drop or Enter it
 * is handed to `onRequestChange`, which opens the impact dialog.
 */
import {
  addDays,
  getCalendar,
  originalBaseline,
  previewReschedule,
  type Activity,
  type Impact,
  type IsoDate,
  type Publication,
  type PublicationHealth,
  type ScheduleChange,
} from '@pms/domain'
import { ChevronRight, Lock } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { KindGlyph } from '@/components/masterplan/kind-glyph'
import { HealthDot, SlipBadge } from '@/components/status/status'
import { da } from '@/i18n/da'
import { formatDate } from '@/lib/format'
import type { PhaseRows } from '@/lib/publication'
import { cn } from '@/lib/utils'
import { barX } from './geometry'
import { layoutRows, type GanttRow } from './rows'
import {
  createScale,
  dayTicks,
  monthTicks,
  planRange,
  weekTicks,
  type Scale,
  type Zoom,
} from './scale'

const LEFT = 300
const HEADER = 48
const DRAG_THRESHOLD = 3
const HATCH =
  'repeating-linear-gradient(135deg, rgb(255 255 255 / 0.35) 0 3px, transparent 3px 7px)'

type DragMode = 'move' | 'resize' | 'link'

interface DragState {
  mode: DragMode
  activityId: string
  startX: number
  /** Pointer position relative to the timeline body. */
  bx: number
  by: number
  moved: boolean
}

export interface GanttProps {
  publication: Publication
  health: PublicationHealth
  asOf: IsoDate
  groups: PhaseRows[]
  isOpen: (phaseId: string) => boolean
  onToggle: (phaseId: string) => void
  zoom: Zoom
  showCritical: boolean
  showAllDependencies: boolean
  selectedId: string | null
  onOpenActivity: (id: string) => void
  onRequestChange: (change: ScheduleChange) => void
  onAddDependency: (predecessorId: string, successorId: string) => void
  /** Scenario mode: the live plan, drawn as ghosts where the scenario differs from it. */
  compareTo?: Publication | null
}

export function Gantt(props: GanttProps) {
  const { publication: pub, health, asOf, groups, zoom } = props
  const cal = getCalendar(pub.calendar)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const range = useMemo(() => planRange(pub, health, asOf), [pub, health, asOf])
  const scale = useMemo(() => createScale(range.start, range.end, zoom), [range, zoom])
  const layout = useMemo(
    () => layoutRows(groups, props.isOpen, da.publication.milestones),
    [groups, props.isOpen],
  )
  const byId = useMemo(() => new Map(pub.activities.map((a) => [a.id, a])), [pub])
  const baseline = originalBaseline(pub)

  // State for rendering, mirrored in refs for the window listeners of an ongoing drag.
  const [drag, setDragState] = useState<DragState | null>(null)
  const [pending, setPendingState] = useState<ScheduleChange | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const pendingRef = useRef<ScheduleChange | null>(null)
  const setDrag = (d: DragState | null) => {
    dragRef.current = d
    setDragState(d)
  }
  const setPending = (c: ScheduleChange | null) => {
    pendingRef.current = c
    setPendingState(c)
  }

  const impact = useMemo((): Impact | null => {
    if (!pending) return null
    try {
      return previewReschedule(pub, pending, { strategy: 'absorb' })
    } catch {
      return null
    }
  }, [pub, pending])

  // Keep today in view when the chart opens or the zoom changes.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = Math.max(0, scale.x(asOf) - (el.clientWidth - LEFT) / 3)
  }, [scale, asOf])

  /** The change a drag of `dx` pixels would make, snapped to working days. */
  const changeFor = useCallback(
    (mode: DragMode, a: Activity, dx: number): ScheduleChange | null => {
      const days = Math.round(dx / scale.ppd)
      if (days === 0 || mode === 'link') return null
      const raw = addDays(a.deadline, days)
      let snapped = cal.isWorkingDay(raw)
        ? raw
        : days > 0
          ? cal.nextWorkingDay(raw)
          : cal.previousWorkingDay(raw)
      if (mode === 'move') {
        return snapped === a.deadline
          ? null
          : { kind: 'set_deadline', activityId: a.id, deadline: snapped }
      }
      if (snapped < a.start!) snapped = a.start!
      const duration = cal.countWorkdays(a.start!, snapped)
      return duration === a.durationWorkdays
        ? null
        : { kind: 'set_duration', activityId: a.id, durationWorkdays: duration }
    },
    [cal, scale.ppd],
  )

  // Pointer tracking for move / resize / link drags.
  const { onOpenActivity, onRequestChange, onAddDependency } = props
  useEffect(() => {
    if (!drag) return
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current!
      const moved = d.moved || Math.abs(e.clientX - d.startX) > DRAG_THRESHOLD
      const rect = bodyRef.current?.getBoundingClientRect()
      setDrag({
        ...d,
        bx: rect ? e.clientX - rect.left - LEFT : 0,
        by: rect ? e.clientY - rect.top : 0,
        moved,
      })
      if (moved && d.mode !== 'link') {
        setPending(changeFor(d.mode, byId.get(d.activityId)!, e.clientX - d.startX))
      }
    }
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current!
      const change = pendingRef.current
      setDrag(null)
      setPending(null)
      if (d.mode === 'link') {
        const target = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLElement>('[data-activity-id]')?.dataset.activityId
        if (target && target !== d.activityId) onAddDependency(d.activityId, target)
      } else if (!d.moved) {
        onOpenActivity(d.activityId)
      } else if (change) {
        onRequestChange(change)
      }
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setDrag(null)
      setPending(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKey)
    }
    // Re-subscribe only when a drag starts or ends.
  }, [drag !== null]) // eslint-disable-line react-hooks/exhaustive-deps

  const startDrag = (mode: DragMode, a: Activity) => (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    setDrag({ mode, activityId: a.id, startX: e.clientX, bx: 0, by: 0, moved: false })
  }

  /** Arrow keys nudge the focused activity by working days; Enter asks to apply; Esc cancels. */
  const onBarKey = (a: Activity, draggable: boolean) => (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setPending(null)
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (pending?.activityId === a.id) {
        onRequestChange(pending)
        setPending(null)
      } else {
        onOpenActivity(a.id)
      }
      return
    }
    if (!draggable || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
    e.preventDefault()
    const step = (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 5 : 1)
    const base =
      pending?.activityId === a.id && pending.kind === 'set_deadline'
        ? pending.deadline
        : a.deadline
    const deadline = cal.addWorkdays(base, step)
    setPending(
      deadline === a.deadline ? null : { kind: 'set_deadline', activityId: a.id, deadline },
    )
  }

  const focusId = drag?.activityId ?? hoverId ?? props.selectedId
  const ghostIds = new Set(impact?.moved.map((m) => m.activityId))
  const previewById = useMemo(
    () => new Map(impact?.publication.activities.map((a) => [a.id, a]) ?? []),
    [impact],
  )
  const liveById = useMemo(
    () => (props.compareTo ? new Map(props.compareTo.activities.map((a) => [a.id, a])) : null),
    [props.compareTo],
  )
  const liveFor = (a: Activity) => {
    const live = liveById?.get(a.id)
    return live && (live.deadline !== a.deadline || live.start !== a.start) ? live : undefined
  }
  const releaseTarget = health.release.target
  const previewRelease = impact?.release.after ?? null
  const previewSlip = impact?.release.slipWorkdays ?? 0

  return (
    <div
      ref={scrollRef}
      className="relative max-h-[75svh] overflow-auto rounded-xl border bg-card shadow-xs select-none"
      onPointerLeave={() => setHoverId(null)}
    >
      <div className="relative" style={{ width: LEFT + scale.width }}>
        <Header scale={scale} asOf={asOf} releaseTarget={releaseTarget} />

        <div ref={bodyRef} className="relative" style={{ height: layout.height }}>
          <Background
            scale={scale}
            publication={pub}
            asOf={asOf}
            height={layout.height}
            releaseTarget={releaseTarget}
            forecastRelease={health.release.forecast}
            previewRelease={previewRelease !== health.release.forecast ? previewRelease : null}
            previewSlip={previewSlip}
          />

          {layout.rows.map((row) => (
            <Row
              key={row.key}
              row={row}
              scale={scale}
              health={health}
              onToggle={props.onToggle}
              onOpenActivity={onOpenActivity}
              onHover={setHoverId}
              selected={row.kind === 'activity' && row.activity.id === props.selectedId}
            >
              {row.kind === 'activity' && (
                <ActivityBars
                  activity={row.activity}
                  publication={pub}
                  health={health}
                  scale={scale}
                  baselineDates={baseline?.activities[row.activity.id]}
                  showCritical={props.showCritical}
                  preview={
                    ghostIds.has(row.activity.id) ? previewById.get(row.activity.id) : undefined
                  }
                  live={liveFor(row.activity)}
                  dragging={drag?.activityId === row.activity.id}
                  onPointerDown={startDrag}
                  onKeyDown={onBarKey}
                />
              )}
            </Row>
          ))}

          <Dependencies
            publication={pub}
            byId={byId}
            scale={scale}
            centerY={layout.centerY}
            height={layout.height}
            focusId={focusId}
            showAll={props.showAllDependencies}
            critical={props.showCritical ? health : null}
          />

          {drag?.mode === 'link' && drag.moved && (
            <LinkLine
              from={byId.get(drag.activityId)!}
              scale={scale}
              centerY={layout.centerY}
              x={drag.bx}
              y={drag.by}
              height={layout.height}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Header and background ────────────────────────────────────────────────────

function Header({
  scale,
  asOf,
  releaseTarget,
}: {
  scale: Scale
  asOf: IsoDate
  releaseTarget: IsoDate
}) {
  const months = monthTicks(scale)
  const lower =
    scale.zoom === 'week' ? dayTicks(scale) : scale.zoom === 'month' ? weekTicks(scale) : []
  return (
    <div className="sticky top-0 z-30 flex border-b bg-card" style={{ height: HEADER }}>
      <div
        className="sticky left-0 z-40 flex items-end border-r bg-card px-4 pb-1.5 text-xs font-medium text-muted-foreground"
        style={{ width: LEFT, minWidth: LEFT }}
      >
        {da.publication.columns.activity}
      </div>
      <div className="relative" style={{ width: scale.width }}>
        {months.map((t) => (
          <div
            key={t.date}
            className="absolute top-0 h-6 truncate border-l px-1.5 pt-1 text-xs font-medium"
            style={{ left: t.x, width: t.width }}
          >
            {t.label}
          </div>
        ))}
        {lower.map((t) => (
          <div
            key={t.date}
            className={cn(
              'absolute top-6 h-6 border-l pt-1 text-center text-[11px] text-muted-foreground tabular-nums',
            )}
            style={{ left: t.x, width: t.width }}
          >
            {scale.zoom === 'month' ? `u${t.label}` : t.label}
          </div>
        ))}
        <Pill x={scale.x(asOf) + scale.ppd / 2} className="bg-status-active text-white">
          {da.gantt.today}
        </Pill>
        <Pill
          x={scale.x(releaseTarget) + scale.ppd / 2}
          className="bg-primary text-primary-foreground"
        >
          {da.gantt.release}
        </Pill>
      </div>
    </div>
  )
}

function Pill({ x, className, children }: { x: number; className: string; children: string }) {
  return (
    <span
      className={cn(
        'absolute bottom-0.5 z-10 -translate-x-1/2 rounded px-1.5 text-[10px] leading-4 font-medium whitespace-nowrap',
        className,
      )}
      style={{ left: x }}
    >
      {children}
    </span>
  )
}

function Background({
  scale,
  publication: pub,
  asOf,
  height,
  releaseTarget,
  forecastRelease,
  previewRelease,
  previewSlip,
}: {
  scale: Scale
  publication: Publication
  asOf: IsoDate
  height: number
  releaseTarget: IsoDate
  forecastRelease: IsoDate | null
  previewRelease: IsoDate | null
  previewSlip: number
}) {
  const cal = getCalendar(pub.calendar)
  const closed = useMemo(() => {
    if (scale.zoom === 'quarter') return []
    const days: IsoDate[] = []
    for (let d = scale.start; d <= scale.end; d = addDays(d, 1))
      if (!cal.isWorkingDay(d)) days.push(d)
    return days
  }, [scale, cal])
  const line = (date: IsoDate) => scale.x(date) + scale.ppd / 2
  return (
    <div
      className="pointer-events-none absolute top-0"
      style={{ left: LEFT, width: scale.width, height }}
      aria-hidden
    >
      {closed.map((d) => (
        <div
          key={d}
          className="absolute top-0 h-full bg-muted/70"
          style={{ left: scale.x(d), width: scale.ppd }}
        />
      ))}
      {pub.pauses.map((p) => (
        <div
          key={p.from}
          className="absolute top-0 h-full bg-status-waiting/15"
          style={{
            left: scale.x(p.from),
            width: scale.x(p.to ?? asOf) + scale.ppd - scale.x(p.from),
            backgroundImage:
              'repeating-linear-gradient(135deg, var(--status-waiting) 0 1px, transparent 1px 10px)',
            opacity: 0.6,
          }}
          title={`${da.gantt.pause}: ${p.reason}`}
        />
      ))}
      <div className="absolute top-0 h-full w-px bg-status-active" style={{ left: line(asOf) }} />
      <div
        className={cn(
          'absolute top-0 h-full w-0 border-l-2',
          pub.planState === 'binding' ? 'border-primary' : 'border-dashed border-primary/70',
        )}
        style={{ left: line(releaseTarget) - 1 }}
      />
      {forecastRelease && forecastRelease > releaseTarget && (
        <div
          className="absolute top-0 h-full w-0 border-l-2 border-dashed border-status-late/70"
          style={{ left: line(forecastRelease) - 1 }}
        />
      )}
      {previewRelease && (
        <div
          className={cn(
            'absolute top-0 h-full w-0 border-l-2 border-dashed',
            previewSlip > 0 ? 'border-status-late' : 'border-status-done',
          )}
          style={{ left: line(previewRelease) - 1 }}
        >
          <span
            className={cn(
              'absolute top-1 left-1 rounded px-1 text-[10px] font-medium whitespace-nowrap text-white',
              previewSlip > 0 ? 'bg-status-late' : 'bg-status-done',
            )}
          >
            {da.gantt.release} {formatDate(previewRelease)}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Rows ─────────────────────────────────────────────────────────────────────

function Row({
  row,
  scale,
  health,
  selected,
  onToggle,
  onOpenActivity,
  onHover,
  children,
}: {
  row: GanttRow
  scale: Scale
  health: PublicationHealth
  selected: boolean
  onToggle: (phaseId: string) => void
  onOpenActivity: (id: string) => void
  onHover: (id: string | null) => void
  children?: ReactNode
}) {
  const left = 'sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r bg-card'
  if (row.kind === 'phase') {
    const ph = health.phases.get(row.phase.id)!
    const xs = row.group.activities.map((a) => barX(a, scale))
    const x1 = Math.min(...xs.map((x) => x.x1))
    const x2 = Math.max(...xs.map((x) => x.x2))
    return (
      <div className="relative flex border-b bg-muted/40" style={{ height: row.height }}>
        <button
          type="button"
          onClick={() => onToggle(row.phase.id)}
          aria-expanded={row.open}
          className={cn(left, 'bg-muted px-3 text-left text-sm font-semibold')}
          style={{ width: LEFT }}
        >
          <ChevronRight
            className={cn('size-4 shrink-0 transition-transform', row.open && 'rotate-90')}
          />
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
            {row.phase.number}
          </span>
          <span className="min-w-0 flex-1 truncate">{row.phase.name}</span>
          <HealthDot state={ph.state} />
        </button>
        <div className="relative" style={{ width: scale.width }}>
          {/* Phase band, filled to the share of work done */}
          <div
            className="absolute top-3 h-2.5 overflow-hidden rounded-sm bg-phase-band"
            style={{ left: x1, width: Math.max(2, x2 - x1) }}
            title={`${Math.round(ph.progress * 100)} % ${da.publication.phaseDone}`}
          >
            <div className="h-full bg-status-done/70" style={{ width: `${ph.progress * 100}%` }} />
          </div>
        </div>
      </div>
    )
  }
  if (row.kind === 'track') {
    return (
      <div className="relative flex" style={{ height: row.height }}>
        <div
          className={cn(
            left,
            'px-4 text-[11px] font-medium tracking-wide text-muted-foreground uppercase',
          )}
          style={{ width: LEFT }}
        >
          <span className="truncate">{row.label}</span>
        </div>
        <div style={{ width: scale.width }} />
      </div>
    )
  }
  const a = row.activity
  const h = health.activities.get(a.id)!
  return (
    <div
      className={cn('group relative flex border-t border-border/50', selected && 'bg-accent/50')}
      style={{ height: row.height }}
      onPointerEnter={() => onHover(a.id)}
    >
      <div
        className={cn(left, 'px-4 text-sm', selected && 'bg-accent')}
        style={{ width: LEFT }}
        data-activity-id={a.id}
      >
        <HealthDot state={h.state} />
        <KindGlyph kind={a.kind} optional={a.optional} />
        <button
          type="button"
          onClick={() => onOpenActivity(a.id)}
          className={cn(
            'min-w-0 flex-1 truncate text-left hover:text-primary hover:underline',
            a.status === 'skipped' && 'text-muted-foreground line-through',
          )}
          title={a.name}
        >
          {a.name}
        </button>
      </div>
      <div className="relative" style={{ width: scale.width }}>
        {children}
      </div>
    </div>
  )
}

// ── Bars ─────────────────────────────────────────────────────────────────────

function ActivityBars({
  activity: a,
  publication: pub,
  health,
  scale,
  baselineDates,
  showCritical,
  preview,
  live,
  dragging,
  onPointerDown,
  onKeyDown,
}: {
  activity: Activity
  publication: Publication
  health: PublicationHealth
  scale: Scale
  baselineDates: { start: IsoDate | null; deadline: IsoDate } | undefined
  showCritical: boolean
  preview: Activity | undefined
  live: Activity | undefined
  dragging: boolean
  onPointerDown: (mode: DragMode, a: Activity) => (e: ReactPointerEvent) => void
  onKeyDown: (a: Activity, draggable: boolean) => (e: KeyboardEvent) => void
}) {
  const f = health.analysis.activities.get(a.id)!
  const h = health.activities.get(a.id)!
  const done = a.status === 'done'
  const skipped = a.status === 'skipped'
  const open = !done && !skipped
  const draggable = open
  const preliminary = pub.planState === 'preliminary' && open
  const dim = showCritical && !f.critical && open
  const ring = showCritical && f.critical
  const label = `${a.name}, ${da.gantt.deadline} ${formatDate(a.deadline)}`

  // Done tasks are drawn at their actual dates.
  const shown =
    done && a.kind === 'task' && a.actualFinish
      ? { kind: a.kind, start: a.actualStart ?? a.start, deadline: a.actualFinish }
      : a
  const { x1, x2 } = barX(shown, scale)
  const forecastEnd = open && f.deadline > a.deadline ? scale.x(f.deadline) + scale.ppd : null
  const end = forecastEnd ?? x2
  const latestEnd =
    open && f.latestDeadline && f.latestDeadline > (forecastEnd ? f.deadline : a.deadline)
      ? scale.x(f.latestDeadline) + scale.ppd
      : null

  const common = {
    'data-activity-id': a.id,
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    title: label,
    onPointerDown: draggable ? onPointerDown('move', a) : undefined,
    onKeyDown: onKeyDown(a, draggable),
  } as const

  return (
    <div className={cn('absolute inset-0', dim && 'opacity-35')}>
      {/* Original plan (baseline 0) */}
      {baselineDates && <BaselineGhost kind={a.kind} dates={baselineDates} scale={scale} />}

      {/* Slack tail: room before this delays the release */}
      {latestEnd && (
        <div
          className="absolute top-[14px] h-0.5 bg-muted-foreground/35"
          style={{ left: end, width: latestEnd - end }}
          title={`${da.panel.slack}: ${f.slackWorkdays} ${da.impact.workdays}`}
        >
          <span className="absolute -top-1 right-0 h-2.5 w-px bg-muted-foreground/50" />
        </div>
      )}

      {/* Forecast beyond the current deadline */}
      {forecastEnd && (
        <div
          className="absolute top-2 h-3.5 rounded-r-sm bg-status-risk/40"
          style={{
            left: x2,
            width: forecastEnd - x2,
            backgroundImage: HATCH,
          }}
          title={`${da.publication.forecastShort} ${formatDate(f.deadline)}`}
        />
      )}

      {a.kind === 'task' ? (
        <div
          {...common}
          className={cn(
            'absolute top-2 h-3.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
            draggable && 'cursor-grab active:cursor-grabbing',
            done && 'bg-status-done/70',
            skipped && 'border border-dashed border-bar-optional',
            a.status === 'in_progress' && 'bg-bar-task',
            a.status === 'not_started' && 'bg-bar-task/60',
            a.status === 'waiting' && 'bg-status-waiting',
            ring && 'ring-2 ring-status-late',
            dragging && 'opacity-60',
          )}
          style={{
            left: x1,
            width: Math.max(scale.ppd, x2 - x1),
            ...(preliminary ? { backgroundImage: HATCH } : {}),
          }}
        >
          {draggable && (
            <span
              className="absolute top-0 right-0 h-full w-2 cursor-ew-resize"
              onPointerDown={onPointerDown('resize', a)}
              aria-hidden
            />
          )}
        </div>
      ) : (
        <div
          {...common}
          className={cn(
            'absolute top-1 flex h-5 w-4 -translate-x-1/2 items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-ring',
            draggable && 'cursor-grab active:cursor-grabbing',
            dragging && 'opacity-60',
          )}
          style={{ left: x1 }}
        >
          {a.kind === 'milestone' ? (
            <span
              className={cn(
                'size-3 rotate-45 rounded-[2px]',
                done ? 'bg-status-done' : 'bg-milestone',
                ring && 'ring-2 ring-status-late',
              )}
            />
          ) : (
            <span
              className={cn(
                'h-4 w-1 rounded-full',
                done ? 'bg-status-done' : skipped ? 'bg-bar-optional' : 'bg-bar-deadline',
                ring && 'ring-2 ring-status-late',
              )}
            />
          )}
        </div>
      )}

      {/* Link handle: drag to another activity to add a dependency */}
      {open && (
        <span
          className="absolute top-[11px] size-2 cursor-crosshair rounded-full border border-primary bg-card opacity-0 group-hover:opacity-100"
          style={{ left: x2 + (a.kind === 'task' ? 3 : 8) }}
          onPointerDown={onPointerDown('link', a)}
          title={da.gantt.linkHint}
          aria-hidden
        />
      )}

      {a.pinned && (
        <Lock
          className="absolute top-2 size-3 text-muted-foreground"
          style={{ left: x1 - (a.kind === 'task' ? 15 : 20) }}
          aria-label={da.panel.pinned}
        />
      )}

      {h.slipVsBaselineWorkdays !== null && h.slipVsBaselineWorkdays !== 0 && (
        <span className="absolute top-[7px]" style={{ left: (latestEnd ?? end) + 14 }}>
          <SlipBadge workdays={h.slipVsBaselineWorkdays} title={da.publication.vsBaseline} />
        </span>
      )}

      {/* Scenario mode: where the live plan has this activity */}
      {live && <PreviewGhost activity={live} scale={scale} variant="live" />}

      {/* Live preview of where this activity would go */}
      {preview && <PreviewGhost activity={preview} scale={scale} />}
    </div>
  )
}

function BaselineGhost({
  kind,
  dates,
  scale,
}: {
  kind: Activity['kind']
  dates: { start: IsoDate | null; deadline: IsoDate }
  scale: Scale
}) {
  const { x1, x2 } = barX({ kind, start: dates.start, deadline: dates.deadline }, scale)
  if (kind === 'task') {
    return (
      <div
        className="absolute top-[24px] h-[3px] rounded-full bg-foreground/25"
        style={{ left: x1, width: Math.max(2, x2 - x1) }}
        title={`${da.gantt.baseline}: ${formatDate(dates.deadline)}`}
      />
    )
  }
  return (
    <div
      className="absolute top-[23px] h-1 w-1 -translate-x-1/2 rounded-full bg-foreground/35"
      style={{ left: x1 }}
      title={`${da.gantt.baseline}: ${formatDate(dates.deadline)}`}
    />
  )
}

/** A dashed outline: where a pending change would put the activity, or (`live`) where the
 * live plan has it while a scenario is open. */
function PreviewGhost({
  activity: a,
  scale,
  variant = 'preview',
}: {
  activity: Activity
  scale: Scale
  variant?: 'preview' | 'live'
}) {
  const { x1, x2 } = barX(a, scale)
  const style =
    variant === 'live'
      ? 'border-dotted border-muted-foreground/70'
      : 'border-dashed border-primary bg-primary/10'
  const testId = variant === 'live' ? 'live-ghost' : 'preview-ghost'
  const title = variant === 'live' ? `${da.sandbox.ghost}: ${formatDate(a.deadline)}` : undefined
  if (a.kind === 'task') {
    return (
      <div
        className={cn('pointer-events-none absolute top-[6px] h-[18px] rounded border-2', style)}
        style={{ left: x1, width: Math.max(scale.ppd, x2 - x1) }}
        data-testid={testId}
        title={title}
      />
    )
  }
  return (
    <div
      className={cn(
        'pointer-events-none absolute top-1 h-5 w-5 -translate-x-1/2 rounded border-2',
        style,
      )}
      style={{ left: x1 }}
      data-testid={testId}
      title={title}
    />
  )
}

// ── Dependencies ─────────────────────────────────────────────────────────────

function Dependencies({
  publication: pub,
  byId,
  scale,
  centerY,
  height,
  focusId,
  showAll,
  critical,
}: {
  publication: Publication
  byId: Map<string, Activity>
  scale: Scale
  centerY: Map<string, number>
  height: number
  focusId: string | null
  showAll: boolean
  critical: PublicationHealth | null
}) {
  const paths: { key: string; d: string; className: string }[] = []
  for (const a of pub.activities) {
    const ty = centerY.get(a.id)
    if (ty === undefined) continue
    for (const dep of a.predecessors) {
      const fy = centerY.get(dep.activityId)
      const p = byId.get(dep.activityId)
      if (fy === undefined || !p) continue
      const related = a.id === focusId || p.id === focusId
      if (!showAll && !related) continue
      const pg = barX(p, scale)
      const sg = barX(a, scale)
      const fx = dep.type === 'SS' ? pg.x1 : pg.x2
      const tx = dep.type === 'FF' ? sg.x2 : sg.x1
      const onCritical =
        critical?.analysis.activities.get(a.id)?.critical &&
        critical.analysis.activities.get(p.id)?.critical
      paths.push({
        key: `${p.id}>${a.id}`,
        d: elbow(fx, fy, tx, ty),
        className: cn(
          onCritical
            ? 'stroke-status-late'
            : related
              ? 'stroke-primary'
              : 'stroke-muted-foreground/40',
        ),
      })
    }
  }
  return (
    <svg
      className="pointer-events-none absolute top-0"
      style={{ left: LEFT, width: scale.width, height }}
      aria-hidden
    >
      <defs>
        <marker
          id="gantt-arrow"
          viewBox="0 0 6 6"
          refX="5"
          refY="3"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 z" className="fill-muted-foreground" />
        </marker>
      </defs>
      {paths.map((p) => (
        <path
          key={p.key}
          d={p.d}
          fill="none"
          strokeWidth={1.25}
          className={p.className}
          markerEnd="url(#gantt-arrow)"
        />
      ))}
    </svg>
  )
}

function elbow(fx: number, fy: number, tx: number, ty: number): string {
  if (tx >= fx + 12) return `M${fx},${fy} H${fx + 6} V${ty} H${tx - 1}`
  // The successor starts before the predecessor ends: route around.
  const midY = ty > fy ? ty - 10 : ty + 10
  return `M${fx},${fy} H${fx + 6} V${midY} H${tx - 8} V${ty} H${tx - 1}`
}

function LinkLine({
  from,
  scale,
  centerY,
  x,
  y,
  height,
}: {
  from: Activity
  scale: Scale
  centerY: Map<string, number>
  x: number
  y: number
  height: number
}) {
  const fx = barX(from, scale).x2
  const fy = centerY.get(from.id) ?? 0
  return (
    <svg
      className="pointer-events-none absolute top-0 z-30"
      style={{ left: LEFT, width: scale.width, height }}
      aria-hidden
    >
      <line
        x1={fx}
        y1={fy}
        x2={x}
        y2={y}
        className="stroke-primary"
        strokeWidth={1.5}
        strokeDasharray="4 3"
      />
    </svg>
  )
}
