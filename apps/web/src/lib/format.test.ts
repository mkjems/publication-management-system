import { describe, expect, it } from 'vitest'
import { formatDependencyType, formatDuration, formatOffset } from './format'

describe('formatDuration', () => {
  it('uses days below a week and weeks above', () => {
    expect(formatDuration(0)).toBe('–')
    expect(formatDuration(1)).toBe('1 dag')
    expect(formatDuration(3)).toBe('3 dage')
    expect(formatDuration(5)).toBe('1 uge')
    expect(formatDuration(22)).toBe('4,4 uger')
  })
})

describe('formatOffset', () => {
  it('describes offsets relative to release', () => {
    expect(formatOffset(0)).toBe('Udgivelsesdag')
    expect(formatOffset(-3)).toBe('3 dage før')
    expect(formatOffset(-190)).toBe('38 uger før')
    expect(formatOffset(-137)).toBe('27,4 uger før')
    expect(formatOffset(10)).toBe('2 uger efter')
  })
})

describe('formatDependencyType', () => {
  it('hides the default and shows type and lag otherwise', () => {
    expect(formatDependencyType({ activityId: 'a', type: 'FS', lagWorkdays: 0 })).toBe('')
    expect(formatDependencyType({ activityId: 'a', type: 'SS', lagWorkdays: 5 })).toBe('SS +5')
    expect(formatDependencyType({ activityId: 'a', type: 'FS', lagWorkdays: 1 })).toBe('FS +1')
    expect(formatDependencyType({ activityId: 'a', type: 'FF', lagWorkdays: 0 })).toBe('FF')
  })
})
