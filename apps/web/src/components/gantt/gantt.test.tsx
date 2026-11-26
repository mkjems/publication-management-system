import {
  DEFAULT_CALENDAR,
  MASTERPLAN_V1,
  addDays,
  assessHealth,
  generatePlan,
  getCalendar,
  type ScheduleChange,
} from '@pms/domain'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { groupActivities } from '@/lib/publication'
import { Gantt, type GanttProps } from './gantt'
import { PX_PER_DAY } from './scale'

const AS_OF = '2026-11-26'
const { publication } = generatePlan({
  id: 'p',
  workingTitle: 'Bog',
  template: MASTERPLAN_V1,
  desiredReleaseDate: '2027-10-15',
})
const health = assessHealth(publication, AS_OF)
const groups = groupActivities(publication).slice(0, 1) // Phase 1 only

function setup(overrides: Partial<GanttProps> = {}) {
  const props: GanttProps = {
    publication,
    health,
    asOf: AS_OF,
    groups,
    isOpen: () => true,
    onToggle: vi.fn(),
    zoom: 'week',
    showCritical: false,
    showAllDependencies: false,
    selectedId: null,
    onOpenActivity: vi.fn(),
    onRequestChange: vi.fn(),
    onAddDependency: vi.fn(),
    ...overrides,
  }
  render(<Gantt {...props} />)
  return props
}

const kickoff = publication.activities.find((a) => a.id === 'kickoff-meeting')!
const cal = getCalendar(DEFAULT_CALENDAR)
const bar = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}, deadline`) })

describe('Gantt', () => {
  it('renders phase and activity rows with bars', () => {
    setup()
    expect(screen.getByRole('button', { name: /Startmøde/, expanded: true })).toBeInTheDocument()
    expect(bar('Startmøde indkaldes og gennemføres')).toBeInTheDocument()
    expect(bar('GO / HOLD / NO-GO')).toBeInTheDocument()
  })

  it('opens the side panel on click without dragging', () => {
    const props = setup()
    const el = bar('Startmøde indkaldes og gennemføres')
    fireEvent.pointerDown(el, { button: 0, clientX: 100 })
    fireEvent.pointerUp(window, { clientX: 100 })
    expect(props.onOpenActivity).toHaveBeenCalledWith('kickoff-meeting')
    expect(props.onRequestChange).not.toHaveBeenCalled()
  })

  it('nudges with the keyboard, previews the impact and asks on Enter', () => {
    const props = setup()
    const el = bar('Startmøde indkaldes og gennemføres')
    el.focus()
    fireEvent.keyDown(el, { key: 'ArrowRight', shiftKey: true })
    // Ghosts show where the activity and everything downstream would go.
    expect(screen.getAllByTestId('preview-ghost').length).toBeGreaterThan(1)
    fireEvent.keyDown(el, { key: 'ArrowRight' })
    fireEvent.keyDown(el, { key: 'Enter' })
    const change = vi.mocked(props.onRequestChange).mock.calls[0]![0] as ScheduleChange
    expect(change).toMatchObject({ kind: 'set_deadline', activityId: 'kickoff-meeting' })
    // Shift+→ is a week (5 working days), → one more.
    expect(change.kind === 'set_deadline' && change.deadline).toBe(
      cal.addWorkdays(kickoff.deadline, 6),
    )
  })

  it('cancels a keyboard nudge with Escape', () => {
    setup()
    const el = bar('Startmøde indkaldes og gennemføres')
    fireEvent.keyDown(el, { key: 'ArrowRight' })
    fireEvent.keyDown(el, { key: 'Escape' })
    expect(screen.queryAllByTestId('preview-ghost')).toHaveLength(0)
  })

  it('drags a bar to a new deadline, snapped to a working day', () => {
    const props = setup()
    const el = bar('Startmøde indkaldes og gennemføres')
    fireEvent.pointerDown(el, { button: 0, clientX: 100 })
    // Drag far enough to land on a weekend: it snaps forward to the Monday.
    const toSaturday = 6 - Number(new Date(`${kickoff.deadline}T00:00:00Z`).getUTCDay())
    expect(cal.isWorkingDay(addDays(kickoff.deadline, toSaturday))).toBe(false)
    fireEvent.pointerMove(window, { clientX: 100 + toSaturday * PX_PER_DAY.week })
    expect(screen.getAllByTestId('preview-ghost').length).toBeGreaterThan(0)
    fireEvent.pointerUp(window, { clientX: 100 + toSaturday * PX_PER_DAY.week })
    expect(props.onRequestChange).toHaveBeenCalledWith({
      kind: 'set_deadline',
      activityId: 'kickoff-meeting',
      deadline: cal.nextWorkingDay(addDays(kickoff.deadline, toSaturday)),
    })
  })

  it('resizes a task from its right edge', () => {
    const props = setup()
    const handle = bar('Startmøde indkaldes og gennemføres').querySelector('span')!
    fireEvent.pointerDown(handle, { button: 0, clientX: 200 })
    fireEvent.pointerMove(window, { clientX: 200 + 7 * PX_PER_DAY.week })
    fireEvent.pointerUp(window, { clientX: 200 + 7 * PX_PER_DAY.week })
    expect(props.onRequestChange).toHaveBeenCalledWith({
      kind: 'set_duration',
      activityId: 'kickoff-meeting',
      durationWorkdays: kickoff.durationWorkdays + 5,
    })
  })

  it('creates a dependency by dragging from the link handle onto another activity', () => {
    const props = setup()
    const row = bar('Kort projektbeskrivelse udarbejdes').parentElement!
    const handle = row.querySelector<HTMLElement>('[title^="Træk til en anden"]')!
    const target = bar('Foreløbig udgivelsesøkonomi udarbejdes')
    document.elementFromPoint = vi.fn(() => target)
    fireEvent.pointerDown(handle, { button: 0, clientX: 300 })
    fireEvent.pointerMove(window, { clientX: 340, clientY: 80 })
    fireEvent.pointerUp(window, { clientX: 340, clientY: 80 })
    expect(props.onAddDependency).toHaveBeenCalledWith('project-description', 'preliminary-economy')
  })

  it('does not let finished work be dragged', () => {
    const done = {
      ...publication,
      activities: publication.activities.map((a) =>
        a.id === 'kickoff-meeting'
          ? { ...a, status: 'done' as const, actualStart: a.start, actualFinish: a.deadline }
          : a,
      ),
    }
    const props = setup({
      publication: done,
      health: assessHealth(done, AS_OF),
      groups: groupActivities(done).slice(0, 1),
    })
    const el = bar('Startmøde indkaldes og gennemføres')
    fireEvent.pointerDown(el, { button: 0, clientX: 100 })
    fireEvent.pointerMove(window, { clientX: 300 })
    fireEvent.pointerUp(window, { clientX: 300 })
    fireEvent.keyDown(el, { key: 'ArrowRight' })
    expect(screen.queryAllByTestId('preview-ghost')).toHaveLength(0)
    expect(props.onRequestChange).not.toHaveBeenCalled()
  })
})
