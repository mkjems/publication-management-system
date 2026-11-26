import type { IsoDate } from '../model/common'

/**
 * Everything a command needs from the outside world. The domain never reads the clock or
 * generates random ids itself (PLAN §4.3).
 */
export interface CommandContext {
  /** Business date of the change: the (possibly simulated) "today". */
  asOf: IsoDate
  /** Wall-clock time, ISO date-time with offset. */
  recordedAt: string
  /** Who made the change (person id), or null for the system. */
  by: string | null
  /** Unique id generator for events and transactions. */
  newId: () => string
}
