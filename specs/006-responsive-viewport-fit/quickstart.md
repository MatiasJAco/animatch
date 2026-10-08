# Quickstart: Responsive Viewport Fit (No Page Scroll)

- **Feature**: specs/006-responsive-viewport-fit
- **Date**: 2026-10-08
- **Spec**: [spec.md](./spec.md) · **Data model**: [data-model.md](./data-model.md) ·
  **Contract**: [contracts/viewport-fit.md](./contracts/viewport-fit.md) ·
  **Research**: [research.md](./research.md) (decisions R-001…R-009)

This guide proves the feature end to end: the document never scrolls at the four target
viewports, nothing is clipped, and no width ≥768px overflows horizontally. Implementation details
live in `tasks.md` (from `/speckit.tasks`).

> **Superseded for the game screens by feature 007 (2026-10-08).** The board-first layout in
> `specs/007-board-first-layout` intentionally relaxes this feature's "no vertical scroll" rule for
> Groups, More or Less and Match the Series: the board is the first region, the status/how-to-play
> copy sits below the fold, and the gate now asserts **horizontal no-scroll only** on those screens.
> The four-size matrix, the resize sweep, the horizontal-overflow checks and both-locale coverage
> below still apply, and the home/error screens keep the locked frame.

## Prerequisites

- Node 22.18+ and PostgreSQL reachable at `DATABASE_URL` (the game screens need today's puzzle;
  without the DB the pages render their bilingual error state, which is itself part of the gate).
- `.env` with `DATABASE_URL` — gitignored, never committed (Constitution II).
- **`@playwright/test` is owner-approved (2026-10-08)** — dev-only, viewport checks only; no other
  dependency may be added (plan §Constitution Check, research R-006). It is pinned to **1.59.0**:
  the registry's latest (1.64.0) ships an ESM loader that returns a null `source` on Node 22.18+
  and cannot start a run here; 1.59.0 is the newest release that boots on this runtime.

## Setup

```sh
set -a; . ./.env; set +a          # load DATABASE_URL
npm install                        # adds @playwright/test to devDependencies (after approval)
npx playwright install chromium    # one-time browser download for the verification suite
npx nuxt dev                       # app on http://localhost:3000
```

## Automated gate (Playwright, ~6 tests, cap 15)

```sh
npm test                           # existing vitest suite stays green (no layout assertions exist)
npm run test:viewport              # e2e/viewport-fit.spec.ts — the directive's predicates
```

Expected outcomes (contract §3):

1. At **1920x1080, 1440x900, 1280x800, 1024x768**, on **home, match-the-series, groups,
   more-or-less, and the error page**, in every reachable state (loading, playing, attempt error,
   finished-session, finished-reloaded): `document.scrollingElement.scrollHeight === clientHeight`
   and `scrollWidth === clientWidth`.
2. Every P1 region (headers, board grids, action rows, result summary + share, error panel +
   retry) has its bounding box fully inside the viewport — nothing clipped, nothing reachable only
   by scrolling.
3. Resize sweep 1920→1024 (60px steps) and 1080→768 (48px steps): predicate 1 holds at every
   step, no scrollbar, no clipped element at any intermediate size.
4. Both locales (`es`, `en`) pass 1–3; longer Spanish strings wrap without horizontal overflow.

```sh
# single-viewport debugging, if the suite needs isolating:
npx playwright test e2e/viewport-fit.spec.ts --grep "1024x768"
```

## Manual gate (contingency only — e.g., an environment without a browser; research R-006)

`@playwright/test` is approved and is the gate; this procedure exists so a reviewer without the
suite can still check a build by hand.

1. `npx nuxt dev`, open `http://localhost:3000` in a browser.
2. For each viewport — 1920x1080, 1440x900, 1280x800, 1024x768 (devtools responsive mode) — visit
   home, each of the three games, and an unknown route (error page); drive each game to its
   finished state (use the dev-only **Reset** button to replay).
3. Paste into the console at each size/state:

   ```js
   const d = document.scrollingElement;
   ({ vOk: d.scrollHeight === d.clientHeight, hOk: d.scrollWidth === d.clientWidth,
      v: [d.scrollHeight, d.clientHeight], h: [d.scrollWidth, d.clientWidth] })
   ```

   Expected: `{ vOk: true, hOk: true }` everywhere.
4. Visually confirm every P1 region is on screen (no cut-off edges, retry/share/submit buttons
   visible) and drag-resize across the range watching for any scrollbar flash.
5. Repeat step 3 with the UI in English (language control on home).
6. Record results against SC-001…SC-005 in `checklists/requirements.md` notes.

