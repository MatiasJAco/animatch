# Quickstart Validation: Responsive Home Game Catalog

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This guide proves the home catalog works end to end. It is a validation runbook, not an
implementation guide. Contracts live in [contracts/home-catalog-ui.md](./contracts/home-catalog-ui.md)
and [contracts/game-artwork.md](./contracts/game-artwork.md).

## Prerequisites

- Node.js 22.18 or newer
- PostgreSQL 13 or newer with the read-only catalog from `docs/catalog-schema.sql`
- A local `.env` containing `DATABASE_URL` (never commit it)
- Chromium installed for Playwright: `npx playwright install chromium`

## Setup

```bash
npm install
cp .env.example .env      # set DATABASE_URL
npm run db:migrate
npm run dev
```

Open `http://localhost:3000/`. The home page shows the five games.

## Manual Validation

### 1. Complete, stable catalog

1. Load the home page with a clean browser profile.
2. Confirm exactly five cards in this order: More or Less, Match the Series — Autumn 2026,
   Spring 2026, Summer 2026, Groups.
3. Reload. Confirm the order has not changed.

Expected: no missing, duplicated, or reordered game.

### 2. Uniform card size and artwork

1. At 1920x1080, visually compare all cards and use the browser inspector to check their bounding
   boxes.
2. Repeat at 1024x768, 768x1024, and 360x640.
3. Confirm every card has a small image in the same position and all five images are distinct.

Expected: every card has identical width and height at each viewport; no broken-image icon; the
last row's cards do not stretch to fill empty space.

### 3. Whole-card interaction

1. Hover a playable card. Confirm its surface colour changes and the pointer indicates a link.
2. Click the artwork, then the title, then a blank area of the card.
3. Confirm the matching game opens each time.
4. Confirm no Play button appears anywhere in the cards.

Expected: the whole card is the target and no separate action exists.

### 4. Finished card treatment

1. Finish one game, then return to the home page.
2. Confirm that card is greyed, shows "Finished today" (or "Terminado hoy"), and has no pointer
   cursor.
3. Hover it: no colour change.
4. Click it: no navigation.
5. Tab through the page: the finished card is skipped.

Expected: a finished card is unmistakably inert while the remaining games stay playable.

### 5. Unavailable and error cards

If the listing exposes a game with insufficient content or a database probe failure:

1. Confirm the affected card remains in the catalog.
2. Confirm it uses the inert surface, explains its state, and does not navigate.
3. Confirm the other cards remain playable.

Expected: a single game problem never blanks or disables the catalog.

### 6. Responsive and zoom behaviour

1. Resize continuously from 1920 down to 320 pixels.
2. Confirm the grid moves from three columns to two to one.
3. Confirm there is never a horizontal scrollbar or clipped text.
4. Set browser text size to 200% and repeat.

Expected: all cards remain equal and readable; only vertical scrolling is needed on smaller
screens.

### 7. Keyboard and assistive technology

1. Press Tab from the top of the page.
2. Confirm focus visits controls and playable cards in visual order.
3. Confirm playable cards show a visible focus ring and open with Enter or Space.
4. Confirm inactive cards never receive focus.
5. With a screen reader, confirm a playable card is announced as a link with its game name and
   summary, and a finished card is announced as static text including the finished state.

Expected: the catalog is fully operable without a pointer and the artwork does not create noise.

### 8. Language, theme, and artwork replacement

1. Switch from Spanish to English. Confirm every card updates without a reload.
2. Switch the operating system or browser between light and dark modes. Confirm card text and
   state treatments stay legible.
3. Replace `public/games/groups.svg` with a different 16:9 SVG and reload.
4. Confirm the Groups card shows the new image, all cards keep equal dimensions, and no code
   changed.
5. Temporarily rename the file and reload.

Expected: the new image appears; missing artwork shows the neutral fallback with unchanged card
geometry.

## Automated Validation

```bash
npm test
npm run test:viewport
```

`npm test` covers the artwork map/file contract and the four card presentation states without a
network or database.

`npm run test:viewport` boots Nuxt with the local database and covers:

- catalog completeness, order, equal card boxes, artwork loading, and no horizontal overflow at
  360x640, 768x1024, 1024x768, 1440x900, and 1920x1080;
- whole-card activation and the absence of Play buttons;
- playable hover, finished grey/inert behavior, and no finished-card navigation;
- keyboard link semantics and activation;
- missing-artwork fallback and 200% text zoom, including card-content fit;
- language switching without a reload, plus the 1920x1080 and 320-pixel layout checks;
- the pre-existing viewport-fit contract, including the 1920x1080 home no-scroll check.

Expected: all tests pass. The feature adds eight tests, staying within the project's test cap.

## Failure Triage

| Symptom | Check |
|---------|-------|
| Cards have different heights | All cards must use the same block-size token at the current breakpoint; no card may override height. |
| Horizontal scrollbar appears | Check the home width, grid gap/padding, and long unbroken text; verify at 320 px. |
| Play button still visible | Remove the in-card action; the card root itself must be the anchor. |
| Finished card still navigates | The finished state must render a non-interactive article with no href. |
| Image missing | Confirm the mapping path matches the file under `public/games/`; the fallback must still render. |
| Hover has no effect | Hover styling must apply to the playable anchor, not only an inner element. |
| Spanish text overflows | The card block size must fit the longer locale; recheck at 200% text size. |
