---
description: "Task list for Match the Series Seasonal Editions (Autumn, Spring, Summer 2026)"
---

# Tasks: Match the Series Seasonal Editions (Autumn, Spring, Summer 2026)

**Input**: Design documents from `/specs/010-match-series-season-variants/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The project constitution (Principle VI, Development Workflow) makes passing
tests part of the definition of done, and plan.md/research.md specify the test set. Keep the
feature's suite ≤15 tests; update existing suites rather than multiplying files; never assert
stylesheet text, CSS class strings, or markup snapshots.

**Organization**: Tasks are grouped by user story (US1 → US5 in priority order from spec.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: `[US1]` three editions offered in a grid, `[US2]` Autumn 2026, `[US3]` Spring 2026,
  `[US4]` Summer 2026, `[US5]` independent availability
- Every task names an exact file path.

## Path Conventions

Single Nuxt project: `app/` (Vue client), `server/` (Nitro routes/game layer), `tests/`, `e2e/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The shared game identities, fixed season mapping, and bilingual copy every story needs.

- [X] T001 [P] Edit `server/game/ids.ts`: add `match_the_series_autumn_2026`, `match_the_series_spring_2026`, `match_the_series_summer_2026` to the `GameId` union and `GAME_IDS`, remove `match_the_series`, and set order to `more_or_less`, `match_the_series_autumn_2026`, `match_the_series_spring_2026`, `match_the_series_summer_2026`, `groups` (contracts/game-identities.md §1, §4).
- [X] T002 [P] Create `server/game/matchSeasons.ts`: export the fixed mapping `match_the_series_autumn_2026 → { season: 'fall', year: 2026 }`, `match_the_series_spring_2026 → { season: 'spring', year: 2026 }`, `match_the_series_summer_2026 → { season: 'summer', year: 2026 }`; export `isMatchEditionId(id)` and `matchSeasonFor(id)` that return the constant (never derived from the UTC date, client, locale, or catalog). No table storage (contracts/game-identities.md §2, data-model.md).
- [X] T003 [P] Update `app/i18n/en.ts` and `app/i18n/es.ts` keeping key parity: add `game.match_the_series_autumn_2026` (e.g. "Match the Series — Autumn 2026" / "Empareja la serie — Otoño 2026"), `.spring_2026`, `.summer_2026`, each with a season-specific `.summary`, plus shared per-edition `.help`; change `match.board` to neutral series wording (e.g. "Series" / "Series de {season}" is not required — use season-neutral "Series") so past-season editions stay accurate (spec FR-013, FR-014; research.md R7).

**Checkpoint**: `isGameId` accepts exactly the five identities and the two catalogs still have identical key sets.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Wire the new identities through the existing listing, generation, page, and saved-state machinery so any edition becomes playable.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [X] T004 Edit `server/game/listing.ts`: build `games` from the ordered `GAME_IDS`; for `more_or_less` and `groups` keep the existing probes; for each match edition probe with `matchSeasonFor(game)` using `countMatchableCurrentSeasonSeries(year, season)`; keep per-entry ready/unavailable/error isolation and the existing `DATABASE_UNAVAILABLE` logging (spec FR-008, FR-011, FR-012; contracts/game-identities.md §4). Depends on T001, T002.
- [X] T005 Edit `server/game/puzzleService.ts`: map each match edition identity to `generateMatchTheSeries(game, puzzleDate, matchSeasonFor(game))`; remove the old `match_the_series` entry and the `getCalendarSeason`-based match wiring; leave `more_or_less` and `groups` generators untouched (spec FR-005, FR-006, FR-016; contracts/game-identities.md §5). Depends on T001, T002.
- [X] T006 Extract `app/components/MatchTheSeriesGame.vue` from `app/pages/game/match-the-series.vue`: accept a `game: GameId` prop; fetch `/api/daily/${game}`; read/write progress under that `game` key; post to `/api/daily/${game}/attempt` and `/api/daily/${game}/expire`; resolve the page title from `game.${game}`. Preserve every existing timer, reveal, error, and share behavior (research.md R4). Depends on T001, T003.
- [X] T007 Edit `app/composables/useLocalProgress.ts`: in `sanitize`, delete entries whose key is not in the current `GAME_IDS`, so a saved `match_the_series` entry is dropped without error and reset-all clears it; keep the `v: 1` shape and per-game scoping (spec FR-009, FR-010, FR-015; research.md R6).
- [X] T008 [P] Update `tests/local-progress.test.ts`: assert a stored `match_the_series` entry is dropped while the three edition keys round-trip, and that finishing/resetting one edition does not touch another (spec FR-009, FR-010, FR-015). Depends on T001, T007.

**Checkpoint**: An edition identity resolves through the API, generates its own daily puzzle, and keeps independent saved state.

---

## Phase 3: User Story 1 - Three Match the Series editions offered as separate games (Priority: P1) 🎯 MVP

**Goal**: The home page lists five games in a responsive grid with the three editions named by
season and year, current season first, each with its own status and finished marker.

**Independent Test**: Load the home page with no stored data; five cards appear in a grid, in the
order More or Less, Autumn 2026, Spring 2026, Summer 2026, Groups, with no horizontal scrolling on
a phone width.

### Implementation for User Story 1

- [X] T009 [P] [US1] Edit `app/assets/css/main.css`: turn `.game-list` into a responsive grid (`repeat(auto-fill, minmax(<card-min>, 1fr))` with the existing gap) so multiple cards share a row on wide screens and remain readable on phones without horizontal overflow (contracts/home-layout.md §1). No dependency.
- [X] T010 [US1] Remove `app/pages/game/match-the-series.vue` now that `MatchTheSeriesGame.vue` and the edition wrapper pages own the route surface; confirm `app/components/GameCard.vue` resolves names/routes from the identity unchanged (spec FR-002; contracts/game-identities.md §3). Depends on T006.
- [X] T011 [P] [US1] Update `tests/routes/daily.get.test.ts`: expect exactly five entries in the contract order with the Autumn edition before Spring and Summer, and assert per-entry status is independent (spec FR-001, FR-008; contracts/game-identities.md §4). Depends on T004.
- [X] T012 [P] [US1] Update `e2e/viewport-fit.spec.ts`: point the `match` route/attempt entries at `match-the-series-autumn-2026` / `match_the_series_autumn_2026`, and keep the home grid assertions free of stylesheet-text or markup-snapshot checks (contracts/home-layout.md). Depends on T001, T009.

**Checkpoint**: The home page offers the five games correctly; the Autumn edition card is openable once US2 lands.

---

## Phase 4: User Story 2 - Play the Autumn 2026 edition (Priority: P1) 🎯 MVP

**Goal**: The renamed current-season game plays exactly as before, with every grid series and reveal
drawn only from Autumn 2026.

**Independent Test**: Open `/game/match-the-series-autumn-2026`, win or time out, and confirm every
revealed series belongs to Autumn 2026 and the payload's `season` is `fall`/2026.

### Implementation for User Story 2

- [X] T013 [US2] Create `app/pages/game/match-the-series-autumn-2026.vue`: render `MatchTheSeriesGame` with `game="match_the_series_autumn_2026"` (contracts/game-identities.md §3). Depends on T006.
- [X] T014 [US2] Update `tests/generation.test.ts`: generate for `match_the_series_autumn_2026` and assert `payload.season` equals the fixed mapping `{ season: 'fall', year: 2026 }` and all nine grid series come from that season (spec FR-005, FR-016; contracts/game-identities.md §5). Depends on T002, T005.
- [X] T015 [P] [US2] Update `tests/routes/puzzle.get.test.ts`: request the Autumn identity and assert the identity, the fixed `season`, the 3×3 grid, and the 18-card deck with no series key on any clue card (contracts/game-identities.md §5). Depends on T005.

**Checkpoint**: The current-season edition is fully playable and season-correct.

---

## Phase 5: User Story 3 - Play the Spring 2026 edition (Priority: P2)

