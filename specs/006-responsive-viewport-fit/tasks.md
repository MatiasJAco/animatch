# Tasks: Responsive Viewport Fit (No Page Scroll)

**Input**: Design documents from `/specs/006-responsive-viewport-fit/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/viewport-fit.md](./contracts/viewport-fit.md),
[quickstart.md](./quickstart.md)

**Tests**: Included — the feature directive explicitly requests browser verification (scroll
predicates at four viewports, 60px resize sweep, both locales, bounding-box anti-clip assertions),
and the owner approved `@playwright/test` for exactly that scope on 2026-10-08. Test budget: ~6
tests, cap 15 (Constitution VI). No stylesheet-text or markup-snapshot assertions.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and
delivered independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths in every description

## Path Conventions

Web application (Nuxt 3) — layout change is confined to the single global stylesheet plus the
verification harness (plan.md Structure Decision). `server/`, `migrations/`, `app/i18n/`,
`app/composables/` are explicitly out of scope.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Approved verification tooling installed and configured before any layout work, so
every story can be measured from its first commit.

- [X] T001 Add `@playwright/test` as a devDependency in `package.json` (owner-approved 2026-10-08,
      dev-only, viewport checks only — no other dependency may be added) and add the script
      `"test:viewport": "playwright test"`
- [X] T002 Run `npx playwright install chromium` (driven by `playwright.config.ts`) so the suite
      has a local browser (dev machine / CI only; never part of deployment artifacts —
      Constitution Delivery Model)
- [X] T003 [P] Create `playwright.config.ts` at repo root: `testDir: 'e2e'`, chromium project
      only, `webServer` running `npx nuxt dev` against `http://localhost:3000` with
      `reuseExistingServer`, `DATABASE_URL` inherited from `.env` (contract §3 scope: four
      viewports only — no extra projects, retries, or reporters)
- [X] T004 [P] Create the shared helpers at the top of `e2e/viewport-fit.spec.ts`: the viewport
      matrix `[[1920,1080],[1440,900],[1280,800],[1024,768]]`, a `noDocumentScroll(page)` helper
      asserting `document.scrollingElement.scrollHeight === clientHeight` and
      `scrollWidth === clientWidth`, a `withinViewport(page, selectors)` bounding-box helper per
      contract §3, and a locale helper switching `es`/`en` via the home language control

