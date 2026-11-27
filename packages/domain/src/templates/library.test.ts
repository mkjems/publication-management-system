import { describe, expect, it } from 'vitest'
import { generatePlan } from '../engine/generate'
import type { Publication } from '../model/publication'
import { RELEASE, WEEKDAYS } from '../testing/fixtures'
import { rescheduleTemplateActivity, removeTemplateActivity } from './edit'
import {
  BUILT_IN_TEMPLATES,
  actualDurations,
  compareTemplates,
  createDraft,
  latestTemplate,
  publishDraft,
} from './library'
import { MASTERPLAN_V1 } from './masterplan-v1'

describe('versions', () => {
  it('drafts the next version and publishes it', () => {
    const draft = createDraft(MASTERPLAN_V1, 2)
    expect(draft).toMatchObject({ version: 2, basedOnVersion: 1 })
    expect(draft.publishedOn).toBeUndefined()
    const v2 = publishDraft(draft, '2026-11-26', '  Længere billedresearch ')
    expect(v2).toMatchObject({
      version: 2,
      publishedOn: '2026-11-26',
      changeNote: 'Længere billedresearch',
    })
    expect(latestTemplate([...BUILT_IN_TEMPLATES, v2], 'masterplan')?.version).toBe(2)
  })

  it('does not share data with the version it was copied from', () => {
    const draft = createDraft(MASTERPLAN_V1, 2)
    draft.activities[0]!.predecessors.push({ activityId: 'x', type: 'FS', lagWorkdays: 0 })
    expect(MASTERPLAN_V1.activities[0]!.predecessors).toEqual([])
  })

  it('refuses to publish a draft with errors', () => {
    const { template } = rescheduleTemplateActivity(createDraft(MASTERPLAN_V1, 2), 'printing', {
      deadlineOffset: 5,
    })
    expect(() => publishDraft(template, '2026-11-26', '')).toThrow('error')
  })

  it('generates plans from a new version', () => {
    const v2 = publishDraft(createDraft(MASTERPLAN_V1, 2), '2026-11-26', '')
    const { publication } = generatePlan({
      id: 'p',
      workingTitle: 'Bog',
      template: v2,
      desiredReleaseDate: '2027-10-01',
    })
    expect(publication.templateVersion).toBe(2)
  })
})

describe('compareTemplates', () => {
  it('lists added, removed and changed activities with the fields that changed', () => {
    const { template } = rescheduleTemplateActivity(
      createDraft(MASTERPLAN_V1, 2),
      'image-research',
      {
        durationWorkdays: 40,
      },
    )
    const v2 = removeTemplateActivity(template, 'colophon')
    const changes = compareTemplates(MASTERPLAN_V1, v2)
    expect(changes.find((c) => c.id === 'image-research')).toMatchObject({
      op: 'changed',
      fields: ['duration'],
      duration: { from: expect.any(Number), to: 40 },
    })
    expect(changes.find((c) => c.id === 'colophon')).toMatchObject({ op: 'removed' })
    // Upstream activities moved earlier to make room.
    expect(changes.filter((c) => c.fields.includes('deadline')).length).toBeGreaterThan(0)
  })

  it('finds nothing between identical versions', () => {
    expect(compareTemplates(MASTERPLAN_V1, createDraft(MASTERPLAN_V1, 2))).toEqual([])
  })
})

describe('actualDurations', () => {
  it('measures finished tasks in working days, by template activity', () => {
    const base = generatePlan({
      id: 'p',
      workingTitle: 'Bog',
      template: MASTERPLAN_V1,
      desiredReleaseDate: RELEASE,
      calendar: WEEKDAYS,
    }).publication
    const finish = (pub: Publication, start: string, end: string): Publication => ({
      ...pub,
      activities: pub.activities.map((a) =>
        a.id === 'kickoff-meeting'
          ? { ...a, status: 'done', actualStart: start, actualFinish: end }
          : a,
      ),
    })
    // Mon–Fri = 5 days; Mon–next Wed = 8 days; Thu–Thu = 1 day.
    const pubs = [
      finish(base, '2026-11-02', '2026-11-06'),
      finish(base, '2026-11-02', '2026-11-11'),
      finish(base, '2026-11-05', '2026-11-05'),
    ]
    expect(actualDurations(pubs, 'masterplan').get('kickoff-meeting')).toEqual({
      count: 3,
      median: 5,
      min: 1,
      max: 8,
    })
    expect(actualDurations(pubs, 'other').size).toBe(0)
  })
})
