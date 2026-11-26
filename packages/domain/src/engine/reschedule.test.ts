import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { DependencyType } from '../model/common'
import type { Publication } from '../model/publication'
import { cal, day, get, milestone, patch, plan, point, task } from '../testing/fixtures'
import { earliestFinish, type Span } from './constraints'
import { descendants, successorMap } from './graph'
import { previewReschedule, type Strategy } from './reschedule'
import { plannedSpan } from './spans'

// a → b → c → d → release → post, gaps (working days): a→b 0, b→c 3, c→d 4, d→rel 8.
// "side" is unrelated.
const base = plan(
  [
    task('a', 'A', 'Redaktør', 5, -30),
    task('b', 'B', 'Forfatter', 10, -20, ['a']),
    task('c', 'C', 'Redaktør', 5, -12, ['b']),
    point('d', 'D', 'Redaktør', -8, ['c']),
    task('side', 'Side', 'Redaktør', 3, -25),
    task('post', 'Post', 'Presseansvarlig', 2, 3, ['rel']),
  ],
  [milestone('rel', 'Udgivelse', 'Forlaget', 0, ['d'], { gate: 'release' })],
)

const moves = (impact: ReturnType<typeof previewReschedule>) =>
  Object.fromEntries(impact.moved.map((m) => [m.activityId, `${m.cause} ${m.deltaWorkdays}`]))

describe('previewReschedule: absorb', () => {
  it('moves only what must move', () => {
    const impact = previewReschedule(
      base,
      { kind: 'delay', activityId: 'a', workdays: 5 },
      { strategy: 'absorb' },
    )
    expect(moves(impact)).toEqual({ a: 'change 5', b: 'pushed 5', c: 'pushed 2' })
    expect(get(impact.publication, 'c')).toMatchObject({ deadline: day(-10), start: day(-14) })
    expect(impact.release).toMatchObject({ before: day(0), after: day(0), slipWorkdays: 0 })
  })

  it('never pulls work earlier', () => {
    const impact = previewReschedule(
      base,
      { kind: 'delay', activityId: 'a', workdays: -3 },
      { strategy: 'absorb' },
    )
    expect(moves(impact)).toEqual({ a: 'change -3' })
  })

  it('pushes the release and post-release work when the buffer runs out', () => {
    const impact = previewReschedule(
      base,
      { kind: 'delay', activityId: 'b', workdays: 20 },
      { strategy: 'absorb' },
    )
    expect(impact.release).toMatchObject({ after: day(5), slipWorkdays: 5, newTarget: day(0) })
    expect(get(impact.publication, 'post').deadline).toBe(day(7))
    // The target is unchanged: the plan is now late.
    expect(impact.publication.desiredReleaseDate).toBe(base.desiredReleaseDate)
  })

  it('does not change its input', () => {
    const before = JSON.parse(JSON.stringify(base)) as Publication
    previewReschedule(base, { kind: 'delay', activityId: 'a', workdays: 30 }, { strategy: 'push' })
    expect(base).toEqual(before)
  })
})

describe('previewReschedule: push', () => {
  it('shifts everything downstream before the release by the same amount', () => {
    const impact = previewReschedule(
      base,
      { kind: 'delay', activityId: 'a', workdays: 5 },
      { strategy: 'push' },
    )
    expect(moves(impact)).toEqual({ a: 'change 5', b: 'shifted 5', c: 'shifted 5', d: 'shifted 5' })
    expect(impact.release.slipWorkdays).toBe(0)
  })
})

