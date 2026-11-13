# Quickstart Validation: Home Page Character Artwork

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This guide proves the home artwork works end to end. It is a validation runbook, not an
implementation guide. The asset rules live in
[contracts/artwork-assets.md](./contracts/artwork-assets.md) and the mascot rules live in
[contracts/home-mascot.md](./contracts/home-mascot.md).

## Prerequisites

- Node.js 22.18 or newer
- PostgreSQL 13 or newer with the read-only catalog from `docs/catalog-schema.sql`
- A local `.env` containing `DATABASE_URL` (never commit it)
- Chromium installed for Playwright: `npx playwright install chromium`
- Python 3.11 or newer with Pillow 12.x, only to regenerate or re-check the artwork:
  `python3 -m pip install "Pillow>=12,<13"`. The app, the tests, the build, and the deployment do
  not need it — the processed assets are committed files.

## Setup

```bash
npm install
cp .env.example .env      # set DATABASE_URL
npm run db:migrate
npm run dev
```

Open `http://localhost:3000/`. The home page shows the five games, the three seasonal editions
carry their themed artwork, and Matchi stands at the bottom corner of the screen.

## Artwork Checks

```bash
python3 scripts/artwork/build.py     # regenerate the processed assets from artwork/sources/
python3 scripts/artwork/check.py     # verify every shipped asset against its source
python3 scripts/artwork/check.py --rebuild   # regenerate into a temp dir and compare bytes
```

Expected: the build prints five assets with their dimensions and byte sizes; the check reports
that every shipped asset exists, is smaller than its source, is not a copy of it, meets its size
ceiling, and — with `--rebuild` — is byte-identical to what the committed sources produce.

## Manual Validation

### 1. The mascot follows the viewport

1. Load the home page.
2. Scroll to the top, the middle, and the bottom of the catalog.
3. After each scroll, confirm Matchi is at the bottom of the screen, fully visible, in the same
   place.

Expected: the mascot does not move relative to the screen, and it is never cut off at the bottom
or the side.

### 2. The mascot never covers text or swallows a click

1. Look at the card nearest the mascot. Confirm its name, summary, and state text are fully
   readable.
2. Click that card exactly where the mascot is.
3. Switch to Spanish and English and repeat.

Expected: no card text is hidden behind the mascot, and the click opens the game. This check runs
at the default text size; §6 records the accepted overlap at 200% text zoom.

### 3. The mascot in both display modes

1. Switch the operating system or browser between light and dark mode.
2. Look at the mascot's surroundings.

Expected: no white or light rectangle around the character in dark mode; the white coat is still
white, and the character's outline is intact.

### 4. The seasonal cards

1. Compare the three Match the Series cards: Spring, Summer, and Autumn 2026.
2. Confirm each shows its own season — blossoms, a bright shore, red foliage — with the
   character's face visible and nothing stretched.
3. Confirm the More or Less and Groups cards keep their original geometric artwork.
4. Use the browser inspector to compare the three seasonal images' pixel sizes.

Expected: the three images are visibly different from one another and from the other two cards,
each is 800x450, and no card's size changed.

### 5. Artwork failure

1. Block the request for `/artwork/matchi-mascot.webp` in the browser's network panel and reload.
2. Block one seasonal image as well and reload.
3. Confirm the catalog still shows five cards, the blocked seasonal card shows the neutral
   placeholder at the same size as its siblings, and no broken-image icon appears anywhere.

Expected: the page is completely usable and the blocked artwork is simply absent.

### 6. Resize and zoom

1. Resize the window continuously from 1920 down to 320 pixels.
2. Confirm there is never a horizontal scrollbar.
3. Set the browser text size to 200% and repeat.
4. At 200% text zoom, confirm the mascot is still entirely inside the viewport, that all five
   cards still measure the same width and height, and that the page still shows no horizontal
   scrollbar.
5. At 200% text zoom and a viewport narrower than about 1024 pixels, look at the card nearest the
   mascot and note whether a wrapped line of the card's summary text reaches the corner the
   mascot occupies.

Expected: the mascot's size follows the viewport, not the text size — it does not grow when the
text is enlarged. At 200% text zoom the mascot stays inside the viewport, the cards stay the same
size, and the page never scrolls sideways.

