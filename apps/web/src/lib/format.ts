import type { ActivityKind, Dependency } from '@pms/domain'

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