## Measured fit at 1024x768 (the tightest supported viewport)

Measured 2026-10-08 with the automated gate (Playwright 1.59.0), after the owner's design
feedback (uncropped images, Next beside the clue, More-or-Less using its space) **and the second
design-feedback revision below**. Every state reports `document.scrollingElement.scrollHeight ===
clientHeight === 768` and `scrollWidth === clientWidth === 1024`. Board heights are rendered
`getBoundingClientRect` heights; the one P3 region shows scroll content → bounded viewport height.

| Screen / state | P1 board region (px) | P3 region (content → viewport) | Result summary |
|---|---:|---|---:|
| Home, normal | page 768, 3 cards | — | — |
| Match, playing | 3x3 grid 473 | — | — |
| Match, attempt error | 3x3 grid 302; ErrorPanel 172 | — | — |
| Match, loss in session | grid yields (0) to the list | `.reveal-list` 235 (auto-fit columns, scrolls) | 140 |
| Match, loss reloaded | 3x3 grid 333 | — | 140 |
| Groups, playing | 4x4 grid 524 | — | — |
| Groups, attempt error | 4x4 grid 343; ErrorPanel 172 | — | — |
| Groups, loss in session | 4x4 grid 297 (revealed rows inside the grid) | none (no scroller) | 140 |
| Groups, loss reloaded | 4x4 grid 406 (16 tiles; the reveal is transient) | — | 140 |
| More-or-Less, playing | comparison 453 (images [392, 392]) | — | — |
| More-or-Less, attempt error | comparison 272; ErrorPanel 172 | — | — |
| More-or-Less, loss + explanation | comparison 303 (images [230, 230]) | — | 521 |

## Inner-scroll exceptions (record here if granted)

Compression alone left the Match loss state taller than 768px, so the measurement-gated P3 exception
(research R-003, contract §2) is granted to exactly that region. Every pinned region — header, the
clue/Next row, action row, result summary + share — stays fully inside the viewport in the same
states (verified by the bounding-box gate). In the Match loss state the finished 3x3 grid yields its
height to the list; its (zero-height) box remains inside the viewport and the revealed pairings are
the content the player reads.

The former Groups `.group-rows` exception was **withdrawn** in the second design-feedback revision
(see below): discovered rows now sit inside the board grid and the board no longer scrolls.

| State | Region | Height before → after @1024x768 | Pinned regions verified visible |
|-------|--------|--------------------------------|--------------------------------|
| Match loss, in session | `.reveal-list` (18 entries, auto-fit columns) | content 727px → 235px scroller | header, clue + Next, result summary + share (all inside the viewport) |

## Second design-feedback revision (2026-10-08, owner review)

Owner review removed three rough edges; this invalidates the rows above that mention `.group-rows`
or a `ResultPanel` card:

- **Result card removed** — `ResultPanel.vue` renders inline as `.result-summary` (no card frame, no
  `You lost`/`You won` heading); the board's own reveal is the result. Applied to wins and losses.
- **Groups discovered rows inside the board grid** — a found/revealed group is a full-width row in
  `.grid-4x4`, taking the space its four tiles did; the `.group-rows` scroller is gone.
- **More or Less compared images equal height** — live board and loss explanation.

Re-measured at 1024x768 with the gate: Groups loss grid 297px, result summary 140px, no scroller;
More-or-Less live images `[392, 392]`, loss images `[230, 230]`; document `768×768` / `1024×1024`
(no scroll) in every state. `npm test` 48/48 and `npm run test:viewport` 6/6 pass. Full record:
[checklists/requirements.md](./checklists/requirements.md) → "Second design-feedback revision".

## Success-criteria mapping

| Criterion | How this guide verifies it |
|-----------|----------------------------|
| SC-001 — zero document scrollbars, all screens × states × 4 viewports | Automated gate 1 (or manual step 3) |
| SC-002 — 0 failures across the resize sweep | Automated gate 3 (manual: sampled drag-resize, step 4) |
| SC-003 — primary controls hittable without document scrolling | Automated gate 2 (bounding boxes) + manual visual pass |
| SC-004 — full round of each game at 1024x768 with zero document scroll events | Play each game once at 1024x768; the document cannot scroll by construction (locked shell) — confirm no content was unreachable |
| SC-005 — both locales fit, no truncated strings | Automated gate 4 / manual step 5 |

## Rollback

The change is presentation-only: reverting the commits restores the previous stylesheet and
removes `playwright.config.ts`, `e2e/`, and the devDependency. No data, API, or migration impact.
