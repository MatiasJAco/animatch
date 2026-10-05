# Implementation Plan: Daily Anime Puzzles (v1)

**Branch**: `feat/sdd-inicial` | **Date**: 2026-10-05 (revised) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-daily-anime-puzzles/spec.md`

## Summary

Three daily anime puzzle games served by one Nuxt 3 process: Nitro handles the API and SSR, the
browser gets no database access, and the day's puzzle for each game is stored once in a single new
`daily_puzzles` table keyed by (game, UTC date). Puzzle generation is a deterministic function of
the game id and the UTC date, reads only the read-only catalog, and writes exactly one row inside a
transaction on first request. The visitor has no account; the day's outcome and in-progress state
live in their own browser storage.

**Technical approach** (details in [research.md](./research.md)): a seeded PRNG whose seed is
`sha256(game:date)` plus primary-key ordering on every catalog read, so generation is reproducible;
create-once-then-reread inside one transaction, so concurrent first requests serve the same stored
puzzle; strict column allow-lists per query, so forbidden catalog fields cannot leak; and a payload
that withholds every answer, so the attempt endpoint is the only disclosure path.

**Revised on 2026-10-05** after the clarification session. Match the Series is now a single
three-by-three grid of current-season series titles with one character or voice actor on a clue card
above it, answered by one click per card, with a free Next skip; a wrong click rotates the card to
another entity while keeping the abandoned entity in the pool. Every game screen gained a control
back to the home page and, in development only, a reset control that clears the visitor's own
device state for that game and day, and the home page gained a matching control that clears all
three games' state at once. No dependency, table, or endpoint was added for any of it.

## Technical Context

**Language/Version**: TypeScript on Node.js 22 (Nuxt 3 runtime)

**Primary Dependencies**: `nuxt` ^3 (Vue 3, Nitro, SSR), `pg` (Postgres client, server only),
`vitest` (dev only). All three named and approved by the project owner before this plan was
written. No component kit, no CSS framework, no ORM, no icon or font package, no third-party
scripts. System fonts only.

**Storage**: PostgreSQL. Existing read-only catalog: `people`, `anime`, `characters`,
`voice_roles`, `anime_seasons`. Import tables `import_state` and `import_runs` untouched. One new
table created by this feature: `daily_puzzles`. Browser storage holds the visitor's own result and
in-progress state only.

**Testing**: `vitest`, maximum 15 tests, no browser end-to-end. Route-level tests against the three
endpoints, unit tests for the UTC day rule and the generators, and one test asserting the catalog
read-only boundary by inspecting executed SQL.

**Target Platform**: Linux or macOS server, Node 22. Modern evergreen browser on phone or desktop,
touch and pointer. Reads and writes the site's own origin only.

**Project Type**: Web application (SSR frontend and API in one process)

**Performance Goals**: Home and game routes render on first request with no client-side data
fetch wait. On a mid-range phone over 4G, the home page shows all three games and a game page shows
a playable puzzle in under 2 seconds in at least 95% of measurements (SC-019). The Match the Series
board is nine tiles and eighteen small clue cards, so it is smaller and lighter than a full bingo
board and adds no image request (FR-029, SC-014). Puzzles already generated for today are served from
a single row read. First-request generation is a one-off cost per game per day and must not block
other requests.

**Constraints**: UTC is the only timezone (R-007, R-014). The browser's timezone is used for display
only. No login, no session, no server-side player state. No secrets in the repository. No writes or
DDL against catalog tables. No image request to any host but this one. Every reset control, on the
game screens and on the home page, is absent from production builds and never reads or writes the
server (FR-057a, FR-057c, FR-058, R-022, R-024). Original copy and assets only.

**Scale/Scope**: Three games, three server routes plus one home route and three game routes, one
new table, one shared game-header component, at most 15 automated tests. Four pages. No user
management, no history, no streaks, no archive, no timed mode, no favorites ranking.

## Constitution Check

Re-checked against constitution v2.1.0 after the 2026-10-05 clarification. All gates pass.

| Principle / rule | How the plan satisfies it |
|---|---|
| I. Read-Only Catalog Ownership | Hand-written `SELECT`s only, one central catalog module, no ORM or query builder, no migration tool pointed at the catalog (R-008, R-016). One migration creating `daily_puzzles` only (R-018). `import_state` and `import_runs` appear nowhere in the plan or the code. Neither reset control adds a write of any kind, so the one allowed write is still the puzzle insert |
| II. API/UI Separation | Nitro server routes are the only database path; the browser receives JSON over HTTP and never holds a driver, connection string, or query. `DATABASE_URL` read from the environment, `.env` gitignored, `.env.example` carries an empty placeholder only. The home control and both reset controls are pure client navigation and client storage, and the home reset clears state for all three games in one browser operation (R-024) |
| III. One Deterministic Puzzle per UTC Day | Day key derived in UTC from the server clock (R-014). Seed is `sha256(game:date)` with primary-key ordering on all catalog reads (R-004). Create-once inside a transaction, then re-read the persisted row (R-005). The reset control never reaches the server, so it cannot change the day's puzzle for anyone (FR-058, SC-023). Browser timezone used only for display |
| IV. Stateless v1 | No login, no session, no user table, no history table. Attempts are validated against the stored puzzle alone (R-012). Result and in-progress progress live in browser storage (R-015). A visitor can therefore never replay a finished day, because the only controls that clear stored state are absent in production (FR-057a, FR-057c, R-022, R-024) |
| V. Fail Visible, Never Blank | Structured error envelope with stable codes and a client-side bilingual message catalog (R-017). Per-game availability on the home listing so one unavailable game never blanks the page. The error state also covers a current season with fewer than nine series (FR-030, EC-002). No empty `catch` on any fetch path; SC-008 makes it a defect |
| VI. Lean Tests, Approved Dependencies Only | Exactly 15 tests named below, consolidated where the new controls and the mistake rotation added behavior. `nuxt`, `pg`, `vitest` named and approved before writing the plan; no fourth dependency, and the development-only resets use Nuxt's built-in build flag rather than a new package. No stylesheet-text or markup-snapshot assertions. No essay comments in source |
| Naming and Originality | Original names, copy, and layout. The prohibited token appears in no name, route, or message key. No external asset, no hotlinked image: the clue card placeholder is the project's own CSS (R-009), so the board can resemble other seasonal puzzle games without copying any of them |
| Bilingual UI | One message catalog with `es` and `en`, no locale variant pinned, no region or timezone setting. The browser's language is detected on first visit, a visible control switches language immediately, and the explicit choice is stored outside the date-scoped progress entry so it survives the daily rollover (FR-048, FR-049, FR-049a, FR-049b). The controls' labels, including the new home reset, come from that same catalog (FR-057, FR-057b) |
| Delivery Model | Runs with `npm install && npm run dev`. No native build, no app store, no mandatory local database for the player |

**Complexity Tracking**: no violations, so nothing to justify.

## Project Structure

### Documentation (this feature)

```text
specs/001-daily-anime-puzzles/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: decisions and alternatives
├── data-model.md        # Phase 1: entities, payload/solution shapes, state machines
├── quickstart.md        # Phase 1: setup, run command, 21 manual validation checks
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── contracts/
    └── openapi.yaml     # The three endpoints, error envelope, per-game schemas
