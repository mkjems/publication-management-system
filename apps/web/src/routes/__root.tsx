import { createRootRoute, Outlet } from '@tanstack/react-router'
import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { useEffect } from 'react'
import { AppSidebar, MobileNav } from '@/components/app-sidebar'
import { FlashBanner } from '@/components/flash-banner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TimeMachine } from '@/components/workspace/time-machine'
import { da } from '@/i18n/da'
import { useWorkspace } from '@/store'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const status = useWorkspace((s) => s.status)
  const error = useWorkspace((s) => s.error)
  const load = useWorkspace((s) => s.load)

  useEffect(() => {
    void load()
  }, [load])

  return (
    <TooltipProvider>
      <a
        href="#main"
        className="sr-only z-[70] rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {da.skipToContent}
      </a>
      <div className="flex min-h-svh">
        <AppSidebar />
        <div className="@container min-w-0 flex-1">
          <MobileNav />
          <main
            id="main"
            tabIndex={-1}
            className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8 print:max-w-none print:p-0 outline-none"
          >
            {status === 'ready' && (
              <div className="print:hidden">
                <TimeMachine />
              </div>
            )}
            {status === 'error' && (
              <div className="mb-6 flex gap-3 rounded-lg border border-status-late/40 bg-status-late/10 px-4 py-3 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-status-late" />
                <p>
                  {da.workspace.error}: {error}
                </p>
              </div>
            )}
            {status === 'loading' ? (
              <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                {da.workspace.loading}
              </div>
            ) : (
              <Outlet />
            )}
          </main>
        </div>
      </div>
      <FlashBanner />
    </TooltipProvider>
  )
}
