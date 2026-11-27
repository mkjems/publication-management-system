import type { Activity, IsoDate, Publication, PublicationHealth } from '@pms/domain'
import { da } from '@/i18n/da'
import type { PhaseRows } from '@/lib/publication'
import { cn } from '@/lib/utils'
import { printBar, type PrintScale } from './layout'

const HATCH =
  'repeating-linear-gradient(135deg, rgb(255 255 255 / 0.45) 0 2px, transparent 2px 5px)'

/**
 * A static Gantt chart for paper: one block per phase, each with its own month axis so every
 * printed page can be read on its own. Blocks are not split across pages where avoidable.
 */
export function PrintGantt({
  publication: pub,
  health,
  groups,
  scale,
  asOf,
}: {
  publication: Publication
  health: PublicationHealth
  groups: PhaseRows[]
  scale: PrintScale
  asOf: IsoDate
}) {
  const release = health.release
  return (
    <div className="grid gap-3">
      {groups.map((g) => (
        <section
          key={g.phase.id}
          className="relative break-inside-avoid overflow-hidden rounded border border-border text-[10px]"
        >
          <div className="grid grid-cols-[16rem_1fr] border-b bg-muted/60">
            <div className="px-2 py-1.5 text-[11px] font-semibold">
              {g.phase.number}. {g.phase.name}
            </div>
            <div className="relative h-6">
              {scale.months
                .filter((m) => m.label !== null)
                .map((m) => (
                  <span
                    key={m.date}
                    className="absolute top-1 truncate pl-0.5 leading-4 text-muted-foreground"
                    style={{ left: `${m.left}%`, width: `${m.width}%` }}
                  >
                    {m.label}
                    {m.year && (
                      <span className="ml-0.5 font-semibold text-foreground">{m.year}</span>
                    )}
                  </span>
                ))}
            </div>
          </div>

          <div className="relative">
            {/* Month grid, today and release lines across the whole block */}
            <div className="pointer-events-none absolute inset-y-0 right-0 left-[16rem]">
              {scale.months.map((m) => (
                <span
                  key={m.date}
                  className="absolute inset-y-0 w-px bg-border"
                  style={{ left: `${m.left}%` }}
                />
              ))}
              <span
                className="absolute inset-y-0 w-px bg-status-active"
                style={{ left: `${scale.pct(asOf)}%` }}
              />
              <span
                className="absolute inset-y-0 w-0.5 bg-milestone"
                style={{ left: `${scale.pct(release.target)}%` }}
              />
              {release.forecast && release.forecast > release.target && (
                <span
                  className="absolute inset-y-0 w-0.5 bg-status-late"
                  style={{ left: `${scale.pct(release.forecast)}%` }}
                />
              )}
              {pub.pauses.map((p) => (
                <span
                  key={p.from}
                  className="absolute inset-y-0 bg-status-waiting/15"
                  style={{
                    left: `${scale.pct(p.from)}%`,
                    width: `${scale.pct(p.to ?? asOf) - scale.pct(p.from)}%`,
                  }}
                />
              ))}
            </div>

            {g.tracks.map(({ track, activities }) => (
              <div key={track.id}>
                <div className="px-2 pt-1.5 pb-0.5 text-[9px] font-medium tracking-wide text-muted-foreground uppercase">
                  {track.name}
                </div>
                {activities.map((a) => (
                  <Row key={a.id} publication={pub} activity={a} health={health} scale={scale} />
                ))}
              </div>
            ))}
            {g.milestones.length > 0 && (
              <div>
                <div className="px-2 pt-1.5 pb-0.5 text-[9px] font-medium tracking-wide text-muted-foreground uppercase">
                  {da.publication.milestones}
                </div>
                {g.milestones.map((a) => (
                  <Row key={a.id} publication={pub} activity={a} health={health} scale={scale} />
                ))}
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  )
}

function Row({
  publication: pub,
  activity: a,
  health,
  scale,
}: {
  publication: Publication
  activity: Activity
  health: PublicationHealth
  scale: PrintScale
}) {
  const bar = printBar(pub, a, health, scale)
  const preliminary = pub.planState === 'preliminary' && bar.state !== 'done'
  return (
    <div className="grid h-4 grid-cols-[16rem_1fr] items-center">
      <div
        className={cn(
          'truncate px-2 leading-4',
          a.kind === 'milestone' && 'font-semibold',
          bar.state === 'skipped' && 'text-muted-foreground line-through',
        )}
        title={a.name}
      >
        {a.name}
      </div>
      <div className="relative h-full">
        {bar.baseline && (
          <span
            className="absolute bottom-0 h-0.5 bg-muted-foreground/50"
            style={{
              left: `${bar.baseline.left}%`,
              width: `${Math.max(bar.baseline.width, 0.15)}%`,
            }}
          />
        )}
        {bar.forecast && (
          <span
            className="absolute top-1 h-2 rounded-r-sm bg-status-risk/50"
            style={{
              left: `${bar.forecast.left}%`,
              width: `${bar.forecast.width}%`,
              backgroundImage: HATCH,
            }}
          />
        )}
        {bar.kind === 'task' ? (
          <span
            className={cn(
              'absolute top-1 h-2 rounded-sm',
              bar.state === 'done' && 'bg-status-done/70',
              bar.state === 'skipped' && 'border border-dashed border-bar-optional',
              bar.state === 'in_progress' && 'bg-bar-task',
              bar.state === 'not_started' && 'bg-bar-task/60',
              bar.state === 'waiting' && 'bg-status-waiting',
              bar.late && 'outline outline-1 outline-status-late',
            )}
            style={{
              left: `${bar.left}%`,
              width: `${Math.max(bar.width, scale.day)}%`,
              ...(preliminary ? { backgroundImage: HATCH } : {}),
            }}
          />
        ) : bar.kind === 'milestone' ? (
          <span
            className={cn(
              'absolute top-[3px] size-2 -translate-x-1/2 rotate-45 rounded-[1px]',
              bar.state === 'done' ? 'bg-status-done' : 'bg-milestone',
              bar.late && 'outline outline-1 outline-status-late',
            )}
            style={{ left: `${bar.left}%` }}
          />
        ) : (
          <span
            className={cn(
              'absolute top-0.5 h-3 w-0.5 -translate-x-1/2 rounded-full',
              bar.state === 'done'
                ? 'bg-status-done'
                : bar.state === 'skipped'
                  ? 'bg-bar-optional'
                  : bar.late
                    ? 'bg-status-late'
                    : 'bg-bar-deadline',
            )}
            style={{ left: `${bar.left}%` }}
          />
        )}
      </div>
    </div>
  )
}
