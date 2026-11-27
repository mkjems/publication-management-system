import { CommandError, TemplateEditError, pause, type CommandContext } from '@pms/domain'
import { describe, expect, it } from 'vitest'
import { errorText } from './errors'

describe('errorText', () => {
  it('gives refused commands and template edits a Danish text', () => {
    expect(errorText(new CommandError('already-paused', 'x'))).toBe(
      'Udgivelsen er allerede sat på pause.',
    )
    expect(errorText(new TemplateEditError('cycle', 'x'))).toContain('i ring')
    expect(errorText(new Error('boom'))).toBe('Der opstod en uventet fejl: boom')
  })

  it('covers the errors the domain actually throws', () => {
    const ctx: CommandContext = { asOf: '2026-11-26', recordedAt: '', by: null, newId: () => 'x' }
    const paused = { pauses: [{ from: '2026-11-01', to: null, reason: '' }] }
    expect(() => pause(paused as never, ctx, { reason: '' })).toThrow(CommandError)
    try {
      pause(paused as never, ctx, { reason: '' })
    } catch (e) {
      expect(errorText(e)).toBe('Udgivelsen er allerede sat på pause.')
    }
  })
})
