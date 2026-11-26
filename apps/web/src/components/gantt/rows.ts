import type { Activity, PhaseTemplate } from '@pms/domain'
import type { PhaseRows } from '@/lib/publication'

export const ROW_HEIGHT = { phase: 36, track: 24, activity: 30 } as const

export type GanttRow =
  | {
      kind: 'phase'
      key: string
      y: number
      height: number
      group: PhaseRows
      phase: PhaseTemplate
      open: boolean
    }
  | { kind: 'track'; key: string; y: number; height: number; label: string }
  | { kind: 'activity'; key: string; y: number; height: number; activity: Activity }

type WithoutY<T> = T extends unknown ? Omit<T, 'y'> : never

export interface RowLayout {
  rows: GanttRow[]
  height: number
  /** Vertical centre of each visible activity row. */
  centerY: Map<string, number>
}

/** Flattens Phase → Track → Activity groups into positioned rows. */
export function layoutRows(
  groups: PhaseRows[],
  isOpen: (phaseId: string) => boolean,
  milestoneLabel: string,
): RowLayout {
  const rows: GanttRow[] = []
  const centerY = new Map<string, number>()
  let y = 0
  const push = (row: WithoutY<GanttRow>) => {
    rows.push({ ...row, y } as GanttRow)
    if (row.kind === 'activity') centerY.set(row.activity.id, y + row.height / 2)
    y += row.height
  }
  for (const g of groups) {
    const open = isOpen(g.phase.id)
    push({
      kind: 'phase',
      key: g.phase.id,
      height: ROW_HEIGHT.phase,
      group: g,
      phase: g.phase,
      open,
    })
    if (!open) continue
    const sections = [
      ...g.tracks.map((t) => ({ key: t.track.id, label: t.track.name, activities: t.activities })),
      ...(g.milestones.length
        ? [{ key: `${g.phase.id}-milestones`, label: milestoneLabel, activities: g.milestones }]
        : []),
    ]
    for (const s of sections) {
      push({ kind: 'track', key: s.key, height: ROW_HEIGHT.track, label: s.label })
      for (const a of s.activities) {
        push({ kind: 'activity', key: a.id, height: ROW_HEIGHT.activity, activity: a })
      }
    }
  }
  return { rows, height: y, centerY }
}
