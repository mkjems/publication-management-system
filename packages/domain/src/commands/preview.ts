/**
 * Previews of whole-plan commands (pause, resume, release date changes). Commands are pure, so a
 * preview simply runs the command against the current plan with a throwaway context and
 * compares the result. Nothing is stored.
 */
import { comparePlans, type PlanComparison } from '../engine/compare'
import type { IsoDate } from '../model/common'
import type { Publication } from '../model/publication'
import type { CommandContext } from './context'
import type { CommandResult } from './transaction'

export type CommandPreview<R extends CommandResult> = R & { comparison: PlanComparison }

export function previewCommand<R extends CommandResult>(
  pub: Publication,
  asOf: IsoDate,
  command: (pub: Publication, ctx: CommandContext) => R,
): CommandPreview<R> {
  let n = 0
  const ctx: CommandContext = {
    asOf,
    recordedAt: '1970-01-01T00:00:00.000Z',
    by: null,
    newId: () => `preview-${++n}`,
  }
  const result = command(pub, ctx)
  return { ...result, comparison: comparePlans(pub, result.publication, asOf) }
}
