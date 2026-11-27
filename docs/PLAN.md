# Publishing Management System — Development Plan

Status: v9 · 2026-11-27. Phases 0–6 are done (summarised in §6.1). Phase 7 (§6.2) responds to the
client's first feedback.
Source material: [Research/Masterproduktionsplan_bogudgivelser.pdf](../Research/Masterproduktionsplan_bogudgivelser.pdf)

---

## 1. What we are building

A planning and tracking tool for book production (bogudgivelser). It turns the publisher's
**Masterproduktionsplan** (11 phases, ~25 parallel tracks, ~130 activities, 14 milestones,
planned backwards from a release date) into a live plan per publication. The main view of a
publication is an **interactive Gantt chart**.

Goals, in priority order:

1. **Handle delays and postponements easily.** When something slips, the user sees at once what it
   affects and picks how to absorb it.
2. **Plan production.** Generate a plan for a new book from a master plan and a release date, then
   adapt it to the book.
3. **Track progress.** Status per activity, phase and publication; what is late, at risk or
   waiting; how the plan has drifted from the original.

**Delivery:** Stage A (now) is frontend only, with state in the browser (IndexedDB), deployed as a
demo site for the client. Stage B (§7) adds database, API, auth and multiple users as a swap of
the persistence layer, not a rewrite.

---

## 2. What the master plan tells us

| Concept in the PDF                                                                                   | What it means for the system                                                                                            |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Phases** 1–11 (Startmøde → Opfølgning), each with a window relative to release                     | Template phases with offsets from the release date. Phases 1–2 are anchored to the kickoff, phases 3–11 to the release. |
| **Tracks** within a phase run in parallel                                                            | Gantt rows are grouped Phase → Track → Activity.                                                                        |
| Columns: Aktivitet · Ansvarlig · Start · Oprindelig deadline · Aktuel deadline · Status · Bemærkning | Core activity record; the plan table mirrors these columns.                                                             |
| "Udfyld **Start** kun for aktiviteter med et reelt arbejdsforløb"                                    | Activity kinds: **task** (duration, a bar), **deadline** (a point), **milestone** (a gate or marker).                   |
| "Bevar altid **Oprindelig deadline**, og brug **Aktuel deadline** ved ændringer"                     | Baseline vs current. The original is never overwritten; every change is logged.                                         |
| **Status**: Ikke startet · I gang · Afventer · Færdig                                                | Status enum, plus `skipped`. "Afventer" records what it waits for.                                                      |
| **Ansvarlig**: roles, often combined                                                                 | Activities reference roles; each publication assigns people to roles.                                                   |
| **MILEPÆL** at the end of each phase                                                                 | Milestones; some are gates with a decision (GO/HOLD/NO-GO, funding, production start, release).                         |
| **Finansieringsforbehold**                                                                           | Desired vs binding release date, plan state (preliminary → binding), funding tracking, pause/resume.                    |
| "Hele produktionsplanen beregnes **baglæns**"                                                        | Plans are generated backwards from the release date.                                                                    |
| "Erfaringer føres tilbage i masterplanen"                                                            | Master plans are editable and versioned; actual durations are shown next to the template's.                             |

The PDF gives no durations, dependencies or working calendar. We proposed them
([masterplan-defaults.md](masterplan-defaults.md), Danish); the client wants them visible and
editable (§6.2).

**Roles:** Projektansvarlig, Forlægger, Redaktør, Forfatter, Grafiker, Billedansvarlig, Fotograf,
Korrekturlæser, Registerredaktør, Repro, Trykker, Presseansvarlig, Kommunikation, Salgsansvarlig,
Lager, Opdragsgiver, Forlaget, Projektteam.

**Milestones:** GO/HOLD/NO-GO · Finansiering tilstrækkelig / risiko godkendt · Produktionsstart ·
Revideret og gennemredigeret manus · Manus låst til layout · Billedmateriale komplet til layout ·
Principlayout godkendt · 1. ombrud klar · 2. ombrud klar · Bogen lukket · Trykgodkendelse ·
Færdige bøger godkendt og på lager · Udgivelse · Projekt afsluttet og evalueret.

