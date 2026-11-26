import { createFileRoute } from '@tanstack/react-router'
import { ListChecks } from 'lucide-react'
import { ComingSoon } from '@/components/coming-soon'
import { PageHeader } from '@/components/page-header'
import { da } from '@/i18n/da'

export const Route = createFileRoute('/my-work')({
  component: MyWorkPage,
})

function MyWorkPage() {
  return (
    <>
      <PageHeader title={da.nav.myWork} />
      <ComingSoon
        icon={ListChecks}
        title={da.comingSoon}
        body="Alt der skal ske i denne uge eller er forsinket, for en person eller rolle på tværs af alle udgivelser. Kommer i fase 5."
      />
    </>
  )
}
