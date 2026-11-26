import { fundingStatus, getCalendar, originalBaseline } from '@pms/domain'
import { Link } from '@tanstack/react-router'
import {
  HealthBadge,
  LifecycleBadge,
  PlanStateBadge,
  ProgressBar,
  SlipBadge,
} from '@/components/status/status'
import { useHealth, usePersonName, usePublicationRecord } from '@/hooks/use-publication'
import { da } from '@/i18n/da'
import { formatDate, formatDateCompact, formatMoney } from '@/lib/format'
import { nextMilestone } from '@/lib/publication'
import { useWorkspace } from '@/store'

export function PortfolioRow({ id }: { id: string }) {
  const record = usePublicationRecord(id)!
  const asOf = useWorkspace((s) => s.asOf)
  const pub = record.publication
  const health = useHealth(pub, asOf)
  const lead = usePersonName(pub.projectLeadId)
  const next = nextMilestone(pub)
  const { overall, release } = health
  const funding = fundingStatus(pub, asOf)
  const base = originalBaseline(pub)
  const slipVsOriginal = base
    ? getCalendar(pub.calendar).workdaysBetween(base.releaseDate, release.target)
    : null
  const stopped = ['no_go', 'closed'].includes(pub.lifecycle)
  const paused = health.paused || pub.lifecycle === 'hold'

  return (
    <tr className="border-t align-top first:border-t-0 hover:bg-muted/40">
      <td className="py-3 pr-3 pl-5">
        <Link
          to="/publications/$publicationId"
          params={{ publicationId: id }}
          className="font-medium hover:text-primary hover:underline"
        >
          {pub.workingTitle}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <LifecycleBadge lifecycle={pub.lifecycle} />
          <PlanStateBadge planState={pub.planState} />
          {lead && <span className="text-xs text-muted-foreground">{lead}</span>}
        </div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap tabular-nums">
        {formatDate(release.target)}
        <div className="text-xs text-muted-foreground">
          {pub.planState === 'binding' ? da.publication.binding : da.publication.desired}
        </div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap tabular-nums">
        <span className="flex items-center gap-1.5">
          {formatDate(release.forecast)}
          <SlipBadge workdays={release.slipWorkdays} />
        </span>
      </td>
      <td className="px-3 py-3 tabular-nums">
        {slipVsOriginal === null ? (
          <span className="text-muted-foreground">–</span>
        ) : (
          <SlipBadge workdays={slipVsOriginal} showZero title={da.publications.slipHint} />
        )}
      </td>
      <td className="px-3 py-3 text-xs whitespace-nowrap tabular-nums">
        {funding.minimumRequired === 0 && pub.funding.applications.length === 0 ? (
          <span className="text-muted-foreground">–</span>
        ) : (
          <>
            <div className={funding.sufficient ? undefined : 'text-status-late'}>
              {formatMoney(funding.secured)}
            </div>
            <div className="text-muted-foreground">
              {da.funding.minimum.toLowerCase()} {formatMoney(funding.minimumRequired)}
            </div>
          </>
        )}
      </td>
      <td className="px-3 py-3">
        <ProgressBar value={overall.progress} className="mt-1.5" />
        <div className="mt-1 text-xs text-muted-foreground tabular-nums">
          {overall.done} / {overall.total - overall.skipped}
        </div>
      </td>
      <td className="px-3 py-3">
        {paused || stopped ? (
          <LifecycleBadge lifecycle={pub.lifecycle} />
        ) : (
          <HealthBadge state={overall.state} />
        )}
        {!stopped && (overall.late > 0 || overall.atRisk > 0 || overall.waiting > 0) && (
          <div className="mt-1 text-xs text-muted-foreground tabular-nums">
            {[
              overall.late && `${overall.late} forsinket`,
              overall.atRisk && `${overall.atRisk} i risiko`,
              overall.waiting && `${overall.waiting} afventer`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        )}
      </td>
      <td className="py-3 pr-5 pl-3">
        {next ? (
          <>
            <div>{next.name}</div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {formatDateCompact(next.deadline)}
            </div>
          </>
        ) : (
          '–'
        )}
      </td>
    </tr>
  )
}