---

## 3. Domain model

Zod schemas in `packages/domain/src/model`; the same schemas serve the API in Stage B.

```
Template (versioned; id + version)
 { id, version, name, basedOnVersion?, publishedOn?, changeNote?, nominalKickoffOffset,
   phases:    [{ id, number, name, period, window: { startOffset, endOffset }, anchor: kickoff|release }],
   tracks:    [{ id, phaseId, name }],
   activities:[{ id, phaseId, trackId | null, name, kind: task|deadline|milestone, responsible,
                 durationWorkdays, deadlineOffset, predecessors[{ activityId, type: FS|SS|FF, lagWorkdays }],
                 optional, compressible?, gate?, note? }] }

Publication (activities, baselines and calendar live inside it)
 { id, workingTitle, templateId, templateVersion, projectLeadId,
   kickoffDate, desiredReleaseDate, bindingReleaseDate | null,
   planState: preliminary | binding,
   lifecycle: idea | go | hold | no_go | active | paused | released | closed,
   funding: { minimumRequired, secured, riskAccepted, applications[] },
   roleAssignments: { roleId → personId[] }, pauses[{ from, to | null, reason }],
   calendar: { holidays, closures[] },
   baselines: [{ number, capturedOn, reason, releaseDate, activities: { id → { start, deadline } } }],
   activities: Activity[] }

Activity
 { id, templateActivityId | null, phaseId, trackId | null, name, kind, responsible, assigneeIds[],
   durationWorkdays, start | null, deadline, actualStart | null, actualFinish | null,
   status: not_started | in_progress | waiting | done | skipped, waitingFor | null,
   pinned, optional, compressible?, gate | null, note, predecessors[] }

ChangeEvent (append-only log: audit, undo/redo, slip chart, later API sync)
 { id, txId, publicationId, effectiveDate, recordedAt, by, type, payload, reason?, reasonCategory?, diff }
```

- **Dates** are `YYYY-MM-DD` strings; all arithmetic goes through the working-day calendar
  (weekends, Danish holidays including Easter-based ones, closures).
- **Dependencies:** `start = deadline − duration`; FS means `succ.start ≥ pred.deadline + lag`.
  `engine/constraints.ts` is the one definition, used by the validator and the engine.
- **Baselines** are numbered snapshots. Baseline 0 (_Oprindelig deadline_) is captured when the
  plan becomes binding; moving a binding release or resuming adds baseline 1, 2, … Variance is
  measured against baseline 0.
- **Diffs** record field changes and activity add/remove, so every event can be undone and past
  plans rebuilt from the log.
- Today a publication takes its phases and tracks from its template version. Phase 7 copies them
  into the publication (§6.2, step 1).

---

## 4. Scheduling engine

A pure TypeScript package (`packages/domain`) with no UI or browser dependencies, so the Gantt,
the table, previews and the future server share one implementation.

### 4.1 Capabilities

1. **Generate a plan** (`generatePlan`). Release-anchored phases are placed backwards from the
   release, kickoff-anchored phases forwards from the kickoff. If they overlap, the plan keeps
   the anchored dates and reports `compressionWorkdays` (Phase 7 adds fitting, §6.2 step 4).
2. **Critical path analysis** (`analyzePlan`): forecast (forward pass from `asOf` and actual
   progress), latest allowed dates (backward from the release), slack and critical flag.
3. **Delay propagation with a preview** (`previewReschedule`): affected activities with old → new
   dates, milestones moved, pinned conflicts, release effect. Nothing changes until applied.
4. **Strategies** after a slip: **absorb** (move only what must move), **push** (shift
   downstream work), **compress** (shorten compressible downstream tasks to protect the release),
   **move release** (with a reason; re-baselines).
5. **Pause / resume**: resume shifts unfinished work by the pause length, or replans from a new
   release date.
6. **Make binding**: completing the funding gate captures baseline 0 and makes the plan binding.
7. **Health** (`assessHealth`) per activity, phase and publication: late > waiting > at_risk >
   on_track; slip against baseline 0 is reported separately.

