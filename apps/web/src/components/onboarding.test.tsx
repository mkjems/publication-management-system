import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { Hint } from './onboarding'

beforeEach(() => localStorage.clear())

describe('Hint', () => {
  it('stays dismissed in this browser', () => {
    const { unmount } = render(<Hint id="x">Tip</Hint>)
    fireEvent.click(screen.getByRole('button', { name: 'Skjul tip' }))
    expect(screen.queryByText('Tip')).not.toBeInTheDocument()
    unmount()
    render(<Hint id="x">Tip</Hint>)
    expect(screen.queryByText('Tip')).not.toBeInTheDocument()
    render(<Hint id="y">Andet tip</Hint>)
    expect(screen.getByText('Andet tip')).toBeInTheDocument()
  })
})
