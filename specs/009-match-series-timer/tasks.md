---
description: "Task list for Match the Series — Unlimited Mistakes Within a 90-Second Timer"
---

# Tasks: Match the Series — Unlimited Mistakes Within a 90-Second Timer

**Input**: Design documents from `/specs/009-match-series-timer/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The project constitution (Principle VI, Development Workflow) makes passing
tests part of the definition of done, and the plan/research specify the test set. Keep the feature's
suite ≤15 tests and never assert stylesheet text, CSS class strings, or markup snapshots.

**Organization**: Tasks are grouped by user story (P1 → P3). US2 and US3 depend on US1 because the
mistake cap must be gone before a countdown ending is meaningful.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: `[US1]` unlimited mistakes, `[US2]` visible countdown, `[US3]` time-out ending
- Every task names an exact file path.

## Path Conventions

Single Nuxt project: `app/` (Vue client), `server/` (Nitro routes), `tests/`, `e2e/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared constant/helpers and bilingual copy used by more than one story.

- [X] T001 [P] Create the pure timing helper in `app/utils/matchTimer.ts`: export `MATCH_TIME_LIMIT_MS = 90_000`; `formatMatchClock(remainingMs)` → whole seconds via `Math.ceil`, clamped to `[0, 90_000]`, zero-padded to two digits (`90_000→'90'`, `9_000→'09'`, `0→'00'`); `clampRemaining(remainingMs)` → `[0, 90_000]`, non-finite → `0`; `advanceRemaining(remainingMs, elapsedMs)` → subtract + clamp. No imports, no side effects (contract: contracts/match-timer.md §1).
- [X] T002 [P] Update both catalogs to keep key parity (spec FR-009): in `app/i18n/en.ts` and `app/i18n/es.ts` add `match.timer` (short accessible label for the countdown) and `match.time_up` ("Time's up" / equivalent), remove `match.mistakes`, and reword `game.match_the_series.summary` so it no longer says three mistakes end the game but describes the 90-second timer.

**Checkpoint**: The helper compiles and `Object.keys(en).sort()` still equals `Object.keys(es).sort()`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The day-state shape every story reads and writes. `setGameState` replaces the whole
entry, so this must land before any story write path.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [X] T003 Update `app/composables/useLocalProgress.ts`: add `timerRemainingMs?: number` and `revealedAnswers?: Record<string, string>` to `LocalGameState`; remove the match `wrongClicks` field; remove the match-shaped duplicate `missLog?: Array<{ clueKey: string; seriesKey: string }>` and keep the Groups `missLog?: string[][]`. Document that `timerRemainingMs` is clamped to `[0, 90_000]` on read/write, a previous UTC day is still discarded, and a malformed entry still degrades without blanking (data-model.md §4).
- [X] T004 [P] Update `tests/local-progress.test.ts`: assert `timerRemainingMs` and `revealedAnswers` round-trip across `load()`; assert the removed match `wrongClicks` / match-shaped `missLog` no longer appear; keep the existing day-scoping, reset, and malformed-storage cases.

**Checkpoint**: The progress store compiles, round-trips the new fields, and drops the old ones.

---

## Phase 3: User Story 1 - Unlimited wrong guesses, only the clock constrains the player (Priority: P1) 🎯 MVP

**Goal**: A wrong series guess never ends the game and never counts against the player; a wrong guess
only shows wrong-answer feedback and leaves existing green tiles untouched.

**Independent Test**: Open Match the Series and click a wrong series far more than three times
(including repeats on one clue); the game stays in progress with only wrong-answer feedback.

### Implementation for User Story 1