### 4.2 Implementation decisions

- **Working-day axis.** The engine computes on integer positions, one per working day
  (`WorkCalendar.ordinal`), so dependency rules are plain arithmetic.
- **Forecast never pulls work earlier** than planned; it pushes later for late predecessors, work
  not started by `asOf`, late starts and waiting.
- **Slack is measured against the release** for everything leading to it. Side tracks (press,
  funding follow-up) and post-release work are measured against their own deadlines.
- **Critical path** = walk back from the release through the predecessor with least slack.
- **Rescheduling only moves what is downstream.** Done and pinned activities never move (pinned
  conflicts must be accepted explicitly). A started task keeps its actual start; moving its
  deadline stretches it.
- **Push** shifts downstream work before the release; the release moves only if it has to.
  **Compress** shortens not-started, compressible tasks on the release chain, longest first, down
  to 50 %. Printing, production follow-up, transport and delivery are marked "fast varighed".
- **Pause/resume and release changes** shift remaining work (not overdue work, so lateness stays
  visible), then repair dependencies; nothing not yet started may start before the resume date.
- **At risk** = forecast slip, negative slack or a pinned conflict. On the overview it counts only
  work due within two weeks; otherwise everything downstream of a slip is "at risk" (514 items
  across 11 stress books).
- **Commands** (`commands/`) take a `CommandContext` (`asOf`, `recordedAt`, `by`, `newId`) and
  return `{ publication, events }`. One user action is one transaction; sub-commands fold in with
  `Transaction.include`, so one undo reverts e.g. a whole gate decision. Refused commands throw
  `CommandError(code, message)`.
- **Previews run the real command** (`previewCommand`) against a throwaway context, and
  `comparePlans` describes the result. Preview and apply cannot disagree.
- **Funding:** `secured` is the sum of granted applications. The funding gate can only be
  completed when the minimum is secured or the risk is accepted. **GO/HOLD/NO-GO** is one
  command (`decideGate`): GO completes the gate (resuming if on hold), HOLD pauses with lifecycle
  "hold", NO-GO stops the book.
- **Templates** are edited through pure functions (`templates/edit.ts`) that throw
  `TemplateEditError`. Schedule edits move neighbours minimally (`fitTemplateAround`); the release
  stays on day 0; gate milestones cannot be removed or change kind. Removing an activity drops
  the dependencies on it without bridging (the validator warns instead).
