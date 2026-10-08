---
description: "Task list for More or Less — Explain Every Loss"
---

# Tasks: More or Less — Explain Every Loss

**Input**: Design documents from `specs/004-more-less-loss-feedback/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/loss-explanation.md, quickstart.md

**Tests**: Test tasks ARE included. The constitution caps this feature at **15 automated tests**
(Principle VI), and `plan.md` (R-009) budgets ~4–6 new `it` blocks over pure logic, storage, and
i18n. Every new test below stays inside that budget; there is no Vue component-mount harness, and
tests assert behavior/data, never stylesheet text, CSS class strings, or markup snapshots.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated on
its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task names the exact file it touches.

## Path Conventions

Single Nuxt 3 project. `server/` holds all database access, `app/` holds all rendering, `tests/`
holds the suite. Paths are repository-root relative.

## Conventions that apply to every task

- **No new dependency.** `nuxt`, `pg`, and `vitest` are the only three, already approved (Principle
  VI). Nothing in this list may add a fourth; absence of a fourth is verified in T001.
- **No writes or DDL against catalog tables** `people`, `anime`, `characters`, `voice_roles`,
  `anime_seasons`; `import_state` and `import_runs` are never read or written. This feature makes
  **zero** database changes (Principle I, plan.md §Constitution Check).
- **Bilingual copy.** Every visitor-facing string is added to **both** `app/i18n/en.ts` and
  `app/i18n/es.ts` in the same task that introduces it, and referenced through the catalog, never
  inlined in a component (FR-008).
- **No API change.** The server contract (`MoreOrLessOutcome`) already returns what the explanation
  needs; no endpoint, generator, or migration is touched (R-007, contracts/loss-explanation.md §4).
- **Disclosure bound.** The explanation uses only the failed round's answers and counts, and the
  person derived from the day's puzzle; nothing for later rounds, no remaining chain (FR-009, R-002).
- **Never blank.** A recorded loss always renders at least `result.lost` + attempts + share; the
  explanation degrades to counts/answers without the tile rather than erroring (FR-011, data-model §2).
- **No CSS class-string or markup-snapshot assertions** in tests; the red emphasis is a manual
  quickstart check, never a test assertion (Principle VI, R-004).
- **Comments stay short.** No essay-length rationale in source; that belongs in research.md.
- **Never commit credentials.** `DATABASE_URL` comes from the environment only.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependency freeze and confirmation that the touched files exist per plan.md.

- [X] T001 Confirm `nuxt`, `pg`, and `vitest` remain the only dependencies in `package.json` (`npm ls` or a diff review), and that no fourth dependency was introduced for this feature (Constitution VI; plan.md Technical Context)
- [X] T002 [P] Confirm the edit targets from plan.md exist and match their documented roles: `app/components/MoreOrLessBoard.vue`, `app/components/ResultPanel.vue`, `app/composables/useLocalProgress.ts`, `app/pages/game/more-or-less.vue`, `app/i18n/en.ts`, `app/i18n/es.ts`, `app/assets/css/main.css` (the `--wrong` token at line 15), and `tests/local-progress.test.ts`, `tests/i18n.test.ts`
- [X] T003 [P] Confirm `app/utils/` is the established utils directory (reference `app/utils/entityImage.ts`) and that `app/server/game/moreOrLess.ts` exports `MoreOrLessPuzzleData` / `MoreOrLessAnswer` for type reuse; no changes made in this task

**Checkpoint**: Dependencies frozen and all target files verified.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared pure derivation and the storage extension that both US1 (immediate loss) and US2 (reload) depend on.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [X] T004 Create `app/utils/moreOrLessLoss.ts` with the pure contract from data-model §1–§2: export `MoreOrLessLossRecord { round: number; given: MoreOrLessAnswer; correct: MoreOrLessAnswer; hidden: number; visible: number }`, `MoreOrLessLossView { round; totalRounds; given; correct; hidden; visible; personId: number | null; personName: string; visibleId: number | null; visibleName: string }`, and `moreOrLessLossView(puzzle: MoreOrLessPuzzleData, loss: MoreOrLessLossRecord): MoreOrLessLossView`; derive `ordered = [puzzle.initialVisible, ...puzzle.chain]`, the failed-round person = `ordered[loss.round + 1]`, and the compared person = `ordered[loss.round]`, exactly mirroring `server/game/moreOrLess.ts:67-68`; set `personId`/`personName` from the failed tile and `visibleId`/`visibleName` from the compared tile, and set each pair to `null`/`''` when `loss.round` is out of `[0, 9]` or the entry is undefined (data-model §2 Degradation; R-002)
- [X] T005 Implement the storage extension in `app/composables/useLocalProgress.ts`: add `loss?: MoreOrLessLossRecord` to `LocalGameState` (importing the type from `app/utils/moreOrLessLoss.ts`); extend `markFinished(game, status, attempts, extra?: Partial<LocalGameState>)` to merge `extra` into the written state alongside `status`/`attempts`/`endedAt`; add a `loss` read-time guard that drops a malformed record (non-object, or `round` not an integer in `[0,9]`, or `given`/`correct` not in `{'more','less'}`, or `hidden`/`visible` not finite numbers) while preserving the game's `lost` status (data-model §1 Validation; R-003)

**Checkpoint**: `lossView(puzzle, loss)` is pure and unit-testable, and a malformed or missing loss never breaks the stored day result.

---

## Phase 3: User Story 1 - Loss is explained the moment it happens (Priority: P1) 🎯 MVP

**Goal**: The loss result view shows, with zero extra interaction: the round reached, the failed voice actor's tile with a red background, their true role count in red, and the count it was compared against — bilingual (FR-001..FR-006, FR-013; US1 spec). The comparison itself is the explanation; no separate "Your answer"/"Correct answer" sentence is shown.

**Independent Test**: Play More or Less, answer any round wrong, and verify the loss screen itself shows the failed actor's tile with a red background, the true count in red, and the compared count — no further clicks or navigation (quickstart §1).

**⚠️ Tests first — write them, confirm they FAIL, then implement.**

### Tests for User Story 1

- [X] T006 [P] [US1] Write `tests/more-less-loss.test.ts`: (a) `moreOrLessLossView` for a mid-game helper fixture returns the correct failed-round person id/name (the tile is `ordered[round+1]` of the fixture payload) and the compared person id/name (`ordered[round]`) and carries the recorded `hidden`/`visible`/`given`/`correct`/`round`/`totalRounds`; (b) out-of-range round and/or a `chain` too short for the round return `null`/`''` for both tile pairs while every count/answer field is still present (data-model §2 Degradation; FR-012 degradation, SC-007, SC-008)
- [X] T007 [P] [US1] Extend `tests/i18n.test.ts`: assert `more_or_less.reveal` exists in both `en` and `es` with a `{count}` placeholder, that the shared `more_or_less.answer.*` labels remain, and that `es['more_or_less.reveal']` contains neither the literal `"Tinha"` nor mixed foreign copy (R-008, FR-008)

### Implementation for User Story 1

- [X] T008 [US1] Fix the Spanish `'more_or_less.reveal'` typo in `app/i18n/es.ts` from `"Tinha {count} roles"` to `"Tenía {count} roles"` (R-008, FR-008)
- [X] T009 [P] [US1] Create `app/components/MoreOrLessLossExplanation.vue` taking `view: MoreOrLessLossView` as a prop and rendering, in this reading order: the round indicator via `t('more_or_less.round', { current: view.round + 1, total: view.totalRounds })`; the failed person's tile via `EntityImage kind="person" :id="view.personId" :name="view.personName"` inside a red-background frame (`.loss-explanation__tile`) plus the person's name; the true count framed by `t('more_or_less.reveal', { count: view.hidden })` with the count styled with the existing `.feedback--wrong`/`var(--wrong)` red token and its text label present (never color-only); and the compared person's tile (`:id="view.visibleId" :name="view.visibleName"`) with the compared count badge (`view.visible`) — no "your answer"/"correct answer" sentence is rendered, the comparison itself is the explanation (contracts/loss-explanation.md §2–§3, FR-004, FR-013)
- [X] T010 [US1] Add an optional slot to `app/components/ResultPanel.vue` (inside the `.card` after the attempts paragraph, rendered only when the parent provides content) so all three games' existing output is unchanged when the slot is empty (R-005)
- [X] T011 [US1] Wire the page in `app/pages/game/more-or-less.vue`: in `handleOutcome`, when `o.state === 'lost'` call `progress.markFinished('more_or_less', 'lost', o.attempts, { loss: { round: o.round, given: o.given, correct: o.correct, hidden: o.counts.hidden, visible: o.counts.visible } })`; compute `lossView` from `gameState.value?.loss` + the fetched `puzzle` via `moreOrLessLossView` (guarded so it is null unless the game is lost and a valid loss is stored); render `<ResultPanel game="more_or_less" state="lost" :attempts="...">` with `<MoreOrLessLossExplanation :view="lossView" />` inside the new slot when `lossView` is non-null (data-model §1 Lifecycle, FR-001..FR-006, SC-001, SC-002)
- [X] T012 [US1] In `app/components/MoreOrLessBoard.vue`, make the miss branch own no transient reveal: on `outcome.result === 'miss'` emit the outcome and return without setting `revealed` (the result view renders the durable explanation); keep the existing inline hit reveal (`revealed` + `more_or_less.reveal`) unchanged for correct answers (R-006, FR-006)

**Checkpoint**: A wrong answer shows the full explanation on the loss screen immediately; `result.won` and the other games are visually unchanged; T006 and T007 tests now pass.

---

## Phase 4: User Story 2 - The explanation survives coming back later (Priority: P2)

**Goal**: The same explanation (answers, red count, tile, round) is shown from the stored day result after a reload or a revisit later the same UTC day, and correctly vanishes on the next UTC day (US2 spec, FR-007, FR-011).

**Independent Test**: Lose a round, reload the page or navigate Home → back into the game, and verify the identical explanation re-renders; verify the next UTC day (or cleared storage) starts as a playable empty state with no explanation and no error (quickstart §2).

**⚠️ Tests first — write them, confirm they FAIL, then implement.**

### Tests for User Story 2

- [X] T013 [US2] Extend `tests/local-progress.test.ts`: (a) a more_or_less game marked finished as `lost` with a full `loss` record round-trips through a fresh `useLocalProgress().load()` with `gameState.loss` intact (SC-003); (b) a stored blob from a previous UTC day with a `loss` record is discarded on load (day scoping, US2 scenario 3); (c) a `loss` that fails validation (e.g. `round: 11` or `correct: 'up'`) is dropped on read while the game still reports `status: 'lost'` (data-model §1 Validation, FR-011)

### Implementation for User Story 2

- [X] T014 [US2] Confirm/complete the reload path in `app/pages/game/more-or-less.vue`: the `finished` branch must derive `lossView` solely from persisted `gameState.loss` + the refetched day `puzzle` (a computed, not the in-memory `lastOutcome`), so a fresh page load after a loss re-renders the explanation; ensure cleared or unreadable storage yields the existing playable/empty result path and never an error (FR-007, FR-011; R-002, R-003)
- [X] T015 [US2] Add the day-rollover guard check: on mount the day-scoped `load()` and UTC determinism already discard yesterday's loss (T013b asserts it); verify no reference to a previous day's `loss` remains anywhere in the page or the explanation component (Principle III, data-model §1 Lifecycle)

**Checkpoint**: Reload/revisit later the same day re-renders the identical explanation; next day and cleared storage behave as a fresh playable game. T013 passes.

---

## Phase 5: User Story 3 - The explanation is unambiguous and accessible (Priority: P3)

**Goal**: Correct/incorrect answers and the red count are distinguishable by text alone (no color), reading order is correct for assistive tech, the tile alt text is localizable, and the round indicator is explicit (US3 spec, FR-012).

**Independent Test**: Read the loss screen with colors disabled and via a screen reader: the true count vs the compared count are told apart by labels, the counts are announced in reading order, and the round is stated (quickstart §3).

### Implementation for User Story 3

- [X] T016 [P] [US3] Accessibility pass on `app/components/MoreOrLessLossExplanation.vue`: use a semantic section/heading for the explanation, keep DOM/reading order aligned with the visual order (round → failed tile → red count → compared tile → compared count), ensure the red count carries an explicit text label independent of color, and give the actor tile the catalog `t('image.alt', { name })` alt text via the shared `EntityImage` (contracts/loss-explanation.md §3, FR-012, SC-008)
- [X] T017 [US3] Verify the compared-count interpolation is locale-neutral in both `app/i18n/en.ts` and `app/i18n/es.ts` (the reveal label takes a localized `{count}` value so Spanish reads "Tenía N roles", not a mixed-language mix); adjust the catalog strings if the interpolation reads ambiguously in either language (FR-008, R-008)

**Checkpoint**: No-color and screen-reader readings of the explanation are unambiguous; Spanish answer words render localized.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end verification, constitution re-check, and documentation consistency.

- [X] T018 Run `npm test` and confirm the whole suite is green and the feature's new tests stay within the 15-test cap (Principle VI; R-009)
- [ ] T019 [P] Run the manual validation from `quickstart.md` §1–§5 end-to-end (immediate explanation, reload persistence, no-color/screen-reader, error-not-loss on a blocked attempt, win path and other games unchanged) and record results against the "Expected outcomes map" — **requires a live browser + configured DATABASE_URL; not executable in this headless session**
- [X] T020 [P] Constitution re-check before closing the feature: confirm still zero catalog writes/DDL, no new dependency, no new server endpoint or migration, no account/session, no CSS/markup test assertions, and that `comment`s in new source files are not essay-length (plan.md Constitution Check; Constitution §Development Workflow)
- [X] T021 [P] Consistency pass: make sure `specs/004-more-less-loss-feedback/` should reflect reality — `data-model.md`, `contracts/loss-explanation.md`, `research.md`, and `quickstart.md` must match the implemented schema, i18n keys, and component behavior (no drift from R-001..R-009)

**Checkpoint**: Feature is shippable: tests green, manual matrix passed, constitution gates verified, docs consistent.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (helper + storage are shared).
- **User Stories (Phase 3+)**: Depend on Foundational completion; then run in priority order (P1 → P2 → P3), or in parallel beyond that.
- **Polish (Final Phase)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: T004, T005 (Foundational) → T006, T007 (tests) → T008–T012. No dependency on US2/US3.
- **User Story 2 (P2)**: T004, T005, plus the US1 persistence write (T011). Independently testable via storage tests.
- **User Story 3 (P3)**: T009 (the explanation component) and T008 (i18n). Independently testable; no logic dependency on US2.

### Within Each User Story

- Tests first (fail) → implementation → checkpoint.
- Models/shared primitives (T004, T005) before services/UI (T008–T014).
- Story complete before moving to the next priority.

### Parallel Opportunities

- Phase 1: T002 and T003 can run in parallel.
- Phase 2: T004 and T005 are both greenfield edits to different files (utils vs composable) — parallelizable after T001–T003.
- US1: T006 and T007 (tests, different files) in parallel; then T008, T009, T010, T012 in parallel (i18n, new component, ResultPanel slot, board tweak — different files), with T011 (page wiring) after T004/T005/T009/T010.
- US2: T013 (test) can run while T014 is drafted; T015 is a review task.
- US3: T016 and T017 in parallel.
- Polish: T019, T020, T021 in parallel after T018.

---

## Parallel Example: User Story 1

```bash
# Launch the two US1 tests together:
Task: "Write tests/more-less-loss.test.ts (derivation + fallback)"
Task: "Extend tests/i18n.test.ts (new keys + typo)"

