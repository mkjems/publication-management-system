/**
 * A workspace: the publications, their change history and the people. Stage A stores one per
 * browser store (real and demo) and exports it as JSON; the schema validates imports.
 */
import { z } from 'zod'
import type { History } from '../commands/history'
import { IsoDateSchema } from '../model/common'
import { ChangeEventSchema } from '../model/events'
import { PersonSchema, PublicationSchema } from '../model/publication'
import type { ScriptAction, SimulationSetup } from '../simulation/scenario'
import type { SimulationPolicy } from '../simulation/simulate'

export const WorkspaceKindSchema = z.enum(['real', 'demo'])
export type WorkspaceKind = z.infer<typeof WorkspaceKindSchema>

export const HistorySchema = z.object({
  log: z.array(ChangeEventSchema),
  undoable: z.array(z.string()),
  redoable: z.array(z.string()),
}) satisfies z.ZodType<History>

export const SimulationPolicySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('on_plan') }),
  z.object({ kind: z.literal('realistic') }),
  z.object({ kind: z.literal('stress') }),
  z.object({
    kind: z.literal('custom'),
    delays: z.record(z.string(), z.int()),
    base: z.enum(['on_plan', 'realistic', 'stress']).optional(),
  }),
]) satisfies z.ZodType<SimulationPolicy>

const ScriptActionSchema = z.custom<ScriptAction>(
  (v) => typeof v === 'object' && v !== null && typeof (v as { kind?: unknown }).kind === 'string',
  { message: 'Invalid scripted action' },
)

export const SimulationSetupSchema = z.object({
  policy: SimulationPolicySchema,
  seed: z.int(),
  replan: z.boolean(),
  script: z.array(z.object({ on: IsoDateSchema, action: ScriptActionSchema })),
  state: z.record(z.string(), IsoDateSchema),
}) satisfies z.ZodType<SimulationSetup>

export const PublicationRecordSchema = z.object({
  publication: PublicationSchema,
  history: HistorySchema,
  /** Demo workspace only: how the book moves forward when simulated time advances. */
  simulation: SimulationSetupSchema.optional(),
})
export type PublicationRecord = z.infer<typeof PublicationRecordSchema>

export const WorkspaceSnapshotSchema = z.object({
  format: z.literal('pms-workspace'),
  version: z.literal(1),
  exportedAt: z.iso.datetime({ offset: true }),
  workspace: WorkspaceKindSchema,
  /** The simulated date when exported from the demo workspace. */
  simulatedDate: IsoDateSchema.nullable(),
  people: z.array(PersonSchema),
  publications: z.array(PublicationRecordSchema),
})
export type WorkspaceSnapshot = z.infer<typeof WorkspaceSnapshotSchema>

/** Parses an exported workspace. Throws a readable error on invalid input. */
export function parseWorkspaceSnapshot(json: unknown): WorkspaceSnapshot {
  const result = WorkspaceSnapshotSchema.safeParse(json)
  if (!result.success) {
    const first = result.error.issues[0]
    throw new Error(
      `Invalid workspace file${first ? ` at ${first.path.join('.') || '(root)'}: ${first.message}` : ''}`,
    )
  }
  return result.data
}
