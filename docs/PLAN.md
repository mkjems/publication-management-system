# Publishing Management System — Development Plan

Status: draft v6 · 2026-11-26 (Phases 1–4 done; see §9 for findings)
Source material: [Research/Masterproduktionsplan_bogudgivelser.pdf](../Research/Masterproduktionsplan_bogudgivelser.pdf)

---

## 1. What we are building

A planning and tracking tool for book production (bogudgivelser). Every publication starts from the
**Masterproduktionsplan**: 11 phases, ~25 parallel tracks (spor), ~130 activities and 14 milestones,
planned backwards from a release date. The system turns that paper template into a live plan per
publication.

Three goals, in priority order:

1. **Handle delays and postponements easily.** When something slips, the user sees at once what it
   affects (downstream activities, milestones, the release date) and picks how to absorb it.
2. **Plan production.** Generate a full plan for a new book from the master template and a release
   date, then adjust it.
3. **Track progress.** Status per activity, phase and publication; what is late, at risk, or waiting;
   and how the plan has drifted from the original.

The main view of a publication is an **interactive Gantt chart**.

### Delivery strategy

- **Stage A (now): frontend only.** Full UI with local state saved in the browser. It can be demoed
  to the client and gathers feedback on the hard parts (scheduling, delay handling, Gantt UX) before
  any backend exists.
- **Stage B (later):** database, API, auth and multi-user. Stage A is structured so this is a swap
  of the persistence layer, not a rewrite (see §7).

---

## 2. What the master plan tells us (domain analysis)

| Concept in the PDF                                                                                                                                           | What it means for the system                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phases** 1–11 (Startmøde → Opfølgning), each with a time window relative to release ("9–6½ mdr. før udgivelse")                                            | Template phases carry default offsets from the release date.                                                                                                                 |
| **Tracks** within a phase ("Manus og redaktion", "Billeder", "Finansiering løbende spor"…) run in parallel                                                   | Gantt rows are grouped Phase → Track → Activity.                                                                                                                             |
| **Activity** columns: Aktivitet · Ansvarlig · Start · Oprindelig deadline · Aktuel deadline · Status · Bemærkning/afhængighed                                | Core activity record.                                                                                                                                                        |
| "Udfyld **Start** kun for aktiviteter med et reelt arbejdsforløb"                                                                                            | Two kinds of activity: **task** (has duration, drawn as a bar) and **deadline** (point in time, drawn as a tick).                                                            |
| "Bevar altid **Oprindelig deadline**, og brug **Aktuel deadline** ved ændringer"                                                                             | **Baseline vs current** is built in. We never overwrite the original. Every change is logged.                                                                                |
| **Status**: Ikke startet · I gang · Afventer · Færdig                                                                                                        | Status enum. "Afventer" also records _what_ it waits for.                                                                                                                    |
| **Ansvarlig**: roles, often combined ("Redaktør + grafiker + opdragsgiver")                                                                                  | Activities reference one or more **roles**. Each publication assigns **people** to roles.                                                                                    |
| **MILEPÆL** at the end of each phase (GO/HOLD/NO-GO, Manus låst til layout, Trykgodkendelse…)                                                                | Milestones are gates with a date and a decision/approval.                                                                                                                    |
| **Finansieringsforbehold**: the release date only becomes binding when funding is secured or the risk is accepted; funding can pause or shift the whole plan | Publication has **Ønsket** (desired) and **Bindende** (binding) release dates, a **plan state** (preliminary → binding), funding tracking, and a **pause/resume** operation. |
| "Hele produktionsplanen beregnes **baglæns**"                                                                                                                | Generate the plan backwards from the release date.                                                                                                                           |
| "Erfaringer føres tilbage i masterplanen"                                                                                                                    | The template is editable and versioned. Delay history lets us suggest better default durations later.                                                                        |

### Roles found in the PDF

Projektansvarlig, Forlægger, Redaktør, Forfatter, Grafiker, Billedansvarlig, Fotograf,
Korrekturlæser, Registerredaktør, Repro, Trykker, Presseansvarlig, Kommunikation(sansvarlig),
Salgsansvarlig, Lager, Opdragsgiver, Forlaget (collective), Projektteam (collective).

### Milestones (gates)

