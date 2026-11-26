import { describe, expect, it } from 'vitest'
import { fundingStatus, isFundingSufficient } from '../engine/funding'
import { ctx, day, milestone, plan, task } from '../testing/fixtures'
import { CommandError, assignRole, decideGate, pause, setStatus } from './commands'
import {
  addFundingApplication,
  removeFundingApplication,
  setFundingTarget,
  updateFundingApplication,
} from './funding'
import { emptyHistory, record, undo } from './history'

const base = plan(
  [
    task('a', 'Skrivning', 'Forfatter', 5, -20, ['m-go']),
    task('b', 'Layout', 'Grafiker', 5, -10, ['a']),
  ],
  [
    milestone('m-go', 'GO', 'Forlaget', -30, [], { gate: 'go_hold_nogo' }),
    milestone('m-funding', 'Finansiering', 'Forlaget', -25, ['m-go'], { gate: 'funding_secured' }),
    milestone('rel', 'Udgivelse', 'Forlaget', 0, ['b'], { gate: 'release' }),
  ],
)
const c = ctx(day(-40))

function withApplications() {
  let p = setFundingTarget(base, { minimumRequired: 200_000 }, c).publication
  const a = addFundingApplication(
    p,
    {
      funder: 'Augustinus Fonden',
      amount: 150_000,
      status: 'planned',
      submittedAt: null,
      expectedDecisionAt: null,
      decidedAt: null,
      conditions: '',
    },
    c,
  )
  p = a.publication
  const b = addFundingApplication(
    p,
    {
      funder: 'Statens Kunstfond',
      amount: 80_000,
      status: 'submitted',
      submittedAt: day(-45),
      expectedDecisionAt: day(-42),
      decidedAt: null,
      conditions: '',
    },
    c,
  )
  return { p: b.publication, first: a.applicationId, second: b.applicationId }
}

describe('funding', () => {
  it('keeps "secured" equal to the granted applications and fills in dates', () => {
    const { p, first, second } = withApplications()
    expect(fundingStatus(p, day(-40))).toMatchObject({
      minimumRequired: 200_000,
      secured: 0,
      pending: 80_000,
      planned: 150_000,
      gap: 200_000,
      sufficient: false,
    })
    expect(fundingStatus(p, day(-40)).overdueDecisions.map((a) => a.id)).toEqual([second])

    const granted = updateFundingApplication(p, first, { status: 'granted' }, ctx(day(-35)))
    const a = granted.publication.funding.applications.find((x) => x.id === first)!
    expect(a).toMatchObject({ status: 'granted', submittedAt: day(-35), decidedAt: day(-35) })
    expect(granted.publication.funding.secured).toBe(150_000)
    expect(granted.events[0]).toMatchObject({
      type: 'funding_changed',
      payload: { op: 'updated', status: { from: 'planned', to: 'granted' } },
    })

    const both = updateFundingApplication(granted.publication, second, { status: 'granted' }, c)
    expect(isFundingSufficient(both.publication)).toBe(true)
    // Back to submitted: the decision date goes.
    const reopened = updateFundingApplication(both.publication, second, { status: 'submitted' }, c)
    expect(reopened.publication.funding.applications[1]!.decidedAt).toBeNull()
    expect(reopened.publication.funding.secured).toBe(150_000)

    const removed = removeFundingApplication(both.publication, first, c).publication
    expect(removed.funding.secured).toBe(80_000)
  })

  it('validates input', () => {
    const { p, first } = withApplications()
    expect(() => setFundingTarget(p, { minimumRequired: -1 }, c)).toThrow(CommandError)
    expect(() => updateFundingApplication(p, first, { funder: ' ' }, c)).toThrow('funder')
    expect(() => updateFundingApplication(p, 'nope', {}, c)).toThrow('Unknown')
  })

  it('the funding gate needs the minimum secured or the risk accepted', () => {
    const { p, first } = withApplications()
    expect(() => setStatus(p, 'm-funding', 'done', c)).toThrow('funding gate')
    const risk = setFundingTarget(p, { riskAccepted: true }, c, { reason: 'Forlaget går videre' })
    expect(setStatus(risk.publication, 'm-funding', 'done', c).publication.planState).toBe(
      'binding',
    )
    const granted = updateFundingApplication(p, first, { amount: 250_000, status: 'granted' }, c)
    expect(() => setStatus(granted.publication, 'm-funding', 'done', c)).not.toThrow()
  })
})

describe('decideGate', () => {
  it('GO completes the gate and moves the lifecycle on', () => {
    const r = decideGate(base, 'm-go', 'go', c)
    expect(r.events.map((e) => e.type)).toEqual(['gate_decided'])
    expect(r.publication.lifecycle).toBe('go')
    expect(r.publication.activities.find((a) => a.id === 'm-go')!.status).toBe('done')
    expect(() => decideGate(r.publication, 'm-go', 'go', c)).toThrow('already')
    expect(() => decideGate(base, 'a', 'go', c)).toThrow('gate')
  })

  it('HOLD pauses with lifecycle "hold"; a later GO resumes and shifts the plan', () => {
    expect(() => decideGate(base, 'm-go', 'hold', c)).toThrow('reason')
    const held = decideGate(base, 'm-go', 'hold', ctx(day(-30)), { reason: 'Afventer fond' })
    expect(held.publication).toMatchObject({
      lifecycle: 'hold',
      pauses: [{ from: day(-30), to: null, reason: 'Afventer fond' }],
    })
    const go = decideGate(held.publication, 'm-go', 'go', ctx(day(-25)))
    expect(new Set(go.events.map((e) => e.txId)).size).toBe(1)
    expect(go.events.map((e) => e.type)).toEqual([
      'resumed',
      'release_date_changed',
      'gate_decided',
    ])
    expect(go.publication.lifecycle).toBe('go')
    expect(go.publication.pauses[0]!.to).toBe(day(-25))
    expect(go.publication.activities.find((a) => a.id === 'rel')!.deadline).toBe(day(5))

    // One undo reverts the whole decision.
    let history = record(emptyHistory, held.events)
    history = record(history, go.events)
    expect(undo(go.publication, history, ctx(day(-25))).publication).toEqual(held.publication)
  })

  it('NO-GO stops the publication', () => {
    const r = decideGate(base, 'm-go', 'no_go', c, { reason: 'Ingen finansiering' })
    expect(r.publication.lifecycle).toBe('no_go')
    expect(r.events[0]).toMatchObject({ type: 'gate_decided', reason: 'Ingen finansiering' })
    expect(() => pause(r.publication, c, { reason: 'x' })).toThrow()
  })
})

describe('assignRole', () => {
  it('replaces the people on a role and logs it', () => {
    const r = assignRole(base, 'editor', ['p1', 'p2', 'p1'], c)
    expect(r.publication.roleAssignments.editor).toEqual(['p1', 'p2'])
    expect(r.events[0]).toMatchObject({ type: 'roles_assigned', payload: { roleId: 'editor' } })
    expect(assignRole(r.publication, 'editor', [], c).publication.roleAssignments).toEqual({})
    const lead = assignRole(base, 'project-lead', ['anna'], c).publication
    expect(lead.projectLeadId).toBe('anna')
    expect(assignRole(lead, 'project-lead', [], c).publication.projectLeadId).toBeNull()
  })
})
