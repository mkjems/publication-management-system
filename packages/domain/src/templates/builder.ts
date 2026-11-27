/**
 * Small DSL for writing templates by hand. It keeps the master plan data file
 * close to the PDF: one line per activity, responsibility in the PDF's own words.
 */
import type { Dependency, DependencyType } from '../model/common'
import type { Responsibility, RoleId } from '../model/roles'
import type {
  ActivityTemplate,
  Gate,
  PhaseTemplate,
  Template,
  TrackTemplate,
} from '../model/template'

/** Danish role words as they appear in the master plan's "Ansvarlig" column. */
const ROLE_WORDS: Record<string, RoleId> = {
  projektansvarlig: 'project-lead',
  forlægger: 'publisher',
  forlaget: 'publishing-house',
  redaktør: 'editor',
  forfatter: 'author',
  grafiker: 'designer',
  billedansvarlig: 'picture-editor',
  fotograf: 'photographer',
  korrekturlæser: 'proofreader',
  registerredaktør: 'indexer',
  repro: 'repro',
  trykker: 'printer',
  presse: 'press',
  presseansvarlig: 'press',
  kommunikation: 'communications',
  kommunikationsansvarlig: 'communications',
  salg: 'sales',
  'salgs-': 'sales',
  lager: 'warehouse',
  opdragsgiver: 'commissioner',
  projektteam: 'project-team',
}

/**
 * Parses "Redaktør + grafiker" (joint) and "Redaktør/forfatter" (either).
 * Mixed forms such as "Redaktør + grafiker/projektansvarlig" become joint with all roles;
 * the original text is kept as the label.
 */
export function parseResponsibility(label: string): Responsibility {
  const words = label
    .toLowerCase()
    .split(/[+/]/)
    .map((w) => w.trim())
    .filter(Boolean)
  const roles: RoleId[] = []
  for (const word of words) {
    const role = ROLE_WORDS[word]
    if (!role) throw new Error(`Unknown role "${word}" in "${label}"`)
    if (!roles.includes(role)) roles.push(role)
  }
  const mode = label.includes('+') || !label.includes('/') ? 'joint' : 'either'
  return { roles, mode, label }
}

export type Pred = string | { id: string; type?: DependencyType; lag?: number }

function toDependency(p: Pred): Dependency {
  return typeof p === 'string'
    ? { activityId: p, type: 'FS', lagWorkdays: 0 }
    : { activityId: p.id, type: p.type ?? 'FS', lagWorkdays: p.lag ?? 0 }
}

interface Opts {
  optional?: boolean
  note?: string
}

interface TaskOpts extends Opts {
  /** false for supplier lead times that cannot be shortened (printing, transport). */
  compressible?: boolean
}

type ActivityDraft = Omit<ActivityTemplate, 'phaseId' | 'trackId'>

/** A task with a real work period. `deadline` is in working days relative to release. */
export function task(
  id: string,
  name: string,
  responsible: string,
  durationWorkdays: number,
  deadline: number,
  after: Pred[] = [],
  opts: TaskOpts = {},
): ActivityDraft {
  return {
    id,
    name,
    kind: 'task',
    responsible: parseResponsibility(responsible),
    durationWorkdays,
    deadlineOffset: deadline,
    predecessors: after.map(toDependency),
    optional: opts.optional ?? false,
    ...(opts.compressible === false ? { compressible: false } : {}),
    ...(opts.note ? { note: opts.note } : {}),
  }
}

/** A deadline-only activity (delivery, decision) with no work period. */
export function point(
  id: string,
  name: string,
  responsible: string,
  deadline: number,
  after: Pred[] = [],
  opts: Opts = {},
): ActivityDraft {
  return {
    id,
    name,
    kind: 'deadline',
    responsible: parseResponsibility(responsible),
    durationWorkdays: 0,
    deadlineOffset: deadline,
    predecessors: after.map(toDependency),
    optional: opts.optional ?? false,
    ...(opts.note ? { note: opts.note } : {}),
  }
}

/** A phase gate (MILEPÆL). */
export function milestone(
  id: string,
  name: string,
  responsible: string,
  deadline: number,
  after: Pred[],
  opts: Opts & { gate?: Gate } = {},
): ActivityDraft {
  return {
    id,
    name,
    kind: 'milestone',
    responsible: parseResponsibility(responsible),
    durationWorkdays: 0,
    deadlineOffset: deadline,
    predecessors: after.map(toDependency),
    optional: false,
    ...(opts.gate ? { gate: opts.gate } : {}),
    ...(opts.note ? { note: opts.note } : {}),
  }
}

export interface TrackDraft {
  id: string
  name: string
  description?: string
  activities: ActivityDraft[]
}

export function track(
  id: string,
  name: string,
  activities: ActivityDraft[],
  description?: string,
): TrackDraft {
  return { id, name, activities, ...(description ? { description } : {}) }
}

export interface PhaseDraft {
  phase: PhaseTemplate
  tracks: TrackDraft[]
  milestones: ActivityDraft[]
}

export function phase(
  meta: Omit<PhaseTemplate, 'window'> & { window: [start: number, end: number] },
  tracks: TrackDraft[],
  milestones: ActivityDraft[],
): PhaseDraft {
  const { window, ...rest } = meta
  return {
    phase: { ...rest, window: { startOffset: window[0], endOffset: window[1] } },
    tracks,
    milestones,
  }
}

export function buildTemplate(
  meta: Omit<Template, 'phases' | 'tracks' | 'activities'>,
  phases: PhaseDraft[],
): Template {
  const tracks: TrackTemplate[] = []
  const activities: ActivityTemplate[] = []
  for (const p of phases) {
    for (const t of p.tracks) {
      tracks.push({
        id: t.id,
        phaseId: p.phase.id,
        name: t.name,
        ...(t.description ? { description: t.description } : {}),
      })
      for (const a of t.activities) activities.push({ ...a, phaseId: p.phase.id, trackId: t.id })
    }
    for (const m of p.milestones) activities.push({ ...m, phaseId: p.phase.id, trackId: null })
  }
  return { ...meta, phases: phases.map((p) => p.phase), tracks, activities }
}
