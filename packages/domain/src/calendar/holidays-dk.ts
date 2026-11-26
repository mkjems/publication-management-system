import type { IsoDate } from '../model/common'
import { addDays } from './dates'

export interface Holiday {
  date: IsoDate
  /** Danish name, shown in the UI. */
  name: string
  /**
   * - official:  helligdag by law.
   * - customary: not a public holiday, but most offices close (Grundlovsdag, Juleaftensdag,
   *              Nytårsaftensdag). Included in the default calendar; can be switched off.
   */
  kind: 'official' | 'customary'
}

/** Easter Sunday (Gregorian calendar), using the anonymous Gregorian algorithm. */
export function easterSunday(year: number): IsoDate {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** Danish public holidays and customary closing days for a year, sorted by date. */
export function danishHolidays(year: number): Holiday[] {
  const easter = easterSunday(year)
  const e = (offset: number) => addDays(easter, offset)
  const d = (mmdd: string) => `${year}-${mmdd}`
  const list: Holiday[] = [
    { date: d('01-01'), name: 'Nytårsdag', kind: 'official' },
    { date: e(-3), name: 'Skærtorsdag', kind: 'official' },
    { date: e(-2), name: 'Langfredag', kind: 'official' },
    { date: e(0), name: 'Påskedag', kind: 'official' },
    { date: e(1), name: '2. påskedag', kind: 'official' },
    // Store bededag was abolished as a public holiday from 2024.
    ...(year <= 2023 ? [{ date: e(26), name: 'Store bededag', kind: 'official' as const }] : []),
    { date: e(39), name: 'Kristi himmelfartsdag', kind: 'official' },
    { date: e(49), name: 'Pinsedag', kind: 'official' },
    { date: e(50), name: '2. pinsedag', kind: 'official' },
    { date: d('06-05'), name: 'Grundlovsdag', kind: 'customary' },
    { date: d('12-24'), name: 'Juleaftensdag', kind: 'customary' },
    { date: d('12-25'), name: 'Juledag', kind: 'official' },
    { date: d('12-26'), name: '2. juledag', kind: 'official' },
    { date: d('12-31'), name: 'Nytårsaftensdag', kind: 'customary' },
  ]
  return list.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0))
}
