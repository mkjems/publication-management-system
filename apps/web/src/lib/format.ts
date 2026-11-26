import type { ActivityKind, Dependency, IsoDate } from '@pms/domain'

const WORKDAYS_PER_WEEK = 5
const nf = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 })

/** "5 dage", "1 uge", "4,4 uger". Input is working days. */
export function formatDuration(workdays: number): string {
  if (workdays === 0) return '–'
  if (workdays < WORKDAYS_PER_WEEK) return `${workdays} ${workdays === 1 ? 'dag' : 'dage'}`
  const weeks = workdays / WORKDAYS_PER_WEEK
  return `${nf.format(weeks)} ${weeks === 1 ? 'uge' : 'uger'}`
}

/** Offset relative to release: "38 uger før", "Udgivelsesdag", "2 uger efter". */
export function formatOffset(workdays: number): string {
  if (workdays === 0) return 'Udgivelsesdag'
  const abs = Math.abs(workdays)
  const amount =
    abs < WORKDAYS_PER_WEEK
      ? `${abs} ${abs === 1 ? 'dag' : 'dage'}`
      : `${nf.format(Math.round((abs / WORKDAYS_PER_WEEK) * 10) / 10)} uger`
  return `${amount} ${workdays < 0 ? 'før' : 'efter'}`
}

/** Short dependency suffix: "" for plain FS, otherwise e.g. "SS +5". */
export function formatDependencyType(d: Dependency): string {
  if (d.type === 'FS' && d.lagWorkdays === 0) return ''
  const lag =
    d.lagWorkdays === 0 ? '' : ` ${d.lagWorkdays > 0 ? '+' : '−'}${Math.abs(d.lagWorkdays)}`
  return `${d.type}${lag}`
}

export const KIND_LABELS: Record<ActivityKind, string> = {
  task: 'Opgave',
  deadline: 'Deadline',
  milestone: 'Milepæl',
}

const dateLong = new Intl.DateTimeFormat('da-DK', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const dateCompact = new Intl.DateTimeFormat('da-DK', {
  day: 'numeric',
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
})
const weekday = new Intl.DateTimeFormat('da-DK', { weekday: 'short', timeZone: 'UTC' })

function utc(date: IsoDate) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!))
}

/** "15. okt. 2027". */
export function formatDate(date: IsoDate | null | undefined): string {
  return date ? dateLong.format(utc(date)) : '–'
}

/** "15. okt. 27", for dense tables. */
export function formatDateCompact(date: IsoDate | null | undefined): string {
  return date ? dateCompact.format(utc(date)) : '–'
}

/** "tor. 15. okt. 2027". */
export function formatDateWithWeekday(date: IsoDate): string {
  return `${weekday.format(utc(date))} ${formatDate(date)}`
}

/** "+3", "−2", "0": a signed number of working days. */
export function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0'
}

/** "3 arbejdsdage", "1 arbejdsdag". */
export function formatWorkdays(n: number): string {
  return `${n} ${Math.abs(n) === 1 ? 'arbejdsdag' : 'arbejdsdage'}`
}

const money = new Intl.NumberFormat('da-DK', {
  style: 'currency',
  currency: 'DKK',
  maximumFractionDigits: 0,
})

/** "250.000 kr." */
export function formatMoney(amount: number): string {
  return money.format(amount)
}
