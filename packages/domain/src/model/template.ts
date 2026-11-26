import { z } from 'zod'
import { ActivityKindSchema, DependencySchema } from './common'
import { ResponsibilitySchema } from './roles'

/**
 * Template offsets are measured in WORKING DAYS relative to the release date
 * (Udgivelse = 0). Negative = before release, positive = after.
 */

export const PhaseAnchorSchema = z.enum(['kickoff', 'release'])
export type PhaseAnchor = z.infer<typeof PhaseAnchorSchema>

export const PhaseTemplateSchema = z.object({
  id: z.string().min(1),
  number: z.int().positive(),
  name: z.string().min(1),
  /** Period text from the master plan, e.g. "Ca. 9–6½ måned før udgivelse". */
  period: z.string().min(1),
  /** Nominal window from the master plan, in working days relative to release. */
  window: z.object({ startOffset: z.int(), endOffset: z.int() }),
  /**
   * Which date this phase is planned from. Phases 1–2 run forward from the kickoff meeting;
   * phases 3–11 are planned backwards from the release date ("beregnes baglæns").
   */
  anchor: PhaseAnchorSchema,
  description: z.string().optional(),
})
export type PhaseTemplate = z.infer<typeof PhaseTemplateSchema>

export const TrackTemplateSchema = z.object({
  id: z.string().min(1),
  phaseId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
})
export type TrackTemplate = z.infer<typeof TrackTemplateSchema>

/** Milestones that the scheduling engine gives special meaning. */
export const GateSchema = z.enum(['go_hold_nogo', 'funding_secured', 'production_start', 'release'])
export type Gate = z.infer<typeof GateSchema>

export const ActivityTemplateSchema = z
  .object({
    id: z.string().min(1),
    phaseId: z.string().min(1),
    /** Milestones sit on the phase itself and have no track. */
    trackId: z.string().min(1).nullable(),
    name: z.string().min(1),
    kind: ActivityKindSchema,
    responsible: ResponsibilitySchema,
    /** 0 for deadlines and milestones. */
    durationWorkdays: z.int().nonnegative(),
    /** Default deadline in working days relative to the release date. */
    deadlineOffset: z.int(),
    predecessors: z.array(DependencySchema),
    /** "Eventuel…" activities that many books will skip. */
    optional: z.boolean(),
    gate: GateSchema.optional(),
    note: z.string().optional(),
  })
  .refine((a) => (a.kind === 'task' ? a.durationWorkdays > 0 : a.durationWorkdays === 0), {
    message: 'Tasks need a positive duration; deadlines and milestones have duration 0',
    path: ['durationWorkdays'],
  })
  .refine((a) => (a.kind === 'milestone') === (a.trackId === null), {
    message: 'Milestones have no track; all other activities belong to a track',
    path: ['trackId'],
  })
  .refine((a) => a.gate === undefined || a.kind === 'milestone', {
    message: 'Only milestones can be gates',
    path: ['gate'],
  })
export type ActivityTemplate = z.infer<typeof ActivityTemplateSchema>

export const TemplateSchema = z.object({
  id: z.string().min(1),
  version: z.int().positive(),
  name: z.string().min(1),
  description: z.string().optional(),
  /** Where the kickoff meeting sits in the nominal plan, in working days relative to release. */
  nominalKickoffOffset: z.int().negative(),
  phases: z.array(PhaseTemplateSchema).min(1),
  tracks: z.array(TrackTemplateSchema),
  activities: z.array(ActivityTemplateSchema).min(1),
})
export type Template = z.infer<typeof TemplateSchema>

/** Start offset of an activity on the continuous working-day axis. */
export function startOffset(a: Pick<ActivityTemplate, 'deadlineOffset' | 'durationWorkdays'>) {
  return a.deadlineOffset - a.durationWorkdays
}
