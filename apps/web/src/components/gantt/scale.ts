/**
 * The Gantt time axis: calendar days mapped to pixels. Weekends and holidays are drawn (shaded),
 * but dragging snaps to working days.
 */
import {
  addDays,
  isoWeekday,
  originalBaseline,
  toEpochDay,
  fromEpochDay,
  type IsoDate,
  type Publication,
  type PublicationHealth,
} from '@pms/domain'

export type Zoom = 'week' | 'month' | 'quarter'
export const ZOOMS: Zoom[] = ['week', 'month', 'quarter']
export const PX_PER_DAY: Record<Zoom, number> = { week: 28, month: 8, quarter: 3 }

export interface Scale {
  start: IsoDate
  end: IsoDate
  zoom: Zoom
  /** Pixels per calendar day. */
  ppd: number
  width: number
  /** Left edge of a day. */
  x(date: IsoDate): number
  /** The day under a pixel offset. */
  dayAt(x: number): IsoDate
}

export function createScale(start: IsoDate, end: IsoDate, zoom: Zoom): Scale {
  // Start on a Monday so week columns line up.
  const monday = addDays(start, 1 - isoWeekday(start))
  const s = toEpochDay(monday)
  const ppd = PX_PER_DAY[zoom]
  const days = toEpochDay(end) - s + 1
  return {
    start: monday,
    end,
    zoom,
    ppd,
    width: days * ppd,
    x: (date) => (toEpochDay(date) - s) * ppd,
    dayAt: (x) => fromEpochDay(s + Math.floor(x / ppd)),
  }
}

/** The date range a publication's chart needs: everything planned, forecast and actual. */
export function planRange(
  pub: Publication,
  health: PublicationHealth,
  asOf: IsoDate,
): { start: IsoDate; end: IsoDate } {
  const dates: IsoDate[] = [pub.kickoffDate, asOf, health.release.target]
  for (const a of pub.activities) {
    dates.push(a.deadline)
    if (a.start) dates.push(a.start)
    if (a.actualStart) dates.push(a.actualStart)
    if (a.actualFinish) dates.push(a.actualFinish)
    const f = health.analysis.activities.get(a.id)
    if (f) {
      dates.push(f.deadline)
      if (f.latestDeadline) dates.push(f.latestDeadline)
    }
  }
  for (const b of Object.values(originalBaseline(pub)?.activities ?? {})) {
    dates.push(b.deadline)
    if (b.start) dates.push(b.start)
  }
  for (const p of pub.pauses) {
    dates.push(p.from)
    if (p.to) dates.push(p.to)
  }
  dates.sort()
  return { start: addDays(dates[0]!, -7), end: addDays(dates.at(-1)!, 21) }
}

const monthLong = new Intl.DateTimeFormat('da-DK', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const monthShort = new Intl.DateTimeFormat('da-DK', { month: 'short', timeZone: 'UTC' })

export interface Tick {
  date: IsoDate
  x: number
  width: number
  label: string
}

/** One tick per month. */
export function monthTicks(scale: Scale): Tick[] {
  const ticks: Tick[] = []
  let d = `${scale.start.slice(0, 7)}-01`
  while (d <= scale.end) {
    const next = nextMonth(d)
    const x = Math.max(0, scale.x(d))
    const right = Math.min(scale.width, scale.x(next))
    const utc = new Date(`${d}T00:00:00Z`)
    ticks.push({
      date: d,
      x,
      width: right - x,
      label: scale.zoom === 'quarter' ? monthShort.format(utc) : monthLong.format(utc),
    })
    d = next
  }
  return ticks
}

/** One tick per ISO week (Mondays), labelled with the week number. */
export function weekTicks(scale: Scale): Tick[] {
  const ticks: Tick[] = []
  for (let d = scale.start; d <= scale.end; d = addDays(d, 7)) {
    ticks.push({ date: d, x: scale.x(d), width: 7 * scale.ppd, label: String(isoWeek(d)) })
  }
  return ticks
}

/** One tick per day, labelled with the day of the month. */
export function dayTicks(scale: Scale): Tick[] {
  const ticks: Tick[] = []
  for (let d = scale.start; d <= scale.end; d = addDays(d, 1)) {
    ticks.push({ date: d, x: scale.x(d), width: scale.ppd, label: String(Number(d.slice(8))) })
  }
  return ticks
}

/** ISO 8601 week number. */
export function isoWeek(date: IsoDate): number {
  // The Thursday of this week decides the year.
  const thursday = addDays(date, 4 - isoWeekday(date))
  const jan1 = `${thursday.slice(0, 4)}-01-01`
  return Math.floor((toEpochDay(thursday) - toEpochDay(jan1)) / 7) + 1
}

function nextMonth(d: IsoDate): IsoDate {
  const y = Number(d.slice(0, 4))
  const m = Number(d.slice(5, 7))
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
}
