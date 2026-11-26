import { describe, expect, it } from 'vitest'
import type { Template } from '../model/template'
import { buildTemplate, milestone, parseResponsibility, phase, task, track } from './builder'
import { validateTemplate } from './validate'

function makeTemplate(
  activities: Parameters<typeof track>[2],
  milestones = [] as Parameters<typeof phase>[2],
): Template {
  return buildTemplate({ id: 't', version: 1, name: 'Test', nominalKickoffOffset: -100 }, [
    phase(
      { id: 'p1', number: 1, name: 'P', period: '', window: [-100, 0], anchor: 'release' },
      [track('t1', 'T', activities)],
      milestones,
    ),
  ])
}

describe('validateTemplate', () => {
  it('accepts a consistent chain', () => {
    const t = makeTemplate([
      task('a', 'A', 'Redaktør', 5, -50),
      task('b', 'B', 'Redaktør', 5, -40, ['a']),
    ])
    expect(validateTemplate(t)).toEqual([])
  })

  it('reports an FS violation with the shortfall', () => {
    const t = makeTemplate([
      task('a', 'A', 'Redaktør', 5, -50),
      task('b', 'B', 'Redaktør', 5, -48, ['a']),
    ])
    const issues = validateTemplate(t)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ code: 'dependency-violated', activityId: 'b' })
    expect(issues[0]!.message).toContain('short by 3')
  })

  it('checks SS and FF dependencies', () => {
    const ok = makeTemplate([
      task('a', 'A', 'Redaktør', 10, -50),
      task('b', 'B', 'Redaktør', 5, -52, [{ id: 'a', type: 'SS', lag: 3 }]),
      task('c', 'C', 'Redaktør', 2, -50, [{ id: 'a', type: 'FF' }]),
    ])
    expect(validateTemplate(ok)).toEqual([])
    const bad = makeTemplate([
      task('a', 'A', 'Redaktør', 10, -50),
      task('b', 'B', 'Redaktør', 5, -55, [{ id: 'a', type: 'SS', lag: 3 }]),
      task('c', 'C', 'Redaktør', 2, -51, [{ id: 'a', type: 'FF' }]),
    ])
    expect(validateTemplate(bad).map((i) => i.activityId)).toEqual(['b', 'c'])
  })

  it('detects cycles and unknown predecessors', () => {
    const t = makeTemplate([
      task('root', 'R', 'Redaktør', 1, -90),
      task('a', 'A', 'Redaktør', 1, -50, ['root', 'b']),
      task('b', 'B', 'Redaktør', 1, -40, ['a', 'ghost']),
    ])
    const codes = validateTemplate(t).map((i) => i.code)
    expect(codes).toContain('cycle')
    expect(codes).toContain('unknown-predecessor')
  })

  it('detects duplicate ids', () => {
    const t = makeTemplate([
      task('a', 'A', 'Redaktør', 1, -50),
      task('a', 'A2', 'Redaktør', 1, -40, ['a']),
    ])
    expect(validateTemplate(t).map((i) => i.code)).toContain('duplicate-id')
  })

  it('warns about milestones outside their phase window', () => {
    const t = makeTemplate(
      [task('a', 'A', 'Redaktør', 1, -50)],
      [milestone('m', 'M', 'Forlaget', 20, ['a'])],
    )
    expect(validateTemplate(t)).toEqual([
      expect.objectContaining({
        severity: 'warning',
        code: 'milestone-outside-window',
        activityId: 'm',
      }),
    ])
  })
})

describe('parseResponsibility', () => {
  it('parses joint, either and mixed responsibilities', () => {
    expect(parseResponsibility('Redaktør + grafiker')).toEqual({
      roles: ['editor', 'designer'],
      mode: 'joint',
      label: 'Redaktør + grafiker',
    })
    expect(parseResponsibility('Redaktør/forfatter').mode).toBe('either')
    expect(parseResponsibility('Salgs-/projektansvarlig').roles).toEqual(['sales', 'project-lead'])
    expect(parseResponsibility('Presse/kommunikationsansvarlig').roles).toEqual([
      'press',
      'communications',
    ])
    expect(parseResponsibility('Redaktør + grafiker/projektansvarlig')).toMatchObject({
      roles: ['editor', 'designer', 'project-lead'],
      mode: 'joint',
    })
  })

  it('rejects unknown roles', () => {
    expect(() => parseResponsibility('Bager')).toThrow('Unknown role')
  })
})
