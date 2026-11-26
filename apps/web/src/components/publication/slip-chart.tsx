/**
 * Milestone slip chart (PLAN §5.1.7): x = the date a forecast was made, y = the forecast date.
 * A flat line is a milestone that holds; a rising line is one that slips. A milestone is reached
 * where its line meets the diagonal (forecast = today).
 *
 * Key milestones get the categorical series colours in a fixed order; in "all" mode the other
 * milestones fold into neutral grey lines, so there is never a ninth generated hue. The table
 * under the chart is both legend and table view.
 */
import {
  fromEpochDay,
  getCalendar,
  toEpochDay,
  type IsoDate,
  type PlanTrend,
  type Publication,
  type TrendPoint,
} from '@pms/domain'
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from 'react'
import { SlipBadge } from '@/components/status/status'
import { Button } from '@/components/ui/button'
import { da } from '@/i18n/da'
import { formatDate, formatDateCompact } from '@/lib/format'
import { KEY_MILESTONES } from '@/lib/publication'
import { cn } from '@/lib/utils'

const HEIGHT = 320
const M = { top: 16, right: 24, bottom: 32, left: 64 }
const SERIES = ['series-1', 'series-2', 'series-3', 'series-4', 'series-5', 'series-6']
const monthLabel = new Intl.DateTimeFormat('da-DK', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
})
const tickLabel = (epochDay: number) =>
  monthLabel.format(new Date(`${fromEpochDay(epochDay)}T00:00:00Z`))

interface Series {
  id: string
  name: string
  /** CSS colour; null = folded into the neutral "other" group. */
  color: string | null
  points: TrendPoint[]
}