```

### Source Code (repository root)

```text
migrations/
└── 001_daily_puzzles.sql        # One idempotent CREATE TABLE, catalog untouched

scripts/
└── migrate.ts                   # npm run db:migrate: runs migrations/ in order, each in a tx

server/
├── api/
│   └── daily/
│       ├── index.get.ts               # GET /api/daily
│       ├── [game].get.ts              # GET /api/daily/:game
│       └── [game]/attempt.post.ts     # POST /api/daily/:game/attempt
├── game/
│   ├── ids.ts                         # GameId list and validation
│   ├── moreOrLess.ts                  # payload shape, attempt validation, outcome
│   ├── matchTheSeries.ts              # 3x3 grid + clue deck, attempt validation, outcome
│   └── groups.ts
├── generators/
│   ├── moreOrLess.ts                  # Chain of 11 with adjacent counts unequal
│   ├── matchTheSeries.ts              # Current season, 9 series, 18 clue cards
│   ├── groups.ts                      # Four criteria pools, 1820-subset uniqueness check
│   └── signature.ts                   # Novelty fingerprint and 30-day comparison
├── catalog/
│   ├── index.ts                       # The only module issuing catalog queries
│   └── queries.ts                     # Hand-written SELECTs with column allow-lists
├── db/
│   ├── pool.ts                        # pg Pool from DATABASE_URL, closed on Nitro shutdown
│   └── puzzles.ts                     # daily_puzzles read, insert-once, re-read
└── utils/
    ├── day.ts                         # UTC civil date, calendar season, next rollover
    ├── seed.ts                        # sha256(game:date) -> mulberry32 PRNG
    ├── shuffle.ts                     # Seeded Fisher-Yates
    └── errors.ts                      # Error codes and the response envelope

