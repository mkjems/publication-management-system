import { MASTERPLAN_V1, validateTemplate } from '@pms/domain'
import { describe, expect, it } from 'vitest'
import { issueText, responsibilityFor, templateNames } from './template'

describe('template helpers', () => {
  it('builds responsibility labels in the master plan style', () => {
    expect(responsibilityFor(['editor', 'designer'], 'joint').label).toBe('Redaktør + grafiker')
    expect(responsibilityFor(['editor', 'author'], 'either').label).toBe('Redaktør/forfatter')
  })

  it('describes issues in Danish', () => {
    const t = {
      ...MASTERPLAN_V1,
      activities: MASTERPLAN_V1.activities.map((a) =>
        a.id === 'project-description' ? { ...a, deadlineOffset: -224 } : a,
      ),
    }
    const issue = validateTemplate(t).find((i) => i.code === 'dependency-violated')!
    expect(issueText(issue, templateNames(t))).toMatch(/for tidligt i forhold til "Bogens idé/)
  })
})
