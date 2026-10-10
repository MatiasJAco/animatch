---
description: "Task list for More or Less — Voice Actors With Over 80 Roles"
---

# Tasks: More or Less — Voice Actors With Over 80 Roles

**Input**: Design documents from `/specs/008-more-less-role-floor/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/role-floor.md, quickstart.md

**Tests**: The feature spec does not request TDD, but plan.md R-007 and Constitution VI call for focused, DB-free coverage of the boundary and the no-bypass invariant, so test tasks are included and kept well under the 15-test feature cap. Write tests before their implementation and confirm they fail first.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task names its exact file path

## Path Conventions

Single Nuxt project: server code under `server/`, tests under `tests/`, spec docs under `specs/008-more-less-role-floor/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a clean baseline; no project scaffolding is needed (existing repository).

- [X] T001 Confirm the working tree targets feature `008-more-less-role-floor` and run `npm test` to record a passing baseline before any change (suite under `tests/`); note any pre-existing failures to avoid blaming them on this feature.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The single shared definition of the floor that every user story relies on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 In `server/generators/moreOrLess.ts`, add `export const MIN_ROLE_COUNT_EXCLUSIVE = 80`, `export function isQualifiedRoleCount(roleCount: number): boolean` returning `roleCount > MIN_ROLE_COUNT_EXCLUSIVE`, and `export function filterQualifiedCandidates(candidates: readonly RoleCountCandidate[]): RoleCountCandidate[]` returning the candidates for which `isQualifiedRoleCount` holds. Keep the boundary definition in this one constant.

**Checkpoint**: The floor definition exists and is importable by tests and the generator.

---

## Phase 3: User Story 1 - Only established voice actors appear (Priority: P1) 🎯 MVP

**Goal**: Every voice actor in a More or Less puzzle has a career role count greater than 80.

**Independent Test**: Unit-test the boundary (80 excluded, 81 included) and the no-bypass invariant on a synthetic pool containing 79/80/81+ counts; then confirm a generated puzzle's actors all exceed 80 (quickstart §1).

### Tests for User Story 1 ⚠️ (write first; must FAIL before T004)

- [X] T003 [US1] Create `tests/more-less-role-floor.test.ts` (pure, DB-free) asserting `isQualifiedRoleCount(80) === false`, `isQualifiedRoleCount(81) === true`, `isQualifiedRoleCount(79) === false`, and that `filterQualifiedCandidates` drops every candidate with `roleCount <= 80` while keeping those with `roleCount > 80` from a mixed list. Run `npm test` and confirm these fail before T004.

### Implementation for User Story 1

- [X] T004 [US1] In `buildChain` in `server/generators/moreOrLess.ts`, filter the input through `filterQualifiedCandidates` before the existing `shuffle(...).filter(... > 0 && distinct-from-previous ...)` step, so selection can never admit an actor with `roleCount <= 80`. Leave `contentSignature`, the novelty retry loop, and `PuzzleUnavailableError` unchanged.

- [X] T005 [US1] Extend `tests/more-less-role-floor.test.ts` with the no-bypass invariant: `buildChain` over a synthetic pool containing 79/80/81+ counts returns a twelve-actor chain in which every actor's `roleCount > 80`; and a pool with too few qualified, distinct-count actors returns `null`.

- [X] T006 [US1] Run `npm test` and confirm the new `tests/more-less-role-floor.test.ts` tests pass alongside all existing tests.

**Checkpoint**: User Story 1 is fully functional and independently testable (MVP).

---

## Phase 4: User Story 2 - The floor never weakens the game's fairness rules (Priority: P2)

**Goal**: Ten rounds, no equal-count round, per-UTC-day determinism, and 30-day novelty all survive the narrowed pool.

**Independent Test**: The DB-gated payload/generation tests still pass, the served actors all exceed 80, and two visitors on the same UTC day get an identical full board (quickstart §2).

### Tests for User Story 2

- [X] T007 [US2] In `tests/routes/puzzle.get.test.ts`, extend the existing More or Less payload case to assert that the stored solution's `roleCounts` values for `initialVisible` and all eleven `chain` actors are all `> 80` (DB-gated; keep the existing shape assertions intact).

### Verification for User Story 2

- [X] T008 [US2] Run `npm test` and confirm `tests/generation.test.ts` still shows one deterministic puzzle per game+day and the More or Less payload test still shows `rounds === 10`, `chain.length === 11`, and twelve distinct actors (no equal-count round is introduced by the floor).

