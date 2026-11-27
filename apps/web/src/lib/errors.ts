import { CommandError, DiffConflictError, TemplateEditError } from '@pms/domain'
import { COMMAND_ERROR_TEXT, TEMPLATE_EDIT_ERROR_TEXT, da } from '@/i18n/da'

/**
 * Danish text for an error shown to the user. Refused commands and template edits carry a code;
 * anything else is unexpected and keeps its own message after a Danish lead-in.
 */
export function errorText(e: unknown): string {
  if (e instanceof CommandError) return COMMAND_ERROR_TEXT[e.code]
  if (e instanceof TemplateEditError) return TEMPLATE_EDIT_ERROR_TEXT[e.code]
  if (e instanceof DiffConflictError) return da.errors.conflict
  return `${da.errors.unexpected}: ${e instanceof Error ? e.message : String(e)}`
}
