---
description: "Task list for Board-First Game Page Layout"
---

# Tasks: Board-First Game Page Layout

**Input**: Design documents from `/specs/007-board-first-layout/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories),
[research.md](./research.md), [data-model.md](./data-model.md),
[contracts/game-shell.md](./contracts/game-shell.md)

**Tests**: Requested by plan R-006 — the feature-006 Playwright viewport gate
(`e2e/viewport-fit.spec.ts`) is rewritten **in place** (6 tests, under the 15-test cap, Constitution
VI). The refined FR-009 adds one assertion (T005). The Vitest suite is unchanged and must stay green.
No new dependency (Constitution VI).

**Organization**: Tasks are grouped by user story. The shared shell is the only cross-story
prerequisite (Foundational); after it, US1, US2 and US3 are independently implementable and testable.

**Status note**: all tasks complete — T001–T019 marked `[X]`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1, US2, US3
- Exact file paths are included in every task

## Path Conventions

Nuxt web app: UI in `app/`, verification in `e2e/`, unit tests in `tests/`. No `server/`,
`migrations/`, `app/i18n/`, or `app/composables/` file is touched (plan.md Structure Decision).

---

## Phase 1: Setup

**Purpose**: Confirm the green baseline before any edit; no initialization is needed (no dependency,
no schema).

- [X] T001 Run the existing gates on the base commit from the repo root — `npm test` (expect 48
      passing) and `npm run test:viewport` (expect 6 passing) — and record the result; make no file
      changes. This is the baseline the rewritten gate (T004/T013/T015) must match or exceed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared shell every story builds on. **No user story work can begin until this phase
is complete.**

- [X] T002 [P] Add the shared game-shell region vocabulary and unlock vertical scrolling in
      `app/assets/css/main.css`: define `.game-shell` (flex column, `min-height: 100dvh`,
      `max-width: 46rem`, `margin: 0 auto`, `padding` like `.page`), `.game-header`, `.game-play`,
      `.game-board`, `.game-actions`, `.game-meta`; change `html`, `body` and `.app` so vertical
      overflow is allowed while horizontal overflow stays suppressed; leave `.page`/`.home` untouched
      for the error and home screens.
- [X] T003 Create `app/components/GameShell.vue`: `defineProps<{ title: string }>()`; slots
      `header-actions` and default. Root `main.game-shell` → `header.game-header` containing
      `h1` (the `title`) and `<slot name="header-actions" />` → `<slot />` for the game body.

**Checkpoint**: the shell compiles and can wrap a game body.

---

## Phase 3: User Story 1 — The board is the first thing a player sees (Priority: P1) 🎯 MVP

**Goal**: On each game screen the board is the first region under the header; the primary actions sit
directly under the board; the status bar and how-to-play copy render after those actions
(contract §Required DOM order).

**Independent Test**: Open Groups, More or Less and Match the Series; the board region precedes the
action row and the `.game-meta` copy in document order, no status/instruction node precedes the board,
no horizontal page scroll appears, and an attempt error is visible above the fold.

### Tests for User Story 1

- [X] T004 [US1] Update `e2e/viewport-fit.spec.ts` with the US1 order contract assertions for all
      three screens: `section.game-board` precedes `.game-actions` and `footer.game-meta`; no
      status/help node precedes `section.game-board`; `scrollWidth === clientWidth` (horizontal
      no-scroll). (Replaces feature 006's `noDocumentScroll` vertical predicate.)
- [X] T005 [US1] Update `e2e/viewport-fit.spec.ts` with the refined-FR-009 error-visibility
      assertion: in the attempt-error state, at all four supported viewports and all three games,
      assert the error panel (`section.card[role="alert"]`) top is inside the viewport (above the
      fold), its retry action is reachable without scrolling, and the panel is not a descendant of
      `.game-meta`. The error state already renders above the fold, so this task only adds the gate
      coverage the refined plan (R-006.6) requires.

### Implementation for User Story 1

- [X] T006 [P] [US1] Reorder the template of `app/components/GroupsBoard.vue` to
      `div.game-play` wrapping `section.game-board` (4x4 grid + found/revealed rows) → 
      `div.game-actions` (Clear selection, Propose group), with `footer.game-meta` as a **sibling
      root** (the `groups.mistakes` badge, `game.groups.help`, then `groups.select_four`). Keep the
      `ErrorPanel` and transient feedback with the board region.
- [X] T007 [P] [US1] Reorder the template of `app/components/MoreOrLessBoard.vue` to `div.game-play`
      wrapping board (the comparison) → `div.game-actions` (More, Fewer), with `footer.game-meta` as a
      sibling root (the `more_or_less.round` badge, `game.more_or_less.help`, then
      `more_or_less.question`). Keep the `ErrorPanel` with the board.
- [X] T008 [P] [US1] Reorder the template of `app/components/MatchGrid.vue` to `div.game-play`
      wrapping board (clue card + Next + 3x3 grid) with `footer.game-meta` as a sibling root (the
      `match.mistakes` + `result.attempts` badge, then `game.match_the_series.help`); there is no
      `div.game-actions` for this game. Keep the loss reveal list with the board. The attempt-error
      `ErrorPanel` is page-owned and renders above the board body (contract §Failure rule,
      research R-007) — `MatchGrid` does not receive it.
- [X] T009 [US1] Rewrite `app/pages/game/groups.vue` to render through `GameShell`
      (`title = 'game.groups'`, `#header-actions` = `<GameHeaderControls game="groups" />`, body =
      `GroupsBoard` then `ResultPanel`); remove the `game.groups.help` line from the old header. Keep
      the fetch, `handleOutcome`, `useLocalProgress` wiring, and the `ResultPanel` placement.
