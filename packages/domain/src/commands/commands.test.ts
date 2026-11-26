import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { ChangeEventSchema } from '../model/events'
import { PublicationSchema, type Publication } from '../model/publication'
import type { Strategy } from '../engine/reschedule'
import { ctx, day, get, milestone, patch, plan, point, task } from '../testing/fixtures'
import {
  addDependency,
  changeReleaseDate,
  makeBinding,
  pause,
  removeDependency,
  reschedule,
  resume,
  setPinned,
  setStatus,
  updateActivity,
} from './commands'
import { DiffConflictError, applyDiff, diffPublication, invertDiff } from './diff'
import { emptyHistory, record, redo, undo, type History } from './history'

const base = plan(
  [
    task('a', 'Skrivning', 'Forfatter', 5, -30),
    task('b', 'Redaktion', 'Redaktør', 10, -20, ['a']),
    task('c', 'Layout', 'Grafiker', 5, -12, ['b']),
    point('d', 'Tryk', 'Trykker', -8, ['c']),
    task('side', 'Presse', 'Presseansvarlig', 3, -25),
    task('opt', 'Register', 'Registerredaktør', 2, -15, ['b'], { optional: true }),
    task('post', 'Lancering', 'Presseansvarlig', 2, 3, ['rel']),
  ],
  [
    milestone('m-go', 'GO', 'Forlaget', -35, [], { gate: 'go_hold_nogo' }),
    milestone('m-funding', 'Finansiering', 'Forlaget', -31, ['m-go'], { gate: 'funding_secured' }),
    milestone('rel', 'Udgivelse', 'Forlaget', 0, ['d'], { gate: 'release' }),
  ],
)

const binding = (p: Publication) =>
  makeBinding(p, ctx(day(-40)), { reason: 'Fondsmidler' }).publication

describe('reschedule command', () => {
  it('records one event with a diff, and undo/redo restore exactly', () => {
    const c = ctx(day(-40))
    const r = reschedule(
      base,
      { kind: 'delay', activityId: 'a', workdays: 5 },
      { strategy: 'absorb' },
      c,
      {
        reason: 'Forfatteren er forsinket',
        reasonCategory: 'author',
      },
    )
    expect(r.events).toHaveLength(1)
    const e = r.events[0]!
    expect(() => ChangeEventSchema.parse(e)).not.toThrow()
    expect(e).toMatchObject({
      type: 'activity_rescheduled',
      effectiveDate: day(-40),
      by: 'tester',
      reasonCategory: 'author',
      payload: { activityId: 'a', strategy: 'absorb' },
    })
    // "opt" (Register) also hangs off b.
    expect(e.diff.activities.map((o) => (o.op === 'update' ? o.id : o.op))).toEqual([
      'a',
      'b',
      'c',
      'opt',
    ])

    const h = record(emptyHistory, r.events)
    const u = undo(r.publication, h, c)
    expect(u.publication).toEqual(base)
    expect(u.events[0]!.type).toBe('undone')
    expect(u.history.redoable).toEqual([e.txId])
    const rr = redo(u.publication, u.history, c)
    expect(rr.publication).toEqual(r.publication)
    expect(rr.history.log.map((x) => x.type)).toEqual(['activity_rescheduled', 'undone', 'redone'])
  })

  it('needs a reason to move a binding release, and re-baselines without touching baseline 0', () => {
    const p = binding(base)
    const change = { kind: 'delay', activityId: 'b', workdays: 20 } as const
    expect(() => reschedule(p, change, { strategy: 'move_release' }, ctx(day(-30)))).toThrow(
      'reason',
    )

    const r = reschedule(p, change, { strategy: 'move_release' }, ctx(day(-30)), {
      reason: 'Forfatteren er syg',
      reasonCategory: 'author',
    })
    expect(r.events.map((e) => e.type)).toEqual([
      'activity_rescheduled',
      'release_date_changed',
      'rebaselined',
    ])
    expect(r.publication.bindingReleaseDate).toBe(day(5))
    expect(r.publication.baselines.map((b) => [b.number, b.releaseDate])).toEqual([
      [0, day(0)],
      [1, day(5)],
    ])
    expect(r.publication.baselines[0]).toEqual(p.baselines[0])
  })

  it('refuses pinned conflicts unless accepted', () => {
    const p = patch(base, 'c', { pinned: true })
    const change = { kind: 'delay', activityId: 'b', workdays: 10 } as const
    expect(() => reschedule(p, change, { strategy: 'absorb' }, ctx(day(-40)))).toThrow('Pinned')
    const r = reschedule(p, change, { strategy: 'absorb' }, ctx(day(-40)), {
      acceptConflicts: true,
    })
    expect(get(r.publication, 'c').deadline).toBe(get(p, 'c').deadline)
  })
})

