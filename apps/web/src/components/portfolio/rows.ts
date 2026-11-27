/**
 * What one book's line in the portfolio Gantt shows (PLAN §5.1.1): phase bands, key milestones
 * and the release, at the dates the plan now expects. Done work at its actual dates, open work
 * at its forecast, so slips widen the bands.
 */
import type { IsoDate, PhaseTemplate, Publication, PublicationHealth, Template } from '@pms/domain'
import { KEY_MILESTONES, templateOf } from '@/lib/publication'

export interface PhaseSpan {
  phase: PhaseTemplate
  start: IsoDate
  end: IsoDate
  done: boolean
}

export interface MilestoneMark {
  id: string
  name: string
  date: IsoDate
  done: boolean
  /** Open and forecast later than its current deadline. */
  late: boolean
}

export interface PortfolioRowData {
  phases: PhaseSpan[]
  milestones: MilestoneMark[]
  release: { target: IsoDate; forecast: IsoDate | null; done: boolean }
  pauses: { from: IsoDate; to: IsoDate | null }[]
  /** Earliest and latest date drawn. */
  first: IsoDate
  last: IsoDate
}

export function portfolioRow(
  pub: Publication,
  health: PublicationHealth,
  template: Template = templateOf(pub),
): PortfolioRowData {
  const f = health.analysis.activities
  const span = (a: Publication['activities'][number]) => {
    const forecast = f.get(a.id)
    if (a.status === 'done') {
      const end = a.actualFinish ?? a.deadline
      return { start: a.actualStart ?? a.start ?? end, end }
    }
    return {
      start: forecast?.start ?? a.start ?? a.deadline,
      end: forecast?.deadline ?? a.deadline,
    }
  }

  const phases: PhaseSpan[] = []
  for (const phase of template.phases) {
    const acts = pub.activities.filter((a) => a.phaseId === phase.id && a.status !== 'skipped')
    if (!acts.length) continue
    let start = '9999-12-31'
    let end = '0000-01-01'
    for (const a of acts) {
      const s = span(a)
      if (s.start < start) start = s.start
      if (s.end > end) end = s.end
    }
    phases.push({ phase, start, end, done: acts.every((a) => a.status === 'done') })
  }

  const release = pub.activities.find((a) => a.gate === 'release')
  const milestones: MilestoneMark[] = pub.activities
    .filter((a) => KEY_MILESTONES.includes(a.id) && a.gate !== 'release' && a.status !== 'skipped')
    .map((a) => {
      const date =
        a.status === 'done' ? (a.actualFinish ?? a.deadline) : (f.get(a.id)?.deadline ?? a.deadline)
      return {
        id: a.id,
        name: a.name,
        date,
        done: a.status === 'done',
        late: a.status !== 'done' && date > a.deadline,
      }
    })

  const dates = [
    ...phases.flatMap((p) => [p.start, p.end]),
    health.release.target,
    ...(health.release.forecast ? [health.release.forecast] : []),
  ].sort()
  return {
    phases,
    milestones,
    release: {
      target: health.release.target,
      forecast: health.release.forecast,
      done: release?.status === 'done',
    },
    pauses: pub.pauses.map((p) => ({ from: p.from, to: p.to })),
    first: dates[0]!,
    last: dates.at(-1)!,
  }
}
