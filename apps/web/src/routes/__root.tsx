import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AppSidebar, MobileNav } from '@/components/app-sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <TooltipProvider>
      <div className="flex min-h-svh">
        <AppSidebar />
        <div className="min-w-0 flex-1">
          <MobileNav />
          <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
