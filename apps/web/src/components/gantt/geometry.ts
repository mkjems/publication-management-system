import type { Activity } from '@pms/domain'
import type { Scale } from './scale'

/** Horizontal extent of an activity's planned dates. Points have x1 === x2 (the day centre). */
export function barX(a: Pick<Activity, 'kind' | 'start' | 'deadline'>, scale: Scale) {
  if (a.kind === 'task' && a.start) {
    return { x1: scale.x(a.start), x2: scale.x(a.deadline) + scale.ppd }
  }
  const c = scale.x(a.deadline) + scale.ppd / 2
  return { x1: c, x2: c }
}
