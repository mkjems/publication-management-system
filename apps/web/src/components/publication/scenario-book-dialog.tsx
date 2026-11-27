import { DEFAULT_CALENDAR, SCENARIOS, getCalendar } from '@pms/domain'
import { useNavigate } from '@tanstack/react-router'
import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { da } from '@/i18n/da'
import { errorText } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/store'
import { useFlash } from '@/store/flash'

const cal = getCalendar(DEFAULT_CALENDAR)
/** About six months ahead: the book is mid-production with some history already. */
const DEFAULT_RELEASE_WORKDAYS = 125
/** Spacing between release dates when several books are created at once. */
const SPACING_WORKDAYS = 15
const MAX_BOOKS = 10

/** Demo only: add a book that follows a named scenario from the library (PLAN §4.3). */
export function ScenarioBookDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const asOf = useWorkspace((s) => s.asOf)
  const addScenarioBook = useWorkspace((s) => s.addScenarioBook)
  const show = useFlash((s) => s.show)
  const navigate = useNavigate()
  const ids = { title: useId(), release: useId(), count: useId() }
  const [count, setCount] = useState(1)
  const [scenarioId, setScenarioId] = useState(SCENARIOS[1]?.id ?? SCENARIOS[0]!.id)
  const [title, setTitle] = useState('')
  const [release, setRelease] = useState(() => cal.addWorkdays(asOf, DEFAULT_RELEASE_WORKDAYS))
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!

  function create(e: FormEvent) {
    e.preventDefault()
    if (!release) return
    try {
      const base = title.trim() || scenario.name
      const ids = Array.from({ length: count }, (_, i) =>
        addScenarioBook({
          scenarioId,
          workingTitle: count > 1 ? `${base} ${i + 1}` : base,
          desiredReleaseDate: cal.addWorkdays(release, i * SPACING_WORKDAYS),
        }),
      )
      onOpenChange(false)
      if (ids.length === 1) {
        void navigate({ to: '/publications/$publicationId', params: { publicationId: ids[0]! } })
      } else {
        void navigate({ to: '/' })
      }
    } catch (err) {
      show(errorText(err))
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={create} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{da.scenarioBook.title}</DialogTitle>
            <DialogDescription>{da.scenarioBook.description}</DialogDescription>
          </DialogHeader>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{da.scenarioBook.scenario}</legend>
            {SCENARIOS.map((s) => (
              <label
                key={s.id}
                className={cn(
                  'flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition-colors',
                  scenarioId === s.id ? 'border-ring bg-accent' : 'hover:bg-muted/50',
                )}
              >
                <input
                  type="radio"
                  name="scenario"
                  checked={scenarioId === s.id}
                  onChange={() => setScenarioId(s.id)}
                  className="mt-0.5 accent-primary"
                />
                <span>
                  <span className="block font-medium">{s.name}</span>
                  <span className="block text-xs text-muted-foreground">{s.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={ids.title}>{da.scenarioBook.workingTitle}</Label>
              <Input
                id={ids.title}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={scenario.name}
              />
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor={ids.release}>{da.scenarioBook.releaseDate}</Label>
              <Input
                id={ids.release}
                type="date"
                value={release}
                onChange={(e) => setRelease(e.target.value)}
                className="w-44"
              />
              <p className="text-xs text-muted-foreground">{da.scenarioBook.releaseHint}</p>
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor={ids.count}>{da.scenarioBook.count}</Label>
              <Input
                id={ids.count}
                type="number"
                min={1}
                max={MAX_BOOKS}
                value={count}
                onChange={(e) =>
                  setCount(
                    Math.min(MAX_BOOKS, Math.max(1, Math.round(Number(e.target.value)) || 1)),
                  )
                }
                className="w-24"
              />
              <p className="text-xs text-muted-foreground">{da.scenarioBook.countHint}</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {da.impact.cancel}
            </Button>
            <Button type="submit" disabled={!release}>
              {da.scenarioBook.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
