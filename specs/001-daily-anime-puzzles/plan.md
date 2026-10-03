# Implementation Plan: Daily Anime Puzzles (v1)

**Branch**: `feat/sdd-inicial` | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

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
a playable puzzle in under 2 seconds in at least 95% of measurements (SC-019). Puzzles already
generated for today are served from a single row read. First-request generation is a one-off cost
per game per day and must not block other requests.

**Constraints**: UTC is the only timezone (R-007, R-014). The browser's timezone is used for display
only. No login, no session, no server-side player state. No secrets in the repository. No writes or
DDL against catalog tables. No image request to any host but this one. Original copy and assets
only.

**Scale/Scope**: Three games, three server routes plus one home route and three game routes, one
new table, at most 15 automated tests. Four pages. No user management, no history, no streaks, no
archive, no timed mode, no favorites ranking.

## Constitution Check

Re-checked against constitution v2.1.0. All gates pass.

| Principle / rule | How the plan satisfies it |
|---|---|
| I. Read-Only Catalog Ownership | Hand-written `SELECT`s only, one central catalog module, no ORM or query builder, no migration tool pointed at the catalog (R-008, R-016). One migration creating `daily_puzzles` only (R-018). `import_state` and `import_runs` appear nowhere in the plan or the code |
| II. API/UI Separation | Nitro server routes are the only database path; the browser receives JSON over HTTP and never holds a driver, connection string, or query. `DATABASE_URL` read from the environment, `.env` gitignored, `.env.example` carries an empty placeholder only |
| III. One Deterministic Puzzle per UTC Day | Day key derived in UTC from the server clock (R-014). Seed is `sha256(game:date)` with primary-key ordering on all catalog reads (R-004). Create-once inside a transaction, then re-read the persisted row (R-005). Browser timezone used only for display |
| IV. Stateless v1 | No login, no session, no user table, no history table. Attempts are validated against the stored puzzle alone (R-012). Result and in-progress progress live in browser storage (R-015) |
| V. Fail Visible, Never Blank | Structured error envelope with stable codes and a client-side bilingual message catalog (R-017). Per-game availability on the home listing so one unavailable game never blanks the page. No empty `catch` on any fetch path; SC-008 makes it a defect |
| VI. Lean Tests, Approved Dependencies Only | Exactly 15 tests named below. `nuxt`, `pg`, `vitest` named and approved before writing the plan; no fourth dependency. No stylesheet-text or markup-snapshot assertions. No essay comments in source |
| Naming and Originality | Original names, copy, and layout. The prohibited token appears in no name, route, or message key. No external asset, no hotlinked image (R-009) |
| Bilingual UI | One message catalog with `es` and `en`, no locale variant pinned, no region or timezone setting. The browser's language is detected on first visit, a visible control switches language immediately, and the explicit choice is stored outside the date-scoped progress entry so it survives the daily rollover (FR-048, FR-049, FR-049a, FR-049b) |
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
├── quickstart.md        # Phase 1: setup, run command, 15 manual validation checks
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
│   ├── matchTheSeries.ts
│   └── groups.ts
├── generators/
│   ├── moreOrLess.ts                  # Chain of 11 with adjacent counts unequal
│   ├── matchTheSeries.ts              # Current season, 16 tiles, 16 series
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
│   ├── MoreOrLessBoard.vue
│   ├── MatchGrid.vue                  # Two 4x4 grids, CSS placeholder tile art
│   ├── GroupsBoard.vue
│   ├── ResultPanel.vue                # Won/lost summary and spoiler-free share text
│   ├── ShareButton.vue                # Platform share with manual-copy fallback
│   ├── ErrorPanel.vue                 # Bilingual message with retry action
│   └── CountdownBadge.vue             # Next rollover, rendered in browser timezone
├── composables/
│   ├── useDailyPuzzle.ts              # Fetch + state per game, refetch on UTC date mismatch
│   ├── useLocalProgress.ts            # animatch:v1:progress, date guard, resume
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
                                       # cleared storage, language choice survives rollover

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
| [research.md](./research.md) | 18 decisions with rationale and rejected alternatives: driver, test runner, no second table, seeding, create-once transaction, novelty signature, season identity and mapping, column allow-list, placeholder tiles, round structure and hidden counts, Groups uniqueness, invalid attempts, answer enumeration as an accepted limit, SSR day handling, client resume state, read-only enforcement, error contract, migration mechanics |
| [data-model.md](./data-model.md) | `daily_puzzles` definition and lifecycle, per-game `payload` and `solution` shapes, client state blob, validation rules, state transitions, relationships |
| [contracts/openapi.yaml](./contracts/openapi.yaml) | OpenAPI 3.1 for the three routes, with the error envelope, per-game request and response schemas, and worked examples |
| [quickstart.md](./quickstart.md) | Prerequisites, `npm install`, `npm run db:migrate`, `npm run dev`, `npm test`, and 15 manual checks each tied to a success criterion |

## Key Design Points

