# Quickstart: Match the Series Seasonal Editions (Autumn, Spring, Summer 2026)

## Prerequisites

- Node.js >= 22.18 and installed dependencies (`npm install`).
- A reachable Postgres catalog configured via `DATABASE_URL` in `.env` (the existing local setup).
- Repo root: `animatch/`.

## Setup

```bash
npm install
npm run db:migrate   # applies the existing game-table setup; no new migration is added
npm run dev
```

The app serves the home page at `http://localhost:3000/`.

## Automated checks

```bash
npm test               # Vitest: generation, routes, local progress
npm run test:viewport  # Playwright: home and game viewport behavior
```

Expected: the existing suites pass after being updated for the new identities, with the feature's
test count at or under 15 and no stylesheet-text or markup-snapshot assertions.

## Validation scenarios

Reference: [game-identities.md](./contracts/game-identities.md),
[home-layout.md](./contracts/home-layout.md), and [data-model.md](./data-model.md).

### V1 — Home lists five games in a grid, current season first

1. Open `/`.
2. Expect five cards: More or Less, then the three Match the Series editions in the order
   Autumn 2026, Spring 2026, Summer 2026, then Groups.
3. Expect the layout to place multiple cards per row on a desktop width and to stay readable with
   no horizontal scrolling on a phone width.

### V2 — Autumn 2026 edition uses only Autumn data

1. Open `/game/match-the-series-autumn-2026`.
2. Expect the title to name Autumn 2026.
3. Win or time out the game, then confirm every revealed series belongs to Autumn 2026.
4. Confirm the payload's `season` value matches the fixed mapping for the edition.

### V3 — Spring 2026 and Summer 2026 editions use only their own seasons

1. Open `/game/match-the-series-spring-2026` and, in a separate load,
   `/game/match-the-series-summer-2026`.
2. In each, confirm the title names the matching season and every revealed series belongs to it.
3. Confirm the `season` value returned for each edition equals its fixed mapping.

### V4 — Editions are independent

1. Finish the Autumn 2026 edition for the day.
2. Reload `/` and confirm only the Autumn 2026 card is marked finished; Spring and Summer are not.
3. Start the Spring 2026 edition and confirm it begins fresh with its own timer and board.
4. Use reset on the Spring edition and confirm the Autumn result is untouched.

### V5 — Availability is independent per edition

1. Point the app at a catalog where one edition's fixed season lacks enough matchable series
   (or otherwise make that probe fail).
2. Load `/`.
3. Expect only that edition to show unavailable/error; the other four games render normally and
   the page is not a total failure.

### V6 — Old saved state is ignored

1. In the browser, place a saved entry under the removed `match_the_series` key in
   `animatch:v1:progress`.
2. Load an edition.
3. Expect no error and a fresh game; reset-all clears the stale entry.

### V7 — Other games untouched

1. Open `/game/more-or-less` and `/game/groups`.
2. Expect them to behave exactly as before this feature.

## Expected outcomes summary

- Five games listed, current season first, grid layout usable at supported widths.
- Each edition plays end to end against only its fixed season, independent of the current date.
- Results, timers, reset, and share scope to one edition.
- Fail-visible states stay per edition; no blank or stuck page.
- All new strings present in Spanish and English.