1. GO / HOLD / NO-GO
2. Finansiering tilstrækkelig / risiko godkendt
3. Produktionsstart
4. Revideret og gennemredigeret manus
5. Manus låst til layout
6. Billedmateriale komplet til layout
7. Principlayout godkendt
8. 1. ombrud klar
9. 2. ombrud klar
10. Bogen lukket
11. Trykgodkendelse
12. Færdige bøger godkendt og på lager
13. Udgivelse
14. Projekt afsluttet og evalueret

### What the PDF does _not_ give us (we must propose it, then validate it with the client)

- **Durations** per activity (only phase windows are given).
- **Dependencies** between activities (the "afhængighed" column is empty). We will propose a default
  network: mostly finish-to-start inside a track, plus cross-track links into milestones (e.g.
  _Manus låst_ + _Billedmateriale komplet_ → _Samlet materiale afleveres til grafiker_).
- **Working calendar**: weekends, Danish public holidays, summer and Christmas closures (printers
  often close in July).

---

## 3. Domain model

Plain TypeScript types with Zod schemas. The same schemas are reused by the API in Stage B.

```
Template (versioned)
 ├─ PhaseTemplate      { id, number, name, windowStartOffset, windowEndOffset }
 ├─ TrackTemplate      { id, phaseId, name }
 ├─ ActivityTemplate   { id, trackId, name, kind: task|deadline|milestone, roles[],
 │                       defaultDurationWorkdays, defaultOffsetFromRelease,
 │                       predecessors[{ activityId, type: FS|SS|FF, lagWorkdays }],
 │                       optional: boolean }            // "Eventuelt register…", "Eventuel farveprøve…"
 └─ Role               { id, name }

Publication (Stage A keeps activities, baselines and calendar inside the publication)
 { id, workingTitle, templateId, templateVersion,
   projectLeadId,
   kickoffDate, desiredReleaseDate, bindingReleaseDate | null,
   planState: preliminary | binding,
   lifecycle: idea | go | hold | no_go | active | paused | released | closed,
   funding: { minimumRequired, secured, riskAccepted, applications[] },
   roleAssignments: { roleId → personId[] },
   pauses: [{ from, to | null, reason }],
   calendar: { holidays: dk | dk-official | none, closures[] },
   baselines: [{ number, capturedOn, reason, releaseDate,  // 0 = "Oprindelig deadline", captured when
                 activities: { id → { start, deadline } } }],  // the plan becomes binding; never overwritten
   activities: Activity[] }

Activity (instance, copied from the template and then edited freely)
 { id, templateActivityId | null,                     // null = custom activity added by the user
   phaseId, trackId, name, kind, responsible, assigneeIds[],
   durationWorkdays, start | null,                    // start only for kind=task; first working day
   deadline,                                          // "Aktuel deadline"
   actualStart | null, actualFinish | null,
   status: not_started | in_progress | waiting | done | skipped,
   waitingFor: { text, expectedDate | null } | null,
   pinned: boolean,                                   // fixed date: event venue, printer slot…
   optional, gate | null, note, predecessors[] }

FundingApplication { id, publicationId, funder, amount, status: planned|submitted|granted|rejected,
                     submittedAt, expectedDecisionAt, decidedAt, conditions }

Person { id, name, email, defaultRoles[] }

ChangeEvent (append-only log: audit trail, undo/redo, analytics)
 { id, txId, publicationId, effectiveDate, recordedAt, by, type, payload, reason?, reasonCategory?,
   diff }                                             // field-level diff; undo applies it in reverse
   types: activity_rescheduled, status_changed, release_date_changed, plan_made_binding,
          paused, resumed, rebaselined, activity_added, dependency_changed, …
   reasonCategory: author, editorial, images_rights, design, printer, funding, external, other
```

**Dates** are stored as ISO `YYYY-MM-DD` strings with no time or timezone. All arithmetic goes
through a working-day calendar module.

**Baselines vs re-baselining.** "Never overwrite the original deadline" and "moving the release
re-baselines" are both kept by storing baselines as numbered snapshots: baseline 0 is the
_Oprindelig deadline_; a re-baseline adds baseline 1, 2, … Variance is measured against baseline 0.

---

## 4. Scheduling engine: the core