describe('previewReschedule: compress', () => {
  it('shortens tasks on the critical chain to protect the release', () => {
    // b ends at day(-4); c (5 days) would end at day(1). Shortening c by 1 day saves the release.
    const impact = previewReschedule(
      base,
      { kind: 'delay', activityId: 'b', workdays: 16 },
      { strategy: 'compress' },
    )
    expect(impact.compressed).toEqual([{ activityId: 'c', fromDuration: 5, toDuration: 4 }])
    expect(get(impact.publication, 'c')).toMatchObject({ start: day(-3), deadline: day(0) })
    expect(impact.release.slipWorkdays).toBe(0)
  })

  it('stops at the minimum duration and reports the remaining slip', () => {
    const impact = previewReschedule(
      base,
      { kind: 'delay', activityId: 'b', workdays: 20 },
      { strategy: 'compress' },
    )
    // c may shrink to ceil(5 × 0.5) = 3 days.
    expect(impact.compressed).toEqual([{ activityId: 'c', fromDuration: 5, toDuration: 3 }])
    expect(impact.release.slipWorkdays).toBe(3)
  })

  it('accepts explicit durations', () => {
    const impact = previewReschedule(
      base,
      { kind: 'delay', activityId: 'b', workdays: 20 },
      { strategy: 'compress', compress: { c: 1 } },
    )
    expect(impact.release.slipWorkdays).toBe(1)
  })
})

describe('previewReschedule: move release', () => {
  it('makes the pushed release date the new target', () => {
    const impact = previewReschedule(
      base,
      { kind: 'delay', activityId: 'b', workdays: 20 },
      { strategy: 'move_release' },
    )
    expect(impact.release).toMatchObject({ newTarget: day(5), after: day(5), slipWorkdays: 0 })
    expect(impact.publication.desiredReleaseDate).toBe(day(5))
    expect(impact.publication.bindingReleaseDate).toBeNull()

    const binding = { ...base, planState: 'binding' as const, bindingReleaseDate: day(0) }
    const b = previewReschedule(
      binding,
      { kind: 'delay', activityId: 'b', workdays: 20 },
      { strategy: 'move_release' },
    )
    expect(b.publication.bindingReleaseDate).toBe(day(5))
    expect(b.publication.desiredReleaseDate).toBe(base.desiredReleaseDate)
  })

  it('accepts a later explicit release date and refuses an impossible one', () => {
    const impact = previewReschedule(
      base,
      { kind: 'delay', activityId: 'b', workdays: 20 },
      { strategy: 'move_release', releaseDate: day(10) },
    )
    expect(impact.release).toMatchObject({ newTarget: day(10), after: day(10) })
    expect(get(impact.publication, 'post').deadline).toBe(day(12))
    expect(() =>
      previewReschedule(
        base,
        { kind: 'delay', activityId: 'b', workdays: 20 },
        { strategy: 'move_release', releaseDate: day(2) },
      ),
    ).toThrow('cannot reach the release')
  })
})

