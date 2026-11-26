/**
 * Working-day calendar.
 *
 * The scheduling engine computes on a continuous WORKING-DAY AXIS: every working day has an
 * ordinal (1, 2, 3 …), and a position on the axis means "the end of that working day".
 *
 * - `ordinal(date)`        end of `date`. A non-working date has the ordinal of the working day
 *                          before it (finishing by Saturday = finishing by Friday).
 * - `startBoundary(date)`  the position where work starting on `date` begins, i.e. the end of the
 *                          previous day. A task with duration d starting on S therefore ends at
 *                          `startBoundary(S) + d`, which is the convention in `model/common.ts`.
 * - `dateOf(ordinal)`      the working day with that ordinal.
 */
import { z } from 'zod'
import { IsoDateSchema, type IsoDate } from '../model/common'
import { addDays, epochDayWeekday, fromEpochDay, toEpochDay, yearOf } from './dates'
import { danishHolidays } from './holidays-dk'

export const ClosureSchema = z
  .object({
    from: IsoDateSchema,
    to: IsoDateSchema,
    label: z.string().min(1),
  })
  .refine((c) => c.from <= c.to, { message: '"from" must not be after "to"', path: ['to'] })
export type Closure = z.infer<typeof ClosureSchema>

export const CalendarSpecSchema = z.object({
  /**
   * - dk:          Danish public holidays plus customary closing days (Grundlovsdag, Juleaftensdag,
   *                Nytårsaftensdag).
   * - dk-official: Danish public holidays only.
   * - none:        weekends only.
   */
  holidays: z.enum(['dk', 'dk-official', 'none']),
  /** Extra closed periods, inclusive (Christmas week, printer summer break …). */
  closures: z.array(ClosureSchema),
})
export type CalendarSpec = z.infer<typeof CalendarSpecSchema>

export const DEFAULT_CALENDAR: CalendarSpec = { holidays: 'dk', closures: [] }

const EPOCH_YEAR = 2000
const MIN_YEAR = 1970
const MAX_YEAR = 2199
const MAX_CLOSURE_DAYS = 3 * 366

interface YearData {
  /** Epoch days of all working days in the year, ascending. */
  workingDays: number[]
  workingSet: Set<number>
}

export class WorkCalendar {
  readonly spec: CalendarSpec
  private readonly closed = new Map<number, string>()
  private readonly years = new Map<number, YearData>()
  /** Ordinal of the last working day before 1 January of the year. */
  private readonly bases = new Map<number, number>([[EPOCH_YEAR, 0]])

  constructor(spec: CalendarSpec) {
    this.spec = CalendarSpecSchema.parse(spec)
    for (const c of this.spec.closures) {
      const from = toEpochDay(c.from)
      const to = toEpochDay(c.to)
      if (to - from > MAX_CLOSURE_DAYS) throw new Error(`Closure "${c.label}" is too long`)
      for (let d = from; d <= to; d++) this.closed.set(d, c.label)
    }
  }

  /** Why a date is not a working day, or null if it is one. */
  nonWorkingReason(date: IsoDate): string | null {
    const day = toEpochDay(date)
    if (epochDayWeekday(day) >= 6) return 'Weekend'
    const holiday = this.holidayName(date)
    if (holiday) return holiday
    return this.closed.get(day) ?? null
  }

  isWorkingDay(date: IsoDate): boolean {
    return this.isWorkingEpochDay(toEpochDay(date))
  }

