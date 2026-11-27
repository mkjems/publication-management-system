import {
  ROLE_LABELS,
  type RoleId,
  type Responsibility,
  type Template,
  type TemplateIssue,
} from '@pms/domain'
import { TEMPLATE_ISSUE_TEXT } from '@/i18n/da'

/** Danish text for a validator issue. */
export function issueText(issue: TemplateIssue, nameOf: (id: string) => string): string {
  switch (issue.code) {
    case 'cycle':
      return TEMPLATE_ISSUE_TEXT.cycle((issue.cycle ?? []).map(nameOf).join(' → '))
    case 'dependency-violated':
      return TEMPLATE_ISSUE_TEXT['dependency-violated'](
        nameOf(issue.relatedId ?? ''),
        issue.workdays ?? 0,
      )
    case 'before-kickoff':
      return TEMPLATE_ISSUE_TEXT['before-kickoff'](issue.workdays ?? 0)
    default:
      return TEMPLATE_ISSUE_TEXT[issue.code]()
  }
}

/**
 * The responsibility label in the master plan's own style: "Redaktør + grafiker" (joint) or
 * "Redaktør/forfatter" (either).
 */
export function responsibilityFor(roles: RoleId[], mode: Responsibility['mode']): Responsibility {
  const words = roles.map((r, i) => (i === 0 ? ROLE_LABELS[r] : ROLE_LABELS[r].toLowerCase()))
  return { roles, mode, label: words.join(mode === 'joint' ? ' + ' : '/') }
}

/** Display names by id for everything in a template. */
export function templateNames(t: Template): (id: string) => string {
  const names = new Map<string, string>([
    ...t.phases.map((p) => [p.id, p.name] as const),
    ...t.tracks.map((tr) => [tr.id, tr.name] as const),
    ...t.activities.map((a) => [a.id, a.name] as const),
  ])
  return (id) => names.get(id) ?? id
}
