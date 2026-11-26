/**
 * Dependency rules on the working-day axis. The single source of truth for what FS, SS and FF
 * mean (see `model/common.ts`); used by the template validator and by the engine.
 *
 * A span is `start = finish - duration` and `finish`, both axis positions (end of a working day).
 */
import type { Dependency } from '../model/common'

export interface Span {
  start: number
  finish: number
}

/** The earliest finish the successor may have, given its predecessor's span. */
export function earliestFinish(dep: Dependency, pred: Span, succDuration: number): number {
  switch (dep.type) {
    case 'FS':
      return pred.finish + dep.lagWorkdays + succDuration
    case 'SS':
      return pred.start + dep.lagWorkdays + succDuration
    case 'FF':
      return pred.finish + dep.lagWorkdays
  }
}

/** The latest finish the predecessor may have, given its successor's latest finish. */
export function latestFinish(
  dep: Dependency,
  succLatestFinish: number,
  succDuration: number,
  predDuration: number,
): number {
  switch (dep.type) {
    case 'FS':
      return succLatestFinish - succDuration - dep.lagWorkdays
    case 'SS':
      return succLatestFinish - succDuration - dep.lagWorkdays + predDuration
    case 'FF':
      return succLatestFinish - dep.lagWorkdays
  }
}

/** Whether a dependency constrains the successor's start (FS, SS) rather than its finish (FF). */
export function constrainsStart(dep: Dependency): boolean {
  return dep.type !== 'FF'
}
