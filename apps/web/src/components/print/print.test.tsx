import {
  MASTERPLAN_V1,
  assessHealth,
  generatePlan,
  makeBinding,
  setStatus,
  type CommandContext,
  type Publication,
} from '@pms/domain'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { printBar, printScale } from './layout'
import { PrintPlan } from './print-plan'

const ASOF = '2026-12-15'
const ctx: CommandContext = {
  asOf: ASOF,
  recordedAt: '2026-12-15T09:00:00.000Z',
  by: null,
  newId: (() => {
    let n = 0
    return () => `id-${++n}`
  })(),
}

function book(): Publication {
  let pub = generatePlan({
    id: 'p',
    workingTitle: 'Havens historie',
    template: MASTERPLAN_V1,
    desiredReleaseDate: '2027-11-05',
    kickoffDate: '2026-12-01',
  }).publication
  pub = makeBinding(pub, ctx).publication
  pub = setStatus(pub, 'kickoff-meeting', 'done', ctx, { on: '2026-12-10' }).publication
  return pub
}

describe('print layout', () => {
  it('places bars in percent of the chart, done work at its actual dates', () => {
    const pub = book()
    const health = assessHealth(pub, ASOF)
    const scale = printScale(pub, health, ASOF)
    const kickoff = pub.activities.find((a) => a.id === 'kickoff-meeting')!
    const bar = printBar(pub, kickoff, health, scale)
    expect(bar.state).toBe('done')
    expect(bar.left).toBeGreaterThanOrEqual(0)
    expect(bar.left + bar.width).toBeLessThanOrEqual(100)
    // Drawn to the actual finish, not the planned deadline.
    expect(bar.left + bar.width).toBeCloseTo(scale.pct('2026-12-10') + scale.day, 5)
    // It differs from the original plan, so the baseline is shown under it.
    expect(bar.baseline).not.toBeNull()
    const labelled = scale.months.filter((m) => m.label !== null)
    expect(labelled[0]!.year).toBe('2026')
    expect(scale.months.every((m) => m.label !== null || m.width < 2.5)).toBe(true)
  })
})

describe('PrintPlan', () => {
  function renderPlan(parts = { gantt: true, table: true }) {
    const pub = book()
    return render(
      <PrintPlan
        publication={pub}
        health={assessHealth(pub, ASOF)}
        template={MASTERPLAN_V1}
        asOf={ASOF}
        simulated
        projectLead="Karen Vest"
        parts={parts}
      />,
    )
  }

  it('prints the key dates and the table in the master plan columns', () => {
    renderPlan()
    expect(screen.getByRole('heading', { name: 'Havens historie' })).toBeInTheDocument()
    expect(screen.getByText('Karen Vest')).toBeInTheDocument()
    expect(screen.getByText(/simuleret dato/)).toBeInTheDocument()
    const table = screen.getByRole('table')
    for (const col of [
      'Aktivitet',
      'Ansvarlig',
      'Start',
      'Oprindelig deadline',
      'Aktuel deadline',
      'Status',
      'Bemærkning / afhængighed',
    ]) {
      expect(within(table).getByRole('columnheader', { name: col })).toBeInTheDocument()
    }
    expect(within(table).getByText('Milepæl: GO / HOLD / NO-GO')).toBeInTheDocument()
    expect(within(table).getAllByText(/^Efter:/).length).toBeGreaterThan(50)
  })

  it('prints only the chosen parts', () => {
    renderPlan({ gantt: true, table: false })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getAllByText('Startmøde indkaldes og gennemføres').length).toBeGreaterThan(0)
  })
})
