/**
 * Plain calendar-date arithmetic on `YYYY-MM-DD` strings.
 *
 * Dates are converted to an "epoch day" (days since 1970-01-01) for arithmetic. `Date` is used
 * only as a UTC conversion helper; nothing here reads the system clock.
 */
import type { IsoDate } from '../model/common'

const MS_PER_DAY = 86_400_000
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function toEpochDay(date: IsoDate): number {
  const m = ISO_DATE.exec(date)
  if (!m) throw new Error(`Invalid ISO date "${date}"`)
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const day = ms / MS_PER_DAY
  if (fromEpochDay(day) !== date) throw new Error(`Invalid ISO date "${date}"`)
  return day
}

export function fromEpochDay(day: number): IsoDate {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10)
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromEpochDay(toEpochDay(date) + days)
}

/** Calendar days from `a` to `b` (positive when `b` is later). */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return toEpochDay(b) - toEpochDay(a)
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: IsoDate): number {
  return epochDayWeekday(toEpochDay(date))
}

export function epochDayWeekday(day: number): number {
  // 1970-01-01 was a Thursday (4).
  return ((((day + 3) % 7) + 7) % 7) + 1
}

export function yearOf(date: IsoDate): number {
  return Number(date.slice(0, 4))
}

/** ISO dates compare correctly as strings. */
export function compareDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return a >= b ? a : b
}

export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return a <= b ? a : b
}
