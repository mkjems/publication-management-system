import { startOffset, type Template } from '@pms/domain'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { da } from '@/i18n/da'
import { formatOffset } from '@/lib/format'

const WORKDAYS_PER_MONTH = 21
const MONTHS_AFTER = 3

/**
 * Static overview of the template's phases on the release-relative axis.
 * A first, read-only taste of the Gantt chart that comes in Phase 3.
 */
export function PhaseTimeline({
  template,
  onSelectPhase,
}: {
  template: Template
  onSelectPhase?: (phaseId: string) => void
}) {
  const min = template.nominalKickoffOffset
  const max = MONTHS_AFTER * WORKDAYS_PER_MONTH
  const pct = (offset: number) => `${((offset - min) / (max - min)) * 100}%`

  const monthsBefore = Math.ceil(-min / WORKDAYS_PER_MONTH)
  const ticks = Array.from({ length: monthsBefore + MONTHS_AFTER + 1 }, (_, i) => i - monthsBefore)

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Axis */}
        <div className="grid grid-cols-[13rem_1fr] text-[11px] text-muted-foreground">
          <div className="self-end pb-1">Måneder fra udgivelse</div>
          <div className="relative h-6">
            {ticks.map((m) => (
              <span
                key={m}
                className={
                  m === 0
                    ? 'absolute -translate-x-1/2 font-semibold whitespace-nowrap text-foreground'
                    : 'absolute -translate-x-1/2 whitespace-nowrap tabular-nums'
                }
                style={{ left: pct(m * WORKDAYS_PER_MONTH) }}
                title={m === 0 ? da.masterplan.release : undefined}
              >
                {m === 0 ? '0' : m < 0 ? `−${-m}` : `+${m}`}
              </span>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="relative grid grid-cols-[13rem_1fr]">
          {/* Grid lines behind the rows */}
          <div className="pointer-events-none absolute inset-y-0 right-0 left-52">
            {ticks.map((m) => (
              <div
                key={m}
                className={
                  m === 0
                    ? 'absolute inset-y-0 w-0.5 bg-milestone'
                    : 'absolute inset-y-0 w-px bg-border'
                }
                style={{ left: pct(m * WORKDAYS_PER_MONTH) }}
              />
            ))}
          </div>

          {template.phases.map((phase) => {
            const acts = template.activities.filter((a) => a.phaseId === phase.id)
            const spanStart = Math.min(...acts.map(startOffset))
            const spanEnd = Math.max(...acts.map((a) => a.deadlineOffset))
            const milestones = acts.filter((a) => a.kind === 'milestone')
            return (
              <div key={phase.id} className="contents">
                <button
                  type="button"
                  onClick={() => onSelectPhase?.(phase.id)}
                  className="flex items-center gap-2 truncate py-1.5 pr-3 text-left text-sm hover:text-primary"
                >
                  <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                    {phase.number}
                  </span>
                  <span className="truncate">{phase.name}</span>
                </button>
                <div className="relative h-8">
                  <div
                    className="absolute top-1.5 h-5 rounded-sm bg-phase-band/70"
                    style={{
                      left: pct(phase.window.startOffset),
                      width: `calc(${pct(phase.window.endOffset)} - ${pct(phase.window.startOffset)})`,
                    }}
                    title={phase.period}
                  />
                  <div
                    className="absolute top-3.5 h-1 rounded-full bg-bar-task"
                    style={{
                      left: pct(spanStart),
                      width: `calc(${pct(spanEnd)} - ${pct(spanStart)})`,
                    }}
                  />
                  {milestones.map((m) => (
                    <Tooltip key={m.id}>
                      <TooltipTrigger asChild>
                        <span
                          className="absolute top-2.5 size-3 -translate-x-1/2 rotate-45 rounded-[2px] bg-milestone ring-2 ring-background"
                          style={{ left: pct(m.deadlineOffset) }}
                          aria-label={m.name}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="font-medium">{m.name}</div>
                        <div className="opacity-80">{formatOffset(m.deadlineOffset)}</div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 pl-52 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-5 rounded-sm bg-phase-band/70" /> Periode i masterplanen
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-5 rounded-full bg-bar-task" /> Aktiviteter (forslag)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rotate-45 rounded-[2px] bg-milestone" /> Milepæl
          </span>
        </div>
      </div>
    </div>
  )
}
