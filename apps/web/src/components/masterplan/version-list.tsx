import { BUILT_IN_TEMPLATES, compareTemplates, type Template } from '@pms/domain'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { da } from '@/i18n/da'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/store'
import { TemplateChanges } from './template-changes'

/** The published versions of the master plan, newest first, with what changed in each. */
export function VersionList({
  versions,
  shown,
  onShow,
}: {
  versions: Template[]
  shown: number
  onShow: (version: number) => void
}) {
  const records = useWorkspace((s) => s.records)
  const [compare, setCompare] = useState<{ from: Template; to: Template } | null>(null)
  const usage = useMemo(() => {
    const n = new Map<number, number>()
    for (const r of Object.values(records)) {
      const p = r.publication
      if (p.templateId === versions[0]?.id)
        n.set(p.templateVersion, (n.get(p.templateVersion) ?? 0) + 1)
    }
    return n
  }, [records, versions])
  const changes = useMemo(
    () => (compare ? compareTemplates(compare.from, compare.to) : []),
    [compare],
  )
  const latest = versions.at(-1)?.version

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>{da.masterplan.versions}</CardTitle>
        <CardDescription>{da.masterplan.versionsHint}</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="divide-y">
          {[...versions].reverse().map((v) => {
            const previous = versions.find((x) => x.version === v.basedOnVersion)
            return (
              <li
                key={v.version}
                className={cn(
                  'flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm',
                  v.version === shown && 'font-medium',
                )}
              >
                <button
                  type="button"
                  onClick={() => onShow(v.version)}
                  className="hover:text-primary hover:underline"
                  aria-current={v.version === shown ? 'true' : undefined}
                >
                  {da.masterplan.versionOf(v.version)}
                </button>
                {v.version === latest && <Badge variant="muted">{da.masterplan.latest}</Badge>}
                <span className="text-muted-foreground">
                  {BUILT_IN_TEMPLATES.includes(v)
                    ? da.masterplan.builtIn
                    : v.publishedOn && da.masterplan.publishedOn(formatDate(v.publishedOn))}
                </span>
                <span className="min-w-0 flex-1 font-normal text-muted-foreground">
                  {v.changeNote}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {da.masterplan.usedBy(usage.get(v.version) ?? 0)}
                </span>
                {previous && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCompare({ from: previous, to: v })}
                  >
                    {da.masterplan.compare}
                  </Button>
                )}
              </li>
            )
          })}
        </ol>
      </CardContent>
      <Dialog open={compare !== null} onOpenChange={(o) => !o && setCompare(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {compare && da.masterplan.compareTitle(compare.from.version, compare.to.version)}
            </DialogTitle>
            {compare?.to.changeNote && (
              <DialogDescription>{compare.to.changeNote}</DialogDescription>
            )}
          </DialogHeader>
          <TemplateChanges changes={changes} />
        </DialogContent>
      </Dialog>
    </Card>
  )
}