describe('setStatus', () => {
  it('records actual dates', () => {
    const started = setStatus(base, 'a', 'in_progress', ctx(day(-33))).publication
    expect(get(started, 'a')).toMatchObject({ status: 'in_progress', actualStart: day(-33) })
    const done = setStatus(started, 'a', 'done', ctx(day(-29))).publication
    expect(get(done, 'a')).toMatchObject({ actualStart: day(-33), actualFinish: day(-29) })
    expect(() => PublicationSchema.parse(done)).not.toThrow()
    expect(() => setStatus(started, 'a', 'done', ctx(day(-29)), { on: day(-34) })).toThrow(
      'before it started',
    )
  })

  it('validates waiting and skipped, and ignores no-op changes', () => {
    expect(() => setStatus(base, 'b', 'waiting', ctx(day(-40)))).toThrow('waitingFor')
    const w = setStatus(base, 'b', 'waiting', ctx(day(-40)), {
      waitingFor: { text: 'Billeder fra arkivet', expectedDate: null },
    })
    expect(get(w.publication, 'b').waitingFor?.text).toBe('Billeder fra arkivet')
    expect(() => setStatus(base, 'b', 'skipped', ctx(day(-40)))).toThrow('optional')
    expect(get(setStatus(base, 'opt', 'skipped', ctx(day(-40))).publication, 'opt').status).toBe(
      'skipped',
    )
    expect(setStatus(base, 'a', 'not_started', ctx(day(-40))).events).toEqual([])
  })

  it('applies gate effects in the same transaction', () => {
    const go = setStatus(base, 'm-go', 'done', ctx(day(-35)))
    expect(go.publication.lifecycle).toBe('go')
    expect(go.events[0]!.payload.lifecycle).toEqual({ from: 'idea', to: 'go' })

    const funded = setStatus(go.publication, 'm-funding', 'done', ctx(day(-31)))
    expect(funded.events.map((e) => e.type)).toEqual(['status_changed', 'plan_made_binding'])
    expect(new Set(funded.events.map((e) => e.txId)).size).toBe(1)
    const p = funded.publication
    expect(p).toMatchObject({ planState: 'binding', bindingReleaseDate: day(0) })
    expect(p.baselines).toHaveLength(1)
    expect(p.baselines[0]).toMatchObject({ number: 0, capturedOn: day(-31), releaseDate: day(0) })
    expect(p.baselines[0]!.activities.b).toEqual({ start: get(p, 'b').start, deadline: day(-20) })

    // Undo takes both back.
    const u = undo(p, record(emptyHistory, funded.events), ctx(day(-31)))
    expect(u.publication).toEqual(go.publication)

    expect(() => makeBinding(p, ctx(day(-30)))).toThrow('already binding')
  })

  it('marks the book released when the release milestone is done', () => {
    const p = { ...base, lifecycle: 'active' as const }
    expect(setStatus(p, 'rel', 'done', ctx(day(0))).publication.lifecycle).toBe('released')
  })
})

