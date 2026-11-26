import { ROLE_IDS, ROLE_LABELS, type RoleId, type WorkFilter } from '@pms/domain'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { PageHeader } from '@/components/page-header'
import { NativeSelect } from '@/components/ui/native-select'
import { WorkList } from '@/components/work/work-list'
import { usePortfolio, usePortfolioWork } from '@/hooks/use-portfolio'
import { da } from '@/i18n/da'
import { useWorkspace } from '@/store'

interface MyWorkSearch {
  person?: string
  role?: RoleId
}

export const Route = createFileRoute('/my-work')({
  validateSearch: (s: Record<string, unknown>): MyWorkSearch => ({
    ...(typeof s.person === 'string' && s.person ? { person: s.person } : {}),
    ...(typeof s.role === 'string' && (ROLE_IDS as readonly string[]).includes(s.role)
      ? { role: s.role as RoleId }
      : {}),
  }),
  component: MyWorkPage,
})

/** Mine opgaver (PLAN §5.1.8): work for a person or a role across all books. */
function MyWorkPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const people = useWorkspace((s) => s.people)
  const portfolio = usePortfolio()

  const filter = useMemo(
    (): WorkFilter =>
      search.person
        ? { kind: 'person', personId: search.person }
        : search.role
          ? { kind: 'role', roleId: search.role }
          : { kind: 'all' },
    [search.person, search.role],
  )
  const items = usePortfolioWork(filter)

  // People who hold a role on, or lead, at least one book; roles the plans use.
  const involved = useMemo(() => {
    const ids = new Set<string>()
    for (const { record } of portfolio) {
      const p = record.publication
      if (p.projectLeadId) ids.add(p.projectLeadId)
      for (const list of Object.values(p.roleAssignments)) list?.forEach((id) => ids.add(id))
      for (const a of p.activities) a.assigneeIds.forEach((id) => ids.add(id))
    }
    return people.filter((p) => ids.has(p.id))
  }, [portfolio, people])
  const roles = useMemo(
    () =>
      ROLE_IDS.filter((r) =>
        portfolio.some(({ record }) =>
          record.publication.activities.some((a) => a.responsible.roles.includes(r)),
        ),
      ),
    [portfolio],
  )

  const value = search.person ? `p:${search.person}` : search.role ? `r:${search.role}` : 'all'
  function choose(v: string) {
    void navigate({
      search: v.startsWith('p:')
        ? { person: v.slice(2) }
        : v.startsWith('r:')
          ? { role: v.slice(2) as RoleId }
          : {},
      replace: true,
    })
  }

  return (
    <>
      <PageHeader
        title={da.nav.myWork}
        description={da.myWork.description}
        actions={
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{da.myWork.who}</span>
            <NativeSelect
              value={value}
              onChange={(e) => choose(e.target.value)}
              aria-label={da.myWork.who}
              className="w-56"
            >
              <option value="all">{da.myWork.everyone}</option>
              {involved.length > 0 && (
                <optgroup label={da.myWork.people}>
                  {involved.map((p) => (
                    <option key={p.id} value={`p:${p.id}`}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label={da.myWork.roles}>
                {roles.map((r) => (
                  <option key={r} value={`r:${r}`}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </optgroup>
            </NativeSelect>
          </label>
        }
      />
      {involved.length === 0 && (
        <p className="mb-4 text-sm text-muted-foreground">{da.myWork.noPeople}</p>
      )}
      <div className="rounded-xl border bg-card px-5 pb-3 shadow-xs">
        <WorkList items={items} empty={da.myWork.nothing} />
      </div>
    </>
  )
}
