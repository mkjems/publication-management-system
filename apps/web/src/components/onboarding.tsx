import { Link } from '@tanstack/react-router'
import { BookOpen, FlaskConical, Lightbulb, Map, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { da } from '@/i18n/da'
import { useWorkspace } from '@/store'

const o = da.onboarding

/** What to do first in an empty workspace: review the master plan, create a book, try the demo. */
export function GettingStarted() {
  const kind = useWorkspace((s) => s.kind)
  const load = useWorkspace((s) => s.load)
  const resetDemo = useWorkspace((s) => s.resetDemo)
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="grid gap-5 py-8">
        <div className="text-center">
          <h2 className="font-semibold">{o.title}</h2>
          <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
            {kind === 'real' ? o.realBody : o.demoBody}
          </p>
        </div>
        <ol className="mx-auto grid w-full max-w-3xl gap-3 sm:grid-cols-3">
          <Step
            icon={<Map className="size-4" />}
            n={1}
            title={o.masterplan}
            body={o.masterplanBody}
          >
            <Button asChild size="sm" variant="outline">
              <Link to="/masterplan">{o.masterplanAction}</Link>
            </Button>
          </Step>
          <Step icon={<BookOpen className="size-4" />} n={2} title={o.create} body={o.createBody}>
            <Button asChild size="sm">
              <Link to="/publications/new">{da.publications.new}</Link>
            </Button>
          </Step>
          {kind === 'real' ? (
            <Step
              icon={<FlaskConical className="size-4" />}
              n={3}
              title={o.demo}
              body={o.demoStepBody}
            >
              <Button size="sm" variant="outline" onClick={() => void load('demo')}>
                {o.demoAction}
              </Button>
            </Step>
          ) : (
            <Step
              icon={<FlaskConical className="size-4" />}
              n={3}
              title={o.reset}
              body={o.resetBody}
            >
              <Button size="sm" variant="outline" onClick={resetDemo}>
                {da.timeMachine.reset}
              </Button>
            </Step>
          )}
        </ol>
      </CardContent>
    </Card>
  )
}

function Step({
  icon,
  n,
  title,
  body,
  children,
}: {
  icon: ReactNode
  n: number
  title: string
  body: string
  children: ReactNode
}) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </span>
        <span className="sr-only">{n}.</span>
        {title}
      </div>
      <p className="flex-1 text-sm text-muted-foreground">{body}</p>
      <div>{children}</div>
    </li>
  )
}

const HINT_KEY = 'pms-hints-dismissed'

function readDismissed(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(HINT_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * A short first-visit hint that stays dismissed in this browser. Without storage it simply shows
 * again next time.
 */
export function Hint({ id, children }: { id: string; children: ReactNode }) {
  const [hidden, setHidden] = useState(() => readDismissed().includes(id))
  if (hidden) return null
  const dismiss = () => {
    setHidden(true)
    try {
      localStorage.setItem(HINT_KEY, JSON.stringify([...new Set([...readDismissed(), id])]))
    } catch {
      // Storage blocked: the hint is hidden for this visit only.
    }
  }
  return (
    <aside className="mb-6 flex gap-3 rounded-lg border border-primary/20 bg-accent/60 px-4 py-3 text-sm print:hidden">
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="flex-1">{children}</div>
      <button
        type="button"
        onClick={dismiss}
        className="h-fit rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        aria-label={o.dismiss}
      >
        <X className="size-4" />
      </button>
    </aside>
  )
}
