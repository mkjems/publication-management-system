/**
 * Funding commands (PLAN §5.1.6). `funding.secured` is kept equal to the sum of granted
 * applications, so it can never drift from the applications.
 */
import { securedAmount } from '../engine/funding'
import type { IsoDate } from '../model/common'
import type { Funding, FundingApplication, Publication } from '../model/publication'
import { CommandError } from './commands'
import type { CommandContext } from './context'
import { Transaction, type ChangeMeta, type CommandResult } from './transaction'

export type FundingApplicationInput = Omit<FundingApplication, 'id'>

/** Sets the minimum required and/or whether the publisher accepts the funding risk. */
export function setFundingTarget(
  pub: Publication,
  changes: Partial<Pick<Funding, 'minimumRequired' | 'riskAccepted'>>,
  ctx: CommandContext,
  meta: ChangeMeta = {},
): CommandResult {
  if (changes.minimumRequired !== undefined && !(changes.minimumRequired >= 0)) {
    throw new CommandError('The minimum must be zero or more')
  }
  const tx = new Transaction(ctx, pub)
  tx.record(
    'funding_changed',
    withFunding(pub, { ...pub.funding, ...changes }),
    { op: 'target', ...changes },
    meta,
  )
  return tx.result()
}

export function addFundingApplication(
  pub: Publication,
  input: FundingApplicationInput,
  ctx: CommandContext,
): CommandResult & { applicationId: string } {
  validate(input)
  const application: FundingApplication = { ...input, id: ctx.newId() }
  const tx = new Transaction(ctx, pub)
  tx.record(
    'funding_changed',
    withFunding(pub, { ...pub.funding, applications: [...pub.funding.applications, application] }),
    { op: 'added', applicationId: application.id, funder: application.funder },
  )
  return { ...tx.result(), applicationId: application.id }
}

/**
 * Updates an application. Moving it to "submitted", "granted" or "rejected" fills in the
 * submission or decision date (default: `on`, or the business date) if it is missing.
 */
export function updateFundingApplication(
  pub: Publication,
  applicationId: string,
  changes: Partial<FundingApplicationInput>,
  ctx: CommandContext,
  options: { on?: IsoDate } & ChangeMeta = {},
): CommandResult {
  const before = pub.funding.applications.find((a) => a.id === applicationId)
  if (!before) throw new CommandError(`Unknown funding application "${applicationId}"`)
  const on = options.on ?? ctx.asOf
  const next: FundingApplication = { ...before, ...changes }
  if (next.status !== 'planned' && next.submittedAt === null) next.submittedAt = on
  if ((next.status === 'granted' || next.status === 'rejected') && next.decidedAt === null) {
    next.decidedAt = on
  }
  // Only decided applications have a decision date; only submitted ones a submission date.
  if (next.status === 'planned') next.submittedAt = null
  if (next.status === 'planned' || next.status === 'submitted') next.decidedAt = null
  validate(next)
  const tx = new Transaction(ctx, pub)
  tx.record(
    'funding_changed',
    withFunding(pub, {
      ...pub.funding,
      applications: pub.funding.applications.map((a) => (a.id === applicationId ? next : a)),
    }),
    {
      op: 'updated',
      applicationId,
      funder: next.funder,
      ...(before.status !== next.status
        ? { status: { from: before.status, to: next.status } }
        : {}),
    },
    {
      ...(options.reason ? { reason: options.reason } : {}),
      ...(options.reasonCategory ? { reasonCategory: options.reasonCategory } : {}),
    },
  )
  return tx.result()
}

export function removeFundingApplication(
  pub: Publication,
  applicationId: string,
  ctx: CommandContext,
): CommandResult {
  const a = pub.funding.applications.find((x) => x.id === applicationId)
  if (!a) throw new CommandError(`Unknown funding application "${applicationId}"`)
  const tx = new Transaction(ctx, pub)
  tx.record(
    'funding_changed',
    withFunding(pub, {
      ...pub.funding,
      applications: pub.funding.applications.filter((x) => x.id !== applicationId),
    }),
    { op: 'removed', applicationId, funder: a.funder },
  )
  return tx.result()
}

function withFunding(pub: Publication, funding: Funding): Publication {
  return { ...pub, funding: { ...funding, secured: securedAmount(funding.applications) } }
}

function validate(a: FundingApplicationInput) {
  if (!a.funder.trim()) throw new CommandError('A funding application needs a funder')
  if (!(a.amount >= 0)) throw new CommandError('The amount must be zero or more')
  if (a.submittedAt && a.decidedAt && a.decidedAt < a.submittedAt) {
    throw new CommandError('A decision cannot come before the application was submitted')
  }
}
