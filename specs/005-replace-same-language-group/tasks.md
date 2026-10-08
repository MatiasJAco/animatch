---

description: "Task list template for feature implementation"
---

# Tasks: Replace the "same language" Groups Criterion

**Input**: Design documents from `specs/005-replace-same-language-group/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: TDD — tests are REQUIRED by the feature spec's "Manual vs Automated Verification Note" and
SC-006. The source-model tests (plan Test Plan rows 1–3) and the board-shape test (row 4) are written
first and must FAIL before their implementation; rows 5–6 land after the generator swap and act as
regression locks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. The single implementation burst is the generator pool swap; everything else is model, i18n, tests, and doc reconciliation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single Nuxt application at repository root; catalog reads in `server/catalog/queries.ts`, game
  model in `server/game/`, generator in `server/generators/`, locales in `app/i18n/`, tests in `tests/`.
- No client components, pages, composables, API, payload, storage, config, or dependency changes
  (research R-005, R-008, R-011; plan "Scope" section).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the feature needs no new tooling or configuration (research R-008) and that the
baseline is green before any code changes.

- [X] T001 Verify the baseline before changing anything: run `set -a; . ./.env; set +a; npm test`
  and `npx nuxt build`; confirm the existing suites pass and the build is green. No dependency,
  config, vitest, or `.gitignore` change is authorized (research R-008, constitution).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The source-material pool and the `same_source` criterion verdict that every user story
is judged against (research R-002, R-004, data-model.md §2–§3). `same_language` is removed from the
criterion union and from the catalog module, and the existing groups-board fixture is reconciled so
the suite compiles (R-009 partial).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests for the Foundation (TDD — must FAIL before implementation) ⚠️

- [X] T002 [P] Write the source-model tests in `tests/groups-source.test.ts` (plan Test Plan rows 1–3):
  `fetchSameSourcePools` returns pools keyed by non-blank `source`, each pool holding ≥ 4 distinct
  characters across ≥ 4 distinct anime, deterministically ordered; blank sources and pools under the
  distinct-anime bar are excluded; and the judging rule accepts a tile by its own pinned `source`
  while rejecting tiles of any other source regardless of shared anime or language (FR-003, FR-005,
  FR-002). DB-backed with `describe.skipIf(!connectionString)` like `tests/routes/*`. Anti-first:
  the file imports `fetchSameSourcePools` and constructs `{ type: 'same_source', ... }`, neither of
  which exists yet, so it fails to compile — the red is expected.

### Implementation for the Foundation

- [X] T003 [P] Implement `fetchSameSourcePools` in `server/catalog/queries.ts`: key pools by the
  non-blank `anime.source` value, tile candidates across distinct anime (one character per tile, no
  duplicate character within a pool), include only pools clearing the ≥ 4 distinct characters across
  ≥ 4 distinct anime bar, order pools deterministically; add `source: string` to `GroupCandidateTile`;
  delete `fetchSameLanguagePools`; update the module header comment from "eight allowed facts" to
  nine — source material included (research R-003, R-004). Principle I: SELECT-only, owned by the
  catalog module.
- [X] T004 [P] Swap the `GroupCriterion` union in `server/game/groups.ts`: the `same_language`
  variant `{ type: 'same_language'; animeId: number; language: string }` becomes
  `{ type: 'same_source'; source: string }`. The wire `GroupsTile`, payload, and storage shapes are
  byte-identical (research R-005).
- [X] T005 [P] Reconcile the `tests/groups-board.test.ts` fixture (line 22): the non-parallel
  `{ type: 'same_language', animeId: 2, language: 'ja' }` criterion becomes
  `{ type: 'same_source', source: 'Manga' }`, so the whole suite typechecks once T004 lands
  (R-009 partial). No behavioral assertion changes.

**Checkpoint**: Tests 1–3 are authored and tests 1–2 PASS against the new pool; test 3 turns green
with US1's generator swap. Foundation ready — user stories can begin. No client, storage, or
contract change has been made.

---

## Phase 3: User Story 1 - Every board stays four groups of four, with the language group gone (Priority: P1) 🎯 MVP

**Goal**: Every Groups board still resolves into exactly four groups of four, described by `same_anime`,
`same_season`, `same_source`, `same_voice_actor` — `same_language` never appears on any day, and the
replacement label exists in both locales from the first release (spec US1, FR-001, FR-002, FR-007).

**Independent Test**: Solve (or lose, or inspect the daily solution of) Groups boards across several
days and confirm each board shows exactly four groups of four, three existing criteria plus the
replacement, and never a "shared voice language" label.

### Test for User Story 1 (TDD — must FAIL before T008) ⚠️

- [X] T006 [US1] Write the board-shape test in `tests/groups-source.test.ts` (plan Test Plan row 4):
  `generateGroups` for an isolated future UTC date (an `isolatedPuzzleDate` offset unused by other
  suites; catches `PUZZLE_UNAVAILABLE` for an uncovered season like `tests/routes/puzzle.get.test.ts`)
  yields sixteen tiles across exactly four groups, and the criterion set is exactly
  `{ same_anime, same_season, same_source, same_voice_actor }` with `same_language` never present
  (FR-001, FR-002, SC-001). Red because the generator still injects the language pool.

### Implementation for User Story 1

- [X] T007 [P] [US1] Locales in `app/i18n/en.ts` and `app/i18n/es.ts`: add
  `groups.criterion.same_source` (en: "the same source material", es: "el mismo material de origen")
  and remove `groups.criterion.same_language` from both (FR-007, R-006). The existing
  `criterionLabel` mapping in `app/components/GroupsBoard.vue` renders the new key automatically — no
  component change.
- [X] T008 [US1] Swap the generator in `server/generators/groups.ts`: import `fetchSameSourcePools`
  instead of `fetchSameLanguagePools`; remove the `same_language` case from `holds()` and add the
  `same_source` case (a tile holds when its own pinned `source` equals the criterion's, with no
  anime/language check — research R-005); the proposed group becomes
  `{ type: 'same_source', source: <pool source> }`; try candidate source pools smallest-footprint-first
  (niche sources first, e.g. "Web manga" before "Manga") inside the existing `MAX_NOVELTY_RETRIES`
  loop so the exactly-one-subset gate keeps clearing (R-007); rebuild the `tileByKey` map over the
  new pool set. Seeding, retry budget, and the `PUZZLE_UNAVAILABLE` path stay untouched (FR-008).
  This makes plan tests 3 and 4 green.

**Checkpoint**: User Story 1 is fully functional and independently testable (spec US1 AC1–AC3).
A revealed board shows four groups of four with the source group labelled "the same source material".

---

## Phase 4: User Story 2 - The replacement group can be told apart from the "same anime" group (Priority: P1)

**Goal**: The replacement source group is never just another "same anime" group: its four tiles come
from more than one anime, and it is solvable from tile names and general anime knowledge through the
shared source fact (spec US2, FR-003, FR-004, FR-006).

**Independent Test**: Reveal the replacement group on any board and confirm its four tiles come from
more than one anime, and that its label names the shared source rather than pointing back to one show.

### Test for User Story 2 (regression lock — green after T008) 

- [X] T009 [US2] Add the distinctness and solvability test to `tests/groups-source.test.ts` (plan
  Test Plan row 5): on a produced board the source group's four tiles span more than one anime
  (FR-003, SC-003), and across the board the source subset is the only four-tile subset satisfying
  the source criterion — the board passes the exactly-one-subset gate and is not ambiguous (FR-006).
  Authored against the foundation + T008 output, so it passes immediately and guards against a
  regression to a hidden single-show group.

**Checkpoint**: User Story 2 is independently testable (spec US2 AC1–AC2).

---

## Phase 5: User Story 3 - Daily availability and determinism are not harmed (Priority: P2)

**Goal**: Swapping the language pool for the source pool does not shrink the share of playable days,
and any already-published day regenerates identically. Days the source pool cannot fill keep today's
clear `PUZZLE_UNAVAILABLE` outcome — never a malformed or weakened board (spec US3, FR-008, SC-006).

**Independent Test**: Generate boards across a multi-week horizon (as done today) and confirm the share
of days that yield a playable board does not decrease compared with the current design.

### Test for User Story 3 (regression lock — green after T008)

- [X] T010 [US3] Add the determinism and unavailable-day test to `tests/groups-source.test.ts` (plan
  Test Plan row 6): regenerating the same UTC day with the same catalog state reproduces the identical
  board, including the source group (compare the two `generateGroups` payloads directly — the call is
  read-only) (FR-008, SC-006, Principle III); and confirm an un-fillable day still raises
  `PuzzleUnavailableError` rather than a weakened board (SC-006 alt., R-007).

**Checkpoint**: User Story 3 is independently testable (spec US3 AC1–AC2).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Reconciliation with features 001 and 003, governance compliance, and full validation.

- [X] T011 [P] Reconcile the spec-001 wording (research R-009, doc-only): update the Allowed facts
  list in `specs/001-daily-anime-puzzles/spec.md` to gain "Anime source material" and reword FR-032 to
  "the same anime, the same season, the same source material, or the same voice actor"; update
  `specs/001-daily-anime-puzzles/data-model.md` §6 (tile fact, criteria, pool table) and
  `specs/001-daily-anime-puzzles/research.md` fact table; and change the criterion enum in
  `specs/001-daily-anime-puzzles/contracts/openapi.yaml`. No source-code change; server contract and
  stored payloads are byte-identical.
- [X] T012 [P] Reconcile `specs/003-groups-board-layout/contracts/openapi.yaml`: the lost-group
  example's criterion `same_language` becomes `same_source` (research R-009).
- [X] T013 [P] Run the full verification pass for the feature: `set -a; . ./.env; set +a; npm test`
  (whole suite green, new `tests/groups-source.test.ts` included, feature 005 stays at ~6 tests within
  the 15-test cap) and `npx nuxt build`; then run the quickstart availability probe (playable-day share
  before/after) and manual checks 1–8, and confirm no stylesheet, CSS-class, or markup-snapshot
  assertions anywhere in `tests/groups-source.test.ts` (Constitution VI). Record any deviation here or
  in the commit message.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3–5)**: All depend on Foundational completion. US1 owns the single
  implementation burst (T008); US2 and US3 add locking tests on top of US1's output, so they run after
  T008. i18n (T007) is independent of T008 — parallel by file.
- **Polish (Phase 6)**: Depends on all user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Foundational only — independently testable (spec US1 AC1–AC3).
- **User Story 2 (P1)**: Foundational + the generator swap from US1 (T008) — independently testable
  (spec US2 AC1–AC2).
- **User Story 3 (P2)**: Foundational + the generator swap from US1 (T008) — independently testable
  (spec US3 AC1–AC2).

### Within Each Phase

- Foundation tests were written and made to fail (T002) before the pool existed (T003).
- The board-shape test (T006) failed before the generator swap (T008).
- Rows 5–6 (T009, T010) are authored after T008 as regression locks; they assert behavior the
  foundation pool bar and the generator already guarantee.
- Story complete before moving to next priority.

### Parallel Opportunities

- T002 (foundational tests) is sequential against T003–T005 by TDD red→green, but T003, T004, T005
  touch different files — fully parallelizable once T002 is filed.
- T007 (i18n) is independent of T008 (generator) — parallelizable.
- T011 and T012 (doc reconciliations) are independent — parallelizable.
- T013 (verification) runs last.
- Only the generator file (`server/generators/groups.ts`) is single-writer; everything else in any
  phase is disjoint.

---

## Parallel Example: Polish

```bash
Task: "Reconcile spec-001 wording in specs/001-daily-anime-puzzles/{spec.md,data-model.md,research.md,contracts/openapi.yaml}"
Task: "Reconcile the lost-group example in specs/003-groups-board-layout/contracts/openapi.yaml"
```

---

## Implementation Strategy

### MVP First (Foundation + User Story 1)

1. Complete Phase 1: Setup (baseline verified).
2. Complete Phase 2: Foundational (T002 red, T003 green — source pool + criterion type + fixture).
3. Complete Phase 3: User Story 1 (T008 — generator swap; plan tests 3–4 green; i18n label).
4. **STOP and VALIDATE**: a revealed board shows four groups of four and the source group labelled
   "the same source material", and no board anywhere mentions a shared voice language.
5. Deploy/demo if ready.

### Incremental Delivery

1. Foundation ready (source pool + criterion type + its tests).
2. Add User Story 1 → boards generate four-groups-of-four without the language criterion → Test → Demo (MVP).
3. Add User Story 2 → distinctness + solvability tests → Test.
4. Add User Story 3 → determinism + unavailable-day tests, availability probe → Test.
5. Polish (reconciliation + full verification).

### Parallel Team Strategy

- One pair can own the catalog + game model (T003–T005) while another writes i18n (T007); the
  generator (T008) is the merge point.
- Polish doc reconciliations (T011, T012) can run as soon as foundation lands.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to the spec's user story for traceability.
- Each user story is independently completable and testable.
- Tests fail before implementation (T002 red before T003; T006 red before T008).
- Commit after each task or logical group.
- Avoid: server contract, payload, storage, config, UI-component, or dependency changes — this
  feature is server-model + generator + i18n only (directive, research R-005, R-008, R-011).
- `same_language` disappears from code AND docs in the same change (research R-009): no review may
  face a spec that promises a criterion the generator can never emit.

## Implementation Notes (deviations recorded per T013)

Footprint-first ordering alone (research R-007's original single knob) was measured and regressed
availability: 43–44 of 50 consecutive days built a board, and `tests/routes/attempt.post`'s day
(offset 9) was `PUZZLE_UNAVAILABLE`. The root cause is structural — the old `same_language` group
pinned its four tiles to one anime, so it never admitted extra `same_season`/`same_source` subsets;
`same_source` tiles span many anime, and 96 of 114 fall-2026 series carry a source, so a source tile
drawn from a currently-airing anime alone turned the board's four valid groups into five-plus.

The generator now keeps the deterministic pipeline and the existing `MAX_NOVELTY_RETRIES` budget
(FR-008, SC-006) but adds two availability refinements inside the retry loop:
1. **Season cut** — the source, anime, and voice-actor pools drop currently-airing anime before any
   candidate is made (via the catalog's `fetchCurrentSeasonSeries`), so the season group is the only
   group that touches the airing season.
2. **Adaptive source choice** — the anime/season/actor groups are drawn first; the source pool is then
   the smallest-footprint pool whose golden source does not appear on any of those twelve tiles, whose
   tiles collision-check against the picked keys, and none of whose tiles is voiced by the actor under
   test (avoiding a source-vs-actor ambiguous subset). The gate still re-verifies.

Measured result: all 84 days in catalog-covered range (to 2026-12-31) build a board; offsets beyond
the data fall to the unchanged `PUZZLE_UNAVAILABLE` outcome.

**T013 verification results (2026-10-08)**:
- `npm test` → 14 files / 48 tests pass (42 baseline + 6 feature tests), within the 15-test cap.
- `npx nuxt build` → green.
- Quickstart availability probe (read-only, catalog unchanged) → 9 usable sources; matches the
  research R-002 snapshot (Manga 3558/149, Light novel 2097/86, Web manga 1002/61, Original 627/63,
  Web novel 498/50, Game 207/19, Novel 127/10, Mixed media 116/5, Other 109/14) — no catalog-side
  regression, and the generator's playable-day share holds at the language-era baseline within data
  coverage.
- Manual checks 1–8 require a browser (`npx nuxt dev`) and are the on-screen confirmation for
  FR-001/003/004/007, SC-005, and no-scope-creep; the automated suites cover their FR/SC substance.
- `tests/groups-source.test.ts` contains no stylesheet, CSS-class, or markup-snapshot assertion
  (Constitution VI).