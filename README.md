# Publishing Management System

Planning and tracking tool for book production, built on the publisher's
_Masterproduktionsplan for bogudgivelser_ ([Research/](Research/)).

- Plan: [docs/PLAN.md](docs/PLAN.md)
- Proposed default durations and dependencies (for client review): [docs/masterplan-defaults.md](docs/masterplan-defaults.md)

## Structure

```
apps/web          React 19 + Vite frontend (TanStack Router, Tailwind v4, shadcn/ui)
packages/domain   Framework-free domain model, master plan template, (later) scheduling engine
```

## Getting started

Requires Node 24+ and pnpm 11.

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

## Scripts

| Command          | What it does                            |
| ---------------- | --------------------------------------- |
| `pnpm dev`       | Start the web app                       |
| `pnpm build`     | Production build                        |
| `pnpm test`      | Run all unit tests (Vitest)             |
| `pnpm typecheck` | TypeScript check of all packages        |
| `pnpm lint`      | ESLint                                  |
| `pnpm format`    | Prettier                                |
| `pnpm check`     | typecheck + lint + format check + tests |

## Conventions

- Code and identifiers in English; UI text in Danish via `apps/web/src/i18n/da.ts`.
- Template offsets are **working days relative to the release date** (release = 0).
- The master plan data file is hand-formatted (one line per activity) and excluded from Prettier.
