# Tasks: Daily Anime Puzzles (v1)

**Input**: Design documents from `/specs/001-daily-anime-puzzles/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml

**Tests**: Included. SC-012 requires an automated suite of at most 15 tests, and plan.md names
exactly 15. Every test task below maps to one numbered row of that plan; no task may add a
sixteenth. There are no browser end-to-end tests and no markup or stylesheet assertions.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and
demonstrated on its own. Stories are sequential in practice because each one extends the same
attempt route and the same catalog query module.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1..US6). Setup and foundational tasks
  carry no story label.
- Paths are repository-relative and match the structure in plan.md.

## Constraints that apply to every task

- Catalog tables are read-only: hand-written `SELECT`s only, no ORM, no query builder, and
  `import_state` and `import_runs` appear nowhere (Principle I, FR-008).
- `server/` is the only place a database connection or driver exists; the browser never sees
  `DATABASE_URL`, a driver, or SQL (Principle II, FR-010).
- No secrets in the repository: `.env` is gitignored, `.env.example` carries an empty placeholder.
- Original names, copy, layout, and assets only; no external font, icon, or image request; the
  prohibited comparison-game token appears in no name, route, or message key (FR-053, FR-054,
  FR-055).
- Source comments state intent in one short line; no essay comments (Principle VI).
- Nothing new outside the approved dependency set: `nuxt` ^3, `pg`, `vitest`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project skeleton, dependencies, the one new table, and the baseline stylesheet.

- [X] T001 Create the directory skeleton from plan.md §Project Structure: `migrations/`, `scripts/`,
      `server/api/daily/[game]/`, `server/game/`, `server/generators/`, `server/catalog/`,
      `server/db/`, `server/utils/`, `app/components/`, `app/composables/`, `app/pages/game/`,
      `app/i18n/`, `app/assets/css/`, `tests/routes/`, `tests/helpers/`
- [X] T002 Initialize the Nuxt 3 + TypeScript project in package.json with `nuxt` ^3, `pg`, and dev
      dependency `vitest`; add scripts `dev`, `build`, `test`, `db:migrate`; add `nuxt.config.ts`,
      `.gitignore` including `.env`, and `.env.example` with an empty `DATABASE_URL`
- [X] T003 [P] Configure vitest.config.ts with the node environment, the `@` alias to `app/` and
      `server/`, and a setup file that isolates browser storage per test
- [X] T004 Write `migrations/001_daily_puzzles.sql`: idempotent `CREATE TABLE IF NOT EXISTS
      daily_puzzles` with `game`, `puzzle_date`, `payload` JSONB, `solution` JSONB, `created_at`, and
      `PRIMARY KEY (game, puzzle_date)`; no statement against any catalog table
- [X] T005 Write `scripts/migrate.ts` so `npm run db:migrate` applies every file in `migrations/` in
      filename order, each inside its own transaction, and exits non-zero on failure
- [X] T006 [P] Write `app/assets/css/main.css`: system font stack, own layout primitives, phone-first
      rules so no page scrolls horizontally (FR-016), and the neutral tile style reused by
      `MatchGrid.vue` (FR-029)
- [X] T007 [P] Write `README.md` with prerequisites, `npm install`, `npm run db:migrate`,
      `npm run dev`, `npm test`, and a note that runtime configuration is never committed

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The UTC day rule, deterministic seeding, the database and catalog boundary, the error
envelope, the bilingual catalog, and the device-state composables. No user story can start until this
phase is complete.

- [X] T008 Create `server/utils/day.ts`: UTC civil date as `new Date().toISOString().slice(0,10)`,
      the UTC calendar-season mapping including the year, and the next 00:00 UTC rollover instant
      (FR-002, FR-030, FR-047, R-007, R-014)
- [X] T009 [P] Create `server/utils/seed.ts`: `sha256("<game>:<puzzle_date>")` fed into a mulberry32
      PRNG, so the same game and day always yield the same draws (FR-005, R-004)
- [X] T010 [P] Create `server/utils/shuffle.ts`: seeded Fisher-Yates returning new arrays, never
      mutating its input (R-004)
- [X] T011 Create `server/utils/errors.ts`: the codes `UNKNOWN_GAME`, `INVALID_ATTEMPT`,
      `DATABASE_UNAVAILABLE`, `PUZZLE_UNAVAILABLE` and the response envelope with a short
      non-technical English fallback that carries no connection string, query, or stack (FR-050,
      FR-051, R-017)
- [X] T012 Create `server/db/pool.ts`: a `pg` Pool built from `DATABASE_URL` and closed on Nitro
      shutdown; it is the only module that opens a connection (FR-010, Principle II)
- [X] T013 Create `server/catalog/queries.ts` and `server/catalog/index.ts`: the single module that
      issues catalog queries, every statement a hand-written `SELECT` with an explicit column
      allow-list limited to the eight allowed facts, never selecting `image_url`, never touching
      `import_state` or `import_runs` (FR-009, FR-008, R-008)
- [X] T014 Create `server/db/puzzles.ts`: read today's row by primary key, and on a miss generate
      inside one transaction, `INSERT ... ON CONFLICT DO NOTHING`, then re-read and serve the
      persisted winner so concurrent first requests agree (FR-003, FR-004, R-005)
- [X] T015 Create `server/game/ids.ts`: the three `GameId` values, a type guard, and the
      `UNKNOWN_GAME` rejection for anything else (FR-001)
- [X] T016 Create `app/i18n/es.ts` and `app/i18n/en.ts` as one task so their key sets cannot drift:
      every visitor-facing string of the whole site, including help text, error messages, and share
      text (FR-048, FR-049, SC-011)
- [X] T017 [P] Create `app/i18n/index.ts`: resolve the stored choice first, else the browser language
      when it is Spanish or English with any regional variant mapped to its base language, else
      Spanish (FR-049a, R-010)
- [X] T018 [P] Create `app/composables/useLocalPrefs.ts`: read and write `animatch:v1:prefs`, never
      date-scoped, so the language survives the 00:00 UTC rollover (FR-049b, data-model §8.2)
- [X] T019 [P] Create `app/composables/useLocale.ts`: expose the active locale and a switch that
      re-renders every string on the open page with no reload and no refetch (FR-049b)
- [X] T020 Create `app/composables/useLocalProgress.ts`: `animatch:v1:progress` keyed by game and
      UTC date, written on every accepted answer, discarded silently when the stored date is
      another day or the blob is malformed, and never holding puzzle content (FR-015, FR-042,
      FR-043a, FR-043b, FR-052, data-model §8.1)
- [X] T021 [P] Create `app/composables/useAttemptCount.ts`: count every accepted answer, correct or
      wrong, and never an attempt rejected as invalid (FR-041)
- [X] T022 Create `app/composables/useDailyPuzzle.ts`: fetch one game's puzzle, expose
      loading/error/payload state, refetch when the UTC date changes under the page, and keep every
      request on this origin
- [X] T023 Create `tests/helpers/`: a catalog stub that serves fixture rows, a recorder that captures
      every SQL string the app executes, an in-memory `daily_puzzles` substitute, and per-test
      browser storage. Helpers are support code and are not tests, so they do not consume the
      15-test budget
- [X] T024 [P] Write `tests/day.test.ts`, test 6: the day key is a UTC civil date that rolls over at
      00:00 UTC (FR-002, FR-047)
- [X] T025 [P] Write `tests/generation.test.ts`, test 5: the same game and day return an identical
      puzzle and create exactly one row (FR-003, FR-004, FR-005, SC-002)

**Checkpoint**: Foundation ready. The boundary tests can run and user story implementation can begin.

---

## Phase 3: User Story 1 - Pick today's games from the home page (Priority: P1) MVP

**Goal**: A visitor opens the site and sees all three games of the current UTC day, each marked when
it is already finished today from their own device, in their own language.

**Independent Test**: Load with empty device storage, then after storing a finished result for one
game; the home page lists three games and marks exactly one as finished.

### Tests for User Story 1

- [X] T026 [P] [US1] Write `tests/routes/daily.get.test.ts`, test 1: the home listing returns three
      games for the current UTC date with a per-game status and never a completion flag (FR-012,
      FR-013, SC-001)
- [X] T027 [P] [US1] Write `tests/local-progress.test.ts`, tests 11 and 12: finished state is per
      game and per UTC date with mid-game resume, and cleared or malformed storage plus a language
      choice that survives the rollover (FR-013, FR-042, FR-043a, FR-043b, FR-049b, SC-003,
      SC-004, SC-015, SC-017)

### Implementation for User Story 1

- [X] T028 [US1] Create `server/api/daily/index.get.ts`: today's UTC date plus a per-game entry with
      `available` and an error code when one game cannot be produced, so one unavailable game never
      blanks the page (FR-012, Principle V)
- [X] T029 [P] [US1] Create `app/components/GameCard.vue`: game name, one-line description,
      finished-today marker, and a link to the game route
- [X] T030 [P] [US1] Create `app/components/GameHelp.vue`: the short help text per game, rendered
      from the message catalog with no inline copy (FR-014, FR-049)
- [X] T031 [P] [US1] Create `app/components/CountdownBadge.vue`: time until the next rollover,
      formatted in the browser's timezone for display only (FR-047, EC-003)
- [X] T032 [P] [US1] Create `app/components/LanguageControl.vue`: the always-visible switch that
      applies immediately and persists the explicit choice (FR-049b)
- [X] T033 [US1] Create `app/pages/index.vue`: the three games for today, readable and tappable on a
      phone-sized screen without horizontal scrolling, with the language control and countdown
      (FR-012, FR-016, SC-013)
- [X] T034 [US1] Create `app/app.vue`: document shell importing `app/assets/css/main.css`, the
      resolved locale on the root element, and no server-side visitor state

**Checkpoint**: The home page works on its own, in both languages, with correct per-device markers.

---

## Phase 4: User Story 2 - Play More or Less (Priority: P1) MVP

**Goal**: Ten rounds comparing a hidden career role count against a visible one, with an immediate
end state on a wrong answer.

**Independent Test**: Play ten correct answers and see the win summary with the final count revealed;
then answer wrong once and see immediate game over.

### Tests for User Story 2

- [X] T035 [P] [US2] Write `tests/routes/puzzle.get.test.ts`, test 2: today's more-or-less payload is
      served without the solution and with only the one visible role count (FR-003, FR-009)
- [X] T036 [P] [US2] Write `tests/routes/attempt.post.test.ts`, tests 7 and 10: a valid more-or-less
      attempt returns `hit` or `miss` with both counts disclosed and carries no attempt count, and an
      attempt naming an entity outside the puzzle is rejected as invalid and changes no client
      counter (FR-018, FR-021, FR-039, FR-041, SC-007)

### Implementation for User Story 2

- [X] T037 [US2] Add to `server/catalog/queries.ts`: people with their career role counts, counting
      every `voice_roles` row attributed to the person regardless of character, series, or
      language (FR-023)
- [X] T038 [US2] Create `server/generators/moreOrLess.ts`: a chain of eleven actors whose adjacent
      counts are never equal, drawn with the seeded PRNG, and a novelty signature that differs from
      the previous 30 days (FR-017, FR-022, FR-007, EC-001, R-006)
- [X] T039 [US2] Create `server/game/moreOrLess.ts`: the payload shape with one visible count and ten
      withheld, the stored solution, attempt validation, and the outcome where the attempt response
      is the only path that reveals a hidden count, using only entities that exist in the catalog and
      inventing nothing (FR-006, FR-009, FR-019, FR-021, R-010)
- [X] T040 [US2] Create `server/api/daily/[game].get.ts`: serve today's stored payload for the
      requested game, stripping `signature` and never including `solution`
- [X] T041 [US2] Create `server/api/daily/[game]/attempt.post.ts` with the game dispatch and the
      more-or-less branch: validate against the stored puzzle, return the outcome envelope, reject
      an out-of-puzzle entity as `INVALID_ATTEMPT`
- [X] T042 [P] [US2] Create `app/components/MoreOrLessBoard.vue`: two actors with the right count
      visible and the left count hidden, the more/less controls, the reveal after an answer, the
      actor swap on a correct answer, the round counter, and immediate loss on a wrong answer
      (FR-017, FR-018, FR-019, FR-020, FR-021)
- [X] T043 [P] [US2] Create `app/components/ResultPanel.vue`: the won or lost summary with the
      attempt count, shown in the same session with no reload (FR-040, FR-041)
- [X] T044 [US2] Create `app/pages/game/more-or-less.vue`: help text, board, restore the stored
      result on load, refuse further rounds once finished, and reset cleanly when storage is empty
      (FR-014, FR-043, FR-043b)

**Checkpoint**: A complete playable game exists end to end. MVP is now demonstrable.

---

## Phase 5: User Story 3 - Play Match the Series (Priority: P2)

**Goal**: Two 4x4 grids from the current season, three wrong pairs ending the game, and no pairing
revealed before the game ends.

**Independent Test**: Match all sixteen pairs to win; separately make three wrong pairs and see game
over on the third with the pairings revealed.

### Tests for User Story 3

- [X] T045 [P] [US3] Write `tests/routes/puzzle.get.test.ts`, tests 3 and 14: today's match-the-series
      payload is served without the solution and without any image URL, and a calendar season with
      no catalog coverage returns `PUZZLE_UNAVAILABLE` with no row inserted and no older-season
      substitution (FR-003, FR-024, FR-030, EC-002, SC-008)

### Implementation for User Story 3

- [X] T046 [US3] Add to `server/catalog/queries.ts`: series of the current calendar season matched on
      `lower(trim(season))` and the year, plus their characters and voice actors, with no fallback to
      an earlier season (FR-030, R-009)
- [X] T047 [US3] Create `server/generators/matchTheSeries.ts`: sixteen left tiles and sixteen series
      in different orders, all from the current season, with the correct pairing kept in the solution
      and never in the payload (FR-024, FR-029, R-010)
- [X] T048 [US3] Create `server/game/matchTheSeries.ts`: payload and solution shapes, attempt
      validation, a hit that locks the pair, a non-ending miss that discloses nothing and leaves both
      tiles unselected, matching all sixteen pairs as the win, and an ending miss that reveals the
      pairing and the full solution (FR-026, FR-027, FR-027a, FR-028)
- [X] T049 [US3] Extend `server/api/daily/[game]/attempt.post.ts` with the match-the-series branch
      for those three outcome shapes
- [X] T050 [P] [US3] Create `app/components/MatchGrid.vue`: two 4x4 grids, each left tile showing its
      name plus an identical neutral in-project placeholder area, left-then-right selection, locks on
      a hit, and game over on the third wrong pair (FR-025, FR-026, FR-027, FR-029)
- [X] T051 [US3] Create `app/pages/game/match-the-series.vue`: help text, grid, mistake count, result
      panel on either end state, resume of the board position from the device

**Checkpoint**: Two games playable; both independently testable.

---

## Phase 6: User Story 4 - Play Groups (Priority: P2)

**Goal**: Sixteen tiles in four hidden groups of four, five mistakes ending the game, and an overlap
hint on every wrong proposal.

**Independent Test**: Submit one correct group and see its criterion revealed; then make five wrong
proposals and see game over on the fifth with the groups revealed.

### Tests for User Story 4

- [X] T052 [P] [US4] Write `tests/routes/puzzle.get.test.ts`, test 4: today's groups payload is served
      with sixteen distinct tiles and no criterion field
- [X] T053 [P] [US4] Write `tests/routes/attempt.post.test.ts`, test 9: a valid groups attempt returns
      a hit with the criterion or a miss with only the `overlap` count, naming neither a group nor
      its fact (FR-034, FR-035a, SC-016)

### Implementation for User Story 4

- [X] T054 [US4] Add to `server/catalog/queries.ts`: candidate characters and people with the allowed
      facts needed to test a criterion, with no duplicate labels and no image columns
- [X] T055 [US4] Create `server/generators/groups.ts`: sixteen tiles forming four groups under four
      different criteria, then enumerate all 1820 four-tile subsets and reject any board that lacks
      exactly four singly-valid groups; a same-season criterion uses season plus year
      (FR-031, FR-032, FR-037, FR-038, R-011)
- [X] T056 [US4] Create `server/game/groups.ts`: payload with tile keys only, solution with the groups
      and criteria, validation rejecting a wrong tile count, an unknown key, or a consumed key, and
      the `overlap` figure computed as the largest number of submitted tiles sharing one hidden group,
      zero when no two share one (FR-033, FR-039, FR-035a)
- [X] T057 [US4] Extend `server/api/daily/[game]/attempt.post.ts` with the groups branch returning hit
      with criterion, or miss with `overlap` and no solution
- [X] T058 [P] [US4] Create `app/components/GroupsBoard.vue`: the 4x4 board, selection of up to four
      tiles, submission, tile removal and criterion reveal on a hit, the overlap message on a miss,
      and game over on the fifth mistake (FR-033, FR-034, FR-035, FR-035a, FR-036)
- [X] T059 [US4] Create `app/pages/game/groups.vue`: help text, board, mistake count, result panel on
      either end state, resume of found groups from the device

**Checkpoint**: All three games playable and independently testable.

---

## Phase 7: User Story 5 - Share a spoiler-free result (Priority: P3)

**Goal**: A shareable text summary of the game, the outcome, and the attempt count, with no solution
detail, always readable on the page.

**Independent Test**: End each game, copy the share text, and confirm it names the game and outcome
without any answer, count, pairing, or criterion.

### Tests for User Story 5

None. The 15-test budget is a hard cap (SC-012) and every row is already claimed, so this story is
verified by manual checks 11 in quickstart.md. Do not add a test here.

### Implementation for User Story 5

- [X] T060 [US5] Create `app/components/ShareButton.vue`: build the share text from the message
      catalog naming only the game, outcome, and attempt count, call the platform share sheet when
      available, and always leave the text visible for manual copy (FR-044, FR-045, FR-046)
- [X] T061 [US5] Wire `ShareButton.vue` into `ResultPanel.vue` and render the result panel from all
      three game pages so the action is offered on every end state (FR-044, SC-006)

**Checkpoint**: Sharing available on every finished game.

---

## Phase 8: User Story 6 - Recover from a failure to load (Priority: P3)

**Goal**: A bilingual error state with a retry action whenever the catalog is unreachable or a
puzzle cannot be produced, never a blank page.

**Independent Test**: Load with the catalog unavailable, then available again; the error state
appears, then the normal home page after retry.

### Tests for User Story 6

- [X] T062 [US6] Write `tests/routes/daily.get.test.ts`, test 13: with the catalog unreachable the
      listing returns a structured `DATABASE_UNAVAILABLE` code per game and never a blank success
      (FR-050, FR-051, SC-008)

### Implementation for User Story 6

- [X] T063 [P] [US6] Create `app/components/ErrorPanel.vue`: map the error code to a message from the
      bilingual catalog, name the failure without internal detail, and offer a retry action
      (FR-050, FR-051)
- [X] T064 [US6] Render `ErrorPanel.vue` from `app/pages/index.vue` and the three game pages wherever
      a puzzle is missing or the fetch failed, replacing every loading and empty state so no page is
      ever blank or permanently loading (FR-050, SC-009)

**Checkpoint**: All six stories complete; failure paths visible and recoverable.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T065 [P] Write `tests/generation.test.ts`, test 15: generation executes only catalog `SELECT`s
      plus a single insert into `daily_puzzles`, asserted by inspecting the recorded SQL, and that no
      server-side record of a visitor is created (Principle I, FR-011, R-016)
- [X] T066 Run the suite and confirm it contains exactly 15 tests and all pass (SC-012)
- [X] T067 Run the 15 manual validation checks in quickstart.md and record each success criterion
      they prove, including that every game reaches an explicit end state with no blank screen (SC-005)
- [X] T068 Measure SC-019 on a throttled mid-range phone profile: home and a game page usable in
      under 2 seconds in at least 95% of measurements, with no client-side loading step
- [X] T069 Final review: no secrets committed, the prohibited token absent from every name, route,
      and message key, every screen limited to the eight allowed facts, no external image or asset
      request, no browser end-to-end suite added, and no essay comments in source
      (FR-053, FR-054, FR-055, SC-010, SC-014, Principle VI)

---

## Test Budget (hard cap: 15)

| # | Test file | Proves | Task |
|---|-----------|--------|------|
| 1 | tests/routes/daily.get.test.ts | FR-012, FR-013, SC-001 | T026 |
| 2 | tests/routes/puzzle.get.test.ts | FR-003, FR-009 | T035 |
| 3 | tests/routes/puzzle.get.test.ts | FR-003, FR-024 | T045 |
| 4 | tests/routes/puzzle.get.test.ts | FR-003, FR-031 | T052 |
| 5 | tests/generation.test.ts | FR-003, FR-004, FR-005, SC-002 | T025 |
| 6 | tests/day.test.ts | FR-002, FR-047 | T024 |
| 7 | tests/routes/attempt.post.test.ts | FR-018, FR-021 | T036 |
| 8 | tests/routes/attempt.post.test.ts | FR-025, FR-026, FR-027a, SC-018 | T049 |
| 9 | tests/routes/attempt.post.test.ts | FR-033, FR-034, FR-035a, SC-016 | T053 |
| 10 | tests/routes/attempt.post.test.ts | FR-039, FR-041, SC-007 | T036 |
| 11 | tests/local-progress.test.ts | FR-013, FR-042, FR-043a, SC-003, SC-004, SC-015 | T027 |
| 12 | tests/local-progress.test.ts | FR-043b, FR-049a, FR-049b, FR-052, SC-017 | T027 |
| 13 | tests/routes/daily.get.test.ts | FR-050, FR-051, SC-008 | T062 |
| 14 | tests/routes/puzzle.get.test.ts | FR-030, EC-002 | T045 |
| 15 | tests/generation.test.ts | Principle I, R-016 | T065 |

Rows 2, 3, and 4 all exercise `GET /api/daily/:game` for the three games, one per game, inside
`tests/routes/puzzle.get.test.ts`. Rows 7, 8, and 9 exercise the attempt route per game in
`tests/routes/attempt.post.test.ts`. Each row is one `it` block; the budget is the count of `it`
blocks, and it may not exceed 15.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies, start immediately.
- **Foundational (Phase 2)**: depends on Setup. Blocks all user stories.
- **User Stories (Phases 3-8)**: all depend on Foundational. Execute in priority order P1, P1, P2,
  P2, P3, P3; they cannot run in parallel because US3, US4, and US6 each extend
  `server/api/daily/[game]/attempt.post.ts` or `server/catalog/queries.ts`.
- **Polish (Phase 9)**: depends on all desired stories.

### User Story Dependencies

- **US1 (P1)**: starts after Foundational. No dependency on other stories.
- **US2 (P1)**: starts after Foundational. Owns the attempt route and the shared `ResultPanel.vue`,
  which US3 and US4 reuse.
- **US3 (P2)**: starts after Foundational; reuses `ResultPanel.vue` from US2 and the attempt route
  created in US2, but is independently testable with its own board and page.
- **US4 (P2)**: starts after Foundational; same reuse pattern as US3.
- **US5 (P3)**: starts after any one game produces an end state; touches `ResultPanel.vue`.
- **US6 (P3)**: starts after Foundational; needs at least one page to render the panel in.

### Within Each User Story

- Tests are written first and must fail before the implementation that satisfies them.
- Catalog queries before generators, generators before game modules, game modules before routes.
- Components after the composables they consume, pages after their components.

### Parallel Opportunities

- T003, T006, T007 in Setup.
- T009, T010, T017, T018, T019, T021, T024, T025 in Foundational, once T002 is done.
- T026, T027 in US1; T029, T030, T031, T032 in US1 once the composables exist.
- T035, T036 in US2; T045 in US3; T050, T058, T063 per-component work inside each story.

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1 Setup.
2. Complete Phase 2 Foundational.
3. Complete Phase 3 (US1) and Phase 4 (US2).
4. **STOP and VALIDATE**: play a full More or Less game and check the home page markers, both in
   Spanish and in English. Then run `npm test` and confirm 6 of the 15 tests exist and pass.
5. Demo if ready.

### Incremental Delivery

1. Setup + Foundational, then 6 tests green.
2. US1 + US2: first playable game and the whole navigation surface.
3. US3: the second game, which also proves the current-season coverage rule.
4. US4: the third game and the signature board.
5. US5, then US6.
6. Polish: the read-only boundary test, the manual checks, and the performance measurement.

---

## Notes

- [P] tasks touch different files and have no ordering dependency between them.
- [Story] labels give traceability from each task to its user story.
- Every user story can be stopped at its checkpoint and validated on its own.
- Commit after each task or each logical group; never commit `.env`.
- If a task would require a sixteenth test, a new dependency, a second table, a write to the
  catalog, or a browser end-to-end suite, it is out of scope: raise it instead.