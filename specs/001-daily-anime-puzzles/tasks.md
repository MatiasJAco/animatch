---

description: "Task list for Daily Anime Puzzles (v1)"
---

# Tasks: Daily Anime Puzzles (v1)

**Input**: Design documents from `specs/001-daily-anime-puzzles/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md

**Tests**: Test tasks ARE included. The constitution caps this feature at **exactly 15 automated
tests** (SC-012, Principle VI), and `plan.md` already names all 15 with the requirement each one
covers. Every test task below maps to one of those 15. Adding a test therefore means consolidating an
existing one, never appending.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated on
its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1 to US7)
- Every task names the exact file it touches.

## Path Conventions

Single Nuxt 3 project. `server/` holds every database access, `app/` holds all rendering, `tests/`
holds the suite. Paths are repository-root relative.

## Conventions that apply to every task

- **No new dependency.** `nuxt`, `pg`, and `vitest` are the only three, already approved (Principle
  VI). Nothing in this list may add a fourth.
- **No writes or DDL against catalog tables** `people`, `anime`, `characters`, `voice_roles`,
  `anime_seasons`; `import_state` and `import_runs` are never read or written (Principle I).
- **Bilingual copy.** Every visitor-facing string is added to **both** `app/i18n/en.ts` and
  `app/i18n/es.ts` in the same task that introduces it, and referenced through the catalog, never
  inlined in a component (FR-048, FR-049).
- **No CSS class-string or markup-snapshot assertions** in tests (Principle VI). Assert behavior.
- **Comments stay short.** No essay-length rationale in source; that belongs in research.md (Principle
  VI).
- **Never commit credentials.** `DATABASE_URL` comes from the environment only.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project skeleton and dependency confirmation.

- [X] T001 Confirm the three approved dependencies are exactly `nuxt` ^3, `pg`, and `vitest` in package.json, and that no fourth package was added; verify `.gitignore` covers `.env`
- [X] T002 [P] Create the directory skeleton from plan.md: `migrations/`, `scripts/`, `server/api/daily/`, `server/game/`, `server/generators/`, `server/catalog/`, `server/db/`, `server/utils/`, `app/components/`, `app/composables/`, `app/pages/game/`, `app/i18n/`, `tests/routes/`, `tests/helpers/`
- [X] T003 [P] Add `npm run dev`, `npm run build`, `npm test`, and `npm run db:migrate` scripts to package.json, and a `.env.example` whose `DATABASE_URL` is an empty placeholder
- [X] T004 [P] Write the `daily_puzzles` table in `migrations/001_daily_puzzles.sql` as a single idempotent `CREATE TABLE IF NOT EXISTS` keyed by (game, puzzle_date), with no catalog table touched (R-018)
- [X] T005 Implement `scripts/migrate.ts` to run `migrations/*.sql` in filename order, each inside a transaction, using the same `pg` pool as the app; no bookkeeping table (R-018)

**Checkpoint**: `npm run db:migrate` is idempotent and the dev server boots.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The day rule, the database boundary, the storage contract, and the error envelope that every story depends on. T006, T010, and T016 serve the error and language stories (US5, US6, US7); T011 and T017 serve the home page and every game story; the rest serve all seven.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [X] T006 [P] Implement `server/utils/errors.ts` with codes `UNKNOWN_GAME`, `INVALID_ATTEMPT`, `PUZZLE_UNAVAILABLE`, `DATABASE_UNAVAILABLE`, `PAYLOAD_UNAVAILABLE` and the `{ "error": { "code", "message" } }` envelope (R-017, FR-050, FR-051)
- [X] T007 Implement `server/db/pool.ts` creating a `pg` Pool from the environment `DATABASE_URL`, closed on Nitro shutdown, never exposed to the browser (Principle II)
- [X] T008 Implement `server/utils/day.ts` returning the UTC civil date as the day key, plus the calendar season as (season, year) and the next rollover instant; no other timezone referenced anywhere (R-014, FR-002)
- [X] T009 [P] Implement `server/utils/seed.ts` deriving a PRNG from `sha256(game:date)` and `server/utils/shuffle.ts` as a seeded Fisher-Yates, so generation is reproducible (R-004)
- [X] T010 [P] Implement `app/i18n/index.ts` resolving language as stored choice, else browser language mapped to its base locale, else `es`; create `app/i18n/en.ts` and `app/i18n/es.ts` (R-015, FR-049a)
- [X] T011 [P] Implement `server/catalog/queries.ts` as the only module issuing catalog `SELECT`s, with a per-query column allow-lists limited to the eight allowed facts and no `image_url`, favorites, or biography; implement `server/catalog/index.ts` as its single export surface (R-008, R-016, FR-009)
- [X] T012 Implement `server/db/puzzles.ts` reading the day's row, inserting once on first request inside a transaction, then re-reading the persisted row so concurrent first requests serve the same puzzle (R-005, FR-004)
- [X] T013 Implement `app/composables/useLocalProgress.ts` with the `animatch:v1:progress` entry: version guard, UTC date guard that discards a stale entry, per-game state, resume, and the two reset operations; puzzle content is never read from storage (data-model §8.1, FR-042, FR-043a)
- [X] T014 [P] Implement `app/composables/useLocalPrefs.ts` for the separate non-date-scoped `animatch:v1:prefs` entry holding the language choice, so a 00:00 UTC rollover does not reset it (data-model §8.2, FR-049b)
- [X] T015 [P] Implement `app/composables/useLocale.ts` exposing `t()` from the resolved catalog so every component localizes without duplicating resolution logic
- [X] T016 [P] Implement `app/components/ErrorPanel.vue` rendering the bilingual message for a given error code with a retry action that re-runs the load; no empty `catch` on any fetch path (FR-050, SC-008)
- [X] T017 [P] Implement `server/game/ids.ts` exporting the `GameId` union and its parser, and `app/composables/useDailyPuzzle.ts` fetching a game's puzzle and refetching on UTC date mismatch (FR-001)
- [X] T018 Write test 6 of 15, the UTC day rule, in `tests/day.test.ts`: identical day key under `TZ=Asia/Tokyo` and `TZ=America/New_York`, rollover at 00:00 UTC, and the calendar season's (season, year) identity (FR-002, FR-047)
- [X] T019 Write test 5 of 15 in `tests/generation.test.ts`: the same game and day return an identical puzzle and create exactly one row, and the first request for a fresh day inserts once even when the request is repeated (FR-003, FR-004, FR-005, SC-002)
- [X] T020 Write test 15 of 15, the read-only boundary, in `tests/generation.test.ts`: generation issues only catalog `SELECT`s plus exactly one insert into `daily_puzzles` and never names a catalog table in any write (Principle I, R-016)

**Checkpoint**: The foundation is ready. The UTC day rule, the error envelope, the storage contract, and the read-only boundary are all in place and covered by 2 of the 15 tests.

---

## Phase 3: User Story 1 - Pick today's games from the home page (Priority: P1) 🎯 MVP

**Goal**: The home page lists the three games of the current UTC day, marks each one the visitor has
already finished today from their own device, and opens a game with its help text.

**Independent Test**: Load the home page with no stored data, then again after storing a finished
result for one game. It must list three games and mark exactly one as finished; a stored result from
a previous UTC day must mark none.

### Tests for User Story 1

- [X] T021 [P] [US1] Write test 1 of 15 in `tests/routes/daily.get.test.ts`: `GET /api/daily` returns the UTC `date` plus all three games with a per-game `status` of `ready` or `error` (FR-012, FR-013, SC-001)

### Implementation for User Story 1

- [X] T022 [P] [US1] Implement `server/api/daily/index.get.ts` returning the day listing with per-game availability, so one unavailable game never blanks the page (R-017, FR-050)
- [X] T023 [P] [US1] Implement `server/api/daily/[game].get.ts` returning one game's stored payload for the day, 404 `UNKNOWN_GAME` for an unknown id, and never the solution (FR-001, FR-009)
- [X] T024 [P] [US1] Implement `app/components/GameCard.vue` showing the game name, its bilingual summary, its help entry point, and the finished-today marker read from `useLocalProgress` (FR-013, FR-015)
- [X] T025 [P] [US1] Implement `app/components/GameHelp.vue` rendering the per-game short help text from the message catalog (FR-014, FR-048)
- [X] T026 [US1] Implement `app/pages/index.vue` listing all three games in a phone-usable layout with no horizontal scrolling, adding the home reset control placeholder mount point consumed by User Story 7 (FR-012, FR-016)
- [X] T027 [US1] Add `home.*`, `game.*`, and `help.*` keys in both `app/i18n/en.ts` and `app/i18n/es.ts` (FR-048, FR-049)

**Checkpoint**: User Story 1 works on its own. Three games list, one finished marker appears, and a
previous day's result is ignored.

---

## Phase 4: User Story 2 - Play More or Less (Priority: P1)

**Goal**: Ten rounds comparing a hidden career role count against a visible one, with a correct answer
revealing the count, advancing the round, and a wrong answer ending the game immediately.

**Independent Test**: Play ten correct answers and confirm the win summary shows the final hidden
count revealed; then play one wrong answer and confirm immediate game over with the true count
revealed and no further rounds.

### Tests for User Story 2

- [X] T028 [P] [US2] Write test 2 of 15 in `tests/routes/puzzle.get.test.ts`: today's `more_or_less` payload serves its 11-item chain with one count visible and the other ten withheld, and contains no solution field (FR-003, FR-023, R-010)

### Implementation for User Story 2

- [X] T029 [P] [US2] Implement `server/game/moreOrLess.ts` with the payload type, attempt validation, and outcome resolution; the hidden count is read from the stored solution and never sent in the payload (R-010, FR-018, FR-021)
- [X] T030 [P] [US2] Implement `server/generators/moreOrLess.ts` building a chain of 11 people with adjacent counts unequal, so no round has two correct answers or none, and enforcing the novelty fingerprint (FR-007, FR-022, R-006)
- [X] T031 [P] [US2] Implement `app/components/MoreOrLessBoard.vue` showing the left actor with the count hidden, the right with it visible, the two answer controls, and the round counter (FR-017, FR-018)
- [X] T032 [US2] Implement `app/pages/game/more-or-less.vue` wiring the fetch, the attempt call, the win and loss states, and the attempt count through `useLocalProgress` so a closed tab resumes the same round (FR-019, FR-040, FR-043a)
- [X] T033 [US2] Add `game.more_or_less.*` keys in both `app/i18n/en.ts` and `app/i18n/es.ts`, and the project CSS for the two-actor layout in `app/assets/css/main.css` using system fonts only (FR-048, FR-055)
- [X] T034 [US2] Write test 7 of 15 in `tests/routes/attempt.post.test.ts`: a valid `more_or_less` attempt returns `hit` with both counts revealed, or a `miss` that ends the game and reveals the true count, and a stored puzzle that would make a round untied is never served (FR-018, FR-021, FR-022)

**Checkpoint**: User Story 2 is a complete playable game on its own.

---

## Phase 5: User Story 3 - Play Match the Series (Priority: P2)

**Goal**: A single three-by-three grid of current-season series titles with one clue card above it,
one click per card, three wrong clicks ending the game, and a wrong click rotating the card to
another entity while keeping the abandoned entity in the pool.

**Independent Test**: Click the correct series for all nine entities and confirm the win summary;
separately click three wrong series and confirm game over on the third with every pairing revealed.
Confirm a wrong click below the limit changes the card and reveals nothing.

### Tests for User Story 3

- [X] T035 [US3] Write test 3 of 15 in `tests/routes/puzzle.get.test.ts`: today's `match_the_series` payload is a `grid` of 3 rows and 3 columns holding 9 distinct series titles plus 18 clue cards, `wrongLimit` 3, and **no** card carries its series key or an `image_url` (FR-024, FR-024a, FR-029, R-019)
- [X] T036 [US3] Write test 14 of 15 in `tests/routes/puzzle.get.test.ts`: a current season holding fewer than nine series yields `PUZZLE_UNAVAILABLE` and stores no row, and no older season is ever substituted (FR-030, EC-002)

### Implementation for User Story 3

- [X] T037 [P] [US3] Implement `server/game/matchTheSeries.ts` with `MATCH_BOARD_SIZE = 9`, the 3x3 grid and clue-deck payload types, attempt validation requiring a `clueKey` that exists in the day's puzzle, and outcome resolution disclosing `correctSeriesKey` and the full `answers` map **only** when the game ends (FR-025, FR-027, FR-027a, R-020)
- [X] T038 [P] [US3] Implement `server/generators/matchTheSeries.ts` selecting nine current-season series, requiring two unambiguous clue cards per series, rejecting any entity appearing in more than one grid series, shuffling grid and deck independently, and enforcing the novelty fingerprint (FR-007, FR-029a, FR-030, R-007, R-019)
- [X] T039 [P] [US3] Implement `app/components/MatchGrid.vue` with the `grid-3x3` of nine series tiles, the single clue card showing the entity name plus a neutral in-project CSS placeholder, the Next control, and the green-tile state; the component emits answers and holds no selection logic (FR-024, FR-029)
- [X] T040 [US3] Implement the mistake rotation in `app/pages/game/match-the-series.vue`: on a miss below the limit, advance to another entity using the same eligibility rule as Next, never adding to `answeredClues` so the abandoned entity stays in the pool, and fall back to the current card when the pool is empty (FR-027c, FR-027d, R-025)
- [X] T041 [US3] Implement the rest of `app/pages/game/match-the-series.vue`: the Next free skip that touches neither counter and issues no request, the win state at nine green, the loss state revealing every pairing, and persistence of `greenSeries`, `answeredClues`, `clueIndex`, and `wrongClicks` (FR-026b, FR-026c, FR-026d, FR-028, FR-043a)
- [X] T042 [US3] Add `game.match_the_series.*` keys in both `app/i18n/en.ts` and `app/i18n/es.ts`, and the grid, clue-card, and green-tile CSS in `app/assets/css/main.css` (FR-048, FR-055)
- [X] T043 [US3] Write test 8 of 15 in `tests/routes/attempt.post.test.ts`: a valid `match_the_series` attempt returns `hit` for the clicked series, or a `miss` that carries no `correctSeriesKey` and no `answers` below the limit and the full mapping when the game ends; the response never carries an attempt count (FR-025, FR-026, FR-027a, FR-027d, SC-018)

**Checkpoint**: All three games are independently playable. The rotation adds no request and the
miss response is unchanged by it.

---

## Phase 6: User Story 4 - Play Groups (Priority: P2)

**Goal**: Sixteen tiles forming exactly four hidden groups of four, each sharing one allowed fact,
with a wrong proposal reporting only the overlap count.

**Independent Test**: Find and submit one group correctly and confirm its criterion is revealed; then
make five wrong proposals and confirm game over on the fifth with the four groups revealed.

### Tests for User Story 4

- [X] T044 [US4] Write test 4 of 15 in `tests/routes/puzzle.get.test.ts`: today's `groups` payload serves 16 tiles with `key`, `kind`, and `name` only, no criterion field on any tile, and no solution (FR-031, FR-032, FR-037)

### Implementation for User Story 4

- [X] T045 [P] [US4] Implement `server/game/groups.ts` with the tile and criterion types, the criterion as a function of the pinned tile fields, proposal validation, the `overlap` computation as the largest count sharing one hidden group, and outcome resolution (FR-033, FR-035, FR-035a, R-011)
- [X] T046 [US4] Implement `server/generators/groups.ts` building one candidate group per criterion type from pinned pools, each read with primary-key ordering, and rejecting any attempt whose 1820 four-tile subsets do not yield exactly four singly-valid groups matching the intended four (FR-037, R-011)
- [X] T047 [P] [US4] Implement `app/components/GroupsBoard.vue` with the `grid-4x4`, tile selection, the proposal submit control, the removed-group state, and the revealed criterion (FR-031, FR-033, FR-034)
- [X] T048 [US4] Implement `app/pages/game/groups.vue` wiring the fetch, the proposal call, the five-mistake loss, the four-group win, and persistence of `found` and `mistakes` (FR-035, FR-036, FR-043a)
- [X] T049 [US4] Add `game.groups.*` keys in both `app/i18n/en.ts` and `app/i18n/es.ts`, and the board CSS in `app/assets/css/main.css` (FR-048, FR-055)
- [X] T050 [US4] Write test 9 of 15 in `tests/routes/attempt.post.test.ts`: a valid `groups` attempt returns `hit` with the shared `criterion`, or a `miss` carrying only the `overlap` count and naming neither the group nor its fact (FR-034, FR-035a, SC-016)

**Checkpoint**: User Stories 1 through 4 are each independently playable.

---

## Phase 7: User Story 5 - Share a spoiler-free result (Priority: P3)

**Goal**: After any game ends, the visitor can produce a text summary naming the game, the outcome,
and the attempt count, with no answer, count, pairing, or criterion in it.

**Independent Test**: End each of the three games in any outcome, copy the share text, and confirm it
identifies the game and outcome while containing no solution detail.

### Tests for User Story 5

- [X] T051 [P] [US5] Write test 10 of 15 in `tests/routes/attempt.post.test.ts`: an attempt naming a clue card or series outside the puzzle, or missing its `clueKey`, is rejected 400 `INVALID_ATTEMPT`, no counter changes, and the stored payload and solution stay byte-identical (FR-039, FR-041, SC-007, R-020)

### Implementation for User Story 5

- [X] T052 [P] [US5] Implement `app/components/ShareButton.vue` building the text from the game name, the outcome, and the attempt count only, using the platform share sheet when present and falling back to a manual copy; the text stays visible on the page either way (FR-044, FR-045, FR-046)
- [X] T053 [P] [US5] Implement `app/components/ResultPanel.vue` showing the won or lost summary, the attempt count, the revealed detail appropriate to the game, and mounting `ShareButton` (FR-040, FR-041)
- [X] T054 [US5] Add `share.*` and `result.*` keys in both `app/i18n/en.ts` and `app/i18n/es.ts`, with the template naming only the game, outcome, and attempt count (FR-044, FR-048)
- [X] T055 [US5] Mount `ResultPanel` in `app/pages/game/more-or-less.vue`, `app/pages/game/match-the-series.vue`, and `app/pages/game/groups.vue`, passing the attempt count from `app/composables/useLocalProgress.ts` (FR-040, FR-041, FR-043)

**Checkpoint**: Sharing works for all three games with no spoiler in the text.

---

## Phase 8: User Story 6 - Recover from a failure to load (Priority: P3)

**Goal**: A dead or slow catalog shows a bilingual message naming the failure with a retry action,
never a blank page, blank board, or endless spinner.

**Independent Test**: Run with the catalog unreachable, then available again; the error state must
appear, then the normal home page after retry.

### Tests for User Story 6

- [X] T056 [US6] Write test 13 of 15 in `tests/routes/daily.get.test.ts`: an unreachable catalog returns the structured `DATABASE_UNAVAILABLE` error per game rather than a blank result, and the stored puzzle is untouched (FR-050, FR-051, SC-008)

### Implementation for User Story 6

- [X] T057 [P] [US6] Log every database failure server-side with enough context to diagnose it and replace it with `DATABASE_UNAVAILABLE` before responding, leaking no connection string, SQL, stack trace, or hostname; wrap the calls in `server/db/pool.ts` and `server/db/puzzles.ts` (FR-051, R-017)
- [X] T058 [US6] Render `app/components/ErrorPanel.vue` from `app/pages/index.vue` and all three files in `app/pages/game/` for a failed puzzle load, with the retry action re-running the load (FR-050, SC-008)
- [X] T059 [US6] Surface the same bilingual error state in `app/pages/game/match-the-series.vue` when the current season has fewer than nine series, so the board is never served thinner than 3x3 (FR-030, EC-002)
- [X] T060 [US6] Add `error.*` keys in both `app/i18n/en.ts` and `app/i18n/es.ts`, one per error code, with a retry label (FR-048, FR-050)

**Checkpoint**: Every failure path is visible, bilingual, and retryable.

---

## Phase 9: User Story 7 - Return home or reset a game while debugging (Priority: P3)

**Goal**: Every game screen carries a home control, and in development a reset control; the home page
carries one control that clears all three games' saved state at once. Neither ever reaches the server.

**Independent Test**: Start a game, leave via the home control and return to confirm the same position
resumes; press a game reset and confirm that game restarts while the puzzle is unchanged; press the
home reset and confirm all three restart, the language choice survives, and no stored puzzle row
changed.

### Tests for User Story 7

- [X] T061 [P] [US7] Write test 11 of 15 in `tests/local-progress.test.ts`: finished-today state is per game and per UTC date, a mid-game return resumes the same round or green tiles, and a previous UTC day's result is discarded (FR-013, FR-042, FR-043a, SC-003, SC-004, SC-015)
- [X] T062 [US7] Write test 12 of 15 in `tests/local-progress.test.ts`: a missing, malformed, or cleared store leaves the game playable from the start; a per-game reset clears only that game's entry; the home reset clears all three games' entries in one write while `animatch:v1:prefs` keeps the language; neither performs a network call (FR-043b, FR-049a, FR-052, FR-057, FR-057b, FR-057c, FR-058, SC-017, SC-023, SC-025, R-024)

### Implementation for User Story 7

- [X] T063 [P] [US7] Add the per-game `resetGame(game)` and all-games `resetAllGames()` operations to `app/composables/useLocalProgress.ts`, each a single storage write, neither issuing a fetch or touching a `daily_puzzles` row (FR-057, FR-057b, FR-057c, R-024)
- [X] T064 [P] [US7] Implement `app/components/GameHeaderControls.vue` with the home control always present and the per-game reset rendered only under the Nuxt development build flag, with a two-step confirm; it holds no logic of its own and calls the composable operation (FR-056, FR-057a, R-022, R-023)
- [X] T065 [P] [US7] Implement `app/components/HomeResetControls.vue` with one control that calls `resetAllGames()`, rendered only under the development build flag, with the same two-step confirm (FR-057b, FR-057c, R-024)
- [X] T066 [US7] Mount `app/components/GameHeaderControls.vue` in the three files under `app/pages/game/` and `app/components/HomeResetControls.vue` in `app/pages/index.vue`, so the controls sit above the fold on a phone (FR-056, FR-057b, R-023)
- [X] T067 [US7] Add `nav.home`, `nav.reset`, `nav.reset_confirm`, `nav.reset_all`, and `nav.reset_all_confirm` keys in both `app/i18n/en.ts` and `app/i18n/es.ts` (FR-048, FR-057, FR-057b)
- [X] T068 [US7] Add the header control CSS in `app/assets/css/main.css` for both the in-game and home-page controls (FR-055)

**Checkpoint**: A visitor can leave any game without losing progress, and a developer can retest any
day from either screen without touching the database.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [X] T069 [P] Document setup, the migrate and run commands, and the absence of committed secrets in `README.md`
- [X] T070 Verify the whole suite is exactly 15 tests across 6 files by running `npm test`, and that no file under `tests/` asserts stylesheet text, a CSS class string, or a markup snapshot (SC-012, Principle VI)
- [X] T071 [P] Build and serve the production bundle with `npm run build` then `node .output/server/index.mjs`, and confirm the rendered HTML of the home page and all three routes under `app/pages/game/` contains no reset control (SC-024, FR-057a, FR-057c)
- [X] T072 Verify the files under `.output/public/` reference no image, font, or script host other than this origin, and that no `image_url` or external placeholder appears in `app/components/MatchGrid.vue` or any payload (SC-010, SC-014, FR-055)
- [X] T073 Walk `quickstart.md` checks 1 through 21 and record the outcome of each in its validation table, including checks 20 and 21 which cover the rotation and the home reset
- [X] T074 [P] Re-check the constitution gates in `.specify/memory/constitution.md` end to end against the code: no catalog write, no driver in `app/`, UTC day key, no login, bilingual error states with retry, test count at or under 15, both locales complete
- [X] T075 Confirm `.gitignore` covers `.env` and that no credential appears in `package.json`, `tests/`, `.env.example`, or `README.md` (Principle II, Delivery Model)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies, starts immediately.
- **Foundational (Phase 2)**: depends on Phase 1, and **blocks every user story**.
- **User Stories (Phases 3 to 9)**: all depend on Phase 2. Every story is then independent of the
  others; deliver in priority order P1 → P2 → P3 for the least rework.
- **Polish (Phase 10)**: depends on the stories being delivered.

### User Story Dependencies

- **US1 (P1)**: no story dependency. Delivers the MVP.
- **US2 (P1)**: no story dependency; independent of US1 once Phase 2 is done.
- **US3 (P2)**: no story dependency; independent of US1 and US2.
- **US4 (P2)**: no story dependency; independent of the others.
- **US5 (P3)**: mounts onto all three game pages, so it is the one story that genuinely needs US2,
  US3, and US4 to exist. It adds no new backend behavior.
- **US6 (P3)**: no story dependency; the error panel is wired into each page as that page appears.
- **US7 (P3)**: no story dependency; the controls mount on the home page and the three game routes.

### Within Each User Story

- The test task is written first and must fail before the implementation task that satisfies it.
- Generator before the game module that consumes it; payload and solution before the endpoint.
- Component before the page that mounts it.
- Message keys land in the same task as the UI that needs them, in both languages at once.

### Parallel Opportunities

- All `[P]` tasks in Phase 1 and Phase 2 touch different files and can run together.
- Once Phase 2 completes, US1 through US4 and US7 can all proceed in parallel; they share no file.
- Within a story, the `[P]` component, generator, and module tasks can run together, while the page
  task waits for the component and the endpoint test waits for the module.
- The Polish tasks marked `[P]` are independent of each other.

---

## Parallel Example: User Story 3

`tests/routes/puzzle.get.test.ts` is already claimed by T028 in User Story 2, so neither of US3's
two payload tests carries `[P]`; they are sequential. Everything else in this story is a distinct
file and can run together.

```bash
# Launch together, no file overlap:
Task: "Write test 3 of 15 in tests/routes/puzzle.get.test.ts"          # T035, sequential
Task: "Implement server/game/matchTheSeries.ts"                         # T037, [P]
Task: "Implement server/generators/matchTheSeries.ts"                   # T038, [P]
Task: "Implement app/components/MatchGrid.vue"                          # T039, [P]
```

```bash
# Then, once the module, generator, and component land:
Task: "Write test 14 of 15 in tests/routes/puzzle.get.test.ts"         # T036, sequential
```

```bash
# And after the module and component exist:
Task: "Implement the mistake rotation in app/pages/game/match-the-series.vue"   # T040
Task: "Write test 8 of 15 in tests/routes/attempt.post.test.ts"                  # T043
```

Same-file tasks are always sequential, which is why exactly one task per file carries `[P]` in this
story. Verified across the whole list: no file is claimed by two `[P]` tasks.

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 Setup.
2. Complete Phase 2 Foundational, which blocks everything.
3. Complete Phase 3, User Story 1.
4. **Stop and validate**: the home page lists three games, and exactly one finished-today marker
   appears after a result is stored.
5. Deploy or demo.

### Incremental Delivery

1. Setup + Foundational, then validate the day rule and the read-only boundary.
2. US1, then US2, validating each independently. US2 is the first complete playable game.
3. US3, then US4, each independently playable.
4. US5, US6, US7 as cross-cutting polish, each validated on its own.
5. Polish: the 15-test cap, the production build checks, and the quickstart walk.

### Parallel Team Strategy

1. Team completes Setup and Foundational together.
2. Then, in parallel: one developer on US1, one on US2, one on US3, one on US4.
3. US5 through US7 follow once the game pages exist, since they mount onto them.

---

## Notes

- `[P]` means a different file from every other in-flight task and no dependency on an incomplete
  task. Two tasks in the same file are never both `[P]`.
- `[Story]` labels appear only in the user story phases, and map to the spec's stories US1 to US7.
- The test cap is a hard limit. If a new test seems necessary, consolidate an existing one first.
- The reset controls are development-only by construction: rendering them under the Nuxt development
  build flag keeps them out of the production bundle, which is what satisfies SC-024.
- No reset control may ever gain a server route. FR-058 and FR-057c forbid it, and quickstart's
  "Notes and known limits" records that deleting a stale `daily_puzzles` row stays a deliberate
  manual developer action.
- Deleting the four existing `match_the_series` rows in the local database is a deliberate manual
  step before the first run of T038, because the stored rows are in the old two-grid shape and no
  control covers server data.
- Commit after each task or logical group.

---

## Phase 11: Convergence

**Purpose**: Gaps between spec/plan/tasks and the code, found by a read-only convergence pass after
T001–T075 were marked complete. Every task below is traceable to its source. The four CRITICAL
tasks come first: F1 is a total functional break in the per-game reset, F2 is a missing page the
constitution requires, F3 lets a client forge a result, and F4 names the wrong failure. The lean
suite rule still binds: these tasks may not add a test file or exceed 15 tests, so any needed test
consolidates an existing one. No task may add a fourth dependency, write to a catalog table, or
assert CSS class strings.

### CRITICAL

- [X] T076 [US7] Bind a real game id at each `GameHeaderControls` call site: replace the undefined
  identifiers `:game="more_or_less"`, `:game="match_the_series"`, and `:game="groups"` in
  `app/pages/game/more-or-less.vue`, `app/pages/game/match-the-series.vue`, and
  `app/pages/game/groups.vue` with the game's `GameId` literal, and assert in the existing
  `tests/local-progress.test.ts` that a reset through the control removes that game's saved state
  per FR-057, US7 AC3/AC4, SC-023 (contradicts) — CRITICAL
- [X] T077 [US6] Add `app/error.vue` rendering a bilingual not-found and unexpected-error state
  from `app/i18n/en.ts` and `app/i18n/es.ts` in the resolved locale, with no framework branding and
  no catalog access, per Constitution "Bilingual UI", FR-048, FR-049, SC-011 (missing) — CRITICAL
- [X] T078 [US4] Derive the authoritative `won`/`lost` state server-side instead of trusting the
  request body: validate submitted Groups proposals against the stored solution in
  `server/game/groups.ts` and stop using the body's `consumed`, `mistakes`, `green`, and `misses`
  as the sole adjudication input in `server/api/daily/[game]/attempt.post.ts`, keeping the client
  counters advisory per Constitution IV, FR-035, FR-039, R-013 (contradicts) — CRITICAL
- [X] T079 [US2] Parse the `{ error: { code } }` envelope in `app/components/MoreOrLessBoard.vue`
  and `app/pages/game/match-the-series.vue` instead of mapping every non-2xx to
  `DATABASE_UNAVAILABLE`, pass the real code to `app/components/ErrorPanel.vue`, and suppress the
  futile retry for a non-retryable code per Constitution V, FR-039, SC-007 (contradicts) — CRITICAL

### HIGH

- [ ] T080 [US2] Restore a resumed More or Less round in `app/components/MoreOrLessBoard.vue`: load
  device progress before the board first renders and watch the incoming props instead of copying
  `initialRound`/`initialAttempts` into refs once, so returning mid-game resumes the same round per
  FR-043a, SC-015, US2 AC6 (partial)
- [ ] T081 [US2] Ship the right-hand role count for every playable round in the More or Less payload
  from `server/generators/moreOrLess.ts` and `app/components/MoreOrLessBoard.vue`, so a restored
  round shows that round's own count per FR-017, FR-022 (partial)
- [ ] T082 [US2] Keep the resolved More or Less board mounted while the result summary renders, so
  the round's true count and the `more_or_less.correct`/`more_or_less.wrong` feedback are actually
  painted on the last round, per FR-021, US2 AC4 (partial)
- [ ] T083 [US4] Make the Groups end-of-game disclosure reachable: render the revealed board with all
  sixteen tiles and their criterion labels alongside the result on a loss, and show the winning
  group's criterion on a win, instead of unmounting `app/components/GroupsBoard.vue` in the same
  flush, per FR-034, FR-035, US4 AC2/AC3/AC4 (partial)
- [ ] T084 [US3] Persist the Match the Series loss pairing reveal for the UTC day in
  `app/composables/useLocalProgress.ts` and restore it in `app/pages/game/match-the-series.vue`, so
  reloading a finished-lost game still shows the full clue-to-series mapping per FR-027, FR-042
  (partial)
- [ ] T085 [US7] Mount `app/components/LanguageControl.vue` so it is present on all three game
  screens and in the error and share states, not only on the home page, via a layout or `app/app.vue`,
  per FR-049b, SC-017 (missing)
- [ ] T086 [US7] Make a reset update the on-screen state immediately: share one reactive progress
  instance across `app/components/GameHeaderControls.vue`, `app/components/HomeResetControls.vue`,
  `app/components/GameCard.vue`, and the game pages instead of the per-call `ref` created in
  `app/composables/useLocalProgress.ts`, per FR-057, FR-057b, US7 AC3, SC-025 (partial)
- [ ] T087 [US3] Render wrong-click feedback in `app/components/MatchGrid.vue`: the declared
  `lastFeedback` ref is only ever set to `null`, so a mistake below the limit changes nothing on
  screen; pass the outcome down and show `match.wrong` only per FR-027a, US3 AC5 (missing)
- [ ] T088 [P] Make `scripts/migrate.ts` load `.env` (via `node --env-file=.env` in the `db:migrate`
  script or an explicit read) so the documented first run in `README.md` — `cp .env.example .env`
  then `npm run db:migrate` — succeeds, per T005, plan "Runs with `npm install && npm run dev`"
  (contradicts)

### MEDIUM

- [ ] T089 [US4] State the overlap count for every wrong Groups proposal including the fifth and
  ending one, by reordering `app/components/GroupsBoard.vue` so the count is not behind the reveal
  branch, and record the resolution of the FR-035a-versus-FR-035 tension in `research.md` per
  FR-035a, SC-016 (partial)
- [ ] T090 [US4] Name the real failure in the Groups error state: key `ErrorPanel` off
  `error.data.error.code` in `app/pages/game/groups.vue` instead of hardcoding `PUZZLE_UNAVAILABLE`,
  and give `DATABASE_UNAVAILABLE` and `PUZZLE_UNAVAILABLE` distinct copy in both catalogs per
  Constitution V, FR-050 (contradicts)
- [ ] T091 [US1] Lower `REQUIRED_SERIES` in `server/game/listing.ts` from 16 to 9 so the availability
  probe matches the 3x3 board the generator actually requires, and correct the stale "16 series"
  comments in `server/game/listing.ts` and `server/catalog/queries.ts` per FR-030 (contradicts)
- [ ] T092 [US4] Emit at least one person or voice-actor group from `server/generators/groups.ts` so
  the `person` kind declared in `server/game/groups.ts` actually occurs, or amend R-011 in
  `research.md` to accept a character-only board per R-011, FR-033 (partial)
- [ ] T093 [US1] Handle the UTC day rollover in all three game pages: wire
  `app/composables/useDailyPuzzle.ts` (or an equivalent day watcher) into
  `app/pages/index.vue`, `app/pages/game/more-or-less.vue`, `app/pages/game/match-the-series.vue`,
  and `app/pages/game/groups.vue` so an open tab refetches and re-scores on the new day, and re-check
  the day before each attempt per spec edge case "Rollover during play", FR-015 (partial)
- [ ] T094 [P] Repair the broken type import in `app/composables/useLocalPrefs.ts`, which resolves
  `./index` to a non-existent `app/composables/index.ts`, and add a `typecheck` script to
  `package.json` per plan "Project Structure", T001 (partial)
- [ ] T095 [US1] Mount `app/components/HomeResetControls.vue` outside the `listing` branch in
  `app/pages/index.vue` so the reset control still clears device state when the home page failed to
  load, per spec edge case "Home reset on a page that failed to load" (missing)
- [ ] T096 [US4] Reconcile the Groups and Match the Series attempt contract: amend
  `specs/001-daily-anime-puzzles/contracts/openapi.yaml` and `data-model.md` to declare the request
  fields the endpoint actually accepts after T078, add the end-of-game `groups` disclosure to
  `GroupsOutcome`, and either return or drop `remainingWrong` and `remainingGroups`, per R-020,
  data-model §5, openapi (partial)
- [ ] T097 [US1] Trim `fetchAnimesByIds` in `server/catalog/queries.ts` so it stops selecting the
  `episodes` and `source` columns the data model declares are never read, per data-model:22-27, R-008
  (contradicts)
- [ ] T098 [US6] Map any unrecognized throw in `server/api/daily/[game]/attempt.get.ts`'s sibling
  `server/api/daily/[game].get.ts:26` to `errorResponse(event, 'DATABASE_UNAVAILABLE')` instead of a
  bare `createError`, so every failure returns the contract's `ErrorEnvelope` per FR-051,
  openapi `ErrorEnvelope` (partial)

### LOW

- [ ] T099 [US4] Strengthen the Groups availability probe in `server/game/listing.ts` to sample each
  of the four criterion pools, or to report `unavailable` only when generation is genuinely
  impossible, so a `ready` card is not followed by `PUZZLE_UNAVAILABLE` per FR-050, spec edge case
  "empty or exhausted coverage" (partial)
- [ ] T100 [P] Replace the literal NUL byte inside the template literal at
  `server/catalog/queries.ts:450` with the `\0` escape; the raw byte makes the catalog layer
  unreadable to grep and search tooling (partial)
- [ ] T101 [US3] Stop showing `match.next.unavailable` on a finished Match the Series screen by
  gating that branch on `nextCandidates.length === 0 && !finished` in `app/components/MatchGrid.vue`
  per FR-026d (partial)
- [ ] T102 [US3] Key the Match the Series loss-reveal list on `entry.key` instead of `entry.name` in
  `app/components/MatchGrid.vue`, since display-name uniqueness is not enforced and two catalog
  entities may share a name (partial)
- [ ] T103 [US3] Collapse the duplicated clue-eligibility logic: have `app/components/MatchGrid.vue`
  receive the eligible-set result from `app/pages/game/match-the-series.vue` instead of recomputing
  it, so one predicate governs Next and mistake rotation per R-025 (partial)
- [ ] T104 [US3] Remove the developer-facing `match.placeholder` note that
  `app/components/MatchGrid.vue` renders under every clue card, or move it to a help surface, since
  FR-029 asks for a placeholder and not a provenance disclaimer (unrequested)
- [ ] T105 [US2] Enforce FR-007's "MUST NOT repeat the setup of any earlier day" in
  `server/generators/moreOrLess.ts` instead of bounding novelty to `NOVELTY_WINDOW_DAYS = 30` per
  FR-007 (partial)
- [ ] T106 [US1] Normalize `puzzle_date` to a `YYYY-MM-DD` civil string in
  `server/api/daily/[game].get.ts` instead of relying on the payload spread to overwrite a
  local-midnight `pg` Date per Constitution III (partial)
- [ ] T107 [US7] Let `app/components/HomeResetControls.vue` cancel its confirmation step like
  `app/components/GameHeaderControls.vue` does, so both reset controls behave identically per
  plan.md:347-349 (partial)
- [ ] T108 [P] Give `.game-header-controls__link` and `.home-reset-controls__link` the same 44px
  minimum height as `.button` in `app/assets/css/main.css`, since both render about 30px tall per
  plan tap-target decision (partial)
- [ ] T109 [P] Either mount `app/components/GameHelp.vue` as the per-card help entry point from
  `app/components/GameCard.vue` or delete it, so the component tree matches the plan per US1 AC1,
  T025 (unrequested)
- [ ] T110 [P] Sweep the unused exports so the tree matches the plan: `seasonLabel` and `withClient`
  in `server/utils/day.ts` and `server/db/pool.ts`, `hasSignature` in `server/db/puzzles.ts`,
  `setPool`, the four unreferenced catalog queries, `useAttemptCount`, and the unread
  `runtimeConfig.databaseUrl`; delete them or wire them to their caller per plan
  "Project Structure", Principle VI (unrequested)
- [ ] T111 [P] Resolve the undeclared bare-specifier imports of `vue` and `h3`, which are absent from
  `package.json`, by declaring them or importing them through the framework's auto-import surface,
  so the project has no fourth dependency per plan "Primary Dependencies", Principle VI
  (unrequested)
- [ ] T112 [P] Add `http:*/` to `.gitignore`; the repo root holds a local `http:/192.168.25.132:3000/.nuxt/`
  scratch tree containing an internal host address per Constitution VI, "no local scratch committed"
  (unrequested)
- [ ] T113 [P] Record the authoritative four-code error inventory (`PAYLOAD_UNAVAILABLE` is not one of
  them) in `research.md`, and flag T006's `PAYLOAD_UNAVAILABLE` reference for correction in the next
  `/speckit.tasks` pass — convergence may not rewrite an existing task per T006, openapi,
  `server/utils/errors.ts` (partial)
