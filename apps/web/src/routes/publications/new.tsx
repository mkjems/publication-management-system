import {
  DEFAULT_CALENDAR,
  MASTERPLAN_V1,
  findTemplate,
  generatePlan,
  getCalendar,
  latestTemplate,
  templateVersions,
  type GeneratedPlan,
  type Template,
} from '@pms/domain'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'
import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { KindIcon } from '@/components/masterplan/kind-icon'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { da } from '@/i18n/da'
import { formatDate, formatDateWithWeekday } from '@/lib/format'
import { useWorkspace } from '@/store'

export const Route = createFileRoute('/publications/new')({
  component: NewPublicationPage,
})

const cal = getCalendar(DEFAULT_CALENDAR)
const TEMPLATE_ID = MASTERPLAN_V1.id
const NEW_PERSON = '__new__'

function NewPublicationPage() {
  const asOf = useWorkspace((s) => s.asOf)
  const people = useWorkspace((s) => s.people)
  const createPublication = useWorkspace((s) => s.createPublication)
  const navigate = useNavigate()
  const ids = {
    title: useId(),
    release: useId(),
    kickoff: useId(),
    lead: useId(),
    name: useId(),
    version: useId(),
  }
  const templates = useWorkspace((s) => s.templates)
  const versions = useMemo(() => templateVersions(templates, TEMPLATE_ID), [templates])
  const latestVersion = versions.at(-1)?.version ?? MASTERPLAN_V1.version
  const [version, setVersion] = useState(latestVersion)
  const template = useMemo(
    () =>
      findTemplate(templates, TEMPLATE_ID, version) ??
      latestTemplate(templates, TEMPLATE_ID) ??
      MASTERPLAN_V1,
    [templates, version],
  )
  const phaseNumber = new Map(template.phases.map((p) => [p.id, p.number]))
  const optionalActivities = template.activities.filter((a) => a.optional)
  /** Skipped activities that exist (and are optional) in the chosen version. */
  const skipIn = (t: Template, skip: Set<string>) =>
    t.activities.filter((a) => a.optional && skip.has(a.id)).map((a) => a.id)

  const [title, setTitle] = useState('')
  // Default: the template's nominal length from today, plus two weeks to prepare.
  const [release, setRelease] = useState(() =>
    cal.addWorkdays(asOf, -template.nominalKickoffOffset + 10),
  )
  const [kickoff, setKickoff] = useState('')
  const [lead, setLead] = useState('')
  const [newName, setNewName] = useState('')
  const [skip, setSkip] = useState<Set<string>>(() => new Set())

  const preview = useMemo((): GeneratedPlan | null => {
    if (!release) return null
    try {
      return generatePlan({
        id: 'preview',
        workingTitle: title || 'preview',
        template,
        desiredReleaseDate: release,
        ...(kickoff ? { kickoffDate: kickoff } : {}),
        skipOptional: skipIn(template, skip),
      })
    } catch {
      return null
    }
  }, [title, release, kickoff, skip, template])

  const valid =
    title.trim().length > 0 && preview !== null && (lead !== NEW_PERSON || newName.trim())

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    const id = createPublication({
      template: { id: template.id, version: template.version },
      workingTitle: title,
      desiredReleaseDate: release,
      ...(kickoff ? { kickoffDate: kickoff } : {}),
      skipOptional: skipIn(template, skip),
      projectLead: lead === NEW_PERSON ? { name: newName } : lead ? { id: lead } : null,
    })
    void navigate({ to: '/publications/$publicationId', params: { publicationId: id } })
  }

  const milestones = preview?.publication.activities.filter((a) => a.kind === 'milestone') ?? []

  return (
    <>
      <PageHeader title={da.wizard.title} description={da.wizard.description} />
      <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-6">
          <Card>
            <CardContent className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor={ids.title}>{da.wizard.workingTitle}</Label>
                <Input
                  id={ids.title}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={da.wizard.workingTitlePlaceholder}
                  required
                  autoFocus
                />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor={ids.release}>{da.wizard.releaseDate}</Label>
                  <Input
                    id={ids.release}
                    type="date"
                    value={release}
                    onChange={(e) => setRelease(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={ids.kickoff}>{da.wizard.kickoffDate}</Label>
                  <Input
                    id={ids.kickoff}
                    type="date"
                    value={kickoff || preview?.publication.kickoffDate || ''}
                    onChange={(e) => setKickoff(e.target.value)}
                  />
                </div>
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">{da.wizard.kickoffHint}</p>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor={ids.lead}>{da.wizard.projectLead}</Label>
                  <NativeSelect
                    id={ids.lead}
                    value={lead}
                    onChange={(e) => setLead(e.target.value)}
                  >
                    <option value="">{da.wizard.noLead}</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                    <option value={NEW_PERSON}>{da.wizard.newPerson}</option>
                  </NativeSelect>
                </div>
                {lead === NEW_PERSON && (
                  <div className="grid gap-2">
                    <Label htmlFor={ids.name}>{da.wizard.newPersonName}</Label>
                    <Input
                      id={ids.name}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>
              {versions.length > 1 && (
                <div className="grid gap-2 sm:max-w-[calc(50%-0.625rem)]">
                  <Label htmlFor={ids.version}>{da.wizard.templateVersion}</Label>
                  <NativeSelect
                    id={ids.version}
                    value={version}
                    onChange={(e) => setVersion(Number(e.target.value))}
                  >
                    {[...versions].reverse().map((v) => (
                      <option key={v.version} value={v.version}>
                        {da.wizard.templateVersionOption(v.version, v.version === latestVersion)}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{da.wizard.optional}</CardTitle>
              <CardDescription>{da.wizard.optionalHint}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {optionalActivities.map((a) => (
                <label key={a.id} className="flex items-start gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-primary"
                    checked={!skip.has(a.id)}
                    onChange={(e) =>
                      setSkip((s) => {
                        const next = new Set(s)
                        if (e.target.checked) next.delete(a.id)
                        else next.add(a.id)
                        return next
                      })
                    }
                  />
                  <span>
                    {a.name}
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      fase {phaseNumber.get(a.phaseId)}
                    </span>
                  </span>
                </label>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle>{da.wizard.preview}</CardTitle>
            {preview && (
              <CardDescription>
                {da.wizard.kickoffDate}: {formatDateWithWeekday(preview.publication.kickoffDate)}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="grid gap-4">
            {preview && preview.compressionWorkdays > 0 && (
              <Warning>{da.wizard.compressed(preview.compressionWorkdays)}</Warning>
            )}
            {preview && preview.publication.kickoffDate < asOf && (
              <Warning>{da.wizard.pastKickoff}</Warning>
            )}
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                {da.wizard.previewMilestones}
              </div>
              <ol className="grid gap-1.5 text-sm">
                {milestones.map((m) => (
                  <li key={m.id} className="flex items-baseline gap-2">
                    <KindIcon kind="milestone" />
                    <span className="min-w-0 flex-1">{m.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatDate(m.deadline)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={!valid} className="flex-1">
                {da.wizard.create}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to="/publications">{da.wizard.cancel}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </>
  )
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-lg border border-status-waiting/50 bg-status-waiting/10 px-3 py-2.5 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-waiting" />
      <p>{children}</p>
    </div>
  )
}
