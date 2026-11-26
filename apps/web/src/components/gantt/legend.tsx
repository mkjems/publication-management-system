import { Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { KindGlyph } from '@/components/masterplan/kind-glyph'
import { da } from '@/i18n/da'

const HATCH =
  'repeating-linear-gradient(135deg, rgb(255 255 255 / 0.35) 0 3px, transparent 3px 7px)'

/** What the marks in the Gantt mean, and how to edit with mouse and keyboard. */
export function GanttLegend({
  preliminary,
  paused,
  sandbox,
}: {
  preliminary: boolean
  paused?: boolean
  sandbox?: boolean
}) {
  const l = da.gantt.legend
  return (
    <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Item mark={<KindGlyph kind="task" />}>{l.task}</Item>
        <Item mark={<KindGlyph kind="deadline" />}>{l.deadline}</Item>
        <Item mark={<KindGlyph kind="milestone" />}>{l.milestone}</Item>
        <Item mark={<span className="h-[3px] w-5 rounded-full bg-foreground/25" />}>
          {l.baseline}
        </Item>
        <Item
          mark={
            <span
              className="h-3 w-5 rounded-r-sm bg-status-risk/40"
              style={{ backgroundImage: HATCH }}
            />
          }
        >
          {l.forecast}
        </Item>
        <Item mark={<span className="h-0.5 w-5 bg-muted-foreground/35" />}>{l.slack}</Item>
        {preliminary && (
          <Item
            mark={
              <span
                className="h-3 w-5 rounded-sm bg-bar-task/60"
                style={{ backgroundImage: HATCH }}
              />
            }
          >
            {l.preliminary}
          </Item>
        )}
        {paused && (
          <Item
            mark={
              <span
                className="h-3 w-5 bg-status-waiting/15 opacity-60"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(135deg, var(--status-waiting) 0 1px, transparent 1px 10px)',
                }}
              />
            }
          >
            {l.pause}
          </Item>
        )}
        {sandbox && (
          <Item
            mark={
              <span className="h-3 w-5 rounded-sm border-2 border-dotted border-muted-foreground/70" />
            }
          >
            {l.sandbox}
          </Item>
        )}
        <Item mark={<span className="h-3 w-px bg-status-active" />}>{da.gantt.today}</Item>
        <Item
          mark={
            <span
              className={
                preliminary
                  ? 'h-3 w-0 border-l-2 border-dashed border-primary/70'
                  : 'h-3 w-0 border-l-2 border-primary'
              }
            />
          }
        >
          {preliminary ? da.gantt.desiredRelease : da.gantt.bindingRelease}
        </Item>
      </div>
      <p className="flex items-start gap-1.5">
        <Info className="mt-px size-3.5 shrink-0" />
        {da.gantt.help}
      </p>
    </div>
  )
}

function Item({ mark, children }: { mark: ReactNode; children: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex h-4 w-5 items-center justify-center">{mark}</span>
      {children}
    </span>
  )
}
