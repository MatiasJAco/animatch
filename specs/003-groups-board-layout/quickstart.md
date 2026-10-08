# Quickstart: Groups Board Rows-Driven Layout

- **Feature**: specs/003-groups-board-layout
- **Date**: 2026-10-06
- **Spec**: [spec.md](./spec.md) · **Data model**: [data-model.md](./data-model.md) ·
  **Contract**: [contracts/openapi.yaml](./contracts/openapi.yaml) ·
  **Research**: [research.md](./research.md) (decisions R-001…R-012)

This guide proves the feature works end to end. It is a **validation/run guide** — implementation
details live in `tasks.md`. The automation half (pure row model) is the test suite; the
on-screen half (colors, rows, reveal) is the manual checks below, because no approved component
renderer exists (research R-003, R-009).

## Prerequisites

- Node 22+ and a PostgreSQL reachable at `DATABASE_URL` (for game-store reads/writes).
- `.env` with `DATABASE_URL` — gitignored, never committed (Constitution II).
- The day's catalog data already imported by the owning system (Constitution I).

## Setup

```sh
set -a; . ./.env; set +a          # load DATABASE_URL for the DB-backed tests
npm install                       # no new dependency is added by this feature
npm test                          # automated suite (includes the new groups-board tests)
npx nuxt build                    # production build sanity check
npx nuxt dev                      # play the game locally for the manual checks
```

## Automated checks

| Check | Command | Proves |
|-------|---------|--------|
| Row-model unit tests | `npm test` (file `tests/groups-board.test.ts`) | rows classify found vs revealed, one row per group, every tile exactly once, discovery/disclosure ordering, found keys never selectable, reload-restore input, and the reveal adds no selectable tiles — FR-001–FR-007, FR-008/SC-005 at the model level |
| Engine untouched | existing suite remains green (`tests/routes/attempt.post.test.ts` groups cases) | group detection, hit/miss/lost shapes, and consumed-key rejection are byte-identical — directive, contracts |
| i18n completeness | existing i18n test | any new row-heading message key exists in both `es` and `en` from the first change |

## Manual checks (browser, `npx nuxt dev` → Groups)

1. **Found row appears (FR-001, FR-002, SC-001)** — select four tiles that share a group and
   submit. Within a second the board shows one horizontal row with a green background containing
   exactly those four tiles, with the bilingual characteristic label at the row's left end.
   Repeat to reach a second found group: two green rows appear, in discovery order (R-005).

2. **Tiles leave the selection area (FR-003)** — after a found row exists, its tiles cannot be
   selected; proposals are restricted to the remaining tiles. A retry of an old invalid proposal
   never recruits a found tile (R-004).

3. **Loss reveal keeps found rows (FR-004–FR-006, SC-002, SC-003)** — find one group, then make
   the fifth mistake. The board stays visible (R-002): the found row is still there, still green,
   with its label unchanged, and the other three groups appear below as red rows, one per group,
   each with its characteristic label at the left. Every one of the 16 tiles appears in exactly
   one row.

4. **Loss on the very first mistake (edge case)** — clear progress, lose immediately: four red
   rows, no green row, no reset of anything.

5. **Win (edge case)** — find all four groups: the board shows four green rows and the result
   banner; there is no red reveal.

6. **Reload mid-game (FR-007, SC-004)** — find one group and reload the page: the green row is
   restored identically (same tiles, label, order) with no player action. Keep playing — selection
   behaves as in a session that never reloaded.

7. **Color is not the only signal (FR-008, SC-005)** — switch the locale between Español and
   English: every row's left-hand label reads in the active language, so a found vs revealed row
   is still identifiable without color.

8. **Engine unchanged (directive)** — the Groups mistake badge, overlap hint text on a wrong
   proposal, and the ending "game over" message behave exactly as before; only the layout of
   solved and revealed groups changed.

9. **Scope boundary (R-007, R-011)** — after a loss, the reveal rows are shown in that ending
   session (since feature 006's 2026-10-08 second design-feedback revision, as full-width rows
   inside the board grid rather than under a result banner); a reload of a finished lost game shows
   the board's original tiles plus the inline result summary (no stored reveal). This is intentional
   and out of scope to change.

## Expected outcome

All automated suites pass and manual checks 1–9 hold, establishing SC-001 through SC-006. The
feature is a success if a player can always identify what they found (green rows with labels),
and a loss always leaves the board fully rearranged into the day's four groups without disturbing
the green rows they earned.