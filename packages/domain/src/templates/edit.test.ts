import { describe, expect, it } from 'vitest'
import type { Template } from '../model/template'
import { buildTemplate, milestone, parseResponsibility, phase, task, track } from './builder'
import {
  TemplateEditError,
  addTemplateActivity,
  addTemplateDependency,
  addTemplateTrack,
  changeTemplateActivityKind,
  moveTemplateActivity,
  moveTemplateActivityToTrack,
  moveTemplateTrack,
  removeTemplateActivity,
  removeTemplateDependency,
  removeTemplateTrack,
  rescheduleTemplateActivity,
  updateTemplateActivity,
  updateTemplateDependency,
  updateTemplatePhase,
} from './edit'
import { MASTERPLAN_V1 } from './masterplan-v1'
import { validateTemplate } from './validate'

/**
 *   a(5, -50) → b(5, -40) → c(5, -30) → release(0)
 *   x(3, -45)                     (second track)
 */
function chain(): Template {
  return buildTemplate({ id: 't', version: 1, name: 'Test', nominalKickoffOffset: -100 }, [
    phase(
      { id: 'p1', number: 1, name: 'P', period: '', window: [-100, 0], anchor: 'release' },
      [
        track('t1', 'T1', [
          task('a', 'A', 'Redaktør', 5, -50),
          task('b', 'B', 'Redaktør', 5, -40, ['a']),
          task('c', 'C', 'Redaktør', 5, -30, ['b']),
        ]),
        track('t2', 'T2', [task('x', 'X', 'Grafiker', 3, -45, ['a'])]),
      ],
      [milestone('rel', 'Udgivelse', 'Forlaget', 0, ['c', 'x'], { gate: 'release' })],
    ),
  ])
}

const deadline = (t: Template, id: string) => t.activities.find((a) => a.id === id)!.deadlineOffset
const errors = (t: Template) => validateTemplate(t).filter((i) => i.severity === 'error')
const ids = (t: Template, trackId: string) =>
  t.activities.filter((a) => a.trackId === trackId).map((a) => a.id)

describe('rescheduleTemplateActivity', () => {
  it('pushes successors later only as far as needed', () => {
    const { template, moved } = rescheduleTemplateActivity(chain(), 'a', { deadlineOffset: -42 })
    // b must start after -42: deadline ≥ -37; c follows b: ≥ -32 is already satisfied (-30).
    // x (3 days) also follows a: ≥ -39.
    expect(deadline(template, 'b')).toBe(-37)
    expect(deadline(template, 'c')).toBe(-30)
    expect(moved).toEqual([
      { id: 'b', from: -40, to: -37 },
      { id: 'x', from: -45, to: -39 },
    ])
    expect(errors(template)).toEqual([])
  })

  it('pulls predecessors earlier when a task gets longer', () => {
    // b keeps its deadline (-40) and now starts at -52, so a must finish by -52.
    const { template, moved } = rescheduleTemplateActivity(chain(), 'b', { durationWorkdays: 12 })
    expect(deadline(template, 'a')).toBe(-52)
    expect(moved.map((m) => m.id)).toEqual(['a'])
    expect(errors(template)).toEqual([])
  })

  it('never moves the release; the validator reports what is left', () => {
    const { template } = rescheduleTemplateActivity(chain(), 'c', { deadlineOffset: 5 })
    expect(deadline(template, 'rel')).toBe(0)
    expect(errors(template).map((i) => i.code)).toEqual(['dependency-violated'])
  })

  it('keeps the release on day 0', () => {
    expect(() => rescheduleTemplateActivity(chain(), 'rel', { deadlineOffset: 5 })).toThrow(
      TemplateEditError,
    )
  })

  it('rejects invalid durations', () => {
    expect(() => rescheduleTemplateActivity(chain(), 'a', { durationWorkdays: 0 })).toThrow(
      'at least 1',
    )
    expect(() => rescheduleTemplateActivity(chain(), 'a', { durationWorkdays: 2.5 })).toThrow()
  })

  it('keeps the master plan valid when a long task gets longer', () => {
    const { template, moved } = rescheduleTemplateActivity(MASTERPLAN_V1, 'image-research', {
      durationWorkdays: 40,
    })
    expect(moved.length).toBeGreaterThan(0)
    expect(errors(template)).toEqual([])
  })
})