describe('previewReschedule: changes and constraints', () => {
  it('keeps pinned activities and reports the conflict', () => {
    const pinned = patch(base, 'c', { pinned: true })
    const impact = previewReschedule(
      pinned,
      { kind: 'delay', activityId: 'b', workdays: 10 },
      { strategy: 'absorb' },
    )
    expect(moves(impact)).toEqual({ b: 'change 10' })
    expect(impact.pinnedConflicts).toEqual([
      { activityId: 'c', pinnedDeadline: day(-12), requiredDeadline: day(-5) },
    ])
  })

  it('moves waiting work to fit after the expected date', () => {
    const impact = previewReschedule(
      base,
      { kind: 'wait', activityId: 'b', until: day(-12), text: 'Forfatteren er syg' },
      { strategy: 'absorb' },
    )
    expect(get(impact.publication, 'b')).toMatchObject({
      status: 'waiting',
      waitingFor: { text: 'Forfatteren er syg', expectedDate: day(-12) },
      start: day(-12),
      deadline: day(-3),
    })
    expect(impact.release.after).toBe(day(2))
  })

  it('resizes a task from its start', () => {
    const impact = previewReschedule(
      base,
      { kind: 'set_duration', activityId: 'b', durationWorkdays: 15 },
      { strategy: 'absorb' },
    )
    expect(get(impact.publication, 'b')).toMatchObject({
      start: get(base, 'b').start,
      deadline: day(-15),
      durationWorkdays: 15,
    })
    expect(moves(impact)).toEqual({ b: 'change 5', c: 'pushed 2' })
  })

  it('stretches a task that has started instead of moving its start', () => {
    const started = patch(base, 'b', { status: 'in_progress', actualStart: day(-27) })
    const impact = previewReschedule(
      started,
      { kind: 'delay', activityId: 'b', workdays: 5 },
      { strategy: 'absorb' },
    )
    // Planned start becomes the actual start; the duration covers actual start → new deadline.
    expect(get(impact.publication, 'b')).toMatchObject({
      start: day(-27),
      deadline: day(-15),
      durationWorkdays: 13,
    })
  })

  it('does not apply start rules to work that has already started', () => {
    const started = patch(base, 'c', { status: 'in_progress', actualStart: day(-17) })
    const impact = previewReschedule(
      started,
      { kind: 'delay', activityId: 'b', workdays: 5 },
      { strategy: 'absorb' },
    )
    expect(moves(impact)).toEqual({ b: 'change 5' })
  })

  it('refuses to reschedule finished work', () => {
    const done = patch(base, 'a', { status: 'done', actualStart: day(-34), actualFinish: day(-30) })
    expect(() =>
      previewReschedule(
        done,
        { kind: 'delay', activityId: 'a', workdays: 1 },
        { strategy: 'absorb' },
      ),
    ).toThrow('done')
  })
})

// ── Properties on random networks ──────────────────────────────────────────────

interface Draft {
  dur: number
  gap: number
  preds: { pick: number; type: DependencyType; lag: number }[]
}

const arbDraft = fc.record({
  dur: fc.integer({ min: 0, max: 8 }),
  gap: fc.integer({ min: 0, max: 5 }),
  preds: fc.array(
    fc.record({
      pick: fc.nat(),
      type: fc.constantFrom<DependencyType>('FS', 'SS', 'FF'),
      lag: fc.integer({ min: 0, max: 3 }),
    }),
    { maxLength: 3 },
  ),
})

/** A random valid network ending in a release milestone, with some work done and some pinned. */
const arbScenario = fc
  .record({
    drafts: fc.array(arbDraft, { minLength: 2, maxLength: 12 }),
    releasePreds: fc.array(fc.nat(), { minLength: 1, maxLength: 3 }),
    releaseGap: fc.integer({ min: 0, max: 10 }),
    doneCount: fc.nat(),
    pinnedMask: fc.array(fc.boolean(), { minLength: 12, maxLength: 12 }),
    changePick: fc.nat(),
    workdays: fc.integer({ min: -5, max: 25 }),
    strategy: fc.constantFrom<Strategy>('absorb', 'push', 'compress', 'move_release'),
  })
  .map((s) => ({ ...s, pub: buildRandomPlan(s.drafts, s.releasePreds, s.releaseGap) }))

function buildRandomPlan(drafts: Draft[], releasePicks: number[], releaseGap: number) {
  const spans: Span[] = []
  const deps: { id: string; type: DependencyType; lag: number }[][] = []
  drafts.forEach((d, i) => {
    const preds =
      i === 0
        ? []
        : [...new Map(d.preds.map((p) => [p.pick % i, p])).values()].map((p) => ({
            id: `n${p.pick % i}`,
            type: p.type,
            lag: p.lag,
          }))
    let finish = -400 + d.dur
    for (const p of preds) {
      const pred = spans[Number(p.id.slice(1))]!
      finish = Math.max(
        finish,
        earliestFinish({ activityId: p.id, type: p.type, lagWorkdays: p.lag }, pred, d.dur),
      )
    }
    finish += d.gap
    spans.push({ start: finish - d.dur, finish })
    deps.push(preds)
  })
  const relPreds = [...new Set(releasePicks.map((p) => `n${p % drafts.length}`))]
  const relFinish =
    Math.max(...relPreds.map((id) => spans[Number(id.slice(1))]!.finish)) + releaseGap
  const activities = drafts.map((d, i) => {
    const offset = spans[i]!.finish - relFinish
    return d.dur > 0
      ? task(`n${i}`, `N${i}`, 'Redaktør', d.dur, offset, deps[i])
      : point(`n${i}`, `N${i}`, 'Redaktør', offset, deps[i])
  })
  return plan(activities, [
    milestone('rel', 'Udgivelse', 'Forlaget', 0, relPreds, { gate: 'release' }),
  ])
}

