import type { CommandContext, CommandResult, Publication } from '@pms/domain'
import { useCallback } from 'react'
import { useWorkspace } from '@/store'
import { useFlash } from '@/store/flash'

/** Runs a domain command on a publication; a refused command shows a message instead of throwing. */
export function useCommand(publicationId: string) {
  const execute = useWorkspace((s) => s.execute)
  const show = useFlash((s) => s.show)
  return useCallback(
    (command: (pub: Publication, ctx: CommandContext) => CommandResult): boolean => {
      try {
        execute(publicationId, command)
        return true
      } catch (e) {
        show(e instanceof Error ? e.message : String(e))
        return false
      }
    },
    [execute, publicationId, show],
  )
}
