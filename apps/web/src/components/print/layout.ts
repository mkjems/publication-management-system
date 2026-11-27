/**
 * Layout for the printed plan (A3 landscape, PLAN §6 Phase 6). Positions are percentages of the
 * chart width, so the chart fills whatever paper width the browser prints on.
 */
import {
  originalBaseline,
  type Activity,
  type IsoDate,
  type Publication,
  type PublicationHealth,
} from '@pms/domain'
import { barX } from '@/components/gantt/geometry'
import { createScale, monthTicks, planRange, type Scale } from '@/components/gantt/scale'

export interface PrintScale {
  /** Left edge of a day, in percent. */
  pct(date: IsoDate): number
  /** Percent span of a planned extent (tasks: start → end of deadline day; points: day centre). */
  span(a: Pick<Activity, 'kind' | 'start' | 'deadline'>): { left: number; width: number }
  /** The width of one day, in percent. */
  day: number
  /**
   * Every month in range (for the grid). `label` is null for a sliver too narrow to name; the
   * year is shown on the first labelled month of each year.
   */
  months: {
    date: IsoDate
    left: number
    width: number
    label: string | null
    year: string | null
  }[]
}

/** Months narrower than this (percent of the chart) get no label: there is no room for one. */
const MIN_LABEL_WIDTH = 2.5

export function printScale(pub: Publication, health: PublicationHealth, asOf: IsoDate): PrintScale {
  const { start, end } = planRange(pub, health, asOf)
  const scale: Scale = createScale(start, end, 'quarter')
  const toPct = (x: number) => (x / scale.width) * 100
  let lastYear = ''
  const months = monthTicks(scale).map((t) => {
    const width = toPct(t.width)
    const labelled = width >= MIN_LABEL_WIDTH
    const year = t.date.slice(0, 4)
    const showYear = labelled && year !== lastYear
    if (showYear) lastYear = year
    return {
      date: t.date,
      left: toPct(t.x),
      width,
      label: labelled ? t.label : null,
      year: showYear ? year : null,
    }
  })
  return {
    pct: (date) => toPct(scale.x(date)),
    span: (a) => {
      const { x1, x2 } = barX(a, scale)
      return { left: toPct(x1), width: toPct(x2 - x1) }
    },
    day: toPct(scale.ppd),
    months,
  }
}

export interface PrintBar {
  kind: Activity['kind']
  /** Drawn at actual dates when done, planned dates otherwise. */
  left: number
  width: number
  state: 'done' | 'skipped' | 'waiting' | 'in_progress' | 'not_started'
  /** Forecast beyond the current deadline, when later. */
  forecast: { left: number; width: number } | null
  /** Original plan (baseline 0), when it differs from what is drawn. */
  baseline: { left: number; width: number } | null
  late: boolean
}

/** What to draw for one activity. */
export function printBar(
  pub: Publication,
  a: Activity,
  health: PublicationHealth,
  scale: PrintScale,
): PrintBar {
  const f = health.analysis.activities.get(a.id)
  const done = a.status === 'done'
  const open = !done && a.status !== 'skipped'
  const shown =
    done && a.kind === 'task' && a.actualFinish
      ? { kind: a.kind, start: a.actualStart ?? a.start, deadline: a.actualFinish }
      : done && a.actualFinish
        ? { kind: a.kind, start: null, deadline: a.actualFinish }
        : a
  const { left, width } = scale.span(shown)
  const forecast =
    open && f && f.deadline > a.deadline
      ? { left: left + width, width: scale.pct(f.deadline) + scale.day - (left + width) }
      : null
  const b = originalBaseline(pub)?.activities[a.id]
  const baselineSpan =
    b && (b.deadline !== shown.deadline || b.start !== shown.start)
      ? scale.span({ kind: a.kind, start: b.start, deadline: b.deadline })
      : null
  return {
    kind: a.kind,
    left,
    width,
    state: a.status,
    forecast: forecast && forecast.width > 0 ? forecast : null,
    baseline: baselineSpan,
    late: health.activities.get(a.id)?.state === 'late',
  }
}
