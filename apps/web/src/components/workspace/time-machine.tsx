import { DEFAULT_CALENDAR, addDays, getCalendar, type IsoDate } from '@pms/domain'
import { Clock, Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { da } from '@/i18n/da'
import { formatDateWithWeekday, formatWorkdays } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/store'

const cal = getCalendar(DEFAULT_CALENDAR)
const PLAY_STEP_WORKDAYS = 5
const PLAY_INTERVAL_MS = 900

/** Whether the demo has changes made by the user (lost when going back in time). */
function hasUserChanges() {
  return Object.values(useWorkspace.getState().records).some((r) =>
    r.history.log.some((e) => e.by === null),
  )
}

/**
 * Tidsmaskine (PLAN §4.3): sets the simulated date of the demo workspace. Going forward plays
 * the books on; going back rebuilds the demo data as of that date.
 */
export function TimeMachine() {
  const kind = useWorkspace((s) => s.kind)
  const simulatedDate = useWorkspace((s) => s.simulatedDate)
  const realToday = useWorkspace((s) => s.realToday)
  const travelTo = useWorkspace((s) => s.travelTo)
  const resetDemo = useWorkspace((s) => s.resetDemo)
  const frozen = useWorkspace((s) => s.sandbox !== null)
  const [playing, setPlaying] = useState(false)
  const [pendingBack, setPendingBack] = useState<IsoDate | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  // Opening a scenario stops time (the store ignores travel while a sandbox is open).
  if (frozen && playing) setPlaying(false)

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => {
      const current = useWorkspace.getState().simulatedDate
      if (current) travelTo(cal.addWorkdays(current, PLAY_STEP_WORKDAYS))
    }, PLAY_INTERVAL_MS)
    return () => clearInterval(t)
  }, [playing, travelTo])

  if (kind !== 'demo' || !simulatedDate) return null

  const go = (date: IsoDate) => {
    if (date < simulatedDate && hasUserChanges()) setPendingBack(date)
    else travelTo(date)
  }
  const offset = cal.workdaysBetween(realToday, simulatedDate)
  const simulated = simulatedDate !== realToday

  return (
    <div
      className={cn(
        'mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-2.5 text-sm',
        simulated ? 'border-status-waiting/60 bg-status-waiting/10' : 'bg-card',
      )}
    >
      <div className="flex items-center gap-2">
        <Clock className="size-4 text-muted-foreground" />
        <span className="font-medium">{da.timeMachine.title}</span>
        <span className="tabular-nums">{formatDateWithWeekday(simulatedDate)}</span>
        {simulated ? (
          <span className="text-xs text-muted-foreground">
            {da.timeMachine.simulated} · {offset > 0 ? '+' : '−'}
            {formatWorkdays(Math.abs(offset))}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            ({da.timeMachine.today.toLowerCase()})
          </span>
        )}
      </div>
      {frozen && <span className="text-xs text-muted-foreground">{da.sandbox.timeStopped}</span>}
      <div className="flex flex-wrap items-center gap-1.5 md:ml-auto">
        <Button
          size="sm"
          variant="outline"
          onClick={() => go(cal.addWorkdays(simulatedDate, -5))}
          disabled={playing || frozen}
        >
          {da.timeMachine.backWeek}
        </Button>
        <Input
          type="date"
          aria-label={da.timeMachine.simulated}
          value={simulatedDate}
          disabled={playing || frozen}
          onChange={(e) => e.target.value && go(e.target.value)}
          className="h-8 w-38"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => go(addDays(simulatedDate, 1))}
          disabled={playing || frozen}
        >
          {da.timeMachine.forwardDay}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => go(cal.addWorkdays(simulatedDate, 5))}
          disabled={playing || frozen}
        >
          {da.timeMachine.forwardWeek}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => go(cal.addWorkdays(simulatedDate, 21))}
          disabled={playing || frozen}
        >
          {da.timeMachine.forwardMonth}
        </Button>
        <Button
          size="sm"
          variant={playing ? 'default' : 'outline'}
          onClick={() => setPlaying((p) => !p)}
          disabled={frozen}
        >
          {playing ? <Pause /> : <Play />}
          {playing ? da.timeMachine.pause : da.timeMachine.play}
        </Button>
        {simulated && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => go(realToday)}
            disabled={playing || frozen}
          >
            {da.timeMachine.today}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => (hasUserChanges() ? setConfirmReset(true) : resetDemo())}
          disabled={playing || frozen}
          title={da.timeMachine.reset}
        >
          <RotateCcw />
          <span className="sr-only">{da.timeMachine.reset}</span>
        </Button>
      </div>

      <ConfirmDialog
        open={pendingBack !== null}
        onOpenChange={(o) => !o && setPendingBack(null)}
        title={da.timeMachine.backConfirmTitle}
        body={da.timeMachine.backConfirmBody}
        confirm={da.timeMachine.backConfirm}
        cancel={da.timeMachine.cancel}
        onConfirm={() => pendingBack && travelTo(pendingBack)}
      />
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={da.timeMachine.resetConfirmTitle}
        body={da.timeMachine.resetConfirmBody}
        confirm={da.timeMachine.resetConfirm}
        cancel={da.timeMachine.cancel}
        onConfirm={resetDemo}
      />
    </div>
  )
}