**Checkpoint**: `npx playwright test --list` resolves the spec; the harness can boot the app.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The viewport-locked shell itself — without it no story can satisfy FR-001, and no
story's measurement means anything.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Lock the shell in `app/assets/css/main.css` per contract §1: `html { height: 100vh;
      height: 100dvh; overflow: hidden }`, `body { height: 100%; overflow: hidden }` (removing the
      legacy `overflow-x: hidden` band-aid at `main.css:54`), `.app { height: 100%; overflow:
      hidden; display: flex; flex-direction: column }`, and `.page` / `.home` becoming
      `flex: 1 1 auto; min-height: 0; overflow: hidden; display: flex; flex-direction: column`
      while keeping `max-width: 46rem` centering
- [X] T006 Extend the `min-height: 0` height-budget chain in `app/assets/css/main.css` to the
      column children (`.stack`, `.card` that hosts a board, board section roots) so the chain
      from `.app` → page root → board is unbroken (contract §1 "min-height chain")
- [X] T007 Confirm `app/app.vue` (root `div.app`), `app/error.vue` (`main.page`), and the four
      page roots in `app/pages/index.vue`, `app/pages/game/match-the-series.vue`,
      `app/pages/game/groups.vue`, `app/pages/game/more-or-less.vue` all inherit the shell with
      **zero template edits expected** — edit a root element only if the flex chain needs an
      anchor, and record any edit in `specs/006-responsive-viewport-fit/plan.md`
- [X] T008 Add a harness smoke test in `e2e/viewport-fit.spec.ts`: home screen at 1920x1080
      returns `noDocumentScroll` — proves the boot, the shell, and the helper agree before any
      compression work

**Checkpoint**: Foundation ready — with `overflow: hidden` in place, the remaining risk is content
overflow (`scrollHeight > clientHeight` still reports it), which the stories now fix and measure.

---

## Phase 3: User Story 1 - Full working surface visible at target sizes (Priority: P1) 🎯 MVP

**Goal**: At 1920x1080, 1440x900, 1280x800, and 1024x768, every primary screen — home, Match The
Series, Groups, More Or Less — shows its header, board, and controls fully inside the viewport in
loading, playing, and attempt-error states, with zero document scroll (FR-001, FR-003, FR-004,
FR-008; SC-001, SC-003).

**Independent Test**: `npm run test:viewport` — the scroll predicates and bounding-box assertions
pass for all four screens × {loading, playing, attempt error} at all four viewports; manually open
each screen at 1024x768 and confirm no primary control requires scrolling.

### Tests for User Story 1 (requested via feature directive)

- [X] T009 [US1] Scroll-predicate test in `e2e/viewport-fit.spec.ts`: for each viewport in the
      matrix, visit home, match-the-series, groups, more-or-less in loading, playing, and
      attempt-error states (force API failures with `page.route` on `/api/daily*` so ErrorPanel
      renders — FR-008) and assert `noDocumentScroll` (count this as 1 consolidated test)
- [X] T010 [US1] Bounding-box anti-clip test in `e2e/viewport-fit.spec.ts`: at all four viewports
      assert every P1 region (`.page-header`/`.home__header`, `grid-3x3`, `grid-4x4`,
      `.comparison`, action rows incl. Clear/Submit, More/Less, Next, `ErrorPanel` retry button)
      is fully inside the viewport per contract §3 `withinViewport`

### Implementation for User Story 1

- [X] T011 [US1] Spacing collapse in `app/assets/css/main.css`: `.stack > :where(p, h1, h2, h3)
      { margin-bottom: 0 }` and convert `--gap`, `.page`/`.home` padding, `.card`/`.tile`/
      `.group-row` padding to `clamp()` that shrinks toward 1024px and grows toward 1920px
      (research R-002.1, R-002.5)
- [X] T012 [US1] Height-bounded tile art in `app/assets/css/main.css`: `.tile__art` and
      `.clue-card__art` keep `aspect-ratio` as a ceiling but gain a height-derived `max-height`
      in relative units so art is bounded by remaining space, with `.entity-art__img`'s existing
      `object-fit: cover` absorbing the crop (research R-002.2 — no fixed px heights, directive)
- [X] T013 [US1] Fluid grids in `app/assets/css/main.css`: `.grid-3x3` and `.grid-4x4` use
      `grid-template-rows: repeat(N, minmax(0, 1fr))` inside the definite-height chain, with
      `.tile { min-height: 0 }` so rows compress instead of pushing the document (research
      R-002.3; data-model I-4)
- [X] T014 [US1] Trim the More-or-Less `.comparison` in `app/assets/css/main.css`: middle column
      `auto` instead of `1fr`, bounded side columns, art height capped relatively (research
      R-002.5) — clears the +23px attempt-error overage (research R-008)
- [X] T015 [US1] Run `npm run test:viewport` and iterate compression in
      `app/assets/css/main.css` until T009/T010 pass at 1024x768 for all four screens in
      loading/playing/attempt-error states; record measured heights at 1024x768 in
      `specs/006-responsive-viewport-fit/quickstart.md` (gate of FR-001/FR-003/FR-004)

**Checkpoint**: User Story 1 is fully functional — the four screens fit their primary content at
every target size without document scroll. This is the MVP.

---

## Phase 4: User Story 2 - Smooth resizing between supported sizes (Priority: P2)

**Goal**: Resizing across the supported range never introduces a page scrollbar or clipped content
at any intermediate size (FR-005, FR-002; SC-002).

**Independent Test**: the resize-sweep test passes from 1920 down to 1024 and back with
`noDocumentScroll` true at every sampled size; a manual drag-resize on any screen shows no
scrollbar flash.

### Tests for User Story 2 (requested via feature directive)

- [X] T016 [US2] Resize-sweep test in `e2e/viewport-fit.spec.ts`: on each of the four screens,
      step the viewport width 1920→1024 in **60px** increments (and height 1080→768 in 48px
      increments per plan), asserting `noDocumentScroll` at **every** step, then step back up
      (SC-002; 1 consolidated test)

### Implementation for User Story 2

- [X] T017 [US2] Fluid-range tuning in `app/assets/css/main.css`: verify every `clamp()` is
      monotonic and continuous across 1024–1920px, keep all widths in rem/%/fr/vh-derived units,
      and fix any intermediate-size overflow the sweep exposes (no fixed px heights — directive;
      research R-002)
- [X] T018 [US2] Verify horizontal soundness at the 768px floor: confirm `.group-row` fixed bases
      (criterion + 4 tiles + gaps ≤ content width) and `.reveal-list` items wrap without widening
      the page at 1024px and below-1920 widths (research R-008 horizontal audit; FR-002) —
      adjust bases in `app/assets/css/main.css` only if a measured overflow appears

**Checkpoint**: User Stories 1 and 2 both pass — fit holds at the checkpoints *and* between them.

---

## Phase 5: User Story 3 - Finished and expanded states still fit (Priority: P3)

**Goal**: Result panels, loss explanations, Match's 18-entry reveal list, and Groups' four
revealed rows fit the locked viewport without document scrolling (FR-001 in finished states,
FR-004; SC-001).

**Independent Test**: drive each game to a win and a loss at 1024x768 (dev **Reset** replays the
day); predicates and bounding boxes pass in finished-session and finished-reloaded states.

### Tests for User Story 3

- [X] T019 [US3] Finished-state coverage in `e2e/viewport-fit.spec.ts`: for all four viewports
      assert `noDocumentScroll` + `withinViewport` on: Match loss in-session (reveal list +
      ResultPanel + share), Match finished reloaded, Groups loss in-session (4 revealed rows +
      ResultPanel), Groups finished reloaded, More-or-Less loss with explanation (1 consolidated
      test)

### Implementation for User Story 3

- [X] T020 [US3] Compress the Match reveal list in `app/assets/css/main.css`: `.reveal-list`
      becomes a two-column grid with tightened `padding`/`gap` (research R-002.4 — ~350px saved
      on the 18 entries)
- [X] T021 [US3] Compress Groups group rows in `app/assets/css/main.css`: `.group-row__tile`
      basis 5.5rem → ~3.5–4rem and `.group-row__criterion` 5rem → 4rem (research R-002.4,
      ~50px per row), keeping the criterion label always present (feature 003 — colour is never
      the only signal)
- [X] T022 [US3] Measure every finished state at 1024x768 (T019 output). **Only if overflow
      remains after T020–T021**, grant the measurement-gated inner-scroll exception to
      `.reveal-list` and/or `.group-rows` in `app/assets/css/main.css`
      (`min-height: 0; overflow: auto` on that region only — never headers, boards, action rows,
      or the result summary/share, contract §2) and record before/after px + pinned-region
      verification in the exception table in
      `specs/006-responsive-viewport-fit/quickstart.md`; **if nothing overflows, record "none"**
      in that table (R-003 — inner scroll stays none by default)
- [X] T023 [US3] Re-run `npm run test:viewport` (`e2e/viewport-fit.spec.ts`) to confirm T019
      passes together with T009, T010, and T016 — no regression of earlier stories

**Checkpoint**: All user stories independently functional; every reachable state fits.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Locale coverage, regression, and constitution gates that span all stories.

- [X] T024 [P] Both-locale sweep in `e2e/viewport-fit.spec.ts`: repeat the core predicate +
      bounding-box checks with the UI in `es` and `en` (SC-005, spec FR-006 — Spanish strings
      are longer and must wrap, not overflow)
- [X] T025 [P] Run `npm test` over `tests/` — the existing vitest suite stays green (no layout
      assertions exist to break; Constitution VI)
- [X] T026 Run the full quickstart gate end to end per
      `specs/006-responsive-viewport-fit/quickstart.md` (automated gate 1–4) and record SC-001…
      SC-005 outcomes in the Notes of
      `specs/006-responsive-viewport-fit/checklists/requirements.md`
- [X] T027 [P] Reconcile documentation: README.md Test section gains `npm run test:viewport`;
      `specs/006-responsive-viewport-fit/plan.md` structure matches the final file set (any
      helper file added under `e2e/`); quickstart setup commands verified as written
- [X] T028 Final constitution review in `specs/006-responsive-viewport-fit/checklists/requirements.md`
      notes: ≤15 feature tests, `@playwright/test` is the only added dependency, no
      stylesheet-text assertions, no essay comments (Constitution VI), error states verified
      visible (Constitution V), both locales complete (Bilingual UI)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — starts immediately
- **Foundational (Phase 2)**: Depends on Setup (T001–T004) — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Foundational (shell locked, harness smoke green)
- **US2 (Phase 4)**: Depends on US1 (T015) — the sweep is only meaningful once the four
  checkpoint sizes fit; its fixes are fluid-tuning of US1's `clamp()` work
- **US3 (Phase 5)**: Depends on US1 (T015) for the compression infrastructure; independent of US2
- **Polish (Phase 6)**: Depends on all desired stories (T024 after US1 so locales have layout to
  check; T026/T028 after US3)

### User Story Dependencies

- **US1 (P1)**: starts after Foundational; no dependencies on other stories → **MVP**
- **US2 (P2)**: starts after US1; independently testable via T016 (the sweep can be run on its own)
- **US3 (P3)**: starts after US1; independently testable via T019 (finished states driven by
  playing a game)

### Within Each User Story

- Tests (T009/T010, T016, T019) are written first and must FAIL before their compression work
  lands (they measure the current overflow — research R-008 predicts +550…+2,000px)
- Measurement before mutation: run the gate, record numbers, then compress
- Story complete before moving to the next priority

### Parallel Opportunities

- Phase 1: T003 ∥ T004 (different files); T001 → T002 sequential, then T003/T004
- Phase 3: T009 and T010 both edit `e2e/viewport-fit.spec.ts` → run sequentially despite
  independence of intent; T011–T014 all edit `app/assets/css/main.css` → sequential (single-file
  constraint)
- Phase 6: T024 ∥ T025 (different files/runners), T027 can run beside test work
- Real parallelism: US2 and US3 test-authoring (both in `e2e/viewport-fit.spec.ts`) must be
  serialized, but US3's compression (`main.css`) and US2's documentation reconciliation (T027)
  can proceed together

---

## Parallel Example: User Story 1

```bash
# Tests first (they must fail against the current overflow):
Task: "T009 scroll-predicate test in e2e/viewport-fit.spec.ts"
Task: "T010 bounding-box anti-clip test in e2e/viewport-fit.spec.ts"

