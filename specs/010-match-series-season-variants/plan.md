# Implementation Plan: Match the Series Seasonal Editions (Autumn, Spring, Summer 2026)

**Branch**: `010-match-series-season-variants` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-match-series-season-variants/spec.md`

## Summary

Make the season an explicit, user-facing part of Match the Series: rename the current-season game
to the Autumn 2026 edition, add Spring 2026 and Summer 2026 editions, and present all five games in
a responsive home grid with the current season first. Each edition is a full game identity with a
fixed season, its own daily puzzle, availability probe, route, and client-side saved state, while
reusing the existing Match the Series mechanics and the existing daily-puzzle pipeline. More or
Less and Groups are untouched, and no catalog write, schema change, or new dependency is needed.

## Technical Context

**Language/Version**: TypeScript, Node.js >= 22.18, Nuxt 3 (Vue 3) — existing.

**Primary Dependencies**: `nuxt`, `pg` (existing). No new dependency is introduced.

**Storage**: PostgreSQL. Existing owned table `daily_puzzles` (`game`, `puzzle_date`, `payload`,
`solution`) reused with no schema change; read-only catalog (`anime_seasons`, `anime`,
`voice_roles`, `people`, `characters`) reused. Client state stays in `localStorage` under
`animatch:v1:progress`.

**Testing**: Vitest for generation/routes/local progress; Playwright for viewport behavior.
Existing suites are updated for the new identities; the feature stays at or under the 15-test cap.

**Target Platform**: Standards-based web client plus the Node/Nuxt server; no install required for
the player.

**Project Type**: Web application (Nuxt single project with server routes and Vue pages).

**Performance Goals**: No new target; home page remains immediately usable and the feature adds no
extra network round trip per play.

**Constraints**: UTC-only day keys; deterministic one puzzle per edition per UTC day; stateless v1
(no accounts/sessions); every failure path remains bilingual and retryable; catalog is read-only;
all user-facing strings exist in Spanish and English.

**Scale/Scope**: 5 games on the home page (previously 3), 3 Match the Series editions, no new
tables, no new dependencies, one small CSS layout change.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / gate | How this feature satisfies it |
|------------------|-------------------------------|
| I. Read-Only Catalog Ownership | Editions only read catalog tables through the existing query module. No writes, DDL, indexes, or constraints; `import_state` / `import_runs` are never touched. No new table is required because `daily_puzzles.game` is free text. |
| II. API/UI Separation | The browser keeps calling `/api/daily` and `/api/daily/<game>/...`; no DB driver, credential, or query enters the UI. Fixed season mapping is server-side. |
| III. One Deterministic Puzzle per UTC Day | Each edition keeps the existing `(game, puzzle_date)` uniqueness and deterministic generation. The fixed season is an explicit generator input, never derived from the browser, locale, or timezone; the day key stays UTC. |
| IV. Stateless v1 | No login, session, or user store. Edition results and timers remain device-owned and now scope cleanly by game identity. |
| V. Fail Visible, Never Blank | Availability and errors are per edition and reuse the existing bilingual, retryable states. An unavailable edition never blanks the page. |
| VI. Lean Tests, Approved Dependencies | No new dependency. Tests are updated, not multiplied, and stay under 15; no stylesheet-text or snapshot assertions. |
| Naming & originality | Product remains "Animatch"; no forbidden token; names are original. |
| Bilingual UI | New and renamed strings are added to both `es` and `en` message catalogs from the first commit. |
| Delivery Model | Still browser-only, no install, no local DB requirement for players. |

**Result**: PASS. No violations; Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/010-match-series-season-variants/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── game-identities.md
│   └── home-layout.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
app/
├── assets/css/main.css                 # .game-list becomes a responsive grid
├── components/
│   ├── GameCard.vue                    # unchanged behavior; new identities resolve names/routes
│   └── MatchTheSeriesGame.vue          # NEW: extracted, game-identity-parameterized game body
├── composables/
│   └── useLocalProgress.ts             # sanitize drops unknown/removed game keys
├── i18n/
│   ├── en.ts                           # new edition names/summaries/help; neutral board copy
│   └── es.ts                           # same in Spanish
├── pages/
│   ├── index.vue                       # unchanged logic; renders the ordered listing
│   └── game/
│       ├── match-the-series-autumn-2026.vue    # NEW wrapper -> MatchTheSeriesGame
│       ├── match-the-series-spring-2026.vue    # NEW wrapper -> MatchTheSeriesGame
│       ├── match-the-series-summer-2026.vue    # NEW wrapper -> MatchTheSeriesGame
│       ├── match-the-series.vue                # REMOVED
│       ├── groups.vue                          # untouched
│       └── more-or-less.vue                    # untouched

server/
├── api/daily/[game].get.ts             # unchanged; accepts the new identities via isGameId
├── api/daily/[game]/attempt.post.ts    # unchanged; per-edition
├── api/daily/[game]/expire.post.ts     # unchanged; per-edition
├── catalog/queries.ts                  # unchanged reads
├── game/
│   ├── ids.ts                          # NEW identity union and accepted list
│   ├── listing.ts                      # per-edition fixed-season availability + order
│   ├── matchSeasons.ts                 # NEW: identity -> fixed { season, year } mapping
│   ├── matchTheSeries.ts               # existing types/flow reused
│   └── puzzleService.ts                # edition generator wiring uses the fixed mapping
└── generators/matchTheSeries.ts        # unchanged algorithm; receives the fixed season

tests/
├── generation.test.ts                  # updated identity + fixed-season generation check
├── routes/daily.get.test.ts            # updated identity list expectations
├── routes/puzzle.get.test.ts           # updated identity payload check
├── routes/attempt.post.test.ts         # updated identity
├── routes/expire.post.test.ts          # updated identity
└── local-progress.test.ts              # stale-key drop + per-edition isolation
```

