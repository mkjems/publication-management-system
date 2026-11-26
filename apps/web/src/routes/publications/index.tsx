import { parseWorkspaceSnapshot, type WorkspaceSnapshot } from '@pms/domain'
import { createFileRoute, Link } from '@tanstack/react-router'
import { BookOpen, Download, FlaskConical, Plus, TriangleAlert, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { PageHeader } from '@/components/page-header'
import { PortfolioRow } from '@/components/publication/portfolio-row'
import { ScenarioBookDialog } from '@/components/publication/scenario-book-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { da } from '@/i18n/da'
import { useWorkspace } from '@/store'

export const Route = createFileRoute('/publications/')({
  component: PublicationsPage,
})

function PublicationsPage() {
  const order = useWorkspace((s) => s.order)
  const kind = useWorkspace((s) => s.kind)
  const fileInput = useRef<HTMLInputElement>(null)
  const [pendingImport, setPendingImport] = useState<WorkspaceSnapshot | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [scenarioOpen, setScenarioOpen] = useState(false)

  function exportWorkspace() {
    const s = useWorkspace.getState()
    const snapshot = s.exportSnapshot()
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `produktionsplan-${s.kind}-${s.asOf}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function readFile(file: File) {
    setImportError(null)
    try {
      setPendingImport(parseWorkspaceSnapshot(JSON.parse(await file.text())))
    } catch (e) {
      setImportError(
        `${da.publications.importError}: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  }

  return (
    <>
      <PageHeader
        title={da.publications.title}
        description={da.publications.description}
        actions={
          <>
            <Button variant="outline" onClick={exportWorkspace} disabled={order.length === 0}>
              <Download />
              {da.publications.export}
            </Button>
            <Button variant="outline" onClick={() => fileInput.current?.click()}>
              <Upload />
              {da.publications.import}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void readFile(file)
              }}
            />
            {kind === 'demo' && (
              <Button variant="outline" onClick={() => setScenarioOpen(true)}>
                <FlaskConical />
                {da.scenarioBook.open}
              </Button>
            )}
            <Button asChild>
              <Link to="/publications/new">
                <Plus />
                {da.publications.new}
              </Link>
            </Button>
          </>
        }
      />

      {importError && (
        <div className="mb-4 flex gap-3 rounded-lg border border-status-late/40 bg-status-late/10 px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-late" />
          <p>{importError}</p>
        </div>
      )}

      {order.length === 0 ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <BookOpen className="size-5 text-muted-foreground" />
            </div>
            <div className="font-medium">{da.publications.empty}</div>
            <p className="max-w-md text-sm text-muted-foreground">{da.publications.emptyBody}</p>
            <Button asChild className="mt-2">
              <Link to="/publications/new">
                <Plus />
                {da.publications.new}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-xs">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2.5 pr-3 pl-5 font-medium">{da.publications.columns.title}</th>
                <th className="px-3 py-2.5 font-medium">{da.publications.columns.release}</th>
                <th className="px-3 py-2.5 font-medium">{da.publications.columns.forecast}</th>
                <th className="px-3 py-2.5 font-medium">{da.publications.columns.slip}</th>
                <th className="px-3 py-2.5 font-medium">{da.publications.columns.funding}</th>
                <th className="w-36 px-3 py-2.5 font-medium">{da.publications.columns.progress}</th>
                <th className="px-3 py-2.5 font-medium">{da.publications.columns.health}</th>
                <th className="py-2.5 pr-5 pl-3 font-medium">{da.publications.columns.next}</th>
              </tr>
            </thead>
            <tbody>
              {order.map((id) => (
                <PortfolioRow key={id} id={id} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {scenarioOpen && <ScenarioBookDialog onOpenChange={setScenarioOpen} />}

      <ConfirmDialog
        open={pendingImport !== null}
        onOpenChange={(o) => !o && setPendingImport(null)}
        title={da.publications.importConfirmTitle}
        body={
          pendingImport
            ? da.publications.importConfirmBody(
                pendingImport.publications.length,
                da.workspace[kind],
              )
            : ''
        }
        confirm={da.publications.importConfirm}
        cancel={da.wizard.cancel}
        destructive
        onConfirm={() =>
          pendingImport && void useWorkspace.getState().importSnapshot(pendingImport)
        }
      />
    </>
  )
}