The engine is a **pure TypeScript package with no UI dependencies** and heavy unit tests. It is the
most important code in the project. Keeping it pure means the Gantt, the table, the "what-if" preview
and (in Stage B) the server all use the same logic.

### 4.1 Capabilities

1. **Generate a plan from the template** (`generatePlan(template, releaseDate, startMeetingDate?, calendar)`)
   - Phases 3–11 are placed **backwards from the release date** using template offsets and
     durations (the PDF's "beregnes baglæns").
   - Phases 1–2 are placed **forwards from the start meeting date**. If the two halves don't fit
     inside the available time, the engine reports it ("plan is compressed by N weeks").
2. **Critical path analysis (CPM)**
   - Forward pass from today and actual progress → **forecast** dates.
   - Backward pass from the binding release date → **latest allowed** dates.
   - Output per activity: **slack** (buffer in working days) and **critical** yes/no.
3. **Delay propagation with a preview** (`previewReschedule(plan, change) → Impact`)
   - Input: "activity X moves to date D" (or +N days, or "status = waiting until D").
   - Output: the list of affected activities with old → new dates, slack consumed, milestones moved,
     pinned-date conflicts, and the new forecast release date compared with the binding one.
   - Nothing is changed until the user applies the preview.
4. **Resolution strategies** the user can choose after a slip:
   - **Absorb**: move only what must move. Downstream slack takes the delay.
   - **Push all downstream**: keep the internal spacing and shift every successor.
   - **Compress**: shorten selected downstream tasks to protect the release date. The engine
     suggests candidates in order of available slack.
   - **Move release date**: changes the binding date, asks for a reason, and records a re-baseline
     event.
5. **Pause / resume** (funding HOLD, waiting on a grant decision)
   - Pausing freezes the plan. Resuming shifts all unfinished work by the pause length in working
     days, or replans backwards from a new release date. The user chooses.
6. **Make binding**: when the _Finansiering tilstrækkelig / risiko godkendt_ milestone is completed,
   the current plan is captured as **baseline 0** (`baselineDeadline` for every activity) and
   `planState` becomes `binding`.
7. **Health classification** per activity, phase and publication:
   - `late`: past current deadline and not done
   - `at_risk`: slack below a threshold, or due within N days and not started
   - `waiting`: blocked, with a reason
   - `on_track`
   - `slipped`: current deadline is later than the baseline (with a variance in days)

### 4.2 Implementation notes

- Dependency graph as an adjacency list. Topological sort, with cycle detection that rejects the
  change and names the cycle.
- Working-day calendar: weekends, Danish holidays (including Easter-based moveable feasts), and
  custom closures per publication or per supplier.
- Mutations are **commands** that produce a patch and a `ChangeEvent`. This gives undo/redo, an
  audit log and, later, API sync from one mechanism.
- Tests: Vitest for unit tests, plus property-based tests (fast-check) for invariants such as "no
  successor starts before its predecessor finishes plus lag" and "pinned dates never move silently".

Decisions made while building it (Phase 1):

- **Working-day axis.** The engine computes on integer positions, one per working day
  (`WorkCalendar.ordinal`), so dependency rules are plain arithmetic. `engine/constraints.ts` is
  the single definition of FS/SS/FF, used by the template validator and the engine alike.
- **Forecast never pulls work earlier** than its planned dates; it pushes later for late
  predecessors, for work not started by `asOf`, for late starts and for waiting.
- **Slack is measured against the release** for everything that leads to the release. Side tracks
  (press, funding follow-up) and post-release work are measured against their own deadlines, so
  they warn on their own without eating into the main chain's slack.
- **Critical path** = walk back from the release milestone through the predecessor with least
  slack. With the default network this reproduces the chain in `masterplan-defaults.md`.
- **Rescheduling only moves what is downstream of the change.** Done and pinned activities never
  move (pinned conflicts are reported and must be accepted explicitly). A task that has started
  keeps its actual start; moving its deadline stretches it.
- **Push** shifts downstream work before the release; the release only moves if it has to.
  **Compress** shortens not-started tasks on the chain that drives the release, longest first,
  down to 50% of their duration by default.
- **Pause/resume** and **release date changes** shift remaining work (not overdue work, so
  lateness stays visible), then repair dependencies; nothing that has not started may start
  before the resume date.
- **Health**: late > waiting > at_risk > on_track. At risk = forecast slip, negative slack (the
  threshold is configurable), or a pinned conflict. Slip against baseline 0 is reported separately.
- **Simulation** goes through the same commands as the user. Random draws depend only on
  (seed, activity, day); the only carried state is each started task's expected finish.

### 4.3 Time and simulation

A plan only shows its value as time passes: activities become late, slack is used up, milestones
slip, the release date comes under pressure. We need to see this on demand, without waiting months.
Time is therefore an **explicit input**, never read implicitly.

**Rule: nothing in `packages/domain` reads the system clock.** Every function that depends on
"today" (health, forecast, late/at-risk, "due this week", the today line) takes an `asOf: IsoDate`
argument. In the app a single `Clock` provides that date. It is either the real date or a simulated
one.

Three levels, built up across the roadmap:

1. **Time travel (Tidsmaskine).** A toolbar that sets the simulated date: date picker, +1 day,
   +1 week, +1 month, back to today, and **Play** (advance a week every second or so). The whole UI
   re-renders as of that date. A clear banner shows that the date is simulated.
2. **Progress simulation.** `simulateProgress(state, from, to, policy, seed)` in the domain package
   plays the team's work forward. It starts and completes activities according to the plan, with
   a seeded random delay distribution. Policies:
   - _On plan_: everything finishes on time.
   - _Realistic_: some activities slip, mostly the long ones such as writing and image rights.
   - _Stress_: many slips, plus injected events.
   - _Custom_: per-activity overrides.

   Results go through the same command layer as user edits. History, the slip chart, health and
   undo all behave exactly as with real use.

3. **Scenario library.** Named, reproducible scenarios: a seed, a start state and a script of
   events at given dates. Examples:
   - "Forfatteren er 3 uger forsinket"
   - "Fondssvar udebliver → HOLD i 6 uger"
   - "Trykkeriet forsinker 1 uge"
   - "Tre bøger lukkes i samme uge"

   They serve as client demos, as Playwright end-to-end fixtures, and as engine regression tests.
   For the tests, a scenario is replayed week by week and a snapshot of forecast and health is
   taken at each step.

Design consequences:

- `ChangeEvent` carries two times: `effectiveDate` (the business date, simulated or real) and
  `recordedAt` (wall-clock time). The history and slip chart use `effectiveDate`.
- **Simulation never touches real data.** It runs in a separate **demo workspace** (its own
  IndexedDB store, resettable), or in a scenario sandbox copy (§4.1, Phase 4). The real workspace
  always uses the real clock.
- **Seed data is generated by simulation.** Demo books are created a number of months back and
  simulated forward to the current (or simulated) date. Demo data then always looks realistic
  relative to "today", instead of going stale.
- Stage B: the server gets an injectable clock too. Time travel is enabled only for demo and
  staging tenants.

---

## 5. Frontend: views and UX

UI language: **Danish** (the client's working language). Code and identifiers are in English. Text
goes through a small i18n dictionary from day one so English can be added later.

### 5.1 Screens

1. **Portfolio overview (Oversigt)**
   - Cards or rows per publication: title, lifecycle, binding/desired release date, health, next
     milestone, % complete, funding status, total slip vs baseline.
   - **Portfolio Gantt**: one row per publication showing phase bands and milestone diamonds across
     the year. It shows release clustering and overlapping crunch periods (several books in "Bogen
     lukkes" at the same time).
2. **Publication: Gantt (the main view)**
   - Rows grouped Phase → Track → Activity, collapsible. Finished phases are collapsed by default.
   - Task bars, deadline ticks, milestone diamonds.
   - **Baseline ghost bars** under current bars, with a variance badge (`+12 d`).
   - **Slack tails** after bars. A **critical path** toggle.
   - **Today line**, **binding release line**, and a dashed **desired release line** while the plan
     is preliminary. The preliminary plan is drawn hatched.
   - **Pause bands** across the chart for HOLD periods.
   - Dependency arrows. Create a link by dragging from a bar's end to another bar.
   - **Drag a bar or deadline later → live preview**: downstream bars move as ghosts while dragging
     and the release marker turns red if it would slip. On drop, a popover asks for a reason and a
     strategy (§4.1.4) before applying.
   - Resize to change duration. Keyboard nudge ±1 day / ±1 week. Zoom week / month / quarter.
   - Filters: role, person, status, health ("only late / at risk / waiting").
   - Click opens the **activity side panel**.
3. **Publication: Table (Tabel)**
   - Spreadsheet-style view that mirrors the PDF the client already knows: Aktivitet, Ansvarlig,
     Start, Oprindelig deadline, Aktuel deadline, Status, Bemærkning.
   - Inline editing and keyboard navigation. Changing _Aktuel deadline_ runs the same impact preview
     as the Gantt.
4. **Activity side panel**: status, waiting-for, assignees, dates (baseline vs current), pinned flag,
   predecessors and successors, notes, and the change history of this activity.
5. **Postpone / replan dialog (Udskyd)**, reachable from anywhere ("Udskyd…" on an activity,
   milestone or the whole publication):
   - Choose new date or +N days, and a reason category plus free text.
   - Impact preview: affected items, release date effect, slack used, conflicts.
   - Choose a strategy, then apply. The result can be undone.
6. **Funding (Finansiering)** tab: applications, amounts, expected decisions, secured vs minimum, the
   gate state, and a "Pause project" action.
7. **History (Historik)**: change log per publication, filterable. Includes a **milestone slip chart**
   (x = date of change, y = forecast date per milestone), the standard way to show drift over time.
8. **My work (Mine opgaver)**: what is due this week or overdue for a person or role, across all
   publications.
9. **Master plan editor (Masterplan)**: edit phases, tracks, activities, default durations, offsets,
   dependencies and milestones. Versioned, so existing publications keep the version they were
   created from.
10. **New publication wizard**: title, project lead, desired release date, start meeting date,
    template version, optional activities on/off, role → person assignments. Shows a preview of the
    generated plan before creating it.

### 5.2 Gantt implementation decision

**Recommendation: build our own Gantt component on top of our scheduling engine.**

- Delay handling is the product's main differentiator. Live impact preview while dragging, baseline
  ghosts, slack tails, pause bands and preliminary/binding states are all custom behaviour. A
  library's built-in scheduler (DHTMLX, Bryntum) would compete with our engine and limit the UX.
- The data volume is small (~130 rows per publication; a portfolio of tens of publications), so
  performance is not a reason to use a library.
- Rendering: a CSS grid of rows with absolutely positioned bars (HTML) and an SVG overlay for
  dependency arrows. Pointer-event drag handling. Row virtualization (TanStack Virtual) only if
  needed.
- **Fallback**: if the custom route turns out too costly, run a 1–2 day spike with **SVAR React
  Gantt** (MIT core) or **Bryntum Gantt** (commercial, feature-complete but expensive) and compare.

### 5.3 Tech stack (Stage A)

| Concern                | Choice                                                                                        | Why                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Build                  | **Vite** + **React 19** + **TypeScript** (strict)                                             | Fast, standard, no server needed in Stage A                            |
| Monorepo               | **pnpm workspaces**: `packages/domain`, `apps/web` (later `apps/api`)                         | Engine and schemas are shared with the backend later                   |
| Routing                | **TanStack Router**                                                                           | Type-safe routes and search params (filters and zoom live in the URL)  |
| State                  | **Zustand** + **Immer** (patches for undo/redo)                                               | Simple, fast, works with the command/event pattern                     |
| Persistence            | **IndexedDB** via `idb-keyval`, behind a `Repository` interface; JSON export/import           | Survives reloads; demo datasets can be shared with the client          |
| Server state (Stage B) | **TanStack Query**                                                                            | Added when the API arrives; the repository interface makes this a swap |
| UI                     | **Tailwind CSS v4** + **shadcn/ui** (Radix primitives)                                        | Modern, accessible, fully customizable                                 |
| Tables                 | **TanStack Table**                                                                            | Editable grid for the Table view                                       |
| Dates                  | **date-fns** + our own working-day calendar                                                   | Small and tree-shakeable                                               |
| Validation             | **Zod**                                                                                       | Shared schemas for the API later                                       |
| Charts                 | **Recharts** or visx                                                                          | Slip chart, progress charts                                            |
| Tests                  | **Vitest** (engine, stores), **Testing Library**, **Playwright** (Gantt drag and delay flows) |                                                                        |
| Quality                | ESLint, Prettier, TypeScript strict, Husky pre-commit                                         |                                                                        |

---

## 6. Roadmap (Stage A)

Each phase ends with something demoable. Sizes are relative (S ≈ a few days, M ≈ 1–2 weeks,
L ≈ 2–3 weeks).

### Phase 0: Foundations (S)

- Git repo, pnpm monorepo, Vite app, lint/format/test tooling.
- Design tokens and app shell (sidebar navigation, header) with shadcn/ui.
- **Encode the master plan as data**: `packages/domain/src/templates/masterplan-v1.ts` with all
  phases, tracks, activities, roles and milestones from the PDF.
- Proposed default durations and dependency network, written down for client review.
- _Demo:_ app shell; the template rendered as a read-only list.

### Phase 1: Domain and scheduling engine (M–L)

- Types and Zod schemas (§3).
- Working-day calendar with Danish holidays.
- `generatePlan`, CPM forward/backward passes, slack, critical path.
- `previewReschedule` plus the four strategies, pause/resume, make-binding/baseline.
- Health classification. All "today"-dependent functions take `asOf` (§4.3).
- Command layer producing `ChangeEvent`s (with `effectiveDate` and `recordedAt`). Undo/redo.
- Seeded random generator and `simulateProgress` with the _on plan_ and _realistic_ policies.
- _Exit criteria:_ engine test suite green, including property tests and a first replayed scenario.

### Phase 2: Publications and the table view (M)

- Repository interface with an IndexedDB implementation. Real and demo workspaces are kept apart.
- Demo workspace seeded by simulation: 3–5 sample books started at different times and simulated to
  "today", some of them delayed.
- `Clock` and the **Tidsmaskine** toolbar (date picker, step forward and back, play, reset).
- Portfolio list. New-publication wizard (generates a plan from the template).
- Table view with inline editing, status changes and the activity side panel.
- JSON export/import.
- _Demo:_ create a book, see its full plan as a table, update statuses.

Decisions made while building it:

- **No TanStack Table.** The plan table is grouped Phase → Track with inline editors; a hand-written
  table (like the Masterplan page) was simpler. Revisit if sorting/column features are needed.
- **The demo workspace always has a simulated date.** Forward in time plays every demo book on
  (scripted events + simulation, including books the user creates there). Backward rebuilds the
  demo data as of that date from the scenario library; the user is asked first if they changed
  anything. Simulated changes are logged but clear the undo stack (time has moved on).
- **The impact preview is already in the table**: changing _Aktuel deadline_ opens a dialog with
  the four strategies, release effect, moved activities, pinned conflicts and a reason. Phase 4
  builds on it (Gantt drag, pause/resume UI, scenario mode).
- People are created on the fly in the wizard (project lead). Role → person assignments are not
  in the UI yet.

### Phase 3: Interactive Gantt (L)

- Timeline scale and zoom, grouped and collapsible rows, bars, ticks, milestones, today and release
  lines.
- Baseline ghosts, variance badges, slack tails, critical path toggle, dependency arrows.
- Drag and resize with snap to working days; keyboard nudging; dependency creation by drag.
- Table and Gantt stay in sync (one store).
- _Demo:_ the publication as a Gantt chart, editable.

Decisions made while building it:

- **Live impact ghosts while dragging are already in** (planned for Phase 4): every drag or
  keyboard nudge runs `previewReschedule` (absorb) and draws dashed ghosts for everything that
  would move, plus a release marker (red if it would slip). Nothing is applied until the impact
  dialog is confirmed.
- The axis is calendar days (weekends and holidays shaded); dragging snaps to working days in
  the direction of the drag. Zoom: week 28 px/day, month 8, quarter 3.
- Done tasks are drawn at their actual dates; open tasks at their planned dates with a hatched
  forecast tail when the forecast is later, and a thin slack tail up to the latest deadline.
- Dependency arrows are shown for the hovered/selected activity by default; "Alle
  afhængigheder" shows all. A new dependency (drag from the end handle) is finish-to-start with
  no lag and does not move anything by itself; the forecast shows its effect.
- Keyboard: Tab to a bar, ← → (Shift: a week) to nudge with live preview, Enter to open the
  impact dialog, Esc to cancel. Enter on a bar without a nudge opens the side panel.

### Phase 4: Delays and replanning (M–L), the key differentiator

- Live impact ghosts while dragging.
- Postpone dialog with reason, impact preview, strategy choice, apply and undo.
- Pause/resume a publication (funding HOLD) with pause bands.
- Release date change and re-baseline flow. Preliminary vs binding plan visuals.
- Change history view with the milestone slip chart.
- Optional **scenario mode**: try changes in a sandbox copy, compare with the live plan, then commit
  or discard.
- **Scenario library** (§4.3): named, reproducible delay scenarios with event injection. Also used as
  Playwright fixtures.
- _Demo:_ "the author is 3 weeks late"; the full impact is visible and resolved in a few clicks.

Decisions made while building it:

- **Previews run the real command.** Commands are pure, so `previewCommand` runs pause, resume
  or a release change against the current plan with a throwaway context, and `comparePlans`
  describes the result (moved activities, milestone forecasts, release target and forecast).
  Preview and apply can never disagree.
- **Whole-plan changes live in one "Planlægning" menu** on the publication: move the release
  date, pause/resume, make binding, save a baseline, try a scenario. The postpone dialog for a
  single activity (table, side panel, Gantt drop) accepts a date or "+N arbejdsdage".
- **Scenario mode is a fork of the publication's record** (plan and history). While open, every
  command, undo and redo on that book goes to the copy; the live plan and the portfolio are
  untouched. Applying replaces the live record with the copy, so each change stays a separate,
  undoable transaction in the log. Applying is refused if the live record changed meanwhile, and
  the Tidsmaskine is frozen while a scenario is open. Scenarios are kept in memory only (not
  persisted). The Gantt draws the live plan as dotted ghosts where the scenario differs.
- **The slip chart is reconstructed from the log.** Every event has a diff, so undoing the log
  backwards gives the plan as it was on any day (`planTimeline`). `milestoneTrend` samples it
  weekly plus on every planning change and runs the forecast as of each date. Six key
  milestones (the gates, _Manus låst_, _Trykgodkendelse_) get series colours in a fixed order;
  "Vis alle milepæle" adds the rest as neutral grey lines. The table under the chart is both
  legend and table view.
- **Scenario library in the UI:** in the demo, "Fra scenarie…" adds a book that follows a library
  scenario, played up to the simulated date; the rest of its script plays as time moves on.
- Not done: Playwright end-to-end tests with the scenarios as fixtures (no Playwright setup yet;
  the scenarios are covered as engine regression tests and the flows were checked by hand).

### Phase 5: Progress tracking and portfolio (M)

- Health indicators per activity, phase and publication; % complete per phase.
- Portfolio overview and portfolio Gantt.
- "My work" view by person or role.
- Funding tab and gate logic (GO/HOLD/NO-GO, funding sufficient → binding).
- _Stress_ simulation policy. Play a whole portfolio forward to check that the overview stays
  readable when many things slip at once.
- _Demo:_ the publisher's Monday overview: what is late, what is at risk, what is due this week.

### Phase 6: Template editor, polish and client validation (M)

- Master plan editor with versioning.
- Print and PDF export of a publication plan (A3 landscape Gantt plus a table in the PDF's layout).
- Accessibility pass, empty states, onboarding hints, performance check.
- Client test sessions with real upcoming titles. Feedback goes into the backlog for Stage B.

---

## 7. Preparing for Stage B (backend) from day one

Decisions in Stage A that keep the backend a swap rather than a rewrite:

- **`packages/domain` has no browser dependencies.** The same engine and Zod schemas run on the
  server, which can recompute schedules and validate changes.
- **Repository interface** (`PublicationRepository`, `TemplateRepository`, …). Stage A implements it
  with IndexedDB; Stage B implements it over HTTP with TanStack Query.
- **Commands and `ChangeEvent`s** map directly to API mutations and an `audit_log` table.
- **IDs are UUIDs** generated on the client, which makes offline creation and sync simpler later.
- **Normalized state**, shaped like future database tables.

### Proposed Stage B architecture (to confirm later)

- **API:** TypeScript (Hono or Fastify), OpenAPI generated from the Zod schemas.
- **DB:** PostgreSQL with Drizzle ORM. Tables: templates (versioned), publications, activities,
  dependencies, people, role assignments, funding applications, change events.
- **Auth:** SSO via Microsoft Entra ID if the client uses Microsoft 365 (likely, given the Word-based
  workflow); otherwise email magic link. Role-based permissions (e.g. only the project lead or
  publisher can change binding dates).
- **Collaboration:** optimistic updates. Live updates (SSE/WebSocket) when several people edit the
  same plan.
- **Notifications:** email digests ("due this week", "you are now blocking X"); calendar (ICS) feed
  of milestones.
- **Hosting:** EU region for GDPR (personal data of authors and contributors).

---

## 8. Open questions for the client

1. **Scale:** how many publications run at the same time? How many users? Is a person shared across
   books, and should we show workload or capacity per person?
2. **Durations and dependencies:** will they validate our proposed defaults? Are there book types
   that need different templates (picture-heavy art book, translated work, text-only, reprint)?
3. **Baseline policy:** is the baseline captured when the plan becomes binding? Who may re-baseline,
   and must a reason be given?
4. **Approval:** do date changes need approval (e.g. the project lead proposes, the publisher
   approves) or are they applied directly and logged?
5. **Calendar:** holidays and closures to respect (printer summer break, Christmas)? Should we track
   printer slot bookings?
6. **Funding:** what level of detail is needed: just "secured vs minimum", or full application
   tracking with amounts and reporting deadlines (fondsafrapportering)?
7. **Integrations:** Outlook/Google calendar, email reminders, Bogportalen metadata, Excel/PDF
   export?
8. **Language:** Danish-only UI, or Danish and English?
9. **External contributors** (authors, designers, printers): should they get limited access later?

---

## 9. Immediate next steps

Phase 0 is done (repo, tooling, app shell, master plan as data, defaults in
[masterplan-defaults.md](masterplan-defaults.md)).

Phase 1 is done: calendar, generation, CPM analysis, reschedule preview and strategies,
pause/resume, binding plan and baselines, health, commands with undo/redo, simulation and a
scenario library replayed as regression tests. The open questions in §8 are parked for now.

Findings to bring to the client review:

- The default network has about **25 working days of total float** on the release chain at
  production start (the 10-day stock buffer plus small gaps along the chain). A 3-week author
  delay is absorbed without moving the release.
- While a publication is on HOLD, the release forecast only starts slipping once that float is
  used up (about 5 weeks with the defaults).

Phase 2 is done: IndexedDB workspaces (real and demo), the Tidsmaskine, portfolio list, new
publication wizard, plan table with inline status/notes, impact dialog, activity side panel,
history tab and JSON export/import.

Found while testing Phase 2:

- **Compression picks unrealistic tasks.** It shortens the longest task on the critical chain,
  which is often _Tryk og indbinding_ (12 → 6 days). Printing, transport and similar supplier
  lead times cannot be compressed. Proposal: a `compressible` flag in the template (default true,
  false for printer/warehouse work), to be confirmed with the client.
- During a HOLD, overdue activities show as "Forsinket". That is accurate, but the portfolio may
  want to show "På pause" as the health of a paused book instead (Phase 5).

Phase 3 is done: the interactive Gantt (zoom, collapsible rows, baseline ghosts, variance
badges, forecast and slack tails, critical path, dependency arrows, today/release/pause lines,
hatched preliminary plan; drag, resize, keyboard nudge and dependency creation with live
preview).

Phase 4 is done: release date, pause/resume and binding/baseline dialogs with previews,
"+N arbejdsdage" in the postpone dialog, scenario mode, the history view with the milestone slip
chart, baselines and log filters, and scenario books in the demo.

Found while building Phase 4:

- Moving a binding release date or resuming after a pause saves a new baseline each time
  (§8 question 3: who may re-baseline). In a busy book the baselines list grows quickly; the
  client may want only some changes to re-baseline.
- The compression finding from Phase 2 still stands (no `compressible` flag yet).

Next: Phase 5, progress tracking and portfolio.
