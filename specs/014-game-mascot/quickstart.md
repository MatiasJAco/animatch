# Quickstart Validation: Game Screen Mascot

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This guide proves the mascot appears on the game screens, unchanged, and that it does not get in
the way of playing. It is a validation runbook, not an implementation guide. The rules live in
[contracts/game-mascot.md](./contracts/game-mascot.md); the home screen's own mascot rules live in
[contracts/home-mascot.md](../../013-home-artwork/contracts/home-mascot.md).

## Prerequisites

- Node.js 22.18 or newer
- PostgreSQL 13 or newer with the read-only catalog from `docs/catalog-schema.sql`
- A local `.env` containing `DATABASE_URL` (never commit it)
- Chromium installed for Playwright: `npx playwright install chromium`

No new tool, no new dependency and no artwork step: the mascot file is already committed and is
reused byte-for-byte.

## Setup

```bash
npm install
cp .env.example .env      # set DATABASE_URL
npm run db:migrate
npm run dev
```

Open `http://localhost:3000/` and pick a game. Matchi stands at the bottom inline-end corner of
the screen, exactly as it stands on the catalog page — same size, same corner.

## Manual Validation

### 1. The mascot follows the viewport on every game screen

1. Open each of the five game screens: More or Less, Groups, and the Spring 2026, Summer 2026 and
   Autumn 2026 editions of Match the Series.
2. At each screen, scroll to the top, the middle and the bottom of the page.
3. After each scroll, confirm Matchi is still at the bottom of the screen, fully visible, in the
   same place.
4. Widen and narrow the window (from 320 to 1920 pixels) and confirm Matchi re-anchors to the
   bottom corner of the new viewport.

Expected: the mascot does not move relative to the screen, is never cut off at the bottom or the
side, and never produces a horizontal scrollbar.

### 2. It is the same mascot everywhere

1. Open the home page and note the mascot's size and its corner.
2. Open each of the five game screens at the same window size.
3. Confirm the mascot has the same size and the same corner on each, and that it is the same
   drawing — no second image, no alternate pose.

Expected: the boxes match within a pixel. At 1440x900 the mascot measures 224x398 on every
screen; the full table is in `contracts/game-mascot.md` §5.

### 3. Every state carries it

1. On a game screen, open the developer tools and block the day's puzzle request, or let it fail
   in the network panel: the error panel with its retry appears — Matchi is still in the corner.
2. Play a round to the end: the result panel appears — Matchi is still in the corner.
3. Reload a screen whose game is already finished: Matchi is still in the corner.
4. Start a game while the connection is slow: the loading copy shows — Matchi is still in the
   corner.

Expected: the mascot is present in the loading state, the playing state, the finished state and
the puzzle-unavailable error state, and it never covers the retry button's click target.

### 4. It never gets in the way of playing

1. On a narrow window (360 pixels wide), find the tile that sits under the mascot.
2. Click that tile exactly where the mascot is drawn, and tap it on a touch device.
3. Press the More and Fewer buttons where the mascot overlaps them.
4. Tab through the whole screen with the keyboard only.
5. Compare the board and the header with the mascot present and with it removed (in the
   developer tools).

Expected: every control under the mascot still answers; the mascot takes no tab stop; the board
and the header are in exactly the same place with and without it; the page never scrolls sideways.

### 5. The known narrow-viewport cover

1. Set the window to 360x640 and open More or Less.
2. Scroll so that the board's bottom-right region is under the mascot.
3. Confirm the mascot may cover tile artwork, labels, counts, the More/Fewer buttons or the status
   copy there, and that the content is still in the layout — nothing is removed, hidden or
   truncated.
4. Scroll further and confirm the covered content comes out from under the mascot.

Expected: this overlap is **accepted**, not a defect. It is recorded in `contracts/game-mascot.md`
§9. What must never happen is a swallowed click, a layout change, a scrollbar or text that
disappears.

### 6. The mascot in both display modes and at 200% zoom

1. Switch the operating system between light and dark display mode and reload each game screen.
2. Set the browser's text zoom to 200% at 360 pixels wide.

