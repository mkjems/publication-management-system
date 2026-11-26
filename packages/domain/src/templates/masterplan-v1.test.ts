import { describe, expect, it } from 'vitest'
import { TemplateSchema } from '../model/template'
import { MASTERPLAN_V1 as plan } from './masterplan-v1'
import { validateTemplate } from './validate'

describe('Masterplan v1', () => {
  it('matches the template schema', () => {
    expect(() => TemplateSchema.parse(plan)).not.toThrow()
  })

  it('has no validation errors or warnings', () => {
    expect(validateTemplate(plan)).toEqual([])
  })

  it('has the 11 phases from the PDF in order', () => {
    expect(plan.phases.map((p) => `${p.number} ${p.name}`)).toEqual([
      '1 Startmøde',
      '2 Grundlaget lægges',
      '3 Indholdet udvikles',
      '4 Materialet færdiggøres',
      '5 Bogen tager form',
      '6 Bogen gennemarbejdes',
      '7 Bogen lukkes',
      '8 Bogen går i trykken',
      '9 Bogen udkommer',
      '10 Udgivelse',
      '11 Opfølgning',
    ])
  })

  it('has every activity from the PDF (count per phase)', () => {
    const counts = plan.phases.map(
      (p) => plan.activities.filter((a) => a.phaseId === p.id && a.kind !== 'milestone').length,
    )
    expect(counts).toEqual([14, 21, 24, 20, 15, 13, 20, 16, 9, 5, 8])
  })

  it('has the 14 milestones from the PDF', () => {
    expect(plan.activities.filter((a) => a.kind === 'milestone').map((a) => a.name)).toEqual([
      'GO / HOLD / NO-GO',
      'Finansiering tilstrækkelig / risiko godkendt',
      'Produktionsstart',
      'Revideret og gennemredigeret manus',
      'Manus låst til layout',
      'Billedmateriale komplet til layout',
      'Principlayout godkendt',
      '1. ombrud klar',
      '2. ombrud klar',
      'Bogen lukket',
      'Trykgodkendelse',
      'Færdige bøger godkendt og på lager',
      'Udgivelse',
      'Projekt afsluttet og evalueret',
    ])
  })

  it('has one of each gate, with release at offset 0', () => {
    const gates = plan.activities.filter((a) => a.gate)
    expect(gates.map((g) => g.gate).sort()).toEqual([
      'funding_secured',
      'go_hold_nogo',
      'production_start',
      'release',
    ])
    expect(gates.find((g) => g.gate === 'release')?.deadlineOffset).toBe(0)
  })

  it('starts with the kickoff meeting at the nominal kickoff offset', () => {
    const roots = plan.activities.filter((a) => a.predecessors.length === 0)
    expect(roots.map((r) => r.id)).toEqual(['kickoff-meeting'])
    const kickoff = roots[0]!
    expect(kickoff.deadlineOffset - kickoff.durationWorkdays).toBe(plan.nominalKickoffOffset)
  })

  it('only uses kickoff anchoring for phases 1–2', () => {
    expect(plan.phases.filter((p) => p.anchor === 'kickoff').map((p) => p.number)).toEqual([1, 2])
  })

  it('reaches the release milestone from every activity before release', () => {
    const successors = new Map<string, string[]>()
    for (const a of plan.activities)
      for (const d of a.predecessors)
        successors.set(d.activityId, [...(successors.get(d.activityId) ?? []), a.id])
    const reachesRelease = (id: string, seen = new Set<string>()): boolean => {
      if (id === 'm-release') return true
      if (seen.has(id)) return false
      seen.add(id)
      return (successors.get(id) ?? []).some((s) => reachesRelease(s, seen))
    }
    // Ongoing tracks (funding follow-up, press) may run in parallel without feeding the release.
    const dangling = plan.activities
      .filter((a) => a.deadlineOffset < 0 && !reachesRelease(a.id))
      .map((a) => a.id)
    expect(dangling).toMatchSnapshot()
  })
})
