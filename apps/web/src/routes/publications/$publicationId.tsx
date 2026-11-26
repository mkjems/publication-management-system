import {
  ROLE_IDS,
  ROLE_LABELS,
  addDependency,
  type PublicationRecord,
  type RoleId,
  type ScheduleChange,
} from '@pms/domain'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ChevronsDownUp, ChevronsUpDown, Search, TriangleAlert, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Gantt } from '@/components/gantt/gantt'
import { GanttLegend } from '@/components/gantt/legend'
import { ZOOMS, type Zoom } from '@/components/gantt/scale'
import { ActivityPanel } from '@/components/publication/activity-panel'
import { HistoryView } from '@/components/publication/history-view'
import { ImpactDialog } from '@/components/publication/impact-dialog'
import { PlanTable } from '@/components/publication/plan-table'
import { PublicationHeader } from '@/components/publication/publication-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useCommand } from '@/hooks/use-command'
import { useHealth, usePublicationRecord, useSandbox } from '@/hooks/use-publication'
import { da } from '@/i18n/da'
import { groupActivities } from '@/lib/publication'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/store'
import { selectRecord } from '@/store/workspace-store'
import { useFlash } from '@/store/flash'

const TABS = ['table', 'gantt', 'history'] as const
type Tab = (typeof TABS)[number]
const FILTERS = ['all', 'problems', 'open'] as const
type Filter = (typeof FILTERS)[number]

interface PublicationSearch {
  tab?: Tab
  activity?: string
  q?: string
  filter?: Filter
  role?: RoleId
  zoom?: Zoom
  critical?: boolean
  deps?: boolean
}