Expected: in dark mode there is no white or opaque rectangle behind the mascot, and it is the
same drawing in both modes. At 200% zoom below roughly 1024 pixels the mascot overlaps text —
that is the limitation feature 013 recorded on 2026-11-13 and it carries over unchanged.

### 7. A failed mascot

1. Block the request for `/artwork/matchi-mascot.webp` in the developer tools.
2. Open each of the five game screens and play a round.

Expected: the game is fully playable, no broken-image indicator appears, no placeholder image is
requested, and the board and the header are unchanged.

### 8. The home screen is unchanged

1. Open the home page and compare the mascot's size, its corner and its behaviour with a build
   from before this feature.
2. Confirm the catalog still shows five cards, with the same sizes and the same links.

Expected: 0 differences. The home screen's mascot keeps the same file, the same rendered size,
the same corner and the same behaviour.

### 9. A browser that is not Chromium

1. Open a game screen in Firefox and in Safari, at 1440x900 and at 360x640.

Expected: the mascot is anchored to the viewport's bottom inline-end corner in each, exactly as in
Chromium. The home screen's mascot depends on `.home`'s `container-type: inline-size` not
establishing a containing block for fixed-position descendants — verified in Chromium, worth
confirming in the other engines. If another engine anchors the home mascot to `.home` instead of
the viewport, that is a pre-existing condition from feature 013, and it is recorded here rather
than changed, because FR-005 forbids changing what the home screen shows.

## Automated Validation

```bash
npm test
npm run test:viewport
```

`npm test` covers the asset contract, including the mascot file's own guarantees: 640x1137
pixels, a transparent background, at most 150 KB, smaller than its source and not a copy of it.
The file is unchanged by this feature, so this suite is unchanged too.

`npm run test:viewport` boots Nuxt with the local database and covers:

- the mascot present and visible on all five game screens in all four states (loading, playing,
  finished, error), and absent from a 404 route;
- the same rendered size, the same corner and the same image file on the home screen and on the
  five game screens, at 320x640, 360x640, 768x1024, 1024x768, 1440x900 and 1920x1080;
- no horizontal scrollbar from 320 to 1920 pixels, board and header geometry unchanged with and
  without the mascot, controls under the mascot still answering clicks, no focus stop and no
  animation;
- a failed mascot leaving all five game screens playable, with no broken-image indicator and no
  fallback request;
- the pre-existing board-first, viewport-fit and home-artwork contracts, unchanged, re-run with
  the mascot present.

Expected: all tests pass. The feature adds 4 new tests plus 1 updated existing file = 5, against
the project's test cap.

## Failure Triage

| Symptom | Check |
|---------|-------|
| The mascot is missing on a game screen | It must be mounted in `app/components/GameShell.vue`, outside the slot's state branches. A mount inside the board components disappears when the result panel replaces the board. |
| The mascot is a different size on the game screens | There must be one size rule. Band 2's margin term is the home screen's `55rem`; re-deriving it from the game screens' `46rem` column makes the mascot larger there. The bands are in `contracts/game-mascot.md` §5. |
| The mascot is not in the viewport's corner | It must be `position: fixed` with `inset-block-end: 0` and `inset-inline-end: 0`, and it must not sit inside an ancestor that establishes a containing block for fixed descendants (`contain: layout`, `transform`, `filter`, `will-change`). See `contracts/game-mascot.md` §4. |
| A click under the mascot does nothing | The wrapper needs `pointer-events: none`. |
| The mascot scrolls away with the page | It must be `position: fixed`, not absolute or sticky. |
| The mascot shifts the board when it loads | The box must be sized by CSS (`inline-size` plus `aspect-ratio`) and the image must carry `width` and `height`. |
| The mascot is missing in one state only | It must be rendered by the frame, outside every `v-if` / `v-else` of the slot, not by a state branch. |
| The mascot appears on the error page | The error page is a separate Nuxt root; the mascot must be mounted in the game frame, not in `app.vue`. |
| A white rectangle shows around the mascot in dark mode | The asset lost its alpha channel — but the asset is unchanged by this feature, so check that the file in `public/artwork/` is the committed one. |
| The home screen's mascot moved | The home page must keep `<Mascot />` inside `<main class="home">`, in the same position as before. The home screen's rendering must not change (0 differences). |
