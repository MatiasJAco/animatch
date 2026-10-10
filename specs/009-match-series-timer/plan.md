# Implementation Plan: Match the Series — Unlimited Mistakes Within a 90-Second Timer

**Branch**: `009-match-series-timer` | **Date**: 2026-10-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-match-series-timer/spec.md`

## Summary

Replace Match the Series' three-mistake loss with a **fixed 90-second countdown**. Wrong guesses become
unlimited and never end the game; the game now ends only when all nine tiles are green (win) or when
the countdown reaches zero (time-out). The countdown is a **two-digit badge inside the clue card,
right-aligned**, and it is **device-owned and pause-aware**: it counts down only while the board is
visible, pauses on hidden/backgrounded tabs, and preserves the remaining time across reloads. On
time-out the day's game ends as a completed result and **reveals every clue's series**, matching the
existing end-of-game reveal, and the day is marked finished for the home marker, share, and reset.

Technically this removes the mistake-cap machinery entirely (`MATCH_WRONG_LIMIT`, the `wrongLimit`
payload field, the `missLog` evidence, and the `lost`-on-miss outcome), adds a small pure timing
helper plus a device composable, renders the badge in the clue card, and adds **one stateless server
endpoint** (`POST /api/daily/match_the_series/expire`) that returns the withheld answer mapping when
the client reports the clock hit zero — because the solution is never shipped in the daily payload
(Constitution IV), the client cannot reveal the answers without the server. No catalog write, no
`daily_puzzles` schema change, no identity, no new dependency.

## Technical Context

**Language/Version**: TypeScript 5.x on Node ≥22.18; Nitro server routes + Vue 3 islands (Nuxt 3.21)

**Primary Dependencies**: Nuxt 3 + Vue 3; `pg` on the server only. **No dependency is added**
(Constitution VI).

**Storage**: PostgreSQL. Reads the pre-existing read-only catalog and the app-owned `daily_puzzles`
row (served unchanged except the removed `wrongLimit` key in the stored JSON payload). Client state
grows two fields in the existing `animatch:v1:progress` entry (`timerRemainingMs`, `revealedAnswers`)
and drops the now-unused match `wrongClicks` / match-shaped `missLog`. No schema or migration change.

**Testing**: Vitest 5 (`tests/`) — pure unit tests for the timing helper and the simplified match
state, DB-gated route coverage for the new expire endpoint, and edits to existing match
route/generation/progress tests. Playwright e2e for the finished-board layout. No stylesheet-text or
markup-snapshot assertions (Constitution VI).

**Target Platform**: browser client + Nitro server; the timer uses only standard web-platform
intervals and the Page Visibility API (no vendor-specific API, per Delivery Model).

**Project Type**: web application (Nuxt `app/` client + `server/` Nitro routes).

**Performance Goals**: none beyond current behavior. One ~1 Hz client tick and one extra request at
time-out; negligible.

**Constraints**: time limit is a fixed constant (90 s); no catalog writes; no `daily_puzzles` schema
change; no identity/session; the per-UTC-day deterministic puzzle, the 18-card/9-series deck, the
evidence-based win verification, and the fail-visible error states are preserved; every new string is
bilingual; the countdown must not overflow horizontally at supported widths.

**Scale/Scope**: 1 server game module + 1 generator + 1 new route + 1 shared attempt route; 1 page +
1 component + 1 new composable + 1 new pure util + CSS; i18n; ~4 test files edited/added.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Read-Only Catalog Ownership | No catalog writes/DDL; no `import_state`/`import_runs`; no `daily_puzzles` schema change | PASS — change touches only the game module, the generator's payload data, and client state; catalog untouched; `daily_puzzles` columns unchanged |
| II. API/UI Separation | No DB driver/credential/query reachable from the browser | PASS — the reveal endpoint is a server route; the client calls it over HTTP and holds no driver. The countdown is pure client timing, no DB access |
| III. One Deterministic Puzzle per UTC Day | Day key stays UTC; stored puzzle stable; generation deterministic | PASS — the timer affects only the client's ending rule; selection, seed, novelty, and the stored puzzle are unchanged |
| IV. Stateless v1 | No identity, session, or new server storage | PASS — the timer and the day result stay device-owned; the expire endpoint stores nothing and derives its answer from the stored puzzle. The client is not trusted for scoring (unchanged) |
| V. Fail Visible, Never Blank | Failures render a bilingual, retryable state | PASS — if the reveal request fails at time-out, the existing error panel with retry is shown; the time-out reveal uses the existing reveal path, and the badge never blanks the card |
| VI. Lean Tests, Approved Dependencies | Tests ≤15; no new dependency; no stylesheet/markup assertions; lean comments | PASS — no dependency added; timer coverage is pure-value (formatting/clamping), no CSS/markup snapshots; the countdown's *placement* is validated manually (see [research.md](./research.md) R-005) |

**No violations.** Complexity Tracking is intentionally empty.

Post-Design re-check (after Phase 1): unchanged — one new stateless endpoint, one pure helper, one
composable, and surgical edits to the existing match code and its tests. PASS.

## Project Structure

### Documentation (this feature)

```text
specs/009-match-series-timer/
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0 output (/speckit.plan)
├── data-model.md        # Phase 1 output (/speckit.plan)
├── quickstart.md        # Phase 1 output (/speckit.plan)
├── contracts/
│   ├── match-timer.md   # Phase 1 output — countdown behavior + client state contract
│   └── expire-endpoint.md  # Phase 1 output — the new reveal-on-time-out endpoint
├── checklists/
│   └── requirements.md  # Spec quality checklist (/speckit.specify)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by this command)
```

### Source Code (repository root)

```text
server/
├── game/
│   └── matchTheSeries.ts        # EDIT — remove MATCH_WRONG_LIMIT and wrongLimit; drop the
│                                #        missLog input and the lost-on-miss outcome; a wrong
│                                #        answer always resolves to `miss` + `in_progress`.
│                                #        Keep the 9-series/18-card deck and the greenPairs
│                                #        win verification (verifyMatchProgress → { green }).
├── generators/
│   └── matchTheSeries.ts        # EDIT — stop writing `wrongLimit` into the stored payload.
└── api/daily/
    ├── [game]/attempt.post.ts   # EDIT — match branch verifies greenPairs only (no missLog).
    └── [game]/expire.post.ts    # NEW — stateless: loads the stored puzzle and returns
                                 #        { result:'expired', state:'lost', answers } for the
                                 #        client-reported time-out. Existing error envelope on
                                 #        PUZZLE_UNAVAILABLE / DATABASE_UNAVAILABLE. Lives under
                                 #        [game]/ because a static match_the_series/ directory
                                 #        shadows the dynamic [game].get.ts route.

