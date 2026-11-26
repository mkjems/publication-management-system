import { createFileRoute, Link } from '@tanstack/react-router'
import { LayoutDashboard } from 'lucide-react'
import { ComingSoon } from '@/components/coming-soon'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { da } from '@/i18n/da'

export const Route = createFileRoute('/')({
  component: OverviewPage,
})

function OverviewPage() {
  return (
    <>
      <PageHeader
        title={da.nav.overview}
        description="Status for alle udgivelser: hvad er forsinket, hvad er i risiko, og hvad skal ske i denne uge."
        actions={
          <Button asChild variant="outline">
            <Link to="/masterplan">Se masterplanen</Link>
          </Button>
        }
      />
      <ComingSoon
        icon={LayoutDashboard}
        title="Ingen udgivelser endnu"
        body="Porteføljeoverblikket med status, sundhed og næste milepæl for hver bog kommer i fase 5. Udgivelser kan oprettes fra masterplanen i fase 2."
      />
    </>
  )
}
