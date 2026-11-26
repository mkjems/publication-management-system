import { z } from 'zod'
import { IsoDateSchema } from './common'

export const ReasonCategorySchema = z.enum([
  'author',
  'editorial',
  'images_rights',
  'design',
  'printer',
  'funding',
  'external',
  'other',
])
export type ReasonCategory = z.infer<typeof ReasonCategorySchema>

export const ChangeEventTypeSchema = z.enum([
  'activity_rescheduled',
  'status_changed',
  'release_date_changed',
  'plan_made_binding',
  'rebaselined',
  'paused',
  'resumed',
  'pinned_changed',
  'dependency_added',
  'dependency_removed',
  'activity_updated',
  'funding_changed',
  'gate_decided',
  'roles_assigned',
  'undone',
  'redone',
])
export type ChangeEventType = z.infer<typeof ChangeEventTypeSchema>

const FieldChangeSchema = z.object({ from: z.unknown(), to: z.unknown() })
export type FieldChange = z.infer<typeof FieldChangeSchema>

/**
 * Field-level difference between two versions of a publication. Every event carries one, so
 * any event can be undone by applying its diff in reverse, and the history can show exactly
 * what changed.
 */
export const PublicationDiffSchema = z.object({
  /** Top-level publication fields (everything except `activities`). */
  fields: z.record(z.string(), FieldChangeSchema),
  activities: z.array(
    z.discriminatedUnion('op', [
      z.object({
        op: z.literal('update'),
        id: z.string(),
        fields: z.record(z.string(), FieldChangeSchema),
      }),
      z.object({ op: z.literal('add'), index: z.int(), activity: z.unknown() }),
      z.object({ op: z.literal('remove'), index: z.int(), activity: z.unknown() }),
    ]),
  ),
})
export type PublicationDiff = z.infer<typeof PublicationDiffSchema>

/**
 * Append-only log entry. One user action is one transaction (`txId`) of one or more events;
 * undo and redo work on whole transactions.
 */
export const ChangeEventSchema = z.object({
  id: z.string().min(1),
  txId: z.string().min(1),
  publicationId: z.string().min(1),
  /** The business date of the change. Simulated when the clock is simulated. */
  effectiveDate: IsoDateSchema,
  /** Wall-clock time the change was recorded (ISO date-time). */
  recordedAt: z.iso.datetime({ offset: true }),
  by: z.string().nullable(),
  type: ChangeEventTypeSchema,
  /** Type-specific summary for the history view (activity id, old/new dates, strategy …). */
  payload: z.record(z.string(), z.unknown()),
  reason: z.string().optional(),
  reasonCategory: ReasonCategorySchema.optional(),
  diff: PublicationDiffSchema,
})
export type ChangeEvent = z.infer<typeof ChangeEventSchema>