- [X] T005 [P] [US1] Edit `server/game/matchTheSeries.ts`: remove `MATCH_WRONG_LIMIT`, remove `wrongLimit` from `MatchTheSeriesPayloadData`, remove the `missLog` field from `MatchTheSeriesAttemptBody`/`parseMatchAttempt`, and remove the `MatchTheSeriesOutcomeMissEnded` variant. Change `verifyMatchProgress(solution, greenPairs)` to return `{ green: Set<string> }` only (still reject a green pair that is not a genuine correct pairing with `MatchInvalidAttemptError`), and change `resolveMatchOutcome` so a wrong answer always returns `{ result: 'miss', clueKey, seriesKey, state: 'in_progress' }` (never `lost`, no `correctSeriesKey`, no `answers`); keep the nine-distinct-green win rule (contract: contracts/match-timer.md §4).
- [X] T006 [P] [US1] Edit `server/generators/matchTheSeries.ts`: stop importing `MATCH_WRONG_LIMIT` and stop writing `wrongLimit` into `payloadData`; leave the deck, grid, season, signature, and novelty logic unchanged.
- [X] T007 [US1] Edit `server/api/daily/[game]/attempt.post.ts`: in the `match_the_series` branch call `verifyMatchProgress(solution, attempt.greenPairs)` (no `missLog`) and pass the result to `resolveMatchOutcome` (depends on T005).
- [X] T008 [P] [US1] Edit `app/utils/matchState.ts`: remove `wrongClicks` and the match `missLog` from `MatchBoardState` and `applyMatchAnswer`; a `miss` outcome never yields `lost`; and carry `timerRemainingMs` and `revealedAnswers` forward on every returned state so a write never drops them (research.md R-006, the "replace the whole entry" hazard).
- [X] T009 [US1] Edit the match client surface: in `app/pages/game/match-the-series.vue` remove the `wrongClicks`/`missLog` computeds and stop sending `missLog` in the attempt body and stop passing `wrong-clicks`; in `app/components/MatchGrid.vue` remove the `wrongClicks` prop and the `Mistakes: {current}/{max}` bar (the help line stays). Depends on T005, T008.
- [X] T010 [P] [US1] Rewrite `tests/match-state.test.ts`: a wrong answer always leaves the game `in_progress` (never `lost`), no matter how many are logged; nine distinct green series still win; `timerRemainingMs`/`revealedAnswers` are preserved through an accepted answer.
- [X] T011 [P] [US1] Update `tests/routes/attempt.post.test.ts` (a match `miss` returns `state: 'in_progress'` and never discloses the correct series, and `greenPairs` still gates a win) and `tests/routes/puzzle.get.test.ts` (the match payload has no `wrongLimit`; the Groups payload still has `wrongLimit: 5`).

**Checkpoint**: US1 fully works and is testable on its own — unrestricted guesses never end the game.

---

## Phase 4: User Story 2 - A visible countdown the player can follow (Priority: P2)

**Goal**: A two-digit circular countdown inside the clue card, right-aligned, that ticks once per
second, pauses while the board is not visible, and preserves its remaining time across reloads.

**Independent Test**: Start a game; confirm the circle shows `90` inside the clue card on its right,
decreases once per second, is unchanged by answers/skips, pauses when the tab is hidden, and resumes
(not restarts) after a reload.

### Implementation for User Story 2

