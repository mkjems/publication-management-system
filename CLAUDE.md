# CLAUDE.md

Publishing management system for a Danish book publisher. It turns the publisher's
_Masterproduktionsplan for bogudgivelser_ (`Research/Masterproduktionsplan_bogudgivelser.pdf`) into
live, per-book production plans with an interactive Gantt chart. The core differentiator is easy
handling of delays and postponements.

**Read `docs/PLAN.md` before starting a new phase.** It holds the domain model, the scheduling
engine design (§4), time simulation (§4.3), screens (§5) and the roadmap (§6).
`docs/masterplan-defaults.md` (Danish, for the client) explains the proposed durations and
dependencies.

## Status

- Stage A (current): frontend only, local state. Stage B (later): Postgres + API + auth.
- Phase 0 is done: monorepo, tooling, app shell, master plan encoded as data, read-only Masterplan page.
- Phase 1 is done: the scheduling engine in `packages/domain` (PLAN §4.2 lists the decisions).
- Phase 2 is done: workspaces, Tidsmaskine, portfolio list, wizard, plan table, side panel.
- Phase 3 is done: the interactive Gantt (`apps/web/src/components/gantt`).
- Phase 4 is done: whole-plan dialogs, scenario mode (sandbox), history with the slip chart,
  scenario books in the demo.
- Phase 5 is done: Oversigt (portfolio Gantt), Mine opgaver, funding tab and gate logic, role
  assignments, stress simulation.
- Next: **Phase 6**, template editor, polish and client validation (PLAN §6).

## Layout

```
apps/web          React 19 + Vite 8, TanStack Router (file routes in src/routes), Tailwind v4, shadcn/ui
  data/           WorkspaceRepository: IndexedDB (one database per workspace) and in-memory
  store/          Zustand workspace store: all plan changes go through `execute(id, command)`;
                  in scenario mode they go to the sandbox copy (read records via `selectRecord`)
  lib/clock.ts    the only place that reads the system clock
  components/     publication/ (table, panel, dialogs, funding), gantt/ (chart; scale.ts and
                  rows.ts are pure and tested), portfolio/ (portfolio Gantt), work/ (work lists),
                  workspace/ (Tidsmaskine), ui/
packages/domain   Framework-free TypeScript, no build step:
  calendar/       working-day calendar (Danish holidays, closures), date helpers
  model/          Zod schemas: template, publication, activity, events
  templates/      master plan data, builder DSL, validator
  engine/         generatePlan, analyzePlan (forecast/slack/critical path), previewReschedule,
                  shiftPlan, assessHealth, comparePlans, fundingStatus, workItems;
                  constraints.ts defines FS/SS/FF
  commands/       commands → { publication, events }; diff-based undo/redo history;
                  previewCommand; timeline.ts rebuilds past plans from the log (slip chart)
  simulation/     seeded simulateProgress, scenarios and the scenario library
  testing/        test fixtures (not exported)
docs/             Plan and client-facing notes
```

`@pms/domain` is consumed as TypeScript source (`exports: ./src/index.ts`), with no build step.

## Commands

```bash
pnpm dev          # web app on http://localhost:5173
pnpm check        # typecheck + lint + format check + all tests. Run before every commit.
pnpm test         # vitest (projects: domain, web)
pnpm format       # prettier --write
```

## Rules

- **The domain package never reads the system clock.** Anything that depends on "today" takes an
  explicit `asOf: IsoDate`. The app supplies it from a `Clock` that can be simulated (PLAN §4.3).
- **The domain package has no browser or React dependencies.** It will also run on the server.
- **Dates are `YYYY-MM-DD` strings** (`IsoDate`), never `Date` objects in state. Durations and
  template offsets are **working days**; offsets are relative to the release date (release = 0).
- Dependency semantics (see `model/common.ts`): `start = deadline − duration`; FS means
  `succ.start ≥ pred.deadline + lag`. Keep the validator and the engine consistent with this.
- Mutations go through commands that emit `ChangeEvent`s (undo/redo, audit, later API sync).
  Commands take a `CommandContext` (`asOf`, `recordedAt`, `by`, `newId`); the domain never
  generates ids or timestamps itself.
- Never overwrite the baseline (_Oprindelig deadline_); changes go to the current deadline and are
  logged. Baselines are numbered snapshots on the publication; baseline 0 is the original.
- Code, identifiers and comments are in English. **UI text is Danish** and lives in
  `apps/web/src/i18n/da.ts`. Master plan content (activity names etc.) stays in Danish, as in the PDF.
- `packages/domain/src/templates/masterplan-v1.ts` is hand-formatted (one line per activity) and
  excluded from Prettier. After editing it, `pnpm test` validates the whole network.
- UI components: shadcn/ui style in `apps/web/src/components/ui` (written by hand; the shadcn CLI
  hangs on an interactive prompt here). Use the design tokens in `src/styles.css` (status colors,
  `milestone`, `bar-*`, `phase-band`) rather than raw colors.
- TypeScript is pinned to 6.0.x: typescript-eslint does not support 7 yet.
- Two workspaces: **real** (real clock, no simulation) and **demo** (simulated date, seeded from
  the scenario library). Never let simulation touch the real workspace.
- After adding or renaming a route file, run `pnpm --filter @pms/web build` (or `pnpm dev`) to
  regenerate `routeTree.gen.ts` before typechecking.
