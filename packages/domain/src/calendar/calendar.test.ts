import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CALENDAR, WorkCalendar, getCalendar } from './calendar'
import { addDays, diffDays, fromEpochDay, isoWeekday, toEpochDay } from './dates'
import { danishHolidays, easterSunday } from './holidays-dk'

describe('dates', () => {
  it('converts to and from epoch days', () => {
    expect(toEpochDay('1970-01-01')).toBe(0)
    expect(fromEpochDay(toEpochDay('2028-02-29'))).toBe('2028-02-29')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(diffDays('2026-11-26', '2026-12-24')).toBe(28)
  })

  it('rejects invalid dates', () => {
    expect(() => toEpochDay('2027-02-29')).toThrow('Invalid')
    expect(() => toEpochDay('2027-1-5')).toThrow('Invalid')
  })

  it('computes ISO weekdays', () => {
    expect(isoWeekday('2026-11-26')).toBe(4) // Thursday
    expect(isoWeekday('2026-11-29')).toBe(7) // Sunday
    expect(isoWeekday('1969-12-29')).toBe(1) // Monday, before the epoch
  })
})

describe('Danish holidays', () => {
  it('computes Easter Sunday', () => {
    expect(['2024', '2025', '2026', '2027', '2028'].map((y) => easterSunday(Number(y)))).toEqual([
      '2024-03-31',
      '2025-04-20',
      '2026-04-05',
      '2027-03-28',
      '2028-04-16',
    ])
  })

  it('lists the 2027 holidays', () => {
    expect(danishHolidays(2027).map((h) => `${h.date} ${h.name}`)).toEqual([
      '2027-01-01 Nytårsdag',
      '2027-03-25 Skærtorsdag',
      '2027-03-26 Langfredag',
      '2027-03-28 Påskedag',
      '2027-03-29 2. påskedag',
      '2027-05-06 Kristi himmelfartsdag',
      '2027-05-16 Pinsedag',
      '2027-05-17 2. pinsedag',
      '2027-06-05 Grundlovsdag',
      '2027-12-24 Juleaftensdag',
      '2027-12-25 Juledag',
      '2027-12-26 2. juledag',
      '2027-12-31 Nytårsaftensdag',
    ])
  })

  it('includes Store bededag only until 2023', () => {
    expect(danishHolidays(2023).some((h) => h.name === 'Store bededag')).toBe(true)
    expect(danishHolidays(2024).some((h) => h.name === 'Store bededag')).toBe(false)
  })
})

describe('WorkCalendar', () => {
  const cal = new WorkCalendar(DEFAULT_CALENDAR)

  it('knows weekends, holidays and closures', () => {
    expect(cal.isWorkingDay('2027-03-24')).toBe(true) // Wednesday before Easter
    expect(cal.nonWorkingReason('2027-03-25')).toBe('Skærtorsdag')
    expect(cal.nonWorkingReason('2027-03-27')).toBe('Weekend')
    expect(cal.nonWorkingReason('2027-12-24')).toBe('Juleaftensdag')

    const official = new WorkCalendar({ holidays: 'dk-official', closures: [] })
    expect(official.isWorkingDay('2027-12-24')).toBe(true)

    const printer = new WorkCalendar({
      holidays: 'dk',
      closures: [{ from: '2027-07-12', to: '2027-07-30', label: 'Trykkeriets sommerferie' }],
    })
    expect(printer.nonWorkingReason('2027-07-20')).toBe('Trykkeriets sommerferie')
    expect(printer.countWorkdays('2027-07-01', '2027-08-31')).toBe(
      cal.countWorkdays('2027-07-01', '2027-08-31') - 15,
    )
  })

  it('counts working days around Easter', () => {
    // Mon 22 Mar – Fri 2 Apr 2027: 10 weekdays minus Skærtorsdag, Langfredag, 2. påskedag.
    expect(cal.countWorkdays('2027-03-22', '2027-04-02')).toBe(7)
    expect(cal.addWorkdays('2027-03-24', 1)).toBe('2027-03-30')
  })

  it('treats a non-working date as the working day before it', () => {
    expect(cal.ordinal('2026-11-28')).toBe(cal.ordinal('2026-11-27'))
    expect(cal.addWorkdays('2026-11-28', 1)).toBe('2026-11-30')
    expect(cal.addWorkdays('2026-11-28', 0)).toBe('2026-11-27')
    expect(cal.nextWorkingDay('2026-11-28')).toBe('2026-11-30')
    expect(cal.previousWorkingDay('2026-11-28')).toBe('2026-11-27')
    expect(cal.nextWorkingDay('2026-11-26')).toBe('2026-11-26')
  })

  it('places work that starts on a date after the previous day', () => {
    // A 5-day task starting Monday 30 Nov 2026 ends on Friday 4 Dec.
    expect(cal.dateOf(cal.startBoundary('2026-11-30') + 5)).toBe('2026-12-04')
    // Starting on a Saturday is the same as starting on Monday.
    expect(cal.startBoundary('2026-11-28')).toBe(cal.startBoundary('2026-11-30'))
  })

  it('crosses year boundaries and the epoch year', () => {
    expect(cal.addWorkdays('2026-12-23', 1)).toBe('2026-12-28')
    expect(cal.addWorkdays('2026-12-30', 1)).toBe('2027-01-04')
    expect(cal.addWorkdays('2000-01-03', -1)).toBe('1999-12-30')
    expect(cal.workdaysBetween('1999-12-30', '2000-01-03')).toBe(1)
  })

  it('round-trips ordinals and moves by exactly n working days (property)', () => {
    const date = fc
      .integer({ min: toEpochDay('1995-01-01'), max: toEpochDay('2040-12-31') })
      .map(fromEpochDay)
    fc.assert(
      fc.property(date, fc.integer({ min: -800, max: 800 }), (d, n) => {
        const moved = cal.addWorkdays(d, n)
        expect(cal.isWorkingDay(moved)).toBe(true)
        expect(cal.ordinal(cal.dateOf(cal.ordinal(moved)))).toBe(cal.ordinal(moved))
        if (cal.isWorkingDay(d)) expect(cal.workdaysBetween(d, moved)).toBe(n)
      }),
    )
  })

  it('caches instances per spec', () => {
    expect(getCalendar({ holidays: 'dk', closures: [] })).toBe(getCalendar(DEFAULT_CALENDAR))
  })
})