- [X] T012 [US2] Create `app/composables/useMatchTimer.ts`: hold `remainingMs` initialized from the stored `timerRemainingMs` (else `MATCH_TIME_LIMIT_MS`); run a ~1 Hz tick only while the game is `in_progress` and `document.visibilityState === 'visible'`; on hidden stop the tick and persist the current value; on visible resume from it; expose the formatted value, a persist hook, and a one-shot zero callback; stop when finished. Use only `setInterval` and the Page Visibility API (contract: contracts/match-timer.md §2). Depends on T001, T003.
- [X] T013 [US2] Wire the timer in `app/pages/game/match-the-series.vue`: use `useMatchTimer`, seed it from the day's `timerRemainingMs`, write `timerRemainingMs` back on every accepted answer via `persist`, stop it on a win, and pass the current two-digit label to `MatchGrid`. Depends on T012, T008.
- [X] T014 [P] [US2] Edit `app/components/MatchGrid.vue`: add a `remaining: string` prop and render it as the clue card's last child, pushed to the right (e.g. `margin-left: auto`), inside a circular element; give it an accessible name from `match.timer` (spec FR-014).
- [X] T015 [P] [US2] Edit `app/assets/css/main.css`: add the clue-card timer badge styles — a fixed-size circle, centered two-digit text, right-aligned within `.clue-card` — without causing horizontal overflow at widths ≥1024 px.
- [X] T016 [P] [US2] Create `tests/match-timer.test.ts` (pure): `formatMatchClock(90_000) === '90'`, `formatMatchClock(9_000) === '09'`, `formatMatchClock(0) === '00'`; `clampRemaining(-5) === 0` and `clampRemaining(120_000) === 90_000`; `advanceRemaining(90_000, 1_500) === 88_500` and floors at `0`.

**Checkpoint**: US1 + US2 both work independently — the player always sees the running clock.

---

## Phase 5: User Story 3 - Time runs out: the game ends and shows the answers (Priority: P3)

**Goal**: When the countdown reaches zero without a win, the day's game ends, every clue's correct
series is revealed, and the home screen marks the game finished; the ending and the reveal survive a
reload and are cleared by Reset.

**Independent Test**: Seed a near-zero `timerRemainingMs`, reload, and let it hit `00`; the game ends,
the reveal lists every clue's series, the home card shows finished, and a reload keeps the reveal.

### Implementation for User Story 3

- [X] T017 [P] [US3] Create `server/api/daily/[game]/expire.post.ts` (under the existing `[game]/` folder — a static `match_the_series/` directory shadows the dynamic `[game].get.ts` route): reject any game other than `match_the_series`, otherwise load the day's stored puzzle with `getOrCreatePuzzleFor('match_the_series', getUtcDateNow())` and return `{ result: 'expired', state: 'lost', answers: solution.answers }`; map `PUZZLE_UNAVAILABLE` / `DATABASE_UNAVAILABLE` through `errorResponse` (contract: contracts/expire-endpoint.md). No body, no storage, no session.
- [X] T018 [US3] Handle time-out in `app/pages/game/match-the-series.vue`: on the timer's zero callback, guard against a second run, `POST /api/daily/match_the_series/expire`; on success persist `status: 'lost'`, `revealedAnswers = answers`, and `endedAt`; on failure show the existing `ErrorPanel` with a retry and keep the game in progress. Depends on T013, T017.
- [X] T019 [US3] Edit `app/components/MatchGrid.vue`: show the `match.time_up` message when the game ended by time-out, and render the reveal list from the persisted `revealedAnswers` on load (not only from the in-session response), so a reload after time-out still shows every clue's series. Depends on T018.
- [X] T020 [P] [US3] Create `tests/routes/expire.post.test.ts` (DB-gated, `describe.skipIf(!process.env.DATABASE_URL)`): `resolveMatchOutcome`-free — assert the endpoint returns `{ result: 'expired', state: 'lost', answers }` with all 18 clue keys mapping to a grid series for the stored day, and that a missing day reuses the `PUZZLE_UNAVAILABLE` / `DATABASE_UNAVAILABLE` envelope.
- [X] T021 [P] [US3] Update `e2e/viewport-fit.spec.ts`: replace `routeMatchLoss` with a path that seeds a near-zero `timerRemainingMs` into `animatch:v1:progress` and mocks `**/api/daily/match_the_series/expire`, then asserts the `.reveal-list` and the finished-board contract after reload.

