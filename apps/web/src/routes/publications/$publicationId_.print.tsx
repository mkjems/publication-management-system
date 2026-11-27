import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ChevronLeft, Printer } from 'lucide-react'
import { PrintPlan } from '@/components/print/print-plan'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import {
  useHealth,
  usePersonName,
  usePublicationRecord,
  useTemplateOf,
} from '@/hooks/use-publication'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { da } from '@/i18n/da'
import { useWorkspace } from '@/store'
import type { PublicationRecord } from '@pms/domain'

const PAPERS = ['A3', 'A4'] as const
type Paper = (typeof PAPERS)[number]

interface PrintSearch {
  gantt?: false
  table?: false
  paper?: Paper
}

/**
 * The publication plan for paper and PDF: A3 landscape by default, Gantt first and then the
 * table in the master plan's own columns. The browser's print dialog saves it as PDF.
 */
export const Route = createFileRoute('/publications/$publicationId_/print')({
  validateSearch: (s: Record<string, unknown>): PrintSearch => ({
    ...(s.gantt === false || s.gantt === 'false' ? { gantt: false as const } : {}),
    ...(s.table === false || s.table === 'false' ? { table: false as const } : {}),
    ...(s.paper === 'A4' ? { paper: 'A4' as const } : {}),
  }),
  component: PrintPage,
})

function PrintPage() {
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
  return <PrintView record={record} />
}

function PrintView({ record }: { record: PublicationRecord }) {
  const pub = record.publication
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const asOf = useWorkspace((s) => s.asOf)
  const simulated = useWorkspace((s) => s.simulatedDate !== null)
  const health = useHealth(pub, asOf)
  const template = useTemplateOf(pub)
  const lead = usePersonName(pub.projectLeadId)
  const parts = { gantt: search.gantt !== false, table: search.table !== false }
  const paper = search.paper ?? 'A3'
  const p = da.print
  useDocumentTitle(`${p.title} – ${pub.workingTitle} – ${asOf}`, { exact: true })

  return (
    <>
      {/* Paper size for the print dialog. Margins leave room for printers' unprintable edge. */}
      <style>{`@page { size: ${paper} landscape; margin: 10mm; }`}</style>

      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <Link
          to="/publications/$publicationId"
          params={{ publicationId: pub.id }}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          {p.back}
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-4 text-sm">
          {(['gantt', 'table'] as const).map((part) => (
            <label key={part} className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={parts[part]}
                onChange={(e) =>
                  void navigate({
                    search: (s) => ({ ...s, [part]: e.target.checked ? undefined : false }),
                    replace: true,
                  })
                }
              />
              {p[part]}
            </label>
          ))}
          <label className="flex items-center gap-2">
            {p.paper}
            <NativeSelect
              value={paper}
              onChange={(e) =>
                void navigate({
                  search: (s) => ({
                    ...s,
                    paper: e.target.value === 'A4' ? ('A4' as const) : undefined,
                  }),
                  replace: true,
                })
              }
            >
              {PAPERS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </NativeSelect>
          </label>
          <Button onClick={() => window.print()} disabled={!parts.gantt && !parts.table}>
            <Printer /> {p.print}
          </Button>
        </div>
        <p className="w-full text-right text-xs text-muted-foreground">{p.hint}</p>
      </div>

      {parts.gantt || parts.table ? (
        <div className="rounded-lg border bg-card p-6 shadow-xs print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <PrintPlan
            publication={pub}
            health={health}
            template={template}
            asOf={asOf}
            simulated={simulated}
            projectLead={lead}
            parts={parts}
          />
        </div>
      ) : (
        <p className="py-16 text-center text-sm text-muted-foreground">{p.nothing}</p>
      )}
    </>
  )
}
