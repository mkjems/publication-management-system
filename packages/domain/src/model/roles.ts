import { z } from 'zod'

export const ROLE_IDS = [
  'project-lead',
  'publisher',
  'publishing-house',
  'editor',
  'author',
  'designer',
  'picture-editor',
  'photographer',
  'proofreader',
  'indexer',
  'repro',
  'printer',
  'press',
  'communications',
  'sales',
  'warehouse',
  'commissioner',
  'project-team',
] as const

export const RoleIdSchema = z.enum(ROLE_IDS)
export type RoleId = z.infer<typeof RoleIdSchema>

/** Danish display names, as used in the master plan. */
export const ROLE_LABELS: Record<RoleId, string> = {
  'project-lead': 'Projektansvarlig',
  publisher: 'Forlægger',
  'publishing-house': 'Forlaget',
  editor: 'Redaktør',
  author: 'Forfatter',
  designer: 'Grafiker',
  'picture-editor': 'Billedansvarlig',
  photographer: 'Fotograf',
  proofreader: 'Korrekturlæser',
  indexer: 'Registerredaktør',
  repro: 'Repro',
  printer: 'Trykker',
  press: 'Presseansvarlig',
  communications: 'Kommunikation',
  sales: 'Salgsansvarlig',
  warehouse: 'Lager',
  commissioner: 'Opdragsgiver',
  'project-team': 'Projektteam',
}

/**
 * Who is responsible for an activity.
 * - joint:  all roles together ("Redaktør + grafiker")
 * - either: one of the roles ("Redaktør/forfatter")
 * `label` keeps the exact wording from the master plan for display.
 */
export const ResponsibilitySchema = z.object({
  roles: z.array(RoleIdSchema).min(1),
  mode: z.enum(['joint', 'either']),
  label: z.string().min(1),
})
export type Responsibility = z.infer<typeof ResponsibilitySchema>