app/
├── app.vue
├── assets/css/main.css                # Own CSS, system fonts, no framework
├── components/
│   ├── GameCard.vue                   # Home card with finished-today marker
│   ├── GameHelp.vue                   # Short help text per game, bilingual
│   ├── GameHeaderControls.vue         # Home control always; per-game reset in dev builds only
│   ├── HomeResetControls.vue          # Home-page reset for all three games, dev builds only
│   ├── MoreOrLessBoard.vue
│   ├── MatchGrid.vue                  # 3x3 series grid, clue card, Next, mistake rotation, CSS placeholder
│   ├── GroupsBoard.vue
│   ├── ResultPanel.vue                # Won/lost summary and spoiler-free share text
│   ├── ShareButton.vue                # Platform share with manual-copy fallback
│   ├── ErrorPanel.vue                 # Bilingual message with retry action
│   └── CountdownBadge.vue             # Next rollover, rendered in browser timezone
├── composables/
│   ├── useDailyPuzzle.ts              # Fetch + state per game, refetch on UTC date mismatch
│   ├── useLocalProgress.ts            # animatch:v1:progress, date guard, resume, per-game reset
│   ├── useLocalPrefs.ts               # animatch:v1:prefs, language choice, survives rollover
│   ├── useLocale.ts                   # Stored choice, else browser language, else es
│   └── useAttemptCount.ts             # Client-side count: every accepted answer (FR-041)
├── pages/
│   ├── index.vue                      # Home: three games, finished-today markers
│   └── game/
│       ├── more-or-less.vue
│       ├── match-the-series.vue
│       └── groups.vue
└── i18n/
    ├── index.ts                       # Resolve stored choice, browser language, then es
    ├── es.ts                          # Every message key in Spanish
    └── en.ts                          # Every message key in English

tests/
├── day.test.ts                        # UTC civil date, rollover, calendar season
├── routes/
│   ├── daily.get.test.ts              # Home listing, per-game status
│   ├── puzzle.get.test.ts             # Today's puzzle per game, no solution served
│   └── attempt.post.test.ts           # Valid and invalid attempts, per game
├── generation.test.ts                 # Determinism, once-only, coverage failure, read-only SQL
└── local-progress.test.ts             # Already-played-today, prior date ignored, resume,
                                       # cleared storage, language choice survives rollover,
                                       # per-game reset

