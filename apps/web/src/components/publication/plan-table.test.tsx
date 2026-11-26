import 'fake-indexeddb/auto'
import { generatePlan, MASTERPLAN_V1, assessHealth, setStatus } from '@pms/domain'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { describeEvent, groupActivities } from '@/lib/publication'
import { useWorkspace } from '@/store'
import { PlanTable } from './plan-table'

const { publication } = generatePlan({
  id: 'pub-test',
  workingTitle: 'Testbog',
  template: MASTERPLAN_V1,
  desiredReleaseDate: '2027-10-15',
})

beforeAll(async () => {
  await useWorkspace.getState().load('real')
  await useWorkspace.getState().importSnapshot({
    format: 'pms-workspace',
    version: 1,
    exportedAt: '2026-11-26T12:00:00.000Z',
    workspace: 'real',
    simulatedDate: null,
    people: [],
    publications: [{ publication, history: { log: [], undoable: [], redoable: [] } }],
  })
})

function renderTable() {
  const pub = useWorkspace.getState().records['pub-test']!.publication
  const groups = groupActivities(pub).slice(0, 1)
  return render(
    <PlanTable
      publication={pub}
      health={assessHealth(pub, '2026-11-26')}
      groups={groups}
      isOpen={() => true}
      onToggle={() => {}}
      onOpenActivity={() => {}}
      onMove={() => {}}
    />,
  )
}

describe('PlanTable', () => {
  it('renders the phase with its activities in the PDF columns', () => {
    renderTable()
    expect(screen.getByText('Startmøde')).toBeInTheDocument()
    expect(screen.getByText('Startmøde indkaldes og gennemføres')).toBeInTheDocument()
    for (const col of [
      'Aktivitet',
      'Ansvarlig',
      'Start',
      'Oprindelig deadline',
      'Aktuel deadline',
      'Status',
      'Bemærkning',
    ]) {
      expect(screen.getByRole('columnheader', { name: col })).toBeInTheDocument()
    }
  })

  it('changes status through the store, as a logged command', () => {
    renderTable()
    const select = screen.getByRole('combobox', {
      name: 'Status: Startmøde indkaldes og gennemføres',
    })
    expect(within(select).queryByRole('option', { name: 'Fravalgt' })).toBeNull()
    fireEvent.change(select, { target: { value: 'in_progress' } })
    const record = useWorkspace.getState().records['pub-test']!
    expect(record.publication.activities[0]!.status).toBe('in_progress')
    expect(describeEvent(record.history.log[0]!, record.publication)).toBe(
      'Startmøde indkaldes og gennemføres: Ikke startet → I gang',
    )
  })

  it('edits notes on blur', () => {
    renderTable()
    const note = screen.getByRole('textbox', {
      name: 'Bemærkning: Startmøde indkaldes og gennemføres',
    })
    fireEvent.change(note, { target: { value: 'Mødelokale booket' } })
    fireEvent.blur(note)
    expect(useWorkspace.getState().records['pub-test']!.publication.activities[0]!.note).toBe(
      'Mødelokale booket',
    )
  })
})

describe('describeEvent', () => {
  it('describes a status change from the domain command', () => {
    const r = setStatus(publication, 'm-go', 'done', {
      asOf: '2026-12-01',
      recordedAt: '2026-11-26T12:00:00.000Z',
      by: null,
      newId: () => 'x' + Math.random(),
    })
    expect(describeEvent(r.events[0]!, r.publication)).toBe(
      'GO / HOLD / NO-GO: Ikke startet → Færdig',
    )
  })
})