function withProgress(pub: Publication, doneCount: number, pinnedMask: boolean[]): Publication {
  const n = pub.activities.length - 1 // excluding the release milestone (last)
  const done = doneCount % n
  return {
    ...pub,
    activities: pub.activities.map((a, i) => {
      if (i < done) return { ...a, status: 'done', actualStart: a.start, actualFinish: a.deadline }
      if (a.gate !== 'release' && pinnedMask[i]) return { ...a, pinned: true }
      return a
    }),
  }
}

describe('previewReschedule properties', () => {
  it('keeps every invariant on random networks', () => {
    fc.assert(
      fc.property(arbScenario, (s) => {
        const pub = withProgress(s.pub, s.doneCount, s.pinnedMask)
        const open = pub.activities.filter((a) => a.status !== 'done' && !a.pinned)
        fc.pre(open.length > 0)
        const target = open[s.changePick % open.length]!
        const impact = previewReschedule(
          pub,
          { kind: 'delay', activityId: target.id, workdays: s.workdays },
          { strategy: s.strategy },
        )
        const next = impact.publication
        const downstream = descendants(successorMap(pub.activities), [target.id])
        const byId = new Map(next.activities.map((a) => [a.id, a]))

        for (const before of pub.activities) {
          const after = byId.get(before.id)!
          // Done and pinned work never moves; nothing outside the change's reach moves.
          if (
            before.status === 'done' ||
            before.pinned ||
            (!downstream.has(before.id) && before.id !== target.id)
          ) {
            expect(after).toEqual(before)
          }
          // Only compression changes durations (and stretching work that has started).
          if (s.strategy !== 'compress' && before.id !== target.id && before.actualStart === null) {
            expect(after.durationWorkdays).toBe(before.durationWorkdays)
          }
          // Absorbing never pulls work earlier.
          if (s.strategy === 'absorb' && before.id !== target.id) {
            expect(after.deadline >= before.deadline).toBe(true)
          }
          // Planned dates stay consistent with the duration.
          if (after.kind === 'task') {
            expect(cal.countWorkdays(after.start!, after.deadline)).toBe(after.durationWorkdays)
          }
        }

        // Every movable downstream activity satisfies its dependencies afterwards.
        for (const id of downstream) {
          const a = byId.get(id)!
          if (a.status === 'done' || a.pinned) continue
          for (const d of a.predecessors) {
            const p = byId.get(d.activityId)!
            const span =
              p.status === 'done'
                ? {
                    start: cal.startBoundary(p.actualStart ?? p.deadline),
                    finish: cal.ordinal(p.actualFinish!),
                  }
                : plannedSpan(cal, p)
            expect(plannedSpan(cal, a).finish).toBeGreaterThanOrEqual(
              earliestFinish(d, span, a.durationWorkdays),
            )
          }
        }

        // Moving the release always ends with the release on its (new) target.
        if (s.strategy === 'move_release' && impact.release.after !== impact.release.before) {
          expect(impact.release.slipWorkdays).toBe(0)
        }
        // Compression never makes the release later than absorbing.
        if (s.strategy === 'compress') {
          const absorbed = previewReschedule(
            pub,
            { kind: 'delay', activityId: target.id, workdays: s.workdays },
            { strategy: 'absorb' },
          )
          expect(impact.release.slipWorkdays!).toBeLessThanOrEqual(absorbed.release.slipWorkdays!)
        }
      }),
      { numRuns: 300 },
    )
  })
})