# Then compression, serialized inside the single stylesheet:
Task: "T011 spacing collapse + clamp() in app/assets/css/main.css"
Task: "T012 height-bounded tile art in app/assets/css/main.css"
Task: "T013 fluid grids minmax(0,1fr) in app/assets/css/main.css"
Task: "T014 comparison trim in app/assets/css/main.css"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (approved dependency + harness)
2. Complete Phase 2: Foundational (locked shell — **critical, blocks all stories**)
3. Complete Phase 3: User Story 1 (tests → compression → gate green at four viewports)
4. **STOP and VALIDATE**: `npm run test:viewport` green for T009/T010; play each screen at
   1024x768 by hand
5. Deliverable: no page scroll anywhere at the target sizes

### Incremental Delivery

1. Setup + Foundational → shell locked, harness proven
2. US1 → four screens fit at four viewports (MVP)
3. US2 → resize sweep green across the whole range
4. US3 → finished/expanded states green; inner-scroll exceptions recorded (or "none")
5. Polish → both locales, regressions, docs, constitution checklist
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers: team completes Setup + Foundational together; then Developer A runs US1
(single-file `main.css` — no conflicts); after US1, Developer A takes US2 while Developer B takes
US3, coordinating on the two shared files (`app/assets/css/main.css`,
`e2e/viewport-fit.spec.ts`) by phase rather than simultaneously.

---

## Notes

- **[P] tasks = different files, no dependencies** — most layout tasks share `main.css`, so they
  are deliberately sequential
- **[Story] labels** map each task to a user story for traceability; Setup/Foundational/Polish
  carry none
- **Scope freeze** (owner approval 2026-10-08): the checks are limited to the four viewports, the
  60px resize sweep, both locales, and the bounding-box anti-clip assertions; `@playwright/test`
  is the only added dependency
- **Inner scroll stays none** except the measurement-gated exception for Match's `.reveal-list`
  and Groups' `.group-rows` (T022)
- Commit after each task or logical group; stop at each checkpoint to validate the story
- Avoid: vague tasks, edits outside the plan's file set, assertions on stylesheet text
