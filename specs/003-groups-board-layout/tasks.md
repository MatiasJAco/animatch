---

description: "Task list template for feature implementation"
---

# Tasks: Groups Board Rows-Driven Layout

**Input**: Design documents from `specs/003-groups-board-layout/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: TDD — tests are REQUIRED by the feature spec's "Manual vs Automated Verification Note" and SC-006; they are written first in the foundational phase and serve all three stories.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single Nuxt application at repository root; client code in `app/`, tests in `tests/`, server untouched for this feature.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the feature needs no new tooling or configuration (research R-012) and that the baseline is green before any code changes.

- [X] T001 Verify the baseline before changing anything: run `set -a; . ./.env; set +a; npm test` and `npx nuxt build`; confirm the existing 31 tests pass and the build is green. No dependency, config, vitest, or `.gitignore` change is authorized (research R-012, directive).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure board-presentation model (`buildBoardRows`) that every user story renders from (research R-003, data-model.md §2). This is the only place group classification lives; the engine, detection rules, API, and storage are untouched (directive, R-001).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests for the Foundation (TDD — must FAIL before implementation) ⚠️

- [X] T002 Write the row-model tests in `tests/groups-board.test.ts` (anti-first, they reference `app/utils/groupsBoard.ts` which does not exist yet, so the file fails to import — the red is expected). Cover, per the plan's Test Plan rows 1–7: found-only rows in discovery order with `kind: 'found'`; each found row's `tileKeys` match the submitted group and found keys are absent from `selectable`; loss input returns exactly one row per group with the data-model invariant "found rows are ordered by discovery, revealed rows follow in disclosure order" and classification found-then-revealed; the invariant "the union of all tileKeys equals the puzzle's tile keys on the loss layout; no key appears in two rows; found keys never reappear as selectable"; `selectable` empty once revealed; clear-store input (empty found, `null` revealed) yields all tiles selectable; reload-restore input reproduces identical rows. No stylesheet, CSS-class, or markup-snapshot assertions (Constitution VI).

### Implementation for the Foundation

- [X] T003 Implement `buildBoardRows` in `app/utils/groupsBoard.ts` with `GroupRow` (`kind: 'found' | 'revealed'`, `criterion` as `GroupCriterion`, `tileKeys: string[]`) and `BoardPresentation` (`rows`, `selectable: string[]`), honoring the data-model contract verbatim: "rows.length is found.length in play, and the board's group count (4) after a loss"; "the union of all tileKeys equals the puzzle's tile keys on the loss layout; no key appears in two rows; found keys never reappear as selectable"; and "found rows never restyle or reorder when the loss layout appears". `revealed === null` → rows are exactly the found groups and `selectable` is tiles minus found keys; `revealed !== null` → found rows first, then remaining groups from `revealed`, `selectable` empty.

**Checkpoint**: `tests/groups-board.test.ts` PASSES against the pure model. Foundation ready — user stories can begin. No server, storage, or contract change has been made.

---

## Phase 3: User Story 1 - Found groups stay on the board as green rows (Priority: P1) 🎯 MVP

**Goal**: Every correctly proposed group renders as a permanent horizontal green row with its characteristic label on the left, and its tiles leave the selection area (spec US1, FR-001–FR-003).

**Independent Test**: Submit one correct group in the browser and confirm a single green row appears above the selection grid with exactly those four tiles and the bilingual label; the tiles are no longer selectable. (Automated half covered by the foundational `buildBoardRows` tests: rows classification and `selectable` exclusion.)

### Implementation for User Story 1

- [X] T004 [US1] Refactor `app/components/GroupsBoard.vue` to render, above the existing selection grid, one horizontal row per found group built from `buildBoardRows(props.puzzle.tiles, found, revealed)` in `app/utils/groupsBoard.ts`: green styling for `kind: 'found'`, the characteristic as the row's left label via the existing bilingual key `groups.criterion.<type>` (`criterionLabel`), each tile reusing the existing tile content (`EntityImage` + name label), and found-row tiles inert and excluded from the `consumed` selection set (unchanged behavior). No change to proposal/submit logic.

**Checkpoint**: User Story 1 is fully functional and testable independently (spec US1 AC1–AC3).

---

## Phase 4: User Story 2 - Loss reveals every uncovered group as red rows, keeping found rows green (Priority: P1)

**Goal**: On the ending miss the board stays mounted and the loss layout shows every group — found rows keep their green styling, the groups never found appear as red rows — one row per group, labels on the left (spec US2, FR-004–FR-006).

**Independent Test**: Find at least one group, then make the fifth mistake; the board (not just the result card) shows one row per group with the found rows still green and the rest red, 16 tiles total, none missing or duplicated. (Research R-002.)

### Implementation for User Story 2

- [X] T005 [US2] Extend `app/components/GroupsBoard.vue` with the loss-layout rendering: when `revealed` groups are provided, render the full `buildBoardRows(props.puzzle.tiles, found, revealed)` output — found rows first (green, unchanged), then uncovered rows using red styling — each row with its criterion label on the left, and hide the selection grid (per data-model "selectable is empty once revealed"). Keep the existing `groups.game_over` feedback visible. Reuse `EntityImage` tiles; no engine or contract change.
- [X] T006 [P] [US2] Rewire `app/pages/game/groups.vue` so the board stays mounted in the finished state instead of being swapped out: when status is `lost`, render `GroupsBoard` in reveal mode (pass the ending outcome's `groups` as revealed) beneath the existing `ResultPanel`; when status is `won`, render the board with the completed green rows beneath `ResultPanel` (research R-002). The `markFinished`/visit-state flow and ShareButton remain untouched.

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Found rows persist across a reload (Priority: P2)

**Goal**: A reload mid-game restores the found rows identically (same tiles, label, order) from the existing client-side `foundGroups`, with no player action (spec US3, FR-007).

**Independent Test**: Find one group, reload the page, and confirm the same green row is restored and the remaining tiles play normally.

### Implementation for User Story 3

- [X] T007 [US3] Complete the reload path in `app/pages/game/groups.vue` + `app/components/GroupsBoard.vue`: confirm `initialFound` seeds `found` from the stored `foundGroups` and that `buildBoardRows` reproduces identical rows on mount; ensure a persisted `in_progress` board restores rows without re-submitting, and a persisted `won`/`lost` status still selects the finished view (reveal is transient per research R-007 — a reloaded lost game shows `ResultPanel`, which is intentional and documented). No storage-shape change (data-model §3).

**Checkpoint**: All user stories are now independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Reconciliation with feature 001, governance compliance, and full validation.

- [X] T008 [P] Reconcile the spec-001 wording (research R-010, doc-only): update `specs/001-daily-anime-puzzles/spec.md` FR-034 so a correct proposal "arranges the four tiles into a permanent horizontal row showing the group's characteristic," instead of removing tiles from the board, and align the T047 row in `specs/001-daily-anime-puzzles/quickstart.md`. No source-code change; server contract and stored payloads are untouched (contracts/openapi.yaml).
- [X] T009 [P] Run the full verification pass for the feature: `set -a; . ./.env; set +a; npm test` (whole suite green, new `tests/groups-board.test.ts` included, feature 003 total stays under the 15-test cap) and `npx nuxt build`; then execute quickstart.md manual checks 1–9 and confirm `tests/groups-board.test.ts` contains no stylesheet-text, CSS-class-string, or markup-snapshot assertions (Constitution VI). Record any deviation here or in the commit message.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3–5)**: All depend on Foundational completion. US1 and US2 both touch `app/components/GroupsBoard.vue`, so implement them sequentially P1 order (US1 → US2) rather than in parallel; US3 builds on the US1 rows rendering and the stored `foundGroups`.
- **Polish (Phase 6)**: Depends on all user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Foundational only — independently testable (spec US1 AC1–AC3).
- **User Story 2 (P1)**: Foundational + the rows rendering introduced by US1 (shared component file) — independently testable (spec US2 AC1–AC3).
- **User Story 3 (P2)**: US1 rendering + `foundGroups` persistence — independently testable (spec US3 AC1–AC2).

### Within Each User Story

- Foundation tests were written and made to fail (T002) before the model existed (T003).
- Rendering (component) before page wiring; core implementation before integration.
- Story complete before moving to next priority.

### Parallel Opportunities

- T002 (foundational tests) and T003 (model) are sequential (TDD red→green).
- T005 and T006 (US2 component vs page) touch different files — parallelizable.
- T008 and T009 (Polish) are independent — parallelizable.
- Different team members cannot safely work US1 and US2 on the same `GroupsBoard.vue` at once (sequenced above).

---

## Parallel Example: User Story 2

```bash
Task: "Extend the loss-layout rendering in app/components/GroupsBoard.vue"
Task: "Rewire the finished-state view in app/pages/game/groups.vue"
```

---

## Implementation Strategy

### MVP First (User Story 1 + Foundation)

1. Complete Phase 1: Setup (baseline verified).
2. Complete Phase 2: Foundational (T002 red, T003 green — pure `buildBoardRows` model).
3. Complete Phase 3: User Story 1 (T004 — green rows rendering).
4. **STOP and VALIDATE**: a single correct group renders as a permanent green row and its tiles exit the selection area.
5. Deploy/demo if ready.

### Incremental Delivery

1. Foundation ready (pure model + its tests).
2. Add User Story 1 → green rows → Test → Demo (MVP).
3. Add User Story 2 → loss reveal rows, found rows preserved → Test → Demo.
4. Add User Story 3 → reload restore → Test → Demo.
5. Polish (reconciliation + full verification).

### Parallel Team Strategy

- With the shared `GroupsBoard.vue` caveat, one pair can own US1→US2 sequentially while another handles the Polish doc reconciliation (T008) whenever foundation lands.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to the spec's user story for traceability.
- Each user story is independently completable and testable.
- Tests fail before implementation (T002 red before T003 green).
- Commit after each task or logical group.
- Avoid: server, storage, or contract changes — this feature is presentation-only (directive, research R-001, R-011).