**Accepted outcome at 200% text zoom**: below about 1024 pixels the mascot overlaps card text,
because a wrapped card-summary line reaches the corner the mascot occupies and no single size
token is both wide enough to be legible at 320 pixels and narrow enough to clear the text at 480
pixels. The project owner accepted this overlap on 2026-11-13 as a documented limitation for this
rare condition, so it is **recorded here, not treated as a failed check**. At the default text
size no card text is covered at any tested viewport. The limitation is recorded in `spec.md`
(SC-022, the 200% edge case, the assumption, and the Clarifications bullet), `plan.md`
§Verification, and `contracts/home-mascot.md` §5.

### 7. The source artwork stays private

1. Request `http://localhost:3000/artwork/sources/matchi-spring.jpg` in the browser.

Expected: 404. The source artwork is committed to the repository but is not served.

### 8. The seasonal artwork is recognizable

This is a manual study run by the project owner before release. It is not part of the automated
test suite, and no automated test asserts it.

1. Show the home page to 10 visitors who have not seen it before, without naming the seasons.
2. Show each visitor the three seasonal cards one at a time and ask which season each one shows.
   Start the stopwatch when the card appears and stop it when the visitor answers.
3. Record, per visitor, which cards they named correctly and how long each answer took.
4. Write the tally into "Recognition study result" below.

Expected: at least 8 of the 10 visitors name the correct seasonal edition from its card artwork
alone in under 5 seconds.

#### Recognition study result

- Date:
- Run by:
- Visitors who named the correct seasonal edition from the artwork alone in under 5 seconds:
  \_\_\_ / 10
- Notes:

## Automated Validation

```bash
npm test
npm run test:viewport
```

These commands cover every requirement except the recognition study in §8, which is run manually by
the project owner and recorded in this guide.

`npm test` covers the asset contract (sources committed and unserved, one source per asset, every
asset smaller than its source, the 800x450 and 90 KB rules for the seasonal images, the 640x1137
transparent mascot and its 150 KB rule, the 450 KB page budget, and the reserved winter asset)
and the per-game artwork map for vector and raster artwork alike. It needs no network, no
database, and no image library.

`npm run test:viewport` boots Nuxt with the local database and covers:

- the mascot inside the viewport at the top, middle, and bottom scroll positions, within its size
  shares, at 320x640, 360x640, 768x1024, 1024x768, 1440x900, and 1920x1080;
- no card text covered by the mascot at the default text size, and a card under the mascot still
  opening its game;
- no new focus stop, no animation, and no change to the catalog's width or the page's scroll
  behaviour;
- the mascot and a seasonal image failing to load: the catalog stays complete, the placeholder
  appears at the same size, no broken-image indicator appears, the two seasonal images that were
  not blocked and the two unchanged illustrations are still requested, and the home page never
  requests the reserved winter asset;
- the pre-existing home-catalog and viewport-fit contracts, unchanged.

Expected: all tests pass. The feature adds 7 new tests plus 1 updated existing file = 8, against
the project's test cap.

## Failure Triage

| Symptom | Check |
|---------|-------|
| The mascot covers a card's text | The mascot must sit in the bottom inline-end corner. Lower the token of the band that fails — band 1 (320px–1023px) or band 2 (1024px and wider) — rather than moving the mascot over text; the bands and their values are in `contracts/home-mascot.md` §3 and §5. At 200% text zoom below about 1024 pixels the overlap is an accepted limitation, not a regression: see §6 and `contracts/home-mascot.md` §5. |
| A click under the mascot does nothing | The wrapper needs `pointer-events: none`. |
| The mascot scrolls away with the page | It must be `position: fixed`, not absolute or sticky. |
| The mascot flickers or shifts when it loads | The box must be sized by CSS (`inline-size` plus `aspect-ratio`) and the image must carry `width` and `height`. |
| A white rectangle shows around the mascot in dark mode | The asset lost its alpha channel; rebuild it with the stacked border flood. |
| A seasonal card shows a broken image | The mapping in `app/utils/gameArt.ts` must match the file name in `public/games/`. |
| The winter image appears on a card | The winter asset must stay unmapped; only the three existing editions are mapped. |
| The asset check says an asset is not smaller than its source | Re-encode it: the budget is a ceiling, but the source comparison is the binding rule. |
| `scripts/artwork/build.py` fails to import Pillow | Install it: `python3 -m pip install "Pillow>=12,<13"`. The app itself does not need it. |
