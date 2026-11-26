import { z } from 'zod'
import { CalendarSpecSchema } from '../calendar/calendar'
import {
  ActivityKindSchema,
  ActivityStatusSchema,
  DependencySchema,
  IsoDateSchema,
  type IsoDate,
} from './common'
import { ResponsibilitySchema, RoleIdSchema } from './roles'
import { GateSchema } from './template'

export const WaitingForSchema = z.object({
  /** What the activity is waiting for ("Fondssvar fra Augustinus"). */
  text: z.string().min(1),
  /** When the blocker is expected to clear, if known. The forecast uses it. */
  expectedDate: IsoDateSchema.nullable(),
})
export type WaitingFor = z.infer<typeof WaitingForSchema>

/**
 * One activity in a publication's plan. Copied from the template when the plan is generated,
 * then edited freely.
 *
 * Planned dates: `deadline` is the current deadline (_Aktuel deadline_). For tasks, `start` is
 * the first working day and `durationWorkdays` the number of working days from `start` to
 * `deadline` inclusive. The engine keeps the three consistent. The original deadline
 * (_Oprindelig deadline_) lives in the publication's baselines and is never overwritten.
 */
export const ActivitySchema = z
  .object({
    id: z.string().min(1),
    /** null for custom activities added by the user. */
    templateActivityId: z.string().min(1).nullable(),
    phaseId: z.string().min(1),
    trackId: z.string().min(1).nullable(),
    name: z.string().min(1),
    kind: ActivityKindSchema,
    responsible: ResponsibilitySchema,
    assigneeIds: z.array(z.string().min(1)),
    durationWorkdays: z.int().nonnegative(),
    start: IsoDateSchema.nullable(),
    deadline: IsoDateSchema,
    actualStart: IsoDateSchema.nullable(),
    actualFinish: IsoDateSchema.nullable(),
    status: ActivityStatusSchema,
    waitingFor: WaitingForSchema.nullable(),
    /** A fixed date (event venue, printer slot). Rescheduling never moves it. */
    pinned: z.boolean(),
    optional: z.boolean(),
    gate: GateSchema.nullable(),
    note: z.string(),
    predecessors: z.array(DependencySchema),
  })
  .refine((a) => (a.kind === 'task' ? a.durationWorkdays > 0 : a.durationWorkdays === 0), {
    message: 'Tasks need a positive duration; deadlines and milestones have duration 0',
    path: ['durationWorkdays'],
  })
  .refine((a) => (a.kind === 'task') === (a.start !== null), {
    message: 'Only tasks have a start date',
    path: ['start'],
  })
  .refine((a) => a.status !== 'done' || a.actualFinish !== null, {
    message: 'A done activity needs an actual finish date',
    path: ['actualFinish'],
  })
  .refine((a) => (a.status === 'waiting') === (a.waitingFor !== null), {
    message: '"waitingFor" is set exactly when the status is "waiting"',
    path: ['waitingFor'],
  })
export type Activity = z.infer<typeof ActivitySchema>

export const PlanStateSchema = z.enum(['preliminary', 'binding'])
export type PlanState = z.infer<typeof PlanStateSchema>

export const LifecycleSchema = z.enum([
  'idea',
  'go',
  'hold',
  'no_go',
  'active',
  'paused',
  'released',
  'closed',
])
export type Lifecycle = z.infer<typeof LifecycleSchema>

export const PauseSchema = z.object({
  from: IsoDateSchema,
  /** null while the publication is still paused. */
  to: IsoDateSchema.nullable(),
  reason: z.string(),
})
export type Pause = z.infer<typeof PauseSchema>

/**
 * A snapshot of planned dates. Baseline 0 is captured when the plan becomes binding and holds
 * the _Oprindelig deadline_ for every activity. Later re-baselines add new snapshots; none is
 * ever overwritten.
 */
export const BaselineSchema = z.object({
  number: z.int().nonnegative(),
  capturedOn: IsoDateSchema,
  reason: z.string(),
  releaseDate: IsoDateSchema,
  activities: z.record(
    z.string(),
    z.object({ start: IsoDateSchema.nullable(), deadline: IsoDateSchema }),
  ),
})
export type Baseline = z.infer<typeof BaselineSchema>

export const FundingApplicationSchema = z.object({
  id: z.string().min(1),
  funder: z.string().min(1),
  /** DKK. */
  amount: z.number().nonnegative(),
  status: z.enum(['planned', 'submitted', 'granted', 'rejected']),
  submittedAt: IsoDateSchema.nullable(),
  expectedDecisionAt: IsoDateSchema.nullable(),
  decidedAt: IsoDateSchema.nullable(),
  conditions: z.string(),
})
export type FundingApplication = z.infer<typeof FundingApplicationSchema>

export const FundingSchema = z.object({
  /** DKK needed before the release date can become binding. */
  minimumRequired: z.number().nonnegative(),
  /** DKK secured so far. */
  secured: z.number().nonnegative(),
  /** The publisher accepts the risk of going ahead without full funding. */
  riskAccepted: z.boolean(),
  applications: z.array(FundingApplicationSchema),
})
export type Funding = z.infer<typeof FundingSchema>

export const PersonSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.email().nullable(),
  defaultRoles: z.array(RoleIdSchema),
})
export type Person = z.infer<typeof PersonSchema>

/**
 * A publication and its plan. Stage A keeps the activities, baselines and calendar inside the
 * publication so the engine works on one value; Stage B may store them in separate tables.
 */
export const PublicationSchema = z.object({
  id: z.string().min(1),
  workingTitle: z.string().min(1),
  templateId: z.string().min(1),
  templateVersion: z.int().positive(),
  projectLeadId: z.string().min(1).nullable(),
  kickoffDate: IsoDateSchema,
  desiredReleaseDate: IsoDateSchema,
  /** Set when the plan becomes binding. */
  bindingReleaseDate: IsoDateSchema.nullable(),
  planState: PlanStateSchema,
  lifecycle: LifecycleSchema,
  funding: FundingSchema,
  roleAssignments: z.partialRecord(RoleIdSchema, z.array(z.string().min(1))),
  pauses: z.array(PauseSchema),
  calendar: CalendarSpecSchema,
  baselines: z.array(BaselineSchema),
  activities: z.array(ActivitySchema),
})
export type Publication = z.infer<typeof PublicationSchema>

/** The release date the plan is measured against: binding if set, otherwise desired. */
export function targetReleaseDate(p: Publication): IsoDate {
  return p.bindingReleaseDate ?? p.desiredReleaseDate
}

/** The activity carrying the release gate, if the plan has one. */
export function releaseActivity(p: Publication): Activity | undefined {
  return p.activities.find((a) => a.gate === 'release')
}

export function findActivity(p: Publication, id: string): Activity {
  const a = p.activities.find((x) => x.id === id)
  if (!a) throw new Error(`Unknown activity "${id}"`)
  return a
}

/** The open pause, if the publication is paused. */
export function openPause(p: Publication): Pause | undefined {
  return p.pauses.find((x) => x.to === null)
}

/** The original plan (baseline 0), if the plan has become binding. */
export function originalBaseline(p: Publication): Baseline | undefined {
  return p.baselines.find((b) => b.number === 0)
}
