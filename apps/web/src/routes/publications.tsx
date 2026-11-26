import { createFileRoute } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'
import { ComingSoon } from '@/components/coming-soon'
import { PageHeader } from '@/components/page-header'
import { da } from '@/i18n/da'

export const Route = createFileRoute('/publications')({
  component: PublicationsPage,
})

function PublicationsPage() {
  return (
    <>
      <PageHeader title={da.nav.publications} />
      <ComingSoon
        icon={BookOpen}
        title={da.comingSoon}
        body="Her opretter du en ny udgivelse ud fra masterplanen og en ønsket udgivelsesdato. Planen beregnes automatisk baglæns. Kommer i fase 2."
      />
    </>
  )
}