describe('dependencies', () => {
  it('adds a dependency and moves the successor so it holds', () => {
    // x (-45) must now also follow b (-40): x ≥ -37.
    const { template } = addTemplateDependency(chain(), 'x', {
      activityId: 'b',
      type: 'FS',
      lagWorkdays: 0,
    })
    expect(deadline(template, 'x')).toBe(-37)
    expect(errors(template)).toEqual([])
  })

  it('refuses cycles, duplicates and self-dependencies', () => {
    const dep = (activityId: string) => ({ activityId, type: 'FS' as const, lagWorkdays: 0 })
    expect(() => addTemplateDependency(chain(), 'a', dep('c'))).toThrow('cycle')
    expect(() => addTemplateDependency(chain(), 'b', dep('a'))).toThrow('already exists')
    expect(() => addTemplateDependency(chain(), 'a', dep('a'))).toThrow('itself')
  })

  it('changes the type and lag of a dependency', () => {
    const { template } = updateTemplateDependency(chain(), 'b', 'a', { lagWorkdays: 10 })
    expect(template.activities.find((a) => a.id === 'b')!.predecessors[0]).toEqual({
      activityId: 'a',
      type: 'FS',
      lagWorkdays: 10,
    })
    expect(deadline(template, 'b')).toBe(-35)
    expect(errors(template)).toEqual([])
  })

  it('removes a dependency without moving anything', () => {
    const t = removeTemplateDependency(chain(), 'b', 'a')
    expect(t.activities.find((a) => a.id === 'b')!.predecessors).toEqual([])
    expect(deadline(t, 'b')).toBe(-40)
  })
})

describe('activities and tracks', () => {
  it('adds an activity at the end of a track, after the last one', () => {
    const t = addTemplateActivity(chain(), {
      id: 'd',
      place: { trackId: 't1' },
      name: 'D',
      kind: 'task',
      responsible: parseResponsibility('Grafiker'),
      durationWorkdays: 4,
    })
    expect(ids(t, 't1')).toEqual(['a', 'b', 'c', 'd'])
    expect(t.activities.find((a) => a.id === 'd')).toMatchObject({
      deadlineOffset: -26,
      predecessors: [{ activityId: 'c', type: 'FS', lagWorkdays: 0 }],
    })
    expect(errors(t)).toEqual([])
  })

  it('adds a milestone to a phase', () => {
    const t = addTemplateActivity(chain(), {
      id: 'm',
      place: { milestoneOf: 'p1' },
      name: 'M',
      kind: 'milestone',
      responsible: parseResponsibility('Forlaget'),
    })
    expect(t.activities.find((a) => a.id === 'm')).toMatchObject({
      trackId: null,
      kind: 'milestone',
    })
    expect(() =>
      addTemplateActivity(chain(), {
        id: 'm2',
        place: { trackId: 't1' },
        name: 'M',
        kind: 'milestone',
        responsible: parseResponsibility('Forlaget'),
      }),
    ).toThrow(TemplateEditError)
  })

  it('refuses ids that are taken', () => {
    expect(() => addTemplateTrack(chain(), { id: 'a', phaseId: 'p1', name: 'Dup' })).toThrow(
      'already used',
    )
  })

  it('removes an activity and the dependencies on it, but never a gate', () => {
    const t = removeTemplateActivity(chain(), 'b')
    expect(t.activities.find((a) => a.id === 'c')!.predecessors).toEqual([])
    expect(() => removeTemplateActivity(chain(), 'rel')).toThrow('Gate')
  })

  it('removes a track with its activities', () => {
    const t = removeTemplateTrack(chain(), 't2')
    expect(t.tracks.map((tr) => tr.id)).toEqual(['t1'])
    expect(t.activities.some((a) => a.id === 'x')).toBe(false)
    expect(t.activities.find((a) => a.id === 'rel')!.predecessors.map((d) => d.activityId)).toEqual(
      ['c'],
    )
  })

  it('reorders activities within their track and tracks within their phase', () => {
    expect(ids(moveTemplateActivity(chain(), 'b', -1), 't1')).toEqual(['b', 'a', 'c'])
    expect(ids(moveTemplateActivity(chain(), 'a', -1), 't1')).toEqual(['a', 'b', 'c'])
    expect(moveTemplateTrack(chain(), 't2', -1).tracks.map((tr) => tr.id)).toEqual(['t2', 't1'])
  })

  it('moves an activity to another track', () => {
    const t = moveTemplateActivityToTrack(chain(), 'a', 't2')
    expect(ids(t, 't2')).toEqual(['x', 'a'])
    expect(ids(t, 't1')).toEqual(['b', 'c'])
  })

  it('switches between task and deadline', () => {
    const asPoint = changeTemplateActivityKind(chain(), 'b', 'deadline').template
    expect(asPoint.activities.find((a) => a.id === 'b')).toMatchObject({
      kind: 'deadline',
      durationWorkdays: 0,
      deadlineOffset: -40,
    })
    expect(() => changeTemplateActivityKind(chain(), 'rel', 'task')).toThrow('milestone')
  })

  it('keeps the compressible flag only where it means something', () => {
    const fixed = updateTemplateActivity(chain(), 'a', { compressible: false })
    expect(fixed.activities.find((a) => a.id === 'a')!.compressible).toBe(false)
    const back = updateTemplateActivity(fixed, 'a', { compressible: true })
    expect('compressible' in back.activities.find((a) => a.id === 'a')!).toBe(false)
  })

  it('validates phase windows', () => {
    expect(() =>
      updateTemplatePhase(chain(), 'p1', { window: { startOffset: 0, endOffset: -10 } }),
    ).toThrow('end before')
  })
})
