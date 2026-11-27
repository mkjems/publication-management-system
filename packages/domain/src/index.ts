// Model
export * from './model/common'
export * from './model/roles'
export * from './model/template'
export * from './model/publication'
export * from './model/events'

// Calendar
export * from './calendar/calendar'
export * from './calendar/dates'
export { danishHolidays, easterSunday, type Holiday } from './calendar/holidays-dk'

// Templates
export { parseResponsibility } from './templates/builder'
export {
  validateTemplate,
  MILESTONE_WINDOW_TOLERANCE,
  type TemplateIssue,
  type TemplateIssueCode,
} from './templates/validate'
export { MASTERPLAN_V1 } from './templates/masterplan-v1'
export * from './templates/edit'
export * from './templates/library'

// Scheduling engine
export { topologicalOrder, type TopoResult } from './engine/graph'
export {
  generatePlan,
  type GeneratePlanInput,
  type GeneratedPlan,
  type DependencyViolation,
} from './engine/generate'
export * from './engine/analyze'
export * from './engine/reschedule'
export * from './engine/health'
export * from './engine/compare'
export * from './engine/funding'
export * from './engine/work'

// Commands, history
export type { CommandContext } from './commands/context'
export type { CommandResult, ChangeMeta } from './commands/transaction'
export * from './commands/commands'
export * from './commands/history'
export * from './commands/funding'
export * from './commands/preview'
export * from './commands/timeline'
export { DiffConflictError, applyDiff, diffPublication, invertDiff } from './commands/diff'

// Simulation
export * from './simulation/simulate'
export * from './simulation/scenario'
export { SCENARIOS } from './simulation/library'

// Workspace
export * from './workspace/workspace'
export {
  seedDemoWorkspace,
  scenarioBook,
  DEMO_BOOKS,
  DEMO_PEOPLE,
  type DemoWorkspace,
} from './workspace/demo'
