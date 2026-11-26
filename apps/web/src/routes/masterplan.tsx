import { MASTERPLAN_V1, ROLE_IDS, ROLE_LABELS, type RoleId } from '@pms/domain'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronsDownUp, ChevronsUpDown, Search, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { groupTemplate } from '@/components/masterplan/group-template'
import { PhaseSection } from '@/components/masterplan/phase-section'
import { PhaseTimeline } from '@/components/masterplan/phase-timeline'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { da } from '@/i18n/da'

interface MasterplanSearch {
  q?: string
  role?: RoleId
}

export const Route = createFileRoute('/masterplan')({
  validateSearch: (search: Record<string, unknown>): MasterplanSearch => ({
    ...(typeof search.q === 'string' && search.q ? { q: search.q } : {}),
    ...(typeof search.role === 'string' && (ROLE_IDS as readonly string[]).includes(search.role)
      ? { role: search.role as RoleId }
      : {}),
  }),
  component: MasterplanPage,
})

const template = MASTERPLAN_V1
const activityById = new Map(template.activities.map((a) => [a.id, a]))
const usedRoles = ROLE_IDS.filter((r) =>
  template.activities.some((a) => a.responsible.roles.includes(r)),
)

function MasterplanPage() {
  const { q, role } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [focusedId, setFocusedId] = useState<string | null>(null)

  const filtering = Boolean(q || role)
  const groups = useMemo(() => groupTemplate(template, { query: q, role }), [q, role])
  const isOpen = (phaseId: string) => filtering || open.has(phaseId)

  const counts = useMemo(
    () => ({
      activities: template.activities.filter((a) => a.kind !== 'milestone').length,
      milestones: template.activities.filter((a) => a.kind === 'milestone').length,
    }),
    [],
  )

  // Scroll to an activity when a dependency chip is clicked, and flash it.
  useEffect(() => {
    if (!focusedId) return
    document
      .getElementById(`activity-${focusedId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => setFocusedId(null), 1600)
    return () => clearTimeout(t)
  }, [focusedId])

  function focusActivity(id: string) {
    const target = activityById.get(id)
    if (!target) return
    if (filtering) void navigate({ search: {} })
    setOpen((s) => new Set(s).add(target.phaseId))
    setFocusedId(id)
  }

  function showPhase(phaseId: string) {
    setOpen((s) => new Set(s).add(phaseId))
    requestAnimationFrame(() =>
      document.getElementById(phaseId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    )
  }

  const allOpen = groups.every((g) => isOpen(g.phase.id))

  return (
    <>
      <PageHeader
        title={da.masterplan.title}
        description={
          <>
            {template.name} · version {template.version} · {template.phases.length}{' '}
            {da.masterplan.phases} · {counts.activities} {da.masterplan.activities} ·{' '}
            {counts.milestones} {da.masterplan.milestones}
          </>
        }
      />

      <div className="mb-6 flex gap-3 rounded-lg border border-status-waiting/50 bg-status-waiting/10 px-4 py-3 text-sm">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-waiting" />
        <p>{da.masterplan.defaultsNotice}</p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{da.masterplan.timelineTitle}</CardTitle>
          <CardDescription>{da.masterplan.timelineHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <PhaseTimeline template={template} onSelectPhase={showPhase} />
        </CardContent>
      </Card>

      <div className="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap items-center gap-2 bg-background/90 px-4 py-2 backdrop-blur md:-mx-8 md:px-8">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q ?? ''}
            onChange={(e) =>
              void navigate({
                search: (s) => ({ ...s, q: e.target.value || undefined }),
                replace: true,
              })
            }
            placeholder={da.masterplan.search}
            className="pl-9"
            aria-label={da.masterplan.search}
          />
        </div>
        <select
          value={role ?? ''}
          onChange={(e) =>
            void navigate({
              search: (s) => ({ ...s, role: (e.target.value || undefined) as RoleId | undefined }),
              replace: true,
            })
          }
          className="h-9 rounded-md border border-input bg-card px-3 text-sm shadow-xs"
          aria-label={da.masterplan.allRoles}
        >
          <option value="">{da.masterplan.allRoles}</option>
          {usedRoles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        {!filtering && (
          <Button
            variant="outline"
            onClick={() => setOpen(allOpen ? new Set() : new Set(template.phases.map((p) => p.id)))}
          >
            {allOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
            {allOpen ? da.masterplan.collapseAll : da.masterplan.expandAll}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {groups.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {da.masterplan.noMatches}
          </p>
        )}
        {groups.map((g) => (
          <PhaseSection
            key={g.phase.id}
            group={g}
            open={isOpen(g.phase.id)}
            onToggle={() =>
              setOpen((s) => {
                const next = new Set(s)
                if (next.has(g.phase.id)) next.delete(g.phase.id)
                else next.add(g.phase.id)
                return next
              })
            }
            activityById={activityById}
            focusedId={focusedId}
            onFocusActivity={focusActivity}
          />
        ))}
      </div>
    </>
  )
}
