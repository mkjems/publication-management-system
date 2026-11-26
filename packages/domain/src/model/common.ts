import { z } from 'zod'

/**
 * Calendar date without time or timezone, e.g. "2027-03-15".
 * All date arithmetic goes through the working-day calendar module (Phase 1).
 */
export const IsoDateSchema = z.iso.date()
export type IsoDate = z.infer<typeof IsoDateSchema>

/**
 * - task:      has a real work period (start + deadline). Drawn as a bar.
 * - deadline:  a point in time only (a delivery, a decision). Drawn as a tick.
 * - milestone: a phase gate from the master plan. Drawn as a diamond.
 *
 * Mirrors the master plan rule: "Udfyld Start kun for aktiviteter med et reelt arbejdsforløb".
 */
export const ActivityKindSchema = z.enum(['task', 'deadline', 'milestone'])
export type ActivityKind = z.infer<typeof ActivityKindSchema>

/** Status values from the master plan (Ikke startet · I gang · Afventer · Færdig) plus "skipped" for optional activities. */
export const ActivityStatusSchema = z.enum([
  'not_started',
  'in_progress',
  'waiting',
  'done',
  'skipped',
])
export type ActivityStatus = z.infer<typeof ActivityStatusSchema>

/**
 * Dependency types, evaluated on a continuous working-day axis where
 * `start = deadline - duration`:
 * - FS (finish-to-start):  successor.start    >= predecessor.deadline + lag
 * - SS (start-to-start):   successor.start    >= predecessor.start    + lag
 * - FF (finish-to-finish): successor.deadline >= predecessor.deadline + lag
 *
 * With this convention a task with duration d and deadline on working day k
 * occupies working days k-d+1 … k, and an FS successor with lag 0 starts on k+1.
 */
export const DependencyTypeSchema = z.enum(['FS', 'SS', 'FF'])
export type DependencyType = z.infer<typeof DependencyTypeSchema>

export const DependencySchema = z.object({
  activityId: z.string().min(1),
  type: DependencyTypeSchema,
  lagWorkdays: z.int(),
})
export type Dependency = z.infer<typeof DependencySchema>
