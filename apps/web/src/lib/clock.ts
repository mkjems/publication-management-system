/**
 * The only place the app reads the system clock. The domain package never does (PLAN §4.3);
 * the store turns this into `asOf`, which is simulated in the demo workspace.
 */
import type { IsoDate } from '@pms/domain'

export interface SystemClock {
  /** The local calendar date today. */
  today(): IsoDate
  /** Wall-clock time, ISO date-time. */
  now(): string
}

export const systemClock: SystemClock = {
  today() {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  },
  now() {
    return new Date().toISOString()
  },
}