const oneOf = <T extends string>(values: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (values as readonly string[]).includes(v)

export const Route = createFileRoute('/publications/$publicationId')({
  validateSearch: (s: Record<string, unknown>): PublicationSearch => ({
    ...(oneOf(TABS, s.tab) && s.tab !== 'table' ? { tab: s.tab } : {}),
    ...(typeof s.activity === 'string' && s.activity ? { activity: s.activity } : {}),
    ...(typeof s.q === 'string' && s.q ? { q: s.q } : {}),
    ...(oneOf(FILTERS, s.filter) && s.filter !== 'all' ? { filter: s.filter } : {}),
    ...(oneOf(ROLE_IDS, s.role) ? { role: s.role } : {}),
    ...(oneOf(ZOOMS, s.zoom) && s.zoom !== 'month' ? { zoom: s.zoom } : {}),
    ...(s.critical === true || s.critical === 'true' ? { critical: true } : {}),
    ...(s.deps === true || s.deps === 'true' ? { deps: true } : {}),
  }),
  component: PublicationPage,
})

function PublicationPage() {
  const { publicationId } = Route.useParams()
  const record = usePublicationRecord(publicationId)
  if (!record) {
    return (
      <div className="py-16 text-center">
        <p className="font-medium">{da.publication.notFound}</p>
        <Link to="/publications" className="mt-2 inline-block text-sm text-primary hover:underline">
          {da.publication.back}
        </Link>
      </div>
    )
  }
  return <PublicationView record={record} />
}

function PublicationView({ record }: { record: PublicationRecord }) {
  const pub = record.publication
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const asOf = useWorkspace((s) => s.asOf)
  const health = useHealth(pub, asOf)
  const flash = useFlash()
  const clearFlash = useFlash((s) => s.clear)
  const [toggled, setToggled] = useState<Set<string>>(() => new Set())
  const [pending, setPending] = useState<{ activityId: string; change?: ScheduleChange } | null>(
    null,
  )
  const run = useCommand(pub.id)
  const sandbox = useSandbox(pub.id)
  const tab = search.tab ?? 'table'
  const filter = search.filter ?? 'all'
  const filtering = Boolean(search.q || search.role || filter !== 'all')

  useEffect(() => clearFlash, [clearFlash])

  // Undo/redo from the keyboard, unless typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable]')) return
      e.preventDefault()
      const s = useWorkspace.getState()
      const h = selectRecord(s, pub.id)?.history
      try {
        if (e.shiftKey && h?.redoable.length) s.redo(pub.id)
        else if (!e.shiftKey && h?.undoable.length) s.undo(pub.id)
      } catch (err) {
        flash.show(err instanceof Error ? err.message : String(err))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pub.id, flash])

  const groups = useMemo(() => {
    const q = search.q?.toLowerCase()
    const visible = pub.activities.filter((a) => {
      if (q && !a.name.toLowerCase().includes(q)) return false
      if (search.role && !a.responsible.roles.includes(search.role)) return false
      const state = health.activities.get(a.id)!.state
      if (filter === 'problems' && !['late', 'at_risk', 'waiting'].includes(state)) return false
      if (filter === 'open' && (state === 'done' || state === 'skipped')) return false
      return true
    })
    return groupActivities(pub, visible)
  }, [pub, health, search.q, search.role, filter])

  const usedRoles = useMemo(
    () => ROLE_IDS.filter((r) => pub.activities.some((a) => a.responsible.roles.includes(r))),
    [pub],
  )

  // Phases with open work start expanded; finished phases start collapsed.
  const defaultOpen = useCallback(
    (phaseId: string) => {
      const s = health.phases.get(phaseId)?.state
      return s !== 'done' && s !== 'skipped'
    },
    [health],
  )
  const isOpen = useCallback(
    (phaseId: string) => filtering || defaultOpen(phaseId) !== toggled.has(phaseId),
    [filtering, defaultOpen, toggled],
  )
  const toggle = (phaseId: string) =>
    setToggled((t) => {
      const next = new Set(t)
      if (next.has(phaseId)) next.delete(phaseId)
      else next.add(phaseId)
      return next
    })
  const allOpen = groups.every((g) => isOpen(g.phase.id))
  const setAll = (open: boolean) =>
    setToggled(
      new Set(groups.filter((g) => defaultOpen(g.phase.id) !== open).map((g) => g.phase.id)),
    )

  const setSearch = (patch: Partial<PublicationSearch>) =>
    void navigate({ search: (s) => ({ ...s, ...patch }), replace: true })
  const openActivity = (id: string) => setSearch({ activity: id })
  const move = (activityId: string) => setPending({ activityId })
  const pendingActivity = pending
    ? pub.activities.find((a) => a.id === pending.activityId)
    : undefined

  return (
    <>
      <PublicationHeader record={record} health={health} />

      {flash.message && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-status-late/40 bg-status-late/10 px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-late" />
          <p className="flex-1">{flash.message}</p>
          <button type="button" onClick={flash.clear} aria-label="Luk">
            <X className="size-4" />
          </button>
        </div>
      )}

      <nav className="mb-4 flex gap-1 border-b" aria-label="Visninger">
        {TABS.map((t) => (
          <Link
            key={t}
            from={Route.fullPath}
            search={(s) => ({ ...s, tab: t === 'table' ? undefined : t })}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
              tab === t
                ? 'border-primary font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {da.publication.tabs[t]}
          </Link>
        ))}
      </nav>

      {tab !== 'history' && (
        <div className="sticky top-0 z-40 -mx-4 mb-3 flex flex-wrap items-center gap-2 bg-background/90 px-4 py-2 backdrop-blur md:-mx-8 md:px-8">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search.q ?? ''}
              onChange={(e) => setSearch({ q: e.target.value || undefined })}
              placeholder={da.publication.search}
              aria-label={da.publication.search}
              className="pl-9"
            />
          </div>
          <NativeSelect
            value={filter}
            onChange={(e) =>
              setSearch({
                filter: e.target.value === 'all' ? undefined : (e.target.value as Filter),
              })
            }
            aria-label={da.publication.filter.all}
          >
            {FILTERS.map((f) => (
              <option key={f} value={f}>
                {da.publication.filter[f]}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            value={search.role ?? ''}
            onChange={(e) =>
              setSearch({ role: (e.target.value || undefined) as RoleId | undefined })
            }
            aria-label={da.publication.allRoles}
          >
            <option value="">{da.publication.allRoles}</option>
            {usedRoles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </NativeSelect>
          {!filtering && (
            <Button variant="outline" onClick={() => setAll(!allOpen)}>
              {allOpen ? <ChevronsDownUp /> : <ChevronsUpDown />}
              {allOpen ? da.publication.collapseAll : da.publication.expandAll}
            </Button>
          )}
          {tab === 'gantt' && (
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="radiogroup"
                aria-label={da.gantt.zoomLabel}
                className="flex rounded-md border bg-card p-0.5 text-sm"
              >
                {ZOOMS.map((z) => (
                  <button
                    key={z}
                    type="button"
                    role="radio"
                    aria-checked={(search.zoom ?? 'month') === z}
                    onClick={() => setSearch({ zoom: z === 'month' ? undefined : z })}
                    className={cn(
                      'rounded px-2.5 py-1',
                      (search.zoom ?? 'month') === z
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {da.gantt.zoom[z]}
                  </button>
                ))}
              </div>
              <Toggle
                checked={Boolean(search.critical)}
                onChange={(v) => setSearch({ critical: v || undefined })}
                label={da.gantt.critical}
              />
              <Toggle
                checked={Boolean(search.deps)}
                onChange={(v) => setSearch({ deps: v || undefined })}
                label={da.gantt.allDependencies}
              />
            </div>
          )}
        </div>
      )}

      {tab !== 'history' && groups.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {da.publication.noMatches}
        </p>
      )}

      {tab === 'table' && groups.length > 0 && (
        <PlanTable
          publication={pub}
          health={health}
          groups={groups}
          isOpen={isOpen}
          onToggle={toggle}
          onOpenActivity={openActivity}
          onMove={move}
        />
      )}

      {tab === 'gantt' && groups.length > 0 && (
        <>
          {/* Full bleed: the chart spans the whole content column (the root layout's
              @container), not just the max-width page; margins mirror the page gutter. */}
          <div className="mr-[calc(50%-50cqw+1rem)] ml-[calc(50%-50cqw+1rem)] md:mr-[calc(50%-50cqw+1.5rem)] md:ml-[calc(50%-50cqw+1.5rem)]">
            <Gantt
              publication={pub}
              health={health}
              asOf={asOf}
              groups={groups}
              isOpen={isOpen}
              onToggle={toggle}
              zoom={search.zoom ?? 'month'}
              showCritical={Boolean(search.critical)}
              showAllDependencies={Boolean(search.deps)}
              selectedId={search.activity ?? null}
              onOpenActivity={openActivity}
              onRequestChange={(change) => setPending({ activityId: change.activityId, change })}
              onAddDependency={(predecessorId, successorId) =>
                run((p, c) =>
                  addDependency(
                    p,
                    successorId,
                    { activityId: predecessorId, type: 'FS', lagWorkdays: 0 },
                    c,
                  ),
                )
              }
              compareTo={sandbox?.base.publication ?? null}
            />
          </div>
          <GanttLegend
            preliminary={pub.planState === 'preliminary'}
            paused={pub.pauses.length > 0}
            sandbox={sandbox !== null}
          />
        </>
      )}

      {tab === 'history' && <HistoryView record={record} asOf={asOf} />}

      {search.activity && (
        <ActivityPanel
          record={record}
          health={health}
          activityId={search.activity}
          onClose={() => setSearch({ activity: undefined })}
          onOpenActivity={openActivity}
          onMove={move}
        />
      )}

      {pendingActivity && (
        <ImpactDialog
          key={`${pendingActivity.id}-${JSON.stringify(pending?.change ?? null)}`}
          publication={pub}
          activity={pendingActivity}
          {...(pending?.change ? { initial: pending.change } : {})}
          onOpenChange={(open) => !open && setPending(null)}
        />
      )}
    </>
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-card px-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-primary"
      />
      {label}
    </label>
  )
}
