import { useRouterState } from '@tanstack/react-router'
import { TriangleAlert, X } from 'lucide-react'
import { useEffect } from 'react'
import { useFlash } from '@/store/flash'

/** The transient message (e.g. a refused command), shown on every page; cleared on navigation. */
export function FlashBanner() {
  const message = useFlash((s) => s.message)
  const clear = useFlash((s) => s.clear)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  useEffect(() => clear(), [pathname, clear])
  if (!message) return null
  return (
    <div
      role="alert"
      className="fixed right-4 bottom-4 z-[60] flex print:hidden max-w-md items-start gap-3 rounded-lg border border-status-late/40 bg-card px-4 py-3 text-sm shadow-lg"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-late" />
      <p className="flex-1">{message}</p>
      <button type="button" onClick={clear} aria-label="Luk">
        <X className="size-4" />
      </button>
    </div>
  )
}