docs/
└── catalog-schema.sql                 # Existing, read-only reference
README.md                              # Setup, run command, no secrets
```

**Structure Decision**: Single Nuxt application, no separate backend or frontend packages. The user
specified one process with Nitro in the same app, and the constitution's API/UI separation is a
network boundary (HTTP between browser and server), not a repository boundary. `server/` holds all
database access and `app/` holds all rendering, so the Principle II boundary is visible in the tree.
All catalog queries live in one module (`server/catalog/`) so the read-only boundary has exactly one
place to review.

## Design Artifacts

| Artifact | Contents |
|----------|----------|
| [research.md](./research.md) | 25 decisions with rationale and rejected alternatives: driver, test runner, no second table, seeding, create-once transaction, novelty signature, season identity and mapping, column allow-list, placeholder art, round structure and hidden counts, Groups uniqueness, invalid attempts, answer enumeration as an accepted limit, SSR day handling, client resume state, read-only enforcement, error contract, migration mechanics, board shape and clue deck size, attempt key shape, where board state lives, development-only reset gating, shared game header, home reset-all without a server write, mistake rotation keeping the abandoned entity in the pool |
| [data-model.md](./data-model.md) | `daily_puzzles` definition and lifecycle, per-game `payload` and `solution` shapes, client state blob, validation rules, state transitions, relationships |
| [contracts/openapi.yaml](./contracts/openapi.yaml) | OpenAPI 3.1 for the three routes, with the error envelope, per-game request and response schemas, and worked examples |
| [quickstart.md](./quickstart.md) | Prerequisites, `npm install`, `npm run db:migrate`, `npm run dev`, `npm test`, and 21 manual checks each tied to a success criterion |

## Key Design Points

**Why one transaction and a re-read.** Two visitors arriving together on a fresh day both generate.
Only one insert survives the primary key, and both then re-read the same row, so identical puzzle
content for everyone is guaranteed by construction rather than by luck (R-005).

**Why answers are not in the payload.** More or Less sends one visible role count and withholds the
other ten; Match the Series never puts a series key on a clue card, only the entity's name and kind;
Groups never sends criterion fields. The attempt response is the only disclosure path, which is what
makes hidden counts, correct pairings, and criteria work at all (R-010, R-011).

**Why the Match the Series deck is eighteen cards, not nine.** The grid is the answer board, so nine
series is the floor and every tile needs at least one answerable card. Nine cards would leave Next
with nothing to offer once the player had skipped through the deck, which reads as a dead button
rather than a finished puzzle. Two cards per series keeps two routes to every tile, keeps Next
meaningful for the whole game, and still costs eighteen small objects in one stored row (R-019).

**Why the attempt names the clue card.** The board is stateless on the server, so `{ seriesKey }`
alone would have to be scored against an assumed current card and could silently mis-score a client
whose displayed card and stored progress drifted apart after a reload. `{ clueKey, seriesKey }` is
still stateless and exact (R-020).

**Why the reset controls are build-flag and not a flag.** FR-057a and FR-057c need the controls to
be absent in production, and a build-time flag makes that structural: the buttons are not in the
production bundle at all, so no visitor can clear a finished result and replay the day (R-022,
R-024). Each performs one browser-storage write and no fetch, which is what keeps FR-058 and
FR-057c true and leaves no endpoint to abuse.

**Why the home reset clears state only and does not touch the database.** The user asked for a
debug control that removes the need to go to the database by hand. Deleting today's `daily_puzzles`
row would not change what a developer sees, because generation is deterministic in the game and day
(R-005): the next request recreates the identical board. What actually blocks a retest is the
browser's finished-today state, which FR-042 keeps on the device. So the home control clears all
three games' progress in one storage operation, and no server write path is added (R-024, FR-057c).

**Why a mistake rotates the card but keeps the entity in the pool.** FR-027c requires the card to
move on, so the player is not left re-clicking a clue they have already disproved. FR-027d then
keeps that entity eligible, so a wrong guess costs the mistake and nothing else: three mistakes
never retire three of the eighteen cards, and every entity stays reachable through later rotations
or Next. This also means rotation reuses the FR-026c eligibility rule, so one predicate governs
both the Next control and the mistake rotation rather than two that can drift (R-025).

**Why Groups validates 1820 subsets.** Four tiles can satisfy two criteria at once, for example four
characters from one anime who share a voice actor and a language. Generation enumerates every
four-tile subset and rejects any board without exactly four singly-valid groups, so no submission is
ever right for the wrong reason (FR-037).

**Why no server state for attempts.** Attempts are validated against the stored puzzle only. This
keeps Principle IV intact. The consequence, that answers could be enumerated by a determined player,
is recorded as an accepted limit with no value at stake in v1 and no prizes or leaderboards to
protect (R-013).

**Why the current season can produce an error state.** The user chose the calendar season at play
time with no older-season substitution and no smaller grid. In the gap before the catalog covers a
new season, Match the Series shows the bilingual error state with retry rather than quietly serving
stale series or a thinner board (R-007, FR-030, EC-002). With a three-by-three grid the threshold is
nine series, and the catalog currently holds 114 for the season in play, so this is a genuine catalog
gap rather than an expected seasonal one.

## Test Plan (15 tests, the constitution cap)

| # | Test name | Proves |
|---|-----------|--------|
| 1 | home load lists three games with per-game status | FR-012, FR-013, SC-001 |
| 2 | today's more-or-less puzzle is served without the solution | FR-003, FR-009 |
| 3 | today's match-the-series puzzle is a 3x3 grid plus clue deck with no series key on any card | FR-003, FR-024, FR-024a, FR-029, R-019 |
| 4 | today's groups puzzle is served without the solution | FR-003, FR-031 |
| 5 | same game and day return an identical puzzle and create one row | FR-003, FR-004, FR-005, SC-002 |
| 6 | the day key is a UTC civil date that rolls over at 00:00 UTC | FR-002, FR-047 |
| 7 | a valid more-or-less attempt returns hit or miss and reveals both counts | FR-018, FR-021 |
| 8 | a valid match-the-series attempt returns hit for the clicked series, or a miss that discloses nothing below the limit and the full mapping when the game ends; a miss below the limit leaves the abandoned entity unretired | FR-025, FR-026, FR-027, FR-027a, FR-027d, SC-018 |
| 9 | a valid groups attempt returns hit with the criterion, or a miss with only the overlap count | FR-033, FR-034, FR-035a, SC-016 |
| 10 | an attempt naming a clue card or series outside the puzzle, or missing its clue card, is rejected as invalid and changes no counter | FR-039, FR-041, SC-007, R-020 |
| 11 | the client's finished-today state is per game and per UTC date, and a mid-game return resumes the same round or green tiles | FR-013, FR-042, FR-043a, SC-003, SC-004, SC-015 |
| 12 | a missing, malformed, or reset device store leaves the game playable from the start; a per-game reset clears only the target game's entry, the home reset clears all three games' entries while the language choice survives, and neither performs a network call | FR-043b, FR-049a, FR-049b, FR-052, FR-057, FR-057b, FR-057c, FR-058, SC-017, SC-023, SC-025, R-024 |
| 13 | an unreachable catalog returns a structured error, never a blank state | FR-050, FR-051, SC-008 |
| 14 | a current season with fewer than nine series yields an error state and stores no row | FR-030, EC-002 |
| 15 | generation issues only catalog SELECTs plus one insert into daily_puzzles | Principle I, R-016 |

No browser end-to-end tests. No stylesheet-text or markup-snapshot assertions. The attempt count is
client-side (FR-041), so tests 8, 9, and 12 assert the counter in the progress entry rather than in
an API response, and the API deliberately returns no attempt count.

Three requirements are covered by consolidated manual checks rather than new automated tests,
because the cap is spent: the home control's presence on every screen and its non-destructive
behavior (FR-056, SC-022) in quickstart check 18; the reset controls' absence from a production
build (FR-057a, FR-057c, SC-024) in quickstart check 19; and the mistake rotation's visible
behavior on screen (FR-027c, FR-027d, SC-026) in quickstart check 20. All three are rendering
conditions of a build flag, a shared component, and client-side card selection rather than server
data behavior, which is what the cap prefers to keep covered elsewhere. The testable part of the
rotation, that an abandoned entity is not retired, is asserted in test 12's storage assertions and
test 8's outcome assertions.

## Clarifications Incorporated

`/speckit.clarify` ran three times. The first session added five decisions and resolved the two
follow-ups listed in the previous revision of this plan; the second session, on 2026-10-05,
replaced the Match the Series board and added two controls; the third, later the same day, added the
home reset-all control and the mistake rotation. Artifacts updated:

| Clarification | Spec | Effect on this plan and its artifacts |
|---------------|------|--------------------------------------|
| Resume after a mid-game close | FR-043a, FR-043b, SC-015 | `useLocalProgress.ts` writes on every accepted answer; data-model §8.1; quickstart check 8 |
| Attempt count means all answers, not just wrong ones | FR-041 | `useAttemptCount.ts`; no attempt count in any API response (stateless server); data-model §8.1 |
| Groups reveals how many tiles share one group on a miss | FR-035a, SC-016 | `overlap` field computed from the stored solution; contracts `GroupsOutcome`; data-model §6 |
| Language detected from the browser, switch remembered | FR-049a, FR-049b, SC-017 | `useLocalPrefs.ts` and `useLocale.ts`; separate non-date-scoped storage entry, data-model §8.2 |
| Match the Series reveals nothing on a non-ending miss | FR-027a, SC-018 | `correctSeriesKey` only when the game ends; contracts `MatchTheSeriesOutcome`; data-model §5 |
| Under 2 seconds on a mid-range phone over 4G | SC-019 | Added to Performance Goals above |
| Grid is three by three, nine series, not nine by nine | FR-024, FR-028 | `MATCH_BOARD_SIZE` becomes 9; coverage threshold in FR-030 drops to nine series; R-007, data-model §5, contracts `MatchTheSeriesPuzzle`, quickstart check 16 |
| Clue card shows name plus one in-project placeholder | FR-029, SC-014 | CSS placeholder only, no catalog `image_url`; R-009 |
| Next is a free skip, not an attempt and not a mistake | FR-026b, SC-021 | Client-side advance through the served deck; no endpoint call; R-021, data-model §5 and §8.1 |
| Debug reset clears only the visitor's own device state | FR-057, FR-058, SC-023 | One per-game storage operation in `useLocalProgress.ts`, no fetch; R-022 |
| Debug reset is development-only | FR-057a, SC-024 | Rendered under the Nuxt development build flag; absent from a production bundle; R-022, quickstart check 19 |
| Every game screen has a control back to home | FR-056, SC-022 | New shared `GameHeaderControls.vue`; R-023, quickstart check 18 |
| Home page has one control that clears all three games' saved state, in the browser only | FR-057b, FR-057c, SC-025 | New `HomeResetControls.vue` plus one `resetAllGames` storage operation; no server route added, since deleting the day's row would regenerate the identical board (R-005); R-024, data-model §8.1, quickstart check 21 |
| A mistake rotates the clue card, and the abandoned entity stays in the pool | FR-027c, FR-027d, SC-026 | Rotation reuses the FR-026c eligibility predicate; the pool loses a card only on a correct answer; R-025, data-model §5 and §8.1, quickstart check 20 |

One defect surfaced while applying the language clarification: the original single date-scoped
storage blob would have reset the remembered language at every 00:00 UTC rollover. Progress and
preferences are now separate entries (§8.1, §8.2).

## Known work this revision invalidates

The implementation on this branch predates the 2026-10-05 session, so these files encode the old
two-grid design and must be rewritten rather than extended: `server/game/matchTheSeries.ts`,
`server/generators/matchTheSeries.ts`, `app/components/MatchGrid.vue`, and
`app/pages/game/match-the-series.vue`. The stored `daily_puzzles` rows for `match_the_series` are
already in the old shape; regeneration requires deleting those rows by hand, which is exactly the
manual step the new reset control does **not** cover, because FR-058 forbids it from touching the
server. That deletion stays a deliberate developer action during the rewrite.

## Next Steps

1. Regenerate tasks with `/speckit.tasks`. The existing `tasks.md` predates both 2026-10-05 sessions
   and must be replaced, not appended to: it still describes two four-by-four grids, a `tileKey`
   attempt body, and a whole-progress reset. Three task groups are new and have no existing work:
   the `HomeResetControls.vue` component and the `resetAllGames` storage operation (R-024), the
   mistake rotation in `MatchGrid.vue` and the game page's miss path (R-025), and quickstart checks
   20 and 21.
2. Two decisions are carried into `/speckit.tasks` as plan-level choices rather than clarified
   requirements: the mistake rotation picks any other eligible entity rather than advancing in stored
   deck order (both satisfy FR-027c), and the home reset uses the same two-step confirmation as the
   per-game control to match the existing UX.
3. No spec follow-ups remain. Re-run quickstart checks 4, 5, and 16 to 21 after implementation, since
   the recorded validation run predates this revision.