# Then launch the independent US1 edit tasks together:
Task: "Add i18n keys to app/i18n/en.ts and app/i18n/es.ts"
Task: "Create app/components/MoreOrLessLossExplanation.vue"
Task: "Add slot to app/components/ResultPanel.vue"
Task: "Adjust miss branch in app/components/MoreOrLessBoard.vue"

# Then wire the page (depends on all of the above):
Task: "Wire persisted loss + explanation slot in app/pages/game/more-or-less.vue"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (T001–T003).
2. Complete Phase 2, Foundational (T004–T005) — CRITICAL, blocks all stories.
3. Complete Phase 3, US1 (T006–T012).
4. **STOP and VALIDATE**: immediate loss explanation works, tests green.
5. Deploy/demo if ready — this alone closes the "must always know why he lost" defect for the fresh-loss flow.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. Add US1 → immediate loss explanation (MVP).
3. Add US2 → explanation survives reload/revisit same day.
4. Add US3 → accessibility/unambiguous presentation.
5. Polish → full matrix, constitution re-check.

### Parallel Team Strategy

With multiple developers: Setup + Foundational together; then one developer per user story. US1 is the only must-have for a shippable MVP.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps the task to its spec user story for traceability.
- Each user story is independently completable and testable.
- Verify tests fail before implementation (TDD), then pass after.
- Commit after each task or logical group; never commit credentials.
- Stop at any checkpoint to validate the story independently.