**Checkpoint**: All three stories work; the day's Match result is complete and reload-safe.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T022 [P] Update the API contract of record `specs/001-daily-anime-puzzles/contracts/openapi.yaml`: remove `wrongLimit` from the `MatchTheSeriesPuzzle` schema/example, make the Match outcome unable to end on a miss, and document `POST /daily/match_the_series/expire`.
- [X] T023 Run `npm test` and `npx playwright test e2e/viewport-fit.spec.ts`; confirm the feature's suite is ≤15 tests, no stylesheet-text/markup-snapshot assertions were added, and both locales still have identical key sets. (Done: vitest 57/57 across 17 files; 6/6 e2e; `npm run build` clean.)
- [X] T024 Walk the manual scenarios in `quickstart.md` §1–§7 (unlimited mistakes, badge placement, pause/resume/reload, win, time-out reveal, retry panel, other games unchanged) and fix any drift. (Validated: §1/§4 by pure tests + server logic; §2 by SSR markup — `clue-card__timer role="timer"` shows `90` inside the clue card — plus the pure two-digit formatter; §2.3 overflow and §7 other games by the e2e suite; §3 reload-resume and §5 reveal-after-reload by the seeded near-zero-timer e2e `finished states` test. Residual human-eye checks: the tab-hidden pause and the circle's exact pixels.)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all stories.
- **US1 (Phase 3)**: Depends on Foundational. No dependency on other stories.
- **US2 (Phase 4)**: Depends on Foundational and, in practice, US1 (a running clock is meaningless while three mistakes still end the game).
- **US3 (Phase 5)**: Depends on US2 (needs the timer to reach zero) and US1.
- **Polish (Phase 6)**: Depends on all desired stories.

### User Story Dependencies

- **US1 (P1)**: independent after Foundational.
- **US2 (P2)**: builds on US1's removal of the cap; independently testable as "the clock is visible and pause-aware".
- **US3 (P3)**: builds on US2's timer and US1's non-loss; independently testable via a seeded near-zero timer.

### Within Each User Story

- Server type/behavior changes before the route that consumes them (T005 → T007).
- Client state changes before the page that wires them (T008 → T009, T012 → T013, T017 → T018 → T019).
- Tests accompany the story they prove.

### Parallel Opportunities

- Phase 1: T001 and T002 touch different files → run together.
- Phase 2: T004 is independent of T003 in content but asserts its shape; run T004 after T003.
- US1: T005, T006, T008, T010 are different files → parallel; T007 needs T005; T009 needs T005 + T008; T011 is independent.
- US2: T014, T015, T016 are different files → parallel; T013 needs T012.
- US3: T017 and T020/T021 are independent; T019 follows T018.

---

## Parallel Example: User Story 1

```bash
# Independent files at the same time:
Task: "Remove the match mistake cap in server/game/matchTheSeries.ts"          # T005
Task: "Stop writing wrongLimit in server/generators/matchTheSeries.ts"         # T006
Task: "Simplify match state in app/utils/matchState.ts"                        # T008
Task: "Rewrite tests/match-state.test.ts"                                      # T010
```

## Parallel Example: User Story 2

```bash
# Independent files at the same time:
Task: "Render the countdown circle in app/components/MatchGrid.vue"            # T014
Task: "Style the countdown badge in app/assets/css/main.css"                   # T015
Task: "Add pure timing tests in tests/match-timer.test.ts"                     # T016
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (US1).
3. **STOP and VALIDATE**: wrong guesses never end the game; `npm test` green.
4. This alone delivers the requested "make all the mistakes they want".

### Incremental Delivery

1. Setup + Foundational → day-state shape ready.
2. US1 → unlimited mistakes (MVP).
3. US2 → the visible, pause-aware 90-second countdown.
4. US3 → the time-out ending with a reload-safe reveal and finished marker.
5. Polish → contract doc, full test run, quickstart walkthrough.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete work.
- The feature's automated suite must stay ≤15 tests (Constitution VI); consolidate rather than add.
- Never assert stylesheet text, CSS class strings, or markup snapshots; the countdown's *value* is
  tested purely and its *placement* via geometry/manual steps.
- Commit after each task or logical group; stop at any checkpoint to validate a story on its own.