**Goal**: A complete Spring 2026 game using only Spring 2026 series, independent of the Autumn
edition's identity and saved state.

**Independent Test**: Open `/game/match-the-series-spring-2026`, finish a game, and confirm all
revealed series belong to Spring 2026 with no shared state from Autumn.

### Implementation for User Story 3

- [X] T016 [P] [US3] Create `app/pages/game/match-the-series-spring-2026.vue`: render `MatchTheSeriesGame` with `game="match_the_series_spring_2026"` (contracts/game-identities.md §3). Depends on T006.
- [X] T017 [P] [US3] Create `tests/match-editions-spring.test.ts` (DB-gated, `describe.skipIf(!process.env.DATABASE_URL)`): assert the Spring mapping and that a generated Spring payload's grid series and `season` are all Spring 2026 (spec FR-005; data-model.md). Depends on T002, T005.

**Checkpoint**: The first past-season edition is playable and isolated.

---

## Phase 6: User Story 4 - Play the Summer 2026 edition (Priority: P3)

**Goal**: A complete Summer 2026 game using only Summer 2026 series, independent of both other
editions.

**Independent Test**: Open `/game/match-the-series-summer-2026`, finish a game, and confirm all
revealed series belong to Summer 2026.

### Implementation for User Story 4

- [X] T018 [P] [US4] Create `app/pages/game/match-the-series-summer-2026.vue`: render `MatchTheSeriesGame` with `game="match_the_series_summer_2026"` (contracts/game-identities.md §3). Depends on T006.
- [X] T019 [P] [US4] Create `tests/match-editions-summer.test.ts` (DB-gated, `describe.skipIf(!process.env.DATABASE_URL)`): assert the Summer mapping and that a generated Summer payload's grid series and `season` are all Summer 2026 (spec FR-005; data-model.md). Depends on T002, T005.

**Checkpoint**: All three editions are independently playable.

---

## Phase 7: User Story 5 - An edition with insufficient coverage is unavailable by itself (Priority: P3)

**Goal**: One edition's missing catalog coverage shows the existing unavailable state without
affecting the other editions or games.

**Independent Test**: Make one fixed season lack enough matchable series; only that edition shows
unavailable/error and the page is not a total failure.

### Implementation for User Story 5

- [X] T020 [US5] Verify and, if needed, adjust `server/game/listing.ts` so a match-edition probe failure returns `{ status: 'unavailable', code: 'PUZZLE_UNAVAILABLE' }` for that entry only and an exception returns `{ status: 'error', code: 'DATABASE_UNAVAILABLE' }` for that entry only, with no cross-entry short-circuit (spec FR-011, FR-012). Depends on T004.
- [X] T021 [P] [US5] Create `tests/match-edition-availability.test.ts`: assert `matchSeasonFor` is queried per edition, that one unavailable edition leaves the other four entries ready/unchanged, and that a total-error condition is the only case that yields the page-level failure (contracts/game-identities.md §4; spec FR-011, FR-012). Depends on T004.

**Checkpoint**: Availability is correct and isolated per edition.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Keep the remaining suites, docs, and end-to-end flows consistent with the new
identities.

- [X] T022 [P] Update `tests/routes/attempt.post.test.ts` and `tests/routes/expire.post.test.ts` to use `match_the_series_autumn_2026`; assert attempt/expire remain per-edition and stateless with the unchanged shapes (contracts/game-identities.md §5).
- [X] T023 [P] Run quickstart.md scenarios V1–V7 and record results; confirm no blank/stuck states and that More or Less and Groups are unchanged (spec FR-017; quickstart.md). Validation: all Vitest suites pass (20 files, 61 tests) and `npm run build` succeeds; Playwright viewport e2e could not run here because the bundled Chromium binary and its system libraries are unavailable in this environment.
- [X] T024 [P] Review `tests/` and `specs/010-match-series-season-variants/quickstart.md`: confirm the feature suite is ≤15 tests and that no assertion targets stylesheet source text, CSS class strings, or markup snapshots; consolidate if needed (Principle VI).
- [X] T025 [P] Re-check bilingual parity of `app/i18n/en.ts` and `app/i18n/es.ts` and remove any now-unused `game.match_the_series` strings, keeping `Object.keys(en).sort()` equal to `Object.keys(es).sort()` (spec FR-013, FR-014).
- [X] T026 Verify no catalog writes, no `import_state`/`import_runs` access, and no schema migration were introduced; confirm the browser bundle contains no DB driver or credential (Principle I, II; data-model.md).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately; no dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1; BLOCKS all user stories.
- **User Stories (Phases 3–7)**: Depend on Phase 2. US2 depends on US1 only for the home entry point
  (the route itself works independently); US3 and US4 reuse `MatchTheSeriesGame` from Phase 2 and do
  not depend on each other; US5 depends only on the listing work in T004.