**Why one transaction and a re-read.** Two visitors arriving together on a fresh day both generate.
Only one insert survives the primary key, and both then re-read the same row, so identical puzzle
content for everyone is guaranteed by construction rather than by luck (R-005).

**Why answers are not in the payload.** More or Less sends one visible role count and withholds the
other ten; Match the Series never sends an anime id on a left tile; Groups never sends criterion
fields. The attempt response is the only disclosure path, which is what makes hidden counts, correct
pairings, and criteria work at all (R-010, R-011).

**Why Groups validates 1820 subsets.** Four tiles can satisfy two criteria at once, for example four
characters from one anime who share a voice actor and a language. Generation enumerates every
four-tile subset and rejects any board without exactly four singly-valid groups, so no submission is
ever right for the wrong reason (FR-037).

**Why no server state for attempts.** Attempts are validated against the stored puzzle only. This
keeps Principle IV intact. The consequence, that answers could be enumerated by a determined player,
is recorded as an accepted limit with no value at stake in v1 and no prizes or leaderboards to
protect (R-013).

**Why the current season can produce an error state.** The user chose the calendar season at play
time with no older-season substitution. In the gap before the catalog covers a new season, Match the
Series shows the bilingual error state with retry rather than quietly serving stale series (R-007,
FR-030, EC-002).

## Test Plan (15 tests, the constitution cap)

| # | Test name | Proves |
|---|-----------|--------|
| 1 | home load lists three games with per-game status | FR-012, FR-013, SC-001 |
| 2 | today's more-or-less puzzle is served without the solution | FR-003, FR-009 |
| 3 | today's match-the-series puzzle is served without the solution | FR-003, FR-024 |
| 4 | today's groups puzzle is served without the solution | FR-003, FR-031 |
| 5 | same game and day return an identical puzzle and create one row | FR-003, FR-004, FR-005, SC-002 |
| 6 | the day key is a UTC civil date that rolls over at 00:00 UTC | FR-002, FR-047 |
| 7 | a valid more-or-less attempt returns hit or miss and reveals both counts | FR-018, FR-021 |
| 8 | a valid match-the-series attempt returns hit, or a miss that discloses nothing below the limit and the pairing when the game ends | FR-025, FR-026, FR-027a, SC-018 |
| 9 | a valid groups attempt returns hit with the criterion, or a miss with only the overlap count | FR-033, FR-034, FR-035a, SC-016 |
| 10 | an attempt naming an entity outside the puzzle is rejected as invalid and changes no counter | FR-039, FR-041, SC-007 |
| 11 | the client's finished-today state is per game and per UTC date, and a mid-game return resumes the same round | FR-013, FR-042, FR-043a, SC-003, SC-004, SC-015 |
| 12 | a missing or malformed device store leaves the game playable from the start, and the language choice survives a date rollover | FR-043b, FR-049a, FR-049b, FR-052, SC-017 |
| 13 | an unreachable catalog returns a structured error, never a blank state | FR-050, FR-051, SC-008 |
| 14 | insufficient current-season coverage yields an error state and stores no row | FR-030, EC-002 |
| 15 | generation issues only catalog SELECTs plus one insert into daily_puzzles | Principle I, R-016 |

No browser end-to-end tests. No stylesheet-text or markup-snapshot assertions. The attempt count is
client-side (FR-041), so tests 8, 9, and 12 assert the counter in the progress entry rather than in
an API response, and the API deliberately returns no attempt count.

## Clarifications Incorporated

`/speckit.clarify` added five decisions and resolved the two follow-ups listed in the previous
revision of this plan. Artifacts updated:

| Clarification | Spec | Effect on this plan and its artifacts |
|---------------|------|--------------------------------------|
| Resume after a mid-game close | FR-043a, FR-043b, SC-015 | `useLocalProgress.ts` writes on every accepted answer; data-model §8.1; quickstart check 9 |
| Attempt count means all answers, not just wrong ones | FR-041 | `useAttemptCount.ts`; no attempt count in any API response (stateless server); data-model §8.1 |
| Groups reveals how many tiles share one group on a miss | FR-035a, SC-016 | `overlap` field computed from the stored solution; contracts `GroupsOutcome`; data-model §6 |
| Language detected from the browser, switch remembered | FR-049a, FR-049b, SC-017 | `useLocalPrefs.ts` and `useLocale.ts`; separate non-date-scoped storage entry, data-model §8.2 |
| Match the Series reveals nothing on a non-ending miss | FR-027a, SC-018 | `correctSeriesKey` only when the game ends; contracts `MatchTheSeriesOutcome`; data-model §5 |
| Under 2 seconds on a mid-range phone over 4G | SC-019 | Added to Performance Goals above |

One defect surfaced while applying the language clarification: the original single date-scoped
storage blob would have reset the remembered language at every 00:00 UTC rollover. Progress and
preferences are now separate entries (§8.1, §8.2).

## Next Steps

1. Derive tasks with `/speckit.tasks`. No spec follow-ups remain.