import type { Dependency } from '../model/common'

export interface GraphNode {
  id: string
  predecessors: readonly Dependency[]
}

export interface Edge {
  /** The other end of the edge (successor in `successors`, predecessor in `predecessors`). */
  id: string
  dep: Dependency
}

export type TopoResult = { ok: true; order: string[] } | { ok: false; cycle: string[] }

/**
 * Successor lists. Dependencies on unknown ids and on the node itself are ignored here; the
 * validator reports them.
 */
export function successorMap(nodes: readonly GraphNode[]): Map<string, Edge[]> {
  const ids = new Set(nodes.map((n) => n.id))
  const map = new Map<string, Edge[]>(nodes.map((n) => [n.id, []]))
  for (const n of nodes) {
    for (const dep of n.predecessors) {
      if (dep.activityId === n.id || !ids.has(dep.activityId)) continue
      map.get(dep.activityId)!.push({ id: n.id, dep })
    }
  }
  return map
}

/**
 * Topological order (Kahn's algorithm, stable with respect to input order). On a cycle, returns
 * one cycle in precedence order, closed: `[a, b, c, a]` means b depends on a, c on b, a on c.
 */
export function topologicalOrder(nodes: readonly GraphNode[]): TopoResult {
  const succ = successorMap(nodes)
  const indegree = new Map(nodes.map((n) => [n.id, 0]))
  for (const edges of succ.values()) {
    for (const e of edges) indegree.set(e.id, indegree.get(e.id)! + 1)
  }
  const queue = nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id)
  const order: string[] = []
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]!
    order.push(id)
    for (const e of succ.get(id)!) {
      const left = indegree.get(e.id)! - 1
      indegree.set(e.id, left)
      if (left === 0) queue.push(e.id)
    }
  }
  if (order.length === nodes.length) return { ok: true, order }
  return { ok: false, cycle: findCycle(nodes, new Set(order)) }
}

function findCycle(nodes: readonly GraphNode[], acyclic: Set<string>): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  // Every remaining node has a remaining predecessor, so walking predecessors must revisit a node.
  const start = nodes.find((n) => !acyclic.has(n.id))!
  const path: string[] = []
  const index = new Map<string, number>()
  let current = start.id
  while (!index.has(current)) {
    index.set(current, path.length)
    path.push(current)
    const next = byId
      .get(current)!
      .predecessors.find(
        (d) => d.activityId !== current && byId.has(d.activityId) && !acyclic.has(d.activityId),
      )!
    current = next.activityId
  }
  // path[k] depends on path[k+1]; reverse to precedence order and close the loop.
  const cycle = path.slice(index.get(current)!).reverse()
  return [...cycle, cycle[0]!]
}

/** All nodes reachable from `from` through successor edges, excluding the start nodes. */
export function descendants(succ: Map<string, Edge[]>, from: Iterable<string>): Set<string> {
  const start = new Set(from)
  const seen = new Set<string>()
  const stack = [...start]
  while (stack.length) {
    for (const e of succ.get(stack.pop()!) ?? []) {
      if (seen.has(e.id) || start.has(e.id)) continue
      seen.add(e.id)
      stack.push(e.id)
    }
  }
  return seen
}

/** All nodes from which `to` can be reached, excluding `to` itself. */
export function ancestors(nodes: readonly GraphNode[], to: string): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const seen = new Set<string>()
  const stack = [to]
  while (stack.length) {
    for (const d of byId.get(stack.pop()!)?.predecessors ?? []) {
      if (seen.has(d.activityId) || d.activityId === to || !byId.has(d.activityId)) continue
      seen.add(d.activityId)
      stack.push(d.activityId)
    }
  }
  return seen
}
