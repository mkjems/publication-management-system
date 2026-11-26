/**
 * Funding status (PLAN §5.1.6): secured versus the minimum needed before the plan can become
 * binding, what is still pending, and which decisions are due or overdue.
 */
import type { IsoDate } from '../model/common'
import type { FundingApplication, Publication } from '../model/publication'

export interface FundingStatus {
  minimumRequired: number
  /** Sum of granted applications. */
  secured: number
  /** Sum of submitted applications still waiting for a decision. */
  pending: number
  /** Sum of applications not submitted yet. */
  planned: number
  /** DKK still missing to reach the minimum (0 when reached). */
  gap: number
  riskAccepted: boolean
  /** The funding gate may pass: the minimum is secured, or the publisher accepts the risk. */
  sufficient: boolean
  /** Submitted applications by expected decision date, soonest first. */
  awaiting: FundingApplication[]
  /** Submitted applications whose expected decision date has passed. */
  overdueDecisions: FundingApplication[]
}

export function securedAmount(applications: readonly FundingApplication[]): number {
  return sum(applications.filter((a) => a.status === 'granted'))
}

/** Whether the funding gate (_Finansiering tilstrækkelig / risiko godkendt_) may be passed. */
export function isFundingSufficient(pub: Publication): boolean {
  const f = pub.funding
  return f.riskAccepted || securedAmount(f.applications) >= f.minimumRequired
}

export function fundingStatus(pub: Publication, asOf: IsoDate): FundingStatus {
  const f = pub.funding
  const secured = securedAmount(f.applications)
  const awaiting = f.applications
    .filter((a) => a.status === 'submitted')
    .sort((a, b) =>
      (a.expectedDecisionAt ?? '9999-12-31').localeCompare(b.expectedDecisionAt ?? '9999-12-31'),
    )
  return {
    minimumRequired: f.minimumRequired,
    secured,
    pending: sum(awaiting),
    planned: sum(f.applications.filter((a) => a.status === 'planned')),
    gap: Math.max(0, f.minimumRequired - secured),
    riskAccepted: f.riskAccepted,
    sufficient: isFundingSufficient(pub),
    awaiting,
    overdueDecisions: awaiting.filter(
      (a) => a.expectedDecisionAt !== null && a.expectedDecisionAt < asOf,
    ),
  }
}

function sum(apps: readonly FundingApplication[]): number {
  return apps.reduce((t, a) => t + a.amount, 0)
}
