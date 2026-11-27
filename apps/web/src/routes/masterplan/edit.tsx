import { MASTERPLAN_V1 } from '@pms/domain'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { TemplateEditor } from '@/components/masterplan/editor/template-editor'
import { Button } from '@/components/ui/button'
import { da } from '@/i18n/da'
import { useWorkspace } from '@/store'

export const Route = createFileRoute('/masterplan/edit')({
  component: EditorPage,
})

const TEMPLATE_ID = MASTERPLAN_V1.id

function EditorPage() {
  const navigate = useNavigate()
  const hasDraft = useWorkspace((s) => Boolean(s.templateDrafts[TEMPLATE_ID]))
  const startDraft = useWorkspace((s) => s.startTemplateDraft)
  if (!hasDraft) {
    return (
      <div className="py-16 text-center">
        <p className="font-medium">{da.templateEditor.noDraft}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={() => startDraft(TEMPLATE_ID)}>{da.masterplan.edit}</Button>
          <Button variant="outline" asChild>
            <Link to="/masterplan">{da.templateEditor.back}</Link>
          </Button>
        </div>
      </div>
    )
  }
  return (
    <TemplateEditor templateId={TEMPLATE_ID} onClose={() => void navigate({ to: '/masterplan' })} />
  )
}
