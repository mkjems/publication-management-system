/** Conversions between an activity's planned dates and its span on the working-day axis. */
import type { WorkCalendar } from '../calendar/calendar'
import type { IsoDate } from '../model/common'
import type { Activity } from '../model/publication'
import type { Span } from './constraints'

/** The planned span of an activity: `finish` is the end of its deadline. */
export function plannedSpan(cal: WorkCalendar, a: Activity): Span {
  const finish = cal.ordinal(a.deadline)
  return { start: finish - a.durationWorkdays, finish }
}

/** Planned dates for an activity that finishes at `finish` with `duration` working days. */
export function datesForSpan(
  cal: WorkCalendar,
  kind: Activity['kind'],
  finish: number,
  duration: number,
): { start: IsoDate | null; deadline: IsoDate } {
  return {
    start: kind === 'task' ? cal.dateOf(finish - duration + 1) : null,
    deadline: cal.dateOf(finish),
  }
}

/** The activity rescheduled to finish at `finish`, optionally with a new duration. */
export function withSpan(
  cal: WorkCalendar,
  a: Activity,
  finish: number,
  duration = a.durationWorkdays,
): Activity {
  const dates = datesForSpan(cal, a.kind, finish, duration)
  if (dates.deadline === a.deadline && dates.start === a.start && duration === a.durationWorkdays) {
    return a
  }
  return { ...a, ...dates, durationWorkdays: duration }
}