describe('pause and resume', () => {
  const paused = pause(base, ctx(day(-25)), {
    reason: 'Afventer fondssvar',
    reasonCategory: 'funding',
  })

  it('pauses once', () => {
    expect(paused.publication).toMatchObject({
      lifecycle: 'paused',
      pauses: [{ from: day(-25), to: null, reason: 'Afventer fondssvar' }],
    })
    expect(paused.events[0]).toMatchObject({ type: 'paused', reasonCategory: 'funding' })
    expect(() => pause(paused.publication, ctx(day(-24)), { reason: 'x' })).toThrow(
      'already paused',
    )
  })

  it('shifts remaining work by the pause length, and nothing starts before the resume date', () => {
    const r = resume(paused.publication, ctx(day(-20)), { mode: { kind: 'shift' } })
    const p = r.publication
    expect(r.events.map((e) => e.type)).toEqual(['resumed', 'release_date_changed'])
    expect(p.lifecycle).toBe('idea')
    expect(p.pauses).toEqual([{ from: day(-25), to: day(-20), reason: 'Afventer fondssvar' }])
    // a was already overdue before the pause and stays put.
    expect(get(p, 'a').deadline).toBe(day(-30))
    // b (10 days) cannot start before day(-20), so it ends at day(-11).
    expect(get(p, 'b')).toMatchObject({ start: day(-20), deadline: day(-11) })
    expect(get(p, 'c').deadline).toBe(day(-6))
    // "side" was due at the pause start; it shifts 5 days but cannot start before the resume.
    expect(get(p, 'side')).toMatchObject({ start: day(-20), deadline: day(-18) })
    // Everything else moved by the 5 lost working days.
    expect(get(p, 'rel').deadline).toBe(day(5))
    expect(p.desiredReleaseDate).toBe(day(5))
  })

  it('can replan towards a new release date instead', () => {
    const r = resume(paused.publication, ctx(day(-20)), {
      mode: { kind: 'new_release', releaseDate: day(10) },
    })
    expect(get(r.publication, 'rel').deadline).toBe(day(10))
    expect(get(r.publication, 'b').deadline).toBe(day(-10))
    expect(r.publication.desiredReleaseDate).toBe(day(10))
  })
})

describe('changeReleaseDate', () => {
  it('shifts the open plan to the new date', () => {
    const r = changeReleaseDate(base, day(10), ctx(day(-40)))
    expect(r.events.map((e) => e.type)).toEqual(['activity_rescheduled', 'release_date_changed'])
    expect(get(r.publication, 'a').deadline).toBe(day(-20))
    expect(get(r.publication, 'rel').deadline).toBe(day(10))
    expect(r.publication.desiredReleaseDate).toBe(day(10))
  })

  it('needs a reason for a binding plan, and re-baselines', () => {
    const p = binding(base)
    expect(() => changeReleaseDate(p, day(10), ctx(day(-40)))).toThrow('reason')
    const r = changeReleaseDate(p, day(10), ctx(day(-40)), { reason: 'Bogmessen' })
    expect(r.publication.bindingReleaseDate).toBe(day(10))
    expect(r.publication.baselines.map((b) => b.number)).toEqual([0, 1])
  })
})

describe('dependencies and edits', () => {
  it('rejects cycles and names them', () => {
    expect(() =>
      addDependency(base, 'a', { activityId: 'c', type: 'FS', lagWorkdays: 0 }, ctx(day(-40))),
    ).toThrow('cycle: Redaktion → Layout → Skrivning → Redaktion')
    expect(() =>
      addDependency(base, 'b', { activityId: 'a', type: 'FS', lagWorkdays: 0 }, ctx(day(-40))),
    ).toThrow('already exists')
  })

  it('adds and removes dependencies', () => {
    const added = addDependency(
      base,
      'c',
      { activityId: 'side', type: 'FS', lagWorkdays: 2 },
      ctx(day(-40)),
    )
    expect(get(added.publication, 'c').predecessors.map((d) => d.activityId)).toEqual(['b', 'side'])
    const removed = removeDependency(added.publication, 'c', 'side', ctx(day(-40)))
    expect(removed.publication).toEqual(base)
  })

  it('pins and edits activities', () => {
    expect(get(setPinned(base, 'd', true, ctx(day(-40))).publication, 'd').pinned).toBe(true)
    const u = updateActivity(
      base,
      'a',
      { note: 'Kapitel 3 mangler', assigneeIds: ['p1'] },
      ctx(day(-40)),
    )
    expect(get(u.publication, 'a')).toMatchObject({
      note: 'Kapitel 3 mangler',
      assigneeIds: ['p1'],
    })
    expect(u.events[0]!.payload.fields).toEqual(['note', 'assigneeIds'])
  })
})

