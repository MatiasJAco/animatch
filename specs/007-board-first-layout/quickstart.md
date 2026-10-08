# Quickstart: Board-First Game Page Layout

- **Feature**: specs/007-board-first-layout
- **Date**: 2026-10-08
- **Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) ·
  **Contract**: [contracts/game-shell.md](./contracts/game-shell.md) ·
  **Research**: [research.md](./research.md) (decisions R-001…R-008) ·
  **Data model**: [data-model.md](./data-model.md)

This guide proves the feature end to end: on all three game screens the board is the first content
under the header, the primary actions sit directly under the board, and the status/how-to-play copy is
below them (reachable by a normal vertical scroll). Implementation details live in `tasks.md`
(produced by `/speckit.tasks`).

## Prerequisites

- Node 22.18+ and PostgreSQL reachable at `DATABASE_URL` (the game screens need today's puzzle).
- `.env` with `DATABASE_URL` — gitignored, never committed (Constitution II).
- `@playwright/test` 1.59.0 is already installed (feature 006, dev-only). No dependency is added by
  this feature.

## Setup

```sh
set -a; . ./.env; set +a          # load DATABASE_URL
npm install
npx playwright install chromium    # one-time, if the browser is not present
npx nuxt dev                       # app on http://localhost:3000
```

## Automated gate (~6 Playwright tests + Vitest, cap 15)

```sh
npm test               # Vitest suite stays green (no behavior change)
npm run test:viewport  # e2e/viewport-fit.spec.ts — the board-first contract
```

Expected outcomes (contract §Required DOM order, §Header rule, §Scroll rule):

1. **Board-first order** on Groups, More or Less and Match the Series: the board region's top is above
   the `.game-meta` region's top, and no status/instruction node precedes the board.
2. **Actions under the board**: the primary action row (Clear/Propose; More/Fewer) renders after the
   board; Match has no action row and puts its status/help after the grid.
3. **Header alignment**: the title and the Home/Reset controls share one row with vertical centers
   within ≤2px at every supported width (1920x1080, 1440x900, 1280x800, 1024x768).
4. **Horizontal no-scroll, vertical scroll allowed**: `scrollWidth === clientWidth` on every screen;
   game screens may scroll vertically and every `.game-meta` string is reachable by scrolling.
5. **Board above the fold**: the board's top is inside the viewport and its primary controls are
   usable without scrolling.
6. **Freed space goes to the board (refined SC-002)**: at a fixed viewport the board is strictly
   taller than the `.game-meta` block, centered within 2px of the page center, and not clipped.
7. **Error visibility (refined FR-009)**: in the attempt-error state the error panel's top is inside
   the viewport (above the fold), its retry action is reachable without scrolling, and the panel is not
   inside `.game-meta`.
8. **Finished states**: the result summary / loss explanation sits below the board (scrolling allowed).
9. **Both locales** (`es`, `en`) pass 1–8; longer Spanish strings wrap without horizontal overflow.

```sh
# isolate one screen while iterating:
npx playwright test e2e/viewport-fit.spec.ts --grep "board-first"
```

## Manual validation

1. `npx nuxt dev`, open `http://localhost:3000`.
2. **Groups**: confirm the first thing under the header is the 4x4 grid; the Clear selection and
   Propose group buttons are directly below it; the mistakes bar, "Find groups of four that share a
   common criterion." and "Select four tiles" are below the buttons (scroll if needed).
3. **More or Less**: confirm the comparison is first; More/Fewer are directly below it; the round bar,
   the page help line and the in-board question are below the buttons.
4. **Match the Series**: confirm the clue + 3x3 grid is first; the mistakes bar and the page help line
   are below the grid.
5. The board is larger than before at the same window size (compare against the previous commit), is
   horizontally centered, and is fully on screen without scrolling; the copy is below the fold.
6. On More or Less and Match the Series, Home and Reset sit on the same row/height as the title,
   matching Groups.
7. Drag-resize 1024→1920px: no horizontal scrollbar at any width; the board stays centered.
8. Switch the UI to English and repeat 2–6.
9. Force an attempt error on each game (for example, stop the API) and confirm the error panel and its
   retry are visible without scrolling and are not part of the below-the-fold copy.

## Expected outcomes map

| Check | Evidence | Requirement |
|-------|----------|-------------|
| §2–4, §Manual 2–4 | board → actions → status/help order on each screen | FR-001..FR-004 (US1) |
| §6, §Manual 5, 7 | board taller than the displaced copy, centered, no horizontal overflow | FR-005, FR-007, SC-002 (US2) |
| §3, §Manual 6 | title and Home/Reset aligned on one row | FR-006 (US3) |
| §7, §Manual 9 | error panel + retry visible above the fold, out of `.game-meta` | FR-009 |
| §Manual 2–4, 8 | all strings present (moved, not removed) in both locales | FR-008, SC-005 |
| §9, §Manual 8 | both locales wrap, no horizontal overflow | SC-005 |

## Rollback

Presentation-only: reverting the commit restores the previous templates, stylesheet and e2e spec. No
data, API, migration, i18n, or dependency impact.
