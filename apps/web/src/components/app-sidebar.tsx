import { Link } from '@tanstack/react-router'
import { BookOpen, LayoutDashboard, ListChecks, Map } from 'lucide-react'
import type { ComponentType } from 'react'
import { da } from '@/i18n/da'
import { WorkspaceSwitcher } from './workspace/workspace-switcher'

interface NavItem {
  to: '/' | '/publications' | '/my-work' | '/masterplan'
  label: string
  icon: ComponentType<{ className?: string }>
}

const NAV: NavItem[] = [
  { to: '/', label: da.nav.overview, icon: LayoutDashboard },
  { to: '/publications', label: da.nav.publications, icon: BookOpen },
  { to: '/my-work', label: da.nav.myWork, icon: ListChecks },
  { to: '/masterplan', label: da.nav.masterplan, icon: Map },
]

export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <img src="/favicon.svg" alt="" className="size-8" />
        <div className="leading-tight">
          <div className="text-sm font-semibold">{da.appName}</div>
          <div className="text-xs text-muted-foreground">{da.appTagline}</div>
        </div>
      </div>
      <nav className="flex flex-col gap-0.5 px-3">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === '/' }}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:font-medium data-[status=active]:text-foreground"
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto px-5 py-4">
        <WorkspaceSwitcher />
      </div>
    </aside>
  )
}

/** Compact top navigation for narrow screens. */
export function MobileNav() {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b bg-sidebar px-3 py-2 md:hidden">
      {NAV.map(({ to, label }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact: to === '/' }}
          className="rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap text-muted-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-foreground"
        >
          {label}
        </Link>
      ))}
      <div className="ml-auto shrink-0">
        <WorkspaceSwitcher compact />
      </div>
    </nav>
  )
}