describe('diff', () => {
  it('round-trips added and removed activities', () => {
    const extra = { ...get(base, 'a'), id: 'x', name: 'Ekstra' }
    const after: Publication = {
      ...base,
      workingTitle: 'Ny titel',
      activities: [
        ...base.activities.filter((a) => a.id !== 'side').slice(0, 2),
        extra,
        ...base.activities.filter((a) => a.id !== 'side').slice(2),
      ],
    }
    const d = diffPublication(base, after)
    expect(applyDiff(base, d)).toEqual(after)
    expect(applyDiff(after, invertDiff(d))).toEqual(base)
  })

  it('detects conflicts', () => {
    const r = reschedule(
      base,
      { kind: 'delay', activityId: 'a', workdays: 5 },
      { strategy: 'absorb' },
      ctx(day(-40)),
    )
    const tampered = patch(r.publication, 'b', { note: 'ændret' })
    expect(() => applyDiff(tampered, invertDiff(r.events[0]!.diff))).not.toThrow()
    const moved = patch(r.publication, 'b', { deadline: day(-1) })
    expect(() => undo(moved, record(emptyHistory, r.events), ctx(day(-40)))).toThrow(
      DiffConflictError,
    )
  })
})

// ── Property: any sequence of commands can be undone and redone ──────────────────

type Op =
  | { kind: 'delay'; pick: number; workdays: number; strategy: Strategy }
  | { kind: 'status'; pick: number; status: 'in_progress' | 'done' | 'not_started' }
  | { kind: 'pin'; pick: number }
  | { kind: 'pause' }
  | { kind: 'resume' }
  | { kind: 'release'; workdays: number }

const arbOp: fc.Arbitrary<Op> = fc.oneof(
  fc.record({
    kind: fc.constant('delay' as const),
    pick: fc.nat(),
    workdays: fc.integer({ min: -3, max: 15 }),
    strategy: fc.constantFrom<Strategy>('absorb', 'push', 'compress', 'move_release'),
  }),
  fc.record({
    kind: fc.constant('status' as const),
    pick: fc.nat(),
    status: fc.constantFrom('in_progress' as const, 'done' as const, 'not_started' as const),
  }),
  fc.record({ kind: fc.constant('pin' as const), pick: fc.nat() }),
  fc.constant({ kind: 'pause' as const }),
  fc.constant({ kind: 'resume' as const }),
  fc.record({ kind: fc.constant('release' as const), workdays: fc.integer({ min: -5, max: 10 }) }),
)

describe('history properties', () => {
  it('undoing every transaction restores the original, redoing restores the end state', () => {
    fc.assert(
      fc.property(fc.array(arbOp, { minLength: 1, maxLength: 12 }), (ops) => {
        let p = base
        let h: History = emptyHistory
        let dayN = -45
        for (const op of ops) {
          dayN += 1
          const c = ctx(day(dayN))
          const ids = p.activities.map((a) => a.id)
          const id = (pick: number) => ids[pick % ids.length]!
          try {
            const r =
              op.kind === 'delay'
                ? reschedule(
                    p,
                    { kind: 'delay', activityId: id(op.pick), workdays: op.workdays },
                    { strategy: op.strategy },
                    c,
                    { reason: 'test', acceptConflicts: true },
                  )
                : op.kind === 'status'
                  ? setStatus(p, id(op.pick), op.status, c)
                  : op.kind === 'pin'
                    ? setPinned(
                        p,
                        id(op.pick),
                        !p.activities.find((a) => a.id === id(op.pick))!.pinned,
                        c,
                      )
                    : op.kind === 'pause'
                      ? pause(p, c, { reason: 'test' })
                      : op.kind === 'resume'
                        ? resume(p, c, { mode: { kind: 'shift' }, acceptConflicts: true })
                        : changeReleaseDate(p, day(op.workdays), c, {
                            reason: 'test',
                            acceptConflicts: true,
                          })
            p = r.publication
            h = record(h, r.events)
          } catch (e) {
            // Commands may legitimately refuse (done activity, not paused …); only domain errors.
            if (!(e instanceof Error) || e instanceof DiffConflictError) throw e
          }
        }
        const end = p
        const endHistory = h
        while (h.undoable.length) ({ publication: p, history: h } = undo(p, h, ctx(day(0))))
        expect(p).toEqual(base)
        while (h.redoable.length) ({ publication: p, history: h } = redo(p, h, ctx(day(0))))
        expect(p).toEqual(end)
        expect(h.undoable).toEqual(endHistory.undoable)
      }),
      { numRuns: 200 },
    )
  })
})