- [X] T009 [US2] Validate determinism and novelty end-to-end per quickstart §2: regenerate More or Less across consecutive UTC days (deleting only the app-owned `daily_puzzles` row for that game and day between runs) and confirm each day is a full ten-round board, identical for two visitors on the same day, and different from the preceding days.

**Checkpoint**: User Stories 1 and 2 both hold; the floor changed eligibility, not game rules.

---

## Phase 5: User Story 3 - A shortage of qualified actors is shown, never hidden (Priority: P3)

**Goal**: An insufficient qualified pool produces the existing bilingual retry error, never a downgrade or a below-floor actor.

**Independent Test**: A synthetic pool too small for a valid chain yields no chain (from T005), the route maps that to `PUZZLE_UNAVAILABLE` (503), and nothing is stored for the day.

### Verification for User Story 3

- [X] T010 [US3] Confirm the reused failure path with no code change: a `null` chain throws `PuzzleUnavailableError` in `server/generators/moreOrLess.ts`, which `server/game/puzzleService.ts` maps to `GeneratorError('PUZZLE_UNAVAILABLE')` and `server/api/daily/[game].get.ts` turns into the `PUZZLE_UNAVAILABLE` envelope (503); the client already renders it as the bilingual retry panel (`server/utils/errors.ts`, `tests/routes/attempt.post.test.ts`, `tests/i18n.test.ts`). Assert there is no code path that lowers the threshold.

- [X] T011 [P] [US3] Run quickstart §3 (thin-pool scenario) and record the outcome: `PUZZLE_UNAVAILABLE` with retry, no `daily_puzzles` row written, and no below-floor actor presented.

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and constraint checks across the feature.

- [X] T012 [P] Run the full `specs/008-more-less-role-floor/quickstart.md` validation (automated checks and manual sections) and record results.

- [X] T013 [P] Confirm Constitution VI and scope constraints: `package.json` is unchanged (no new dependency), no `migrations/` or catalog/schema change, no API payload/type change, and the new `it` blocks keep this feature under the 15-test cap.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phases 3–5)**: All depend on Foundational (T002).
- **Polish (Phase 6)**: Depends on all desired user stories.

### User Story Dependencies

- **US1 (P1)**: Depends only on T002. T003 (tests) precedes T004 (implementation); T005 extends the same test file after T004.
- **US2 (P2)**: Depends only on T002 and on US1's T004 to have a floor-compliant generator to assert against. Independently testable via its own payload assertions.
- **US3 (P3)**: Depends on T002 and US1's T004/T005; adds no code, only verification of the reused error path.

### Within Each User Story

- Tests before implementation (T003 before T004).
- `buildChain` change (T004) before the no-bypass test can pass (T005).
- Story complete before moving to the next priority.

### Parallel Opportunities

- After T002, US1 (T003→T006) is the critical path; US2's T007 and US3's T010/T011 touch different files and can begin once T002/T004 land.
- T011, T012, and T013 are independent validation tasks and can run in parallel at the end.

---

## Parallel Example: End of Feature

```bash
# Independent validation tasks that touch different concerns/files:
Task: "T011 Run quickstart §3 thin-pool scenario and record the outcome"
Task: "T012 Run the full quickstart.md validation and record results"
Task: "T013 Confirm package.json/migrations/schema unchanged and test count under cap"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (baseline) and Phase 2 (floor definition).
2. Complete Phase 3: enforce the floor in `buildChain` and prove the boundary and no-bypass invariant.
3. **STOP and VALIDATE**: run `npm test`; optionally generate a puzzle and confirm all actors exceed 80.
4. Deploy/demo: the requested guarantee ("every actor has over 80 roles") is met.

### Incremental Delivery

1. Setup + Foundational → floor definition ready.
2. US1 → the floor is enforced and unit-proven (MVP).
3. US2 → confirm the floor preserves rounds, distinctness, determinism, and novelty.
4. US3 → confirm a thin pool fails visibly with the reused retry error, never a downgrade.
5. Polish → full quickstart validation and constraint checks.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps each task to its user story for traceability.
- The change is one server module plus tests; no client, API, i18n, migration, or catalog change.
- Verify T003 fails before implementing T004.
- Commit after each task or logical group.
- Avoid editing `buildChain`'s chain-assembly or novelty logic beyond inserting the qualification filter.