- [X] T010 [US1] Rewrite `app/pages/game/more-or-less.vue` the same way (`game.more_or_less`,
      `GameHeaderControls game="more_or_less"`, body = the `ResultPanel`/board branch); remove the
      `game.more_or_less.help` line from the header. Preserve `lossView` and `handleOutcome`.
- [X] T011 [US1] Rewrite `app/pages/game/match-the-series.vue` the same way
      (`game.match_the_series`, `GameHeaderControls game="match_the_series"`, body = `MatchGrid` then
      `ResultPanel`); remove the `game.match_the_series.help` line from the header. Preserve the
      `answer`/`skip`/`persist` handlers and the page-owned attempt-error panel.

**Checkpoint**: US1 is functional — board-first order and the copy below the actions, with no
horizontal scroll and an above-the-fold error state.

---

## Phase 4: User Story 2 — Freed space makes the game bigger (Priority: P2)

**Goal**: The height the status/help copy used above the board now belongs to the board; the board
grows and stays centered, and the copy falls below the fold (contract §Scroll rule, refined SC-002).

**Independent Test**: At a fixed supported viewport the board renders taller than the `.game-meta`
block it displaced, stays horizontally centered within 2px, and its top is inside the viewport.

### Implementation for User Story 2

- [X] T012 [US2] In `app/assets/css/main.css`, give the freed height to the board: `.game-play`
      `height: calc(100dvh - 4.5rem)` (the header/chrome allowance, research R-005) with
      `flex: 0 0 auto`, `.game-board` `flex: 1 1 auto; min-height: 0`, `.game-actions` and
      `.game-meta` `flex: 0 0 auto`, so the board compresses into the fold and `.game-meta` renders
      after it (below the fold). Keep the board horizontally centered; reuse the existing
      `minmax(0, 1fr)` grid sizing. (Depends on T002; edits `main.css` — serialize with T014.)
- [X] T013 [US2] Extend `e2e/viewport-fit.spec.ts` with the growth assertions: at each supported
      viewport the board region's rendered height is strictly greater than `.game-meta`'s, the board's
      horizontal center matches the page center within ≤2px, and its top is inside the viewport.
      (Serialize with T004/T005/T015 — same file.)

**Checkpoint**: US2 is functional — the board is larger and centered, the copy is below it.

---

## Phase 5: User Story 3 — Headers align consistently (Priority: P3)

**Goal**: On all three games the title and the Home/Reset controls share one row with aligned vertical
centers (contract §Header rule).

**Independent Test**: At every supported width, the title's and the Home/Reset controls' vertical
centers differ by ≤2px on More or Less, Match the Series and Groups.

### Implementation for User Story 3

- [X] T014 [US3] In `app/assets/css/main.css`, lock the shared header alignment:
      `.game-header { display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: var(--gap); }` and align the title and the controls within it. Ensure
      `.game-header` is the single alignment source for the game screens. (Depends on T002; edits
      `main.css` — serialize with T012.)
- [X] T015 [US3] Extend `e2e/viewport-fit.spec.ts` to assert, at all four supported widths
      (1920x1080, 1440x900, 1280x800, 1024x768), that the `h1` and the Home/Reset controls share one
      row (overlapping vertical ranges) and their vertical centers differ by ≤2px on all three games.
      (Serialize with T004/T005/T013 — same file.)

**Checkpoint**: All three user stories are independently functional; the headers match.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T016 [P] Document the scroll-policy change: add a short note to
      `specs/006-responsive-viewport-fit/quickstart.md` and
      `specs/006-responsive-viewport-fit/checklists/requirements.md` that feature 007 supersedes the
      game-screen vertical no-scroll rule (horizontal no-scroll retained), and update `README.md` if
      it describes the viewport lock.
- [X] T017 Run the full gates from the repo root — `npm test` (stay at 48) and `npm run test:viewport`
      (6 tests, all green) — and iterate on `app/assets/css/main.css` / templates until both pass at
      all four viewports and both locales.
- [X] T018 [P] Run the manual quickstart checks in `specs/007-board-first-layout/quickstart.md`
      §Manual in both locales (`es`, `en`); confirm all moved strings are present and wrap without
      horizontal overflow, and the error panel with retry is reachable without scrolling.
- [X] T019 Record the constitution review in
      `specs/007-board-first-layout/checklists/requirements.md`: viewport tests ≤15 (6), no new
      dependency, assertions on rendered geometry/DOM order only (no stylesheet text or markup
      snapshots), error state visible (Principle V), both locales complete.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — run first.
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**.
- **User Stories (Phase 3–5)**: All depend on Foundational.
  - US1 (P1) is the MVP and first.
  - US2 (P2) depends on Foundational and integrates with the US1 board markup.
  - US3 (P3) depends on Foundational only and is independent of US1/US2 (header-only).
- **Polish (Phase 6)**: Depends on all desired stories.

### User Story Dependencies

- **US1 (P1)**: after T002/T003. No dependency on other stories.
- **US2 (P2)**: after T002/T003; its CSS acts on the US1-reordered regions.
- **US3 (P3)**: after T002/T003; header-only, independent of US1/US2.

### Within Each User Story

- Test tasks first (T004/T005/T013/T015); T005 may fail until its assertion is written, then passes.
- T006/T007/T008 are parallel (three board files); T009/T010/T011 are parallel (three page files).
- `app/assets/css/main.css` edits (T002 → T012 → T014) are sequential.
- `e2e/viewport-fit.spec.ts` edits (T004 → T005 → T013 → T015) are sequential.

### Parallel Opportunities

- T002 and T003 touch different files and can run in parallel.
- T006, T007, T008 (GroupsBoard / MoreOrLessBoard / MatchGrid) can run in parallel.
- T009, T010, T011 (the three game pages) can run in parallel.
- T016 and T018 are independent of each other and of the code tasks.

---

## Parallel Example: User Story 1

```bash
# Different files, no shared dependency — after T003 (shell) is done:
Task: "T006 Reorder app/components/GroupsBoard.vue to game-play → board → actions + meta"
Task: "T007 Reorder app/components/MoreOrLessBoard.vue to game-play → board → actions + meta"
Task: "T008 Reorder app/components/MatchGrid.vue to game-play → board + meta"

# Then wire the pages (different files):
Task: "T009 Rewrite app/pages/game/groups.vue to use GameShell"
Task: "T010 Rewrite app/pages/game/more-or-less.vue to use GameShell"
Task: "T011 Rewrite app/pages/game/match-the-series.vue to use GameShell"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001 baseline → T002/T003 shared shell (Foundational).
2. US1 (T004–T011): board-first order, copy below the actions, error above the fold.
3. **STOP and VALIDATE**: `npx playwright test e2e/viewport-fit.spec.ts --grep "board-first"` and a
   manual pass on all three screens.

### Incremental Delivery

1. Foundational → the shell exists.
2. US1 → board-first layout (MVP) → validate.
3. US2 → board grows into the freed space → validate.
4. US3 → headers aligned on all games → validate.
5. Polish → docs, both-locale check, full gates, constitution review.

### Notes

- [P] tasks = different files, no dependencies.
- Presentation-only: no game rules, selection, scoring, storage, API, or i18n key may change
  (spec FR-008). Reverting the commit restores the previous layout.
- Avoid editing `app/assets/css/main.css` or `e2e/viewport-fit.spec.ts` from two tasks at once.
- Keep the test count at 6 (cap 15) and assert rendered geometry / DOM order only.