export function SlipChart({
  trend,
  publication: pub,
}: {
  trend: PlanTrend
  publication: Publication
}) {
  const [showAll, setShowAll] = useState(false)
  const [focus, setFocus] = useState<string | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const width = useWidth(wrapRef)
  const cal = getCalendar(pub.calendar)

  const series = useMemo((): Series[] => {
    const name = (id: string) => pub.activities.find((a) => a.id === id)?.name ?? id
    const key = keyMilestones(pub)
    return trend.milestones
      .filter((m) => m.points.length > 0 && (showAll || key.includes(m.activityId)))
      .map((m) => {
        const slot = key.indexOf(m.activityId)
        return {
          id: m.activityId,
          name: name(m.activityId),
          color: slot >= 0 && slot < SERIES.length ? `var(--${SERIES[slot]})` : null,
          points: m.points,
        }
      })
  }, [trend, pub, showAll])

  const geometry = useMemo(() => {
    if (!trend.dates.length) return null
    const x0 = toEpochDay(trend.dates[0]!)
    const x1 = Math.max(toEpochDay(trend.dates.at(-1)!), x0 + 7)
    let y0 = x0
    let y1 = x1
    for (const s of series) {
      for (const p of s.points) {
        y0 = Math.min(y0, toEpochDay(p.forecast))
        y1 = Math.max(y1, toEpochDay(p.forecast))
      }
    }
    for (const t of trend.target) y1 = Math.max(y1, toEpochDay(t.target))
    const pad = Math.max(7, (y1 - y0) * 0.05)
    y0 -= pad
    y1 += pad
    const plotW = Math.max(120, width - M.left - M.right)
    const plotH = HEIGHT - M.top - M.bottom
    const sx = (d: IsoDate) => M.left + ((toEpochDay(d) - x0) / (x1 - x0)) * plotW
    const sy = (d: IsoDate) => M.top + (1 - (toEpochDay(d) - y0) / (y1 - y0)) * plotH
    return { x0, x1, y0, y1, plotW, plotH, sx, sy }
  }, [trend, series, width])

  if (!geometry || trend.dates.length < 2) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{da.trend.empty}</p>
  }
  const { x0, x1, y0, y1, plotW, plotH, sx, sy } = geometry
  const xTicks = monthTicks(x0, x1, Math.max(2, Math.floor(plotW / 90)))
  const yTicks = monthTicks(y0, y1, Math.max(2, Math.floor(plotH / 40)))
  const path = (points: { date: IsoDate; y: IsoDate }[]) =>
    points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.date).toFixed(1)},${sy(p.y).toFixed(1)}`).join('')
  const diagStart = fromEpochDay(Math.max(x0, y0))
  const diagEnd = fromEpochDay(Math.min(x1, y1))
  const hoverDate = hover !== null ? trend.dates[hover] : undefined

  function onMove(e: PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left + M.left
    let best = 0
    trend.dates.forEach((d, i) => {
      if (Math.abs(sx(d) - x) < Math.abs(sx(trend.dates[best]!) - x)) best = i
    })
    setHover(best)
  }

  const ordered = [...series].sort((a, b) => Number(a.color !== null) - Number(b.color !== null))

  return (
    <div className="grid gap-3">
      <div ref={wrapRef} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${da.trend.title}. ${da.trend.xAxis}, ${da.trend.yAxis}.`}
          className="block text-muted-foreground"
        >
          {/* Grid and axes: recessive */}
          {yTicks.map((t) => (
            <g key={`y${t}`}>
              <line
                x1={M.left}
                x2={M.left + plotW}
                y1={sy(fromEpochDay(t))}
                y2={sy(fromEpochDay(t))}
                className="stroke-border"
              />
              <text
                x={M.left - 8}
                y={sy(fromEpochDay(t))}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground text-[11px] tabular-nums"
              >
                {tickLabel(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text
              key={`x${t}`}
              x={sx(fromEpochDay(t))}
              y={HEIGHT - M.bottom + 18}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px] tabular-nums"
            >
              {tickLabel(t)}
            </text>
          ))}
          <line
            x1={M.left}
            x2={M.left + plotW}
            y1={M.top + plotH}
            y2={M.top + plotH}
            className="stroke-muted-foreground/50"
          />

          {/* Diagonal: forecast = the date it was made. Milestones are reached here. */}
          {diagStart < diagEnd && (
            <line
              x1={sx(diagStart)}
              y1={sy(diagStart)}
              x2={sx(diagEnd)}
              y2={sy(diagEnd)}
              strokeDasharray="2 4"
              className="stroke-muted-foreground/60"
            >
              <title>{da.trend.diagonal}</title>
            </line>
          )}

          {/* Release target over time */}
          <path
            d={path(trend.target.map((t) => ({ date: t.date, y: t.target })))}
            fill="none"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            className="stroke-primary/60"
          >
            <title>{da.trend.target}</title>
          </path>

          {ordered.map((s) => {
            const dim = focus !== null && focus !== s.id
            const reached = s.points.find((p) => p.done)
            return (
              <g
                key={s.id}
                opacity={dim ? 0.15 : 1}
                data-testid="trend-series"
                style={s.color ? { color: s.color } : undefined}
              >
                <path
                  d={path(s.points.map((p) => ({ date: p.date, y: p.forecast })))}
                  fill="none"
                  strokeWidth={s.color ? 2 : 1.25}
                  strokeLinejoin="round"
                  className={s.color ? 'stroke-current' : 'stroke-muted-foreground/45'}
                />
                {reached && (
                  <circle
                    cx={sx(reached.date)}
                    cy={sy(reached.forecast)}
                    r={4}
                    strokeWidth={2}
                    className={cn(
                      'stroke-card',
                      s.color ? 'fill-current' : 'fill-muted-foreground/60',
                    )}
                  />
                )}
              </g>
            )
          })}

          {hoverDate && (
            <g pointerEvents="none">
              <line
                x1={sx(hoverDate)}
                x2={sx(hoverDate)}
                y1={M.top}
                y2={M.top + plotH}
                className="stroke-foreground/30"
              />
              {series.map((s) => {
                const p = s.points.find((x) => x.date === hoverDate)
                if (!p || (focus && focus !== s.id)) return null
                return (
                  <circle
                    key={s.id}
                    cx={sx(p.date)}
                    cy={sy(p.forecast)}
                    r={4}
                    strokeWidth={2}
                    style={s.color ? { color: s.color } : undefined}
                    className={cn(
                      'stroke-card',
                      s.color ? 'fill-current' : 'fill-muted-foreground',
                    )}
                  />
                )
              })}
            </g>
          )}

          <rect
            x={M.left}
            y={M.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>

        {hoverDate && (
          <Tooltip
            left={sx(hoverDate)}
            width={width}
            date={hoverDate}
            rows={series
              .filter((s) => !focus || focus === s.id)
              .flatMap((s) => {
                const p = s.points.find((x) => x.date === hoverDate)
                return p ? [{ s, p }] : []
              })
              .sort((a, b) => a.p.forecast.localeCompare(b.p.forecast))}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-5 border-t-[1.5px] border-dashed border-primary/60" />
            {da.trend.target}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 border-t border-dotted border-muted-foreground" />
            {da.trend.diagonal}
          </span>
        </span>
        <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
          {showAll ? da.trend.showKey : da.trend.showAll}
        </Button>
      </div>

      {/* Legend and table view in one */}
      <table className="w-full text-sm">
        <tbody>
          {series.map((s) => {
            const first = s.points[0]!
            const last = s.points.at(-1)!
            const delta = cal.workdaysBetween(first.forecast, last.forecast)
            return (
              <tr
                key={s.id}
                className={cn(
                  'cursor-default border-t first:border-t-0',
                  focus === s.id && 'bg-muted/60',
                )}
                onPointerEnter={() => setFocus(s.id)}
                onPointerLeave={() => setFocus(null)}
              >
                <td className="w-6 py-1.5 pl-1">
                  <span
                    className={cn(
                      'block h-0.5 w-4 rounded-full',
                      !s.color && 'bg-muted-foreground/45',
                    )}
                    style={s.color ? { background: s.color } : undefined}
                  />
                </td>
                <td className="py-1.5 pr-3">{s.name}</td>
                <td className="px-3 py-1.5 text-muted-foreground tabular-nums">
                  {formatDateCompact(first.forecast)}
                </td>
                <td className="px-3 py-1.5 tabular-nums">{formatDateCompact(last.forecast)}</td>
                <td className="w-16 px-3 py-1.5 text-right">
                  <SlipBadge workdays={delta} />
                </td>
                <td className="w-16 py-1.5 pr-1 text-right text-xs text-muted-foreground">
                  {last.done ? da.trend.done : delta > 0 ? '' : da.trend.held}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Tooltip({
  left,
  width,
  date,
  rows,
}: {
  left: number
  width: number
  date: IsoDate
  rows: { s: Series; p: TrendPoint }[]
}) {
  const flip = left > width - 240
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 w-56 rounded-md border bg-popover p-2 text-xs shadow-md"
      style={flip ? { right: width - left + 12 } : { left: left + 12 }}
    >
      <div className="mb-1 font-medium">{formatDate(date)}</div>
      {rows.map(({ s, p }) => (
        <div key={s.id} className="flex items-center gap-2">
          <span
            className={cn('h-0.5 w-3 shrink-0 rounded-full', !s.color && 'bg-muted-foreground/45')}
            style={s.color ? { background: s.color } : undefined}
          />
          <span className="min-w-0 flex-1 truncate">{s.name}</span>
          <span className="text-muted-foreground tabular-nums">
            {formatDateCompact(p.forecast)}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Milestone ids that get a colour, in colour order. */
function keyMilestones(pub: Publication): string[] {
  const ids = new Set(pub.activities.map((a) => a.id))
  const known = KEY_MILESTONES.filter((id) => ids.has(id))
  if (known.length) return known
  return pub.activities.filter((a) => a.gate !== null).map((a) => a.id)
}

/** First-of-month epoch days within [from, to], thinned to at most `max`. */
function monthTicks(from: number, to: number, max: number): number[] {
  const out: number[] = []
  let d = fromEpochDay(Math.ceil(from))
  d = `${d.slice(0, 8)}01`
  for (let day = toEpochDay(d); day <= to;) {
    if (day >= from) out.push(day)
    const iso = fromEpochDay(day)
    const [y, m] = [Number(iso.slice(0, 4)), Number(iso.slice(5, 7))]
    day = toEpochDay(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`)
  }
  const step = Math.ceil(out.length / max)
  return out.filter((_, i) => i % step === 0)
}

function useWidth(ref: RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(720)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth || 720)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return width
}
