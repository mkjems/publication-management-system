import 'fake-indexeddb/auto'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useWorkspace } from '@/store'
import { useFlash } from '@/store/flash'
import { TemplateEditor } from './template-editor'

beforeEach(async () => {
  await useWorkspace.getState().load('real')
  useWorkspace.getState().discardTemplateDraft('masterplan')
  useWorkspace.getState().startTemplateDraft('masterplan')
  useFlash.getState().clear()
})

const draft = () => useWorkspace.getState().templateDrafts.masterplan!
const activity = (id: string) => draft().activities.find((a) => a.id === id)!

function renderEditor(onClose = vi.fn()) {
  render(
    <TooltipProvider>
      <TemplateEditor templateId="masterplan" onClose={onClose} />
    </TooltipProvider>,
  )
  return onClose
}

function openPhase(name: string) {
  // The phase toggle's name starts with the phase number.
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^\\d+\\s*${name}`) }))
}

describe('TemplateEditor', () => {
  it('changes a duration inline, moves the neighbours and undoes it', () => {
    renderEditor()
    openPhase('Indholdet udvikles')
    const before = activity('illustration-list').deadlineOffset
    const input = screen.getByLabelText('Varighed (arbejdsdage): Billedresearch')
    fireEvent.change(input, { target: { value: '40' } })
    fireEvent.blur(input)

    expect(activity('image-research').durationWorkdays).toBe(40)
    expect(activity('illustration-list').deadlineOffset).toBeLessThan(before)
    expect(screen.getByRole('status')).toHaveTextContent(/andre aktiviteter blev flyttet/)
    expect(screen.queryByText(/\d+ fejl/)).not.toBeInTheDocument()

    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: /Fortryd/ }))
    expect(activity('image-research').durationWorkdays).toBe(20)
    expect(input).toHaveValue('20')
  })

  it('refuses a dependency cycle with a Danish message', () => {
    renderEditor()
    openPhase('Startmøde')
    // The first match is the row itself; the others are dependency chips.
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Startmøde indkaldes og gennemføres' })[0]!,
    )
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Tilføj afhængighed…'), {
      target: { value: 'kickoff-idea' },
    })
    expect(useFlash.getState().message).toMatch(/i ring/)
    expect(activity('kickoff-meeting').predecessors).toEqual([])
  })

  it('publishes the draft as the next version', () => {
    const onClose = renderEditor()
    openPhase('Indholdet udvikles')
    const input = screen.getByLabelText('Varighed (arbejdsdage): Billedresearch')
    fireEvent.change(input, { target: { value: '25' } })
    fireEvent.blur(input)

    fireEvent.click(screen.getByRole('button', { name: /Udgiv version 2/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Billedresearch')).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText('Hvad er ændret?'), {
      target: { value: 'Mere tid til billedresearch' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: /Udgiv version 2/ }))

    expect(onClose).toHaveBeenCalled()
    const v2 = useWorkspace.getState().templates.find((t) => t.version === 2)
    expect(v2).toMatchObject({ changeNote: 'Mere tid til billedresearch' })
    expect(useWorkspace.getState().templateDrafts.masterplan).toBeUndefined()
  })
})