app/
├── pages/game/match-the-series.vue  # EDIT — own the timer, wire pause/resume/persist, call
│                                    #        /expire on timeout, remove the miss-loss path and
│                                    #        the mistakes evidence from the attempt request.
├── components/MatchGrid.vue         # EDIT — render the right-aligned two-digit circle inside
│                                    #        the clue card; drop the `Mistakes: n/3` bar.
├── composables/
│   └── useMatchTimer.ts             # NEW — device countdown: start, 1 Hz tick, pause on
│                                    #        visibilitychange, resume, persist remaining ms.
├── utils/
│   ├── matchTimer.ts                # NEW (pure) — MATCH_TIME_LIMIT_MS, formatMatchClock,
│   │                                #        clamp/advance helpers (the testable core).
│   └── matchState.ts                # EDIT — drop wrongClicks/missLog; preserve timer +
│                                    #        reveal fields through every state write.
├── composables/useLocalProgress.ts  # EDIT — add timerRemainingMs + revealedAnswers; drop the
│                                    #        match-shaped missLog/wrongClicks.
├── i18n/en.ts, app/i18n/es.ts       # EDIT — update the match summary; add match.timer +
│                                    #        match.time_up; remove match.mistakes.
└── assets/css/main.css              # EDIT — the clue-card timer badge (circle, right-aligned).

specs/001-daily-anime-puzzles/contracts/openapi.yaml  # EDIT — the match puzzle drops
                                                     #        `wrongLimit`; the match outcome
                                                     #        no longer ends on a miss; the new
                                                     #        expire endpoint is documented.

tests/
├── match-timer.test.ts            # NEW — pure: two-digit formatting, clamp, tick math.
├── match-state.test.ts            # EDIT — a wrong answer never ends the game.
├── routes/attempt.post.test.ts    # EDIT — match never loses on a miss.
├── routes/expire.post.test.ts     # NEW — the expire endpoint returns the mapping + lost.
├── routes/puzzle.get.test.ts      # EDIT — the match payload no longer carries wrongLimit.
├── local-progress.test.ts         # EDIT — drop removed match fields; timer fields round-trip.
└── (e2e/viewport-fit.spec.ts)     # EDIT — reach Match's finished state via a near-zero stored
                                   #        timer + a mocked expire response instead of a
                                   #        mocked losing attempt.
```

**Structure Decision**: single Nuxt project. The change is confined to Match the Series: its game
module, generator, one shared attempt route, one new stateless route, its page/board, a new pure
timing helper and composable, the client progress shape, i18n, and CSS. Groups and More or Less are
untouched (only the shared `attempt.post.ts` branches change for the match branch).

## Complexity Tracking

No Constitution Check violations; no complexity to justify.