  /** Position at the end of `date` (see the module comment). */
  ordinal(date: IsoDate): number {
    const day = toEpochDay(date)
    const year = yearOf(date)
    const days = this.year(year).workingDays
    // Number of working days in the year on or before `day`.
    let lo = 0
    let hi = days.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (days[mid]! <= day) lo = mid + 1
      else hi = mid
    }
    return this.base(year) + lo
  }

  /** Position where work starting on `date` begins: the end of the previous day. */
  startBoundary(date: IsoDate): number {
    return this.ordinal(addDays(date, -1))
  }

  /** The working day with this ordinal. */
  dateOf(ordinal: number): IsoDate {
    if (!Number.isInteger(ordinal)) throw new Error(`Ordinal must be an integer, got ${ordinal}`)
    let year = EPOCH_YEAR + Math.floor(ordinal / 250)
    year = Math.min(MAX_YEAR, Math.max(MIN_YEAR, year))
    while (this.base(year) >= ordinal) year--
    while (this.base(year) + this.year(year).workingDays.length < ordinal) year++
    return fromEpochDay(this.year(year).workingDays[ordinal - this.base(year) - 1]!)
  }

  /**
   * `n` working days after `date` (before, if negative). A non-working `date` counts as the
   * working day before it, so `addWorkdays(saturday, 1)` is Monday.
   */
  addWorkdays(date: IsoDate, n: number): IsoDate {
    return this.dateOf(this.ordinal(date) + n)
  }

  /** Working days after `a` up to and including `b` (negative if `b` is earlier). */
  workdaysBetween(a: IsoDate, b: IsoDate): number {
    return this.ordinal(b) - this.ordinal(a)
  }

  /** Working days in the inclusive range `start … end`. */
  countWorkdays(start: IsoDate, end: IsoDate): number {
    return this.ordinal(end) - this.startBoundary(start)
  }

  /** `date` if it is a working day, otherwise the next one. */
  nextWorkingDay(date: IsoDate): IsoDate {
    return this.dateOf(this.startBoundary(date) + 1)
  }

  /** `date` if it is a working day, otherwise the previous one. */
  previousWorkingDay(date: IsoDate): IsoDate {
    return this.dateOf(this.ordinal(date))
  }

  private holidayName(date: IsoDate): string | null {
    if (this.spec.holidays === 'none') return null
    const h = danishHolidays(yearOf(date)).find((x) => x.date === date)
    if (!h) return null
    if (h.kind === 'customary' && this.spec.holidays === 'dk-official') return null
    return h.name
  }

  private isWorkingEpochDay(day: number): boolean {
    return this.year(yearOf(fromEpochDay(day))).workingSet.has(day)
  }

  private year(year: number): YearData {
    if (year < MIN_YEAR || year > MAX_YEAR) {
      throw new Error(`Year ${year} is outside the supported range ${MIN_YEAR}–${MAX_YEAR}`)
    }
    let data = this.years.get(year)
    if (!data) {
      const holidays = new Set<number>()
      if (this.spec.holidays !== 'none') {
        for (const h of danishHolidays(year)) {
          if (h.kind === 'customary' && this.spec.holidays === 'dk-official') continue
          holidays.add(toEpochDay(h.date))
        }
      }
      const first = toEpochDay(`${year}-01-01`)
      const last = toEpochDay(`${year}-12-31`)
      const workingDays: number[] = []
      for (let d = first; d <= last; d++) {
        if (epochDayWeekday(d) >= 6 || holidays.has(d) || this.closed.has(d)) continue
        workingDays.push(d)
      }
      data = { workingDays, workingSet: new Set(workingDays) }
      this.years.set(year, data)
    }
    return data
  }

  private base(year: number): number {
    const cached = this.bases.get(year)
    if (cached !== undefined) return cached
    let value: number
    if (year > EPOCH_YEAR) value = this.base(year - 1) + this.year(year - 1).workingDays.length
    else value = this.base(year + 1) - this.year(year).workingDays.length
    this.bases.set(year, value)
    return value
  }
}

const cache = new Map<string, WorkCalendar>()

/** Shared, cached calendar instance for a spec. */
export function getCalendar(spec: CalendarSpec): WorkCalendar {
  const key = JSON.stringify([spec.holidays, spec.closures.map((c) => [c.from, c.to, c.label])])
  let cal = cache.get(key)
  if (!cal) {
    cal = new WorkCalendar(spec)
    cache.set(key, cal)
  }
  return cal
}
