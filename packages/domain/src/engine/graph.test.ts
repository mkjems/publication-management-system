import { describe, expect, it } from 'vitest'
import type { Dependency } from '../model/common'
import { earliestFinish, latestFinish } from './constraints'
import { ancestors, descendants, successorMap, topologicalOrder, type GraphNode } from './graph'

const fs = (id: string): Dependency => ({ activityId: id, type: 'FS', lagWorkdays: 0 })
const node = (id: string, ...preds: string[]): GraphNode => ({
  id,
  predecessors: preds.map(fs),
})

describe('topologicalOrder', () => {
  it('orders predecessors first, stable with respect to input order', () => {
    const nodes = [node('c', 'a', 'b'), node('a'), node('b', 'a'), node('d')]
    expect(topologicalOrder(nodes)).toEqual({ ok: true, order: ['a', 'd', 'b', 'c'] })
  })

  it('names the cycle in precedence order', () => {
    const nodes = [node('root'), node('a', 'root', 'c'), node('b', 'a'), node('c', 'b')]
    const result = topologicalOrder(nodes)
    expect(result.ok).toBe(false)
    if (result.ok) return
    // a → b → c → a, starting anywhere on the loop.
    expect(result.cycle).toHaveLength(4)
    expect(result.cycle[0]).toBe(result.cycle[3])
    const pairs = result.cycle.slice(0, 3).map((x, i) => `${x}>${result.cycle[i + 1]}`)
    expect(new Set(pairs)).toEqual(new Set(['a>b', 'b>c', 'c>a']))
  })

  it('ignores self and unknown dependencies', () => {
    expect(topologicalOrder([node('a', 'a', 'ghost')])).toEqual({ ok: true, order: ['a'] })
  })
})

describe('descendants and ancestors', () => {
  const nodes = [node('a'), node('b', 'a'), node('c', 'b'), node('d'), node('e', 'c', 'd')]
  it('walks the graph both ways', () => {
    expect(descendants(successorMap(nodes), ['b'])).toEqual(new Set(['c', 'e']))
    expect(ancestors(nodes, 'e')).toEqual(new Set(['a', 'b', 'c', 'd']))
  })
})

describe('dependency rules', () => {
  const pred = { start: 10, finish: 15 }
  it('computes the earliest successor finish', () => {
    expect(earliestFinish({ activityId: 'p', type: 'FS', lagWorkdays: 2 }, pred, 3)).toBe(20)
    expect(earliestFinish({ activityId: 'p', type: 'SS', lagWorkdays: 2 }, pred, 3)).toBe(15)
    expect(earliestFinish({ activityId: 'p', type: 'FF', lagWorkdays: 2 }, pred, 3)).toBe(17)
  })

  it('computes the latest predecessor finish as the mirror image', () => {
    for (const type of ['FS', 'SS', 'FF'] as const) {
      const dep = { activityId: 'p', type, lagWorkdays: 2 }
      const ef = earliestFinish(dep, pred, 3)
      // With the successor finishing as early as possible, the predecessor's latest finish is
      // exactly its own finish.
      expect(latestFinish(dep, ef, 3, 5)).toBe(pred.finish)
    }
  })
})