- Tests: Vitest unit tests, fast-check property tests (e.g. "no successor starts before its
  predecessor plus lag", "pinned dates never move silently"), scenarios replayed as regression
  tests.

### 4.3 Time and simulation

Time is an explicit input. **Nothing in `packages/domain` reads the system clock**; everything
that depends on "today" takes `asOf`. In the app, `lib/clock.ts` supplies the real or simulated
date.

- **Tidsmaskine:** date picker, ±day/week/month, back to today, play. A banner shows that the
  date is simulated.
- **Progress simulation** (`simulateProgress`) plays the team's work forward through the same
  commands as the user, with policies _on plan_, _realistic_ and _stress_ (most tasks overrun by
  20–100 %, milestones slip more often, about one task in eight waits 3–10 days). Random draws
  depend only on (seed, activity, day).
- **Scenario library:** named, reproducible scenarios (seed, start state, scripted events at
  dates, including a funding story). Used for demo books, as regression tests, and later as
  Playwright fixtures.
- **Two workspaces.** _Real_ uses the real clock and is never simulated. _Demo_ always has a
  simulated date: forward plays every demo book on; backward rebuilds the demo from the library
  (the user is asked first). Simulated changes are logged but clear the undo stack.
- `ChangeEvent` carries `effectiveDate` (business date, possibly simulated) and `recordedAt`
  (wall clock). History and the slip chart use `effectiveDate`.
- Stage B: the server gets an injectable clock; time travel only in demo and staging tenants.

---

## 5. Frontend

UI text is Danish (`apps/web/src/i18n/da.ts`); code is English.

### 5.1 Screens

1. **Oversigt (portfolio).** Six tiles (books in progress, overdue, at risk, waiting, due this
   week, slipping releases), the **portfolio Gantt** (one line per book; phases as bands in a
   one-hue ordinal ramp so books in the same phase line up; done work at actual dates, open work
   at forecast; release target and red forecast when later; pauses hatched), and two work lists:
   "Kræver opmærksomhed" and "Denne uge". Paused, HOLD and NO-GO books show their lifecycle
   instead of health. Empty workspaces show a three-step onboarding.
2. **Publication Gantt** (custom component, `components/gantt`). Rows Phase → Track → Activity,
   collapsible; bars, deadline ticks, milestone diamonds; baseline ghosts with variance badges;
   hatched forecast tails and thin slack tails; critical path toggle; today, binding and desired
   release lines; hatched preliminary plan; pause bands. Dependency arrows for the hovered or
   selected activity ("Alle afhængigheder" shows all); drag from a bar's end to create an FS
   link. Drag and resize snap to working days, and every drag or keyboard nudge (← →, Shift for
   a week) draws live impact ghosts and a release marker; drop opens the impact dialog. The axis
   is calendar days with non-working days shaded; zoom week 28 px/day, month 8, quarter 3.
3. **Plan table** in the PDF's columns, grouped Phase → Track, hand-written (no TanStack Table),
   with inline status and notes. Changing _Aktuel deadline_ opens the impact dialog.
4. **Activity side panel:** status, waiting-for, assignees, baseline vs current dates, pinned,
   predecessors and successors, notes, history.
5. **Impact dialog (Udskyd)** for one activity: new date or "+N arbejdsdage", reason category and
   text, preview, strategy, apply; undoable. Whole-plan changes sit in the **Planlægning** menu:
   move release, pause/resume, make binding, save baseline, roles and people, try a scenario.
6. **Finansiering** tab: applications, secured vs minimum, gate state, GO/HOLD/NO-GO dialog.
7. **Historik:** filterable log and the **milestone slip chart**, rebuilt from the log
   (`planTimeline`, `milestoneTrend`; weekly samples plus every planning change). Six key
   milestones get series colours; "Vis alle milepæle" adds the rest in grey. The table under the
   chart doubles as legend.
8. **Mine opgaver:** open work for everyone, a person or a role, bucketed (overdue, waiting, due
   this week, starting this week, due next week, in progress). A person matches through
   assignees, role assignments or being project lead.
9. **Masterplan** page and **editor**: read-only view with version list and comparison; the
   editor edits one draft per template with undo, shows "N uger før" next to offsets and a
   "Faktisk" column (median actual duration, highlighted at 3+ days' difference), and publishes
   only without validator errors. Versions are stored per workspace (`template:<id>@<n>`,
   `draft:<id>`) and travel with export/import.
10. **New publication wizard:** title, project lead, release and kickoff dates, master plan
    version, optional activities on/off, preview before creating.
11. **Scenario mode:** a fork of one publication's record. While open, every command, undo and
    redo goes to the copy; the Gantt draws the live plan as dotted ghosts where they differ.
    Applying replaces the live record (refused if the live record changed meanwhile). The
    Tidsmaskine is frozen while a scenario is open; scenarios are in memory only. In the demo,
    "Fra scenarie…" adds up to 10 books following a library scenario.
12. **Print / PDF** (`/publications/<id>/print`): a static, percent-based Gantt (one block per
    phase with its own month axis) and the table in the PDF's columns. `@page` sets A3 landscape
    (A4 selectable); the browser's "Gem som PDF" makes the file. No PDF library.

Cross-cutting: refused commands and template edits show Danish toasts via `lib/errors.ts`; a
Danish error page inside the layout; skip link, page titles and labelled controls; dismissible
first-visit hints.

### 5.2 Tech stack

| Concern     | Choice                                                                                 |
| ----------- | -------------------------------------------------------------------------------------- |
| Build       | pnpm monorepo (`packages/domain`, `apps/web`), Vite 8, React 19, TypeScript 6 (strict) |
| Routing     | TanStack Router (file routes)                                                          |
| State       | Zustand; all plan changes via `execute(id, command)`                                   |
| Persistence | IndexedDB via `idb-keyval` behind a repository interface; JSON export/import           |
| UI          | Tailwind v4, hand-written shadcn/ui components (Radix), lucide icons                   |
| Charts      | Hand-written SVG/HTML (Gantt, portfolio Gantt, slip chart)                             |
| Validation  | Zod                                                                                    |
| Tests       | Vitest, fast-check, Testing Library (jsdom). No Playwright yet.                        |
| Deploy      | Docker image, GitHub Actions to pms.mkjems.dk                                          |

**Performance** (20 books, 3,580 activities): portfolio health ~13 ms, a week of time travel
~11 ms, the slip chart of a 300-event book ~28 ms. React rendering of large charts is not
profiled.

---

## 6. Roadmap

### 6.1 Done (Phases 0–6)

| Phase | Delivered                                                                                                                                            |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Monorepo, tooling, app shell, master plan v1 as data, proposed durations and dependencies                                                            |
| 1     | Calendar, generation, CPM, reschedule preview and strategies, pause/resume, baselines, health, commands with undo/redo, simulation, scenario library |
| 2     | IndexedDB workspaces (real/demo), Tidsmaskine, portfolio list, wizard, plan table, impact dialog, side panel                                         |
| 3     | Interactive Gantt with live impact preview                                                                                                           |
| 4     | Whole-plan dialogs, scenario mode, history with slip chart, scenario books in the demo                                                               |
| 5     | Oversigt with portfolio Gantt, Mine opgaver, funding and gate logic, role assignments, stress policy                                                 |
| 6     | Master plan editor with versions, print/PDF, Danish errors, onboarding, accessibility and performance pass                                           |

Findings that still matter:

- The default network has ~25 working days of float on the release chain at production start; a
  3-week author delay is absorbed without moving the release, and a HOLD only starts moving the
  release forecast after about 5 weeks.
- Every move of a binding release and every resume saves a new baseline, so a busy book collects
  many (open question 3).
- Playwright end-to-end tests are still missing; flows are covered by component tests and manual
  checks.

### 6.2 Phase 7: Flexible plans (L)

**Client feedback (first look at the demo site, 2026-11):** the system is too rigid. The client
wants to run both small and large projects; today every book takes the same time. They want to
add and remove activities and deadlines in a running book, keep a list of master plans, pick
one when creating a book, change its activities freely, and save a book's plan as a new master
plan. Durations, deadlines and dependencies should be out in the open and editable. Master plan
editing should be as visual as the publication Gantt. Also: better icons. A real user system
with roles is wanted later (Stage B, §7).

**Root causes:** (a) one master plan per workspace; (b) a book is the template frozen at its
offsets, structure included, so it cannot change shape and does not scale with the time
available; (c) the master plan is edited as a form, not as a schedule. The engine, delay
handling, scenarios and history are not affected.

**Goal:** the plan adapts to the book. A master plan is a starting point, not a mould.

Steps, in order (each ends with something demoable):

1. **The book owns its structure.** Copy phases and tracks into the publication at generation
   (with a migration for existing books), so the Gantt, table and print read the book, not the
   template. `templateId`/`templateVersion` remain as "based on".
2. **Add and remove in a running book.** New commands with events `activity_added`,
   `activity_removed`, plus `track_added`/`track_removed`/`track_renamed`. Adding places a custom
   activity (`templateActivityId: null`) in a track, either at a date or after a predecessor,
   through the impact preview. Removing drops dependencies on it (as in the template editor) and
   keeps it in the history; done activities can be removed too. `skipped` is allowed for any
   activity, not only optional ones. The release milestone can be neither removed nor skipped;
   for the other gates see question 11. UI: "Tilføj aktivitet" on track rows in the Gantt and
   table, "Fjern" in the side panel and context menu. All undoable.
3. **Several master plans.** A list page (Masterplaner): create blank, copy an existing one,
   rename, archive. Each has its own versions and draft (drafts are already keyed by template
   id). Version 1 of today's plan becomes "Standard". Books keep the plan and version they came
   from.
4. **Wizard and "save as master plan".** The wizard picks a master plan and version, then shows
   the full activity list to include or exclude (gates locked) and add to, with a live Gantt
   preview. A book's current plan can be saved as a new master plan or as a new version of an
   existing one (offsets relative to its release; durations from the plan or, optionally, the
   actual durations). The wizard offers this too.
5. **Fit to the time available.** When kickoff → release is shorter or longer than the master
   plan assumes, `generatePlan` can scale compressible task durations (and the gaps between
   them) to fit, with a minimum of one day and fixed-duration tasks untouched. The wizard shows
   what changed ("Planen er 30 % kortere end masterplanen, 42 opgaver er forkortet") and lets the
   user choose between fitting and keeping the master plan's durations (today's behaviour). How
   this combines with plans per book type depends on question 12.
6. **Assumptions in the open.** The Masterplan page shows every activity's duration, deadline
   (weeks before release), dependencies with lag, fixed/compressible, and the reasoning from
   [masterplan-defaults.md](masterplan-defaults.md) as notes in the app. In a book, the table can
   show and edit duration and predecessors inline (via the existing commands), and the book
   shows how it differs from its master plan (`compareTemplates`).
7. **Visual master plan editor.** A Gantt of the draft on a "weeks before release" axis, reusing
   `gantt/scale.ts` and `rows.ts`: drag to move a deadline, resize for duration, drag to link,
   with ghosts for what `fitTemplateAround` moves; the existing activity sheet for the other
   fields. The table editor stays as a second view.
8. **Icons.** Review activity-kind, status and navigation icons with the client; replace unclear
   ones (lucide).

_Demo:_ create a small book from a short master plan with a few activities removed and one added;
fit it into 4 months; save it as "Lille bog"; add a deadline to a running book and see the impact.

---

## 7. Stage B: backend

Stage A choices that keep this a swap rather than a rewrite: the domain package has no browser
dependencies; persistence sits behind a repository interface; commands and `ChangeEvent`s map
to API mutations and an audit log; ids are UUIDs created on the client; state is normalized.

Proposed (to confirm):

- **API:** TypeScript (Hono or Fastify), OpenAPI from the Zod schemas.
- **DB:** PostgreSQL with Drizzle. Tables: templates (versioned), publications, activities,
  dependencies, people, role assignments, funding applications, change events.
- **Auth and permissions** (asked for by the client): SSO via Microsoft Entra ID if they use
  Microsoft 365, otherwise email magic link. Roles and authorization, e.g. only the project lead
  or publisher may change binding dates or publish master plans.
- **Collaboration:** optimistic updates; live updates (SSE/WebSocket) when several people edit.
- **Notifications:** email digests, ICS feed of milestones.
- **Hosting:** EU region (GDPR).

---

## 8. Open questions for the client

1. **Scale:** how many books at once, how many users; is workload per person needed?
2. **Durations and dependencies:** do they accept the proposed defaults?
3. **Baselines:** who may re-baseline, and should every release move or resume save one?
4. **Approval:** do date changes need approval, or apply directly and get logged?
5. **Calendar:** which closures (printer summer break, Christmas)? Book printer slots?
6. **Funding:** is "secured vs minimum" enough, or full tracking with reporting deadlines?
7. **"At risk":** is "due within two weeks" the right limit on the overview?
8. **Integrations:** Outlook/Google calendar, email reminders, Bogportalen, Excel/PDF?
9. **External contributors:** should authors, designers and printers see their own tasks?
10. **Language:** Danish only, or English too?
11. **Gates in a flexible plan:** may a book drop GO/HOLD/NO-GO or the funding gate (e.g. a fully
    funded commission)? Then the plan would be made binding by hand.
12. **Small vs large books:** a master plan per book type (small, large, art book, reprint …),
    one plan that stretches to the time available, or both?
13. **Icons:** which ones were unclear?

Client test sessions: [klienttest.md](klienttest.md).