**Structure Decision**: Single Nuxt project (existing). This feature touches the existing server
game layer, Vue pages/components, i18n catalogs, and one stylesheet; no new module or package is
added.

## Complexity Tracking

No constitution violations, so no entries.

## Phase 0 — Research (complete)

Artifacts: [research.md](./research.md). Resolved questions:
- Editions are full `GameId` identities, not a season parameter (R1).
- Fixed season comes from an identity lookup, never the UTC date (R2).
- No migration; `daily_puzzles.game` is reused (R3).
- Game body is extracted into one parameterized component; small wrappers keep routes static (R4).
- Home uses a CSS-only responsive grid with a single authoritative order (R5).
- Removed-key client state is sanitized away, not migrated (R6).
- Existing name/slug mechanism plus new i18n entries; neutral board wording (R7).

## Phase 1 — Design & Contracts (complete)

Artifacts:
- [data-model.md](./data-model.md) — unchanged table; fixed season mapping; client-state shape.
- [contracts/game-identities.md](./contracts/game-identities.md) — accepted identities, fixed
  seasons, routes, listing order, payload rules.
- [contracts/home-layout.md](./contracts/home-layout.md) — grid layout, ordering, per-card state,
  localization.
- [quickstart.md](./quickstart.md) — runnable validation scenarios V1–V7.

## Post-Design Constitution Re-check

| Gate | Post-design status |
|------|--------------------|
| Read-only catalog | PASS — reads only; no schema/migration. |
| API/UI separation | PASS — identities and season mapping stay server-side. |
| One deterministic puzzle per UTC day | PASS — fixed season is an explicit deterministic input; `(game, puzzle_date)` unchanged. |
| Stateless v1 | PASS — only client-side state, scoped per edition. |
| Fail visible | PASS — per-edition status keeps bilingual retryable states. |
| Lean tests / no new deps | PASS — dependency set unchanged; tests updated within the cap. |
| Bilingual UI | PASS — all new/renamed strings in both catalogs. |

**Result**: PASS. Ready for `/speckit.tasks`.