- **Polish (Phase 8)**: Depends on the stories being complete.

### User Story Dependencies

- **US1 (P1)**: Needs Phase 2; independent test = home grid and ordering.
- **US2 (P1)**: Needs Phase 2 (`MatchTheSeriesGame`, mapping); independent test = Autumn season.
- **US3 (P2)**: Needs Phase 2; independent of US2's saved state.
- **US4 (P3)**: Needs Phase 2; independent of US2 and US3.
- **US5 (P3)**: Needs T004; independent of the wrapper pages.

### Within Each User Story

- Wrapper page before its end-to-end check; mapping before generation tests; listing before the
  listing/availability tests.

### Parallel Opportunities

- Phase 1: T001, T002, T003 run in parallel (different files).
- Phase 2: T008 runs in parallel with T004–T007 (different files), but T007 must precede T008.
- Phase 3: T009, T011, T012 are parallel (CSS, tests, e2e); T010 depends on T006.
- Phase 4: T015 is parallel with T013–T014.
- Phase 5: T016, T017 are parallel.
- Phase 6: T018, T019 are parallel.
- Phase 7: T021 is parallel once T004 is complete.
- Phase 8: T022–T026 are parallel.

---

## Parallel Example: User Story 1

```bash
Task: "T009 [P] [US1] Responsive .game-list grid in app/assets/css/main.css"
Task: "T011 [P] [US1] Update tests/routes/daily.get.test.ts for five-game ordered listing"
Task: "T012 [P] [US1] Update e2e/viewport-fit.spec.ts to the Autumn edition route/id"
```

## Parallel Example: Past-Season Stories

```bash
Task: "T016 [P] [US3] Create app/pages/game/match-the-series-spring-2026.vue"
Task: "T018 [P] [US4] Create app/pages/game/match-the-series-summer-2026.vue"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1 (identities, mapping, i18n).
2. Complete Phase 2 (listing, generator wiring, shared component, saved-state sanitize).
3. Complete US1 (grid layout, ordered listing, remove old route) and US2 (Autumn wrapper + season test).
4. **STOP and VALIDATE**: home grid with current season first, and a fully playable, season-correct
   Autumn 2026 edition.
5. Deploy/demo if ready.

The two P1 stories ship together because the home grid is only meaningful once at least the
current-season edition is playable.

### Incremental Delivery

1. Setup + Foundational → identities live, no visible change.
2. US1 + US2 → grid home and Autumn 2026 playable (MVP).
3. US3 → Spring 2026 added.
4. US4 → Summer 2026 added.
5. US5 → availability isolation verified.
6. Polish → suites, docs, and constitution checks clean.

### Parallel Team Strategy

1. Team completes Phase 1 + Phase 2 together.
2. Then: Developer A owns US1 (home/CSS/e2e), Developer B owns US2 (Autumn), Developer C owns
   US3 and US4 wrappers/tests, Developer D owns US5 availability.
3. Rejoin for Phase 8.

## Notes

- [P] = different files, no dependency on an incomplete task.
- Every edition-specific behavior is driven by `matchSeasonFor`; do not recompute seasons from the
  UTC date anywhere.
- More or Less and Groups changes are out of scope; if a shared file must change, keep their
  behavior identical.
- Commit after each task or logical group; stop at each checkpoint to validate the story.
