# Implementation Plan: Home Page Character Artwork

**Branch**: `013-home-artwork` | **Date**: 2026-11-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-home-artwork/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Give the home page the product's character: Matchi appears as a persistent decorative element
anchored to the bottom edge of the viewport, and the three Match the Series cards carry themed
seasonal artwork instead of abstract geometric art.

Both pieces of artwork are produced by one build-time step. The five supplied source images are
committed to `artwork/sources/` (a directory the app never serves), and one named tooling pair —
**Python 3 with Pillow 12.x**, run through `scripts/artwork/build.py` and
`scripts/artwork/check.py` — resizes, crops, composes, mattes, and compresses them into the five
processed assets the app ships: three 800x450 seasonal card images, one 640-pixel-wide mascot with
a transparent background, and one winter image kept on disk for a future edition. Neither script is
part of the app: no npm dependency is added, and the processed assets are committed. The tooling
pair is named here for the project owner's approval, and that approval is captured in writing by
the feature's tasks before any script that imports Pillow is written or run — it is a recorded
step, not an assumption.

The app changes in three small places: `app/utils/gameArt.ts` points the three seasonal games at
their new raster files, a new `app/components/HomeMascot.vue` renders the mascot on the home page
only, and `app/assets/css/main.css` gains the mascot's fixed-position rules. Nothing else moves:
the catalog order, the card geometry, the routes, the daily content, the message catalogs, and the
dependency list are all untouched, and no user-facing string is added.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22.18 or newer (Nuxt 3 / Vue 3 single project) for
the app. Python 3.11 or newer with Pillow 12.x for the one-off artwork build and check scripts —
build-time only, never imported by the app, the server, or the test suite.

**Primary Dependencies**: Nuxt 3, Vue 3, `pg` (server-only), Vitest 5, Playwright 1.59 — all
unchanged. **No npm package is added.** The only new tool is Pillow, used exclusively by the
build-time scripts under `scripts/artwork/`; it is named here and approved by name before use,
as FR-033 and Constitution VI require. The approval is **captured by the feature's tasks**, not
assumed: task T002 in `tasks.md` records the project owner's written approval of "Python 3 with
Pillow 12.x" in this plan (§Constitution Check, Gate VI) and in `research.md` R-002, and it is a
blocking prerequisite for every task that imports Pillow (T006, T007, T008). The processed
assets are committed, so the app never needs Pillow to build, run, or deploy.

**Storage**: No database change. The existing read-only catalog and the app-owned `daily_puzzles`
table are untouched, and results stay in the visitor's browser storage. The feature adds two
static, committed file trees: `artwork/sources/` (project record, never served) and the processed
assets under `public/games/` and `public/artwork/` (served from the site origin).

**Testing**: Vitest for the asset contract (sources, sizes, dimensions, transparency, budgets) and
the artwork map; Playwright for the rendered mascot (placement, clearance, click-through, failure
fallback) and the seasonal images. Commands: `npm test`, `npm run test:viewport`, plus the
developer-run `python3 scripts/artwork/check.py`.

**Target Platform**: Server-rendered web app in evergreen browsers (WebP and alpha WebP are
supported by every current evergreen engine); widths from 320 to 1920 pixels; Spanish and English;
light and dark display modes.

**Project Type**: Full-stack Nuxt web application (`app/` browser code, `server/` API and data
access, `public/` static assets) plus one build-time Python tool.

**Performance Goals**: Home-page artwork download of at most 450 KB — the measured set is about
125 KB (124,921 bytes including the two unchanged illustrations); no layout shift when the mascot
or a card image loads; no extra network request beyond the four new image files; no scroll
listeners, observers, or runtime measurement for the mascot (pure CSS positioning).

**Constraints**: Constitution v3.0.0 (read-only catalog, API/UI separation, UTC day, stateless
client results, fail-visible, approved dependencies, bilingual UI, delivery model). Per-asset
ceilings of 90 KB for a seasonal image and 150 KB for the mascot; every shipped asset must also be
smaller in bytes than the source it derives from. No external host, font, or script. The mascot
reserves no layout space, intercepts no pointer input, adds no focus stop, and never animates.

**Scale/Scope**: Five committed source files, five processed assets, one new component, one CSS
block, one three-line mapping change, two build-time scripts, three new test files (two test
suites plus one dependency-free header helper) and one updated test file — 7 new tests plus 1
updated existing file = 8, against the 15-test cap. No server-side, API, or schema change.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|------|--------|----------|
| I. Read-Only Catalog Ownership | PASS | No catalog query, write, migration, DDL, or `import_state`/`import_runs` access. The feature touches only static files and browser presentation. |
| II. API/UI Separation | PASS | The cards keep consuming the existing `/api/daily` payload. No database driver, credential, or query is added to browser code. The mascot is a static image with no data dependency. |
| III. One Deterministic Puzzle per UTC Day | PASS | Daily content and day selection are unchanged. The artwork is static and identical for every visitor, on every locale and every UTC day (FR-034), so it cannot influence or be influenced by the day key. |
| IV. Stateless v1 | PASS | No account, session, cookie, or server-side player record. The mascot is decorative and carries no state. |
| V. Fail Visible, Never Blank | PASS | A failed mascot or card image falls back to the existing neutral placeholder pattern already used by `GameArt.vue`: the image element is removed, the frame size is kept, and no broken-image icon appears. The catalog, its links, and the listing error panel with retry are untouched. A decorative asset that fails to load therefore degrades to the existing neutral placeholder with the catalog intact — the same failure-visibility contract `GameArt.vue` already implements for card artwork — while this gate's obligation applies to the data paths (the listing, its error panel, and its retry action), which this feature does not touch. |
| VI. Lean Tests, Approved Dependencies | PASS | No npm dependency is added. The new tooling is Pillow, named in this plan and confined to build-time scripts that no test imports; its use is approved by name in writing before the first script that imports it runs — the approval is captured by task T002 in `tasks.md` and recorded in this row and in `research.md` R-002, so it is a recorded step, not an assumption. Feature tests: 7 new (3 Vitest + 4 Playwright) plus 1 updated existing file (`tests/game-art.test.ts`) = 8, against the 15-test cap; they assert geometry, file facts, and rendered behavior, never stylesheet source text or markup snapshots. | The artwork tooling approval is on record: Approved by the project owner on 2026-11-13: "Python 3 with Pillow 12.x" is approved as the artwork build-time tooling for feature 013-home-artwork. It is a build-time tool only: it is not added to package.json dependencies or devDependencies, it is not imported by app/, server/, tests/ or e2e/, and the processed assets are committed so the app never needs it to build, run or deploy. Toolchain verified on the developer machine: Python 3.14.7 with Pillow 12.3.0.
| Additional: Bilingual UI | PASS | No new user-facing string. The mascot and the seasonal images carry no text, so `app/i18n/en.ts` and `app/i18n/es.ts` stay complete and unchanged (FR-029, SC-016). |
| Additional: Originality and Naming | PASS | Constitution v3.0.0 removed the asset-origination and licensing bullet, so the supplied artwork may be used; the rule that remains in force — branding, copy, layout, visual structure, and assets MUST NOT be copied from Futbol11 or any other puzzle site — is satisfied affirmatively: the supplied artwork is the project owner's own original artwork, created for this product, its provenance is the owner, and the feature copies nothing from any third-party site. The feature adds no forbidden token, references no external host (FR-030). |
| Additional: Delivery Model | PASS | Plain browser client; no native build, no mandatory toolchain for a player, no new external origin. Pillow is required only by a developer running the artwork script, and the processed assets are committed. |

**Result**: All gates pass. No complexity tracking entry is required. Gate VI's approval is a
recorded step of the feature's tasks (T002) that must complete before the first Pillow script
runs; it is not assumed here.

## Design Approach

### Source artwork and tooling

- The five supplied files are committed verbatim to `artwork/sources/`, keeping the delivered
  names: `matchi-board.png`, `matchi-spring.jpg`, `matchi-summer.jpg`, `matchi-autumn.jpg`,
  `matchi-winter.jpg`. The repository root is outside the served `public/` directory, so a
  visitor can never request a source file (FR-022, SC-011).
- `matchi-board.png` is the one trap in the set: it carries JPEG data under a `.png` name. The
  tooling therefore detects every format from the file content, never from the extension, and the
  contract records the mismatch so no future step trusts the suffix.
- Tooling: **Python 3 with Pillow 12.x**, in two developer-run scripts:
  - `scripts/artwork/build.py` regenerates the five processed assets from `artwork/sources/`.
  - `scripts/artwork/check.py` verifies every shipped asset against its committed source.
  Pillow is a build-time tool only. It is not added to `package.json` dependencies, not imported
  by the app or the test suite, and not needed to build, run, or deploy the app. The scripts are
  wired to `npm run artwork:build` / `npm run artwork:check` for discoverability; those entries are
  scripts, not dependencies.
- **Owner approval of the tooling is a recorded, blocking step, not an assumption.** FR-033 and
  Constitution VI require any artwork-producing tooling to be named and approved by name before
  use. The name is here ("Python 3 with Pillow 12.x"); the written approval is captured by task
  **T002** in `tasks.md`, which records the approver, the date, and the approval statement in this
  plan (§Constitution Check, Gate VI) and in `research.md` R-002. T002 must complete before the
  first task that imports Pillow (T006) is started, so no script that uses Pillow is ever written
  or run without the approval on record.
- The build is deterministic: fixed crop windows, fixed composition settings, fixed resampling
  filter, fixed encoder settings. `check.py --rebuild` regenerates into a temporary directory and
  compares bytes, which proves that each committed asset is exactly what the committed sources
  produce.

### Processed assets

| Shipped asset | Source | Processing | Measured size |
|---------------|--------|------------|---------------|
| `public/games/match-the-series-spring-2026.webp` | `matchi-spring.jpg` | 760 px window at `y=120`, pasted 1:1 on a 1351 px 16:9 canvas, blurred cover backdrop in the lateral margins, 40 px feather, resize to 800x450, WebP q78 | 24,030 bytes (24.0 KB) |
| `public/games/match-the-series-summer-2026.webp` | `matchi-summer.jpg` | 760 px window at `y=40`, pasted 1:1 on a 1351 px 16:9 canvas, blurred cover backdrop in the lateral margins, 40 px feather, resize to 800x450, WebP q78 | 18,154 bytes (18.2 KB) |
| `public/games/match-the-series-autumn-2026.webp` | `matchi-autumn.jpg` | 760 px window at `y=60`, pasted 1:1 on a 1351 px 16:9 canvas, blurred cover backdrop in the lateral margins, 40 px feather, resize to 800x450, WebP q78 | 20,646 bytes (20.6 KB) |
| `public/games/match-the-series-winter-2026.webp` | `matchi-winter.jpg` | 760 px window at `y=0`, pasted 1:1 on a 1351 px 16:9 canvas, blurred cover backdrop in the lateral margins, 40 px feather, resize to 800x450, WebP q78 | 18,376 bytes (18.4 KB) |
| `public/artwork/matchi-mascot.webp` | `matchi-board.png` | Flat-background removal, trim to the character, resize to 640 px wide (640x1137), WebP q80 with alpha | 59,758 bytes (59.8 KB) |

- The seasonal assets are **composed, not merely cropped**. The window is 760 px tall and starts at
  a per-scene `y`; the foreground is the source region pasted at 1:1, so the character is never
  stretched; the lateral margins carry the whole scene scaled to cover the canvas and blurred; and
  the foreground's edges are feathered 40 px into that backdrop, so the join reads as depth of
  field rather than as a pasted panel. The canvas is 1351 px wide — a 16:9 canvas at 760 px tall,
  which is wider than the 832 px source allows.
- The seasonal windows are chosen per scene, not by a fixed fraction, and each one starts at or
  above the crown of the character's hair — spring's hair begins at `y≈172`, summer's at `y≈76`,
  autumn's at `y≈102`, and the winter window starts at the very top of its source (`y=0`) — so the
  top of the head is never clipped. Each window
  reaches the character's waist, and the scene around the figure keeps the season's defining
  features: blossom canopy for spring, sea and sky for summer, red foliage for autumn, snowfall
  for winter.
- The mascot's background removal is a **stacked border flood**: for a descending series of
  whiteness thresholds, flood the near-white region inward from the image border and accumulate
  the result into an alpha channel. Connectivity, not brightness, decides what is background, so
  the character's white coat and clipboard survive intact while the flat white backdrop becomes
  transparent. The alpha is then trimmed to the character's bounding box and resized.
- Every shipped asset is a re-encoded derivative that is smaller than its source (58% of the
  source for the mascot, 14-16% for the seasonal scenes), and each has exactly one source
  (FR-021, FR-022).
- The winter asset is processed and stored beside the other seasonal assets but is mapped to no
  game and is never referenced by the home page, so it is never downloaded and never counts against
  the page budget (FR-020). A future winter edition can map the path and ship with no re-sourcing.
- The two non-seasonal illustrations stay exactly as they are: `public/games/more-or-less.svg` and
  `public/games/groups.svg` (FR-017).

### Seasonal card composition — why a plain crop was not enough

- **The problem the owner reported (2026-11-13).** The first version of the pipeline cropped each
  seasonal scene to 16:9 at the source's full width and resized it to 800x450. The project owner
  reviewed the result and found the framing too tight: the assets showed only the character's
  head, with the chin cut off at the bottom edge. The owner asked for more of the character and
  more of the background, and chose a waist-up framing with a blurred backdrop in the lateral
  margins, keeping the face large and prominent.
- **Why a plain crop could not deliver it.** The sources are 832x1248 portraits, so a 16:9 window
  at the source's full width is only 468 px tall — 37% of the source. That window framed the head
  alone and cut the chin at the bottom edge, and no choice of `y` fixes it: the character is
  narrower than the frame, so widening the window sideways would only add more of the same
  background, and the window's height is fixed by the 16:9 ratio.
- **The composed approach.** The card image is instead composed on a canvas whose height is the
  760 px the framing needs. A 16:9 canvas 760 px tall is 1351 px wide, so the foreground region —
  the source at 1:1 — occupies the middle 832 px of it and the remaining lateral margins are
  filled with the same scene scaled to cover the canvas and blurred (radius 16). The foreground's
  edges are feathered 40 px into that backdrop, so the boundary reads as depth of field instead of
  a pasted panel, and the character keeps its own proportions because it is never scaled
  anisotropically. The finished 1351x760 canvas is then resized to 800x450, and because both the
  canvas and the target are 16:9 the scale is identical on both axes, so nothing is distorted.
- **What this satisfies.** The character's face is complete and large, the frame reaches the waist,
  the crown of the hair is never clipped, the season's defining background is visible around and
  beside the figure, and the image still fills the 16:9 card band without distortion (FR-015,
  FR-016, SC-008).
- **Owner decision on record, 2026-11-13:** the project owner reviewed the seasonal card artwork,
  found the framing too tight, and chose the waist-up framing with a blurred backdrop in the
  lateral margins. The decision is recorded in `spec.md` (the Clarifications bullet for session
  2026-11-13 and FR-015), in `research.md` R-004, in `contracts/artwork-assets.md` §4, and in
  `tasks.md` T006.

### Seasonal card artwork

- `app/utils/gameArt.ts` points the three seasonal games at their new `.webp` files; the two other
  games keep their `.svg` paths. The map stays a `Record<GameId, string>`, so every game still has
  exactly one stable, replaceable location (FR-018, FR-032).
- The card band is unchanged: a fixed 16:9 frame with `object-fit: contain`. A 16:9 image fills it
  exactly, so nothing is stretched and the card keeps its size (FR-015, FR-016). The composed
  seasonal asset is still exactly 16:9 — the 1351x760 canvas and the 800x450 target share the
  ratio, so the downscale is identical on both axes.
- The three seasonal SVGs are deleted when the WebP files land; nothing else references them.

### The mascot

- New `app/components/HomeMascot.vue`, used by `app/pages/index.vue` only, so the mascot appears on
  the home page and nowhere else (FR-011).
- Placement: `position: fixed` at the bottom inline-end corner of the viewport. It floats over the
  page, reserves no space, adds no document overflow, and never moves with the scroll (FR-001).
- Sizing: the mascot's inline size comes from one token, `--mascot-size`, whose value is set
  per viewport band so the mascot stays clear of the card text at every width at the default text
  size (FR-002, FR-005).
  The shipped asset's own aspect ratio is preserved (`aspect-ratio: 640 / 1137` — 640 wide, with a
  height proportional to the trimmed composition of the source), so the browser reserves the box
  before the file arrives.

  | Band | Applies at viewport widths | Catalog geometry at that width | `--mascot-size` |
  |------|---------------------------|-------------------------------|-----------------|
  | 1 — edge | 320px – 1023px | `.home` is `max-width: 56rem` (896px) but the viewport is narrower, so the catalog column reaches the viewport's inline-end edge and no free margin exists beside it. | `min(17vw, calc(17dvh * 640 / 1137))` |
  | 2 — margin | 1024px – 1920px | The catalog column is capped at 896px and centered, so a free column of `(100vw - 55rem) / 2` exists beside it. The mascot takes 80 % of that column, and the `53dvh` term is a ceiling that stops it taking over a wide, short window. | `min(calc((100vw - 55rem) / 2 * 0.8), calc(53dvh * 640 / 1137))` |

  | Viewport | Band | Mascot box | Share of width | Share of height |
  |----------|------|------------|----------------|-----------------|
  | 320x640 | 1 | 54x97 | 17.0% | 15.1% |
  | 360x640 | 1 | 61x109 | 17.0% | 17.0% |
  | 600x800 | 1 | 77x136 | 12.8% | 17.0% |
  | 768x1024 | 1 | 98x174 | 12.8% | 17.0% |
  | 1024x768 | 2 | 58x102 | 5.6% | 13.3% |
  | 1152x768 | 2 | 109x193 | 9.4% | 25.2% |
| 1280x800 | 2 | 160x284 | 12.5% | 35.5% |
| 1366x655 | 2 | 194x345 | 14.2% | 52.7% |
  | 1440x900 | 2 | 224x398 | 15.6% | 44.2% |
| 1920x1080 | 2 | 322x572 | 16.8% | 53.0% |

  600x800, 1152x768, 1280x800 and 1366x655 are measured reference viewports for the sizing
  decision; the automated check runs at the other six. Band 1 keeps margin under the 35% width
  and 55% height ceilings (FR-005, SC-005), and band 2 reaches 53% of the height at 1920x1080
  without crossing it. The mascot scales down on a phone (FR-005).
- **Owner decision on record, 2026-11-13 — the mascot fills 80 % of the free column.** The
  project owner first asked for a 30 % larger mascot and then, after seeing it rendered, asked
  for the mascot to occupy 80 % of the free column to the right of the centered catalog. Band 2
  takes `calc((100vw - 55rem) / 2 * 0.8)` — 80 % of that column — capped by `53dvh`: the
  measured box is 194x345 at 1366x655, 224x398 at 1440x900 and 322x572 at 1920x1080, so the
  mascot is 78 % of the column at 1366px and 1440px and 61 % at 1920px, where the height
  ceiling binds. The margin term is `55rem`, not the catalog's own `56rem`: the catalog's inner
  list measures 872px, so `56rem` under-counted the free column by 8px on each side. The mascot
  never touches the catalog at any width. Band 1 takes `17vw`/`17dvh` — +6 % — because its token is capped by the
  clearance check below, not by the +30 % request: `17` is the largest token for which the
  automated geometry check finds no intersection with any card name, summary, or state text, and
  `18` fails at 768x1024, where the mascot covers the card name and the summary text.
- Input: `pointer-events: none` on the wrapper, so every control under it stays clickable and
  tappable (FR-003). The mascot is an image, so it adds no focus stop (FR-006).
- Accessibility: the wrapper is `aria-hidden="true"` and the image has `alt=""`. The mascot
  conveys no information that is not already in the catalog text (FR-006).
- Motion: the mascot is a plain still image with no animation, no transition, and no
  `prefers-reduced-motion` special case — every visitor sees the same frame (FR-009).
- Failure: an `@error` handler removes the image element, mirroring the existing `GameArt.vue`
  pattern. The page stays fully usable and no broken-image icon appears (FR-008). Because the box
  is sized by CSS, the mascot causes no layout shift when it loads (FR-010).
- Clearance from card text is the one constraint with no pure-CSS guarantee, because the mascot
  floats over the catalog and the layout reserves no space for it. The rule is therefore
  per band, explicit, and verified rather than assumed:
  - **Band 2 (1024px and wider):** the free margin beside the centered catalog is at least 64px
    and the band-2 token is capped by it, so the mascot stands beside the catalog and never
    overlaps the card column.
  - **Band 1 (320px – 1023px):** the catalog column reaches the viewport's inline-end edge, so
    there is no free margin and the mascot does overlap the catalog column. It is positioned in
    the bottom inline-end corner of the viewport, in the region where the card's text does not
    extend — the card's text is left-aligned, so the card's inline-end corner carries no text —
    and the band's token is the largest value for which the automated geometry check finds no
    intersection between the mascot's rectangle and any card name, summary, or state text
    rectangle, at the default text size. That token is `min(17vw, calc(17dvh * 640 / 1137))`:
    `18` fails at 768x1024, where the mascot covers the card name and the summary text.
  - The automated check enforces both bands at **every tested viewport** — 320x640, 360x640,
    768x1024, 1024x768, 1440x900, and 1920x1080 — in both locales, at the top, middle, and bottom
    scroll positions (FR-002, SC-002). If a band's token does not clear the text at a tested
    viewport, **that band's token** is lowered until it does: the mascot never moves onto text,
    and no other band's token changes.
  - **Known limitation — 200% text zoom, accepted by the project owner on 2026-11-13.** The
    clearance above holds at the default text size. At 200% browser text zoom the mascot
    overlaps card text at viewports narrower than about 1024 pixels, because a wrapped
    card-summary line reaches the corner the mascot occupies, and no single size token is both
    wide enough to be legible at 320 pixels and narrow enough to clear the text at 480 pixels.
    The overlap is accepted for this rare condition and is recorded as a known limitation, not a
    defect to be engineered away.
  - **Owner decision on record, 2026-11-13:** the project owner accepted the overlap below
    roughly 1024 pixels at 200% text zoom instead of closing it. The three ways to close it were
    each rejected — lowering or dropping band 1's token (which would make the mascot illegible
    at 320 pixels), reserving a gutter for the mascot in the card text (which contradicts FR-001's
    "the layout reserves no space"), and engineering the mascot around the text. The decision is
    recorded in `spec.md` (SC-022, the 200% edge case, the assumption, and the Clarifications
    bullet), in this plan, in `contracts/home-mascot.md` §5, and in `quickstart.md` §6.

### Verification

- `tests/artwork-assets.test.ts` (Vitest, 3 tests): the asset contract — every source is present
  and outside the served directory; every shipped asset is smaller than its source and is not
  byte-for-byte identical to it; each seasonal asset is 800x450 and at most 90 KB; the mascot
  measures 640x1137 pixels, at most 150 KB, and carries an alpha channel; the home-page artwork
  total is at most 450 KB; the winter asset exists but is mapped to no game. A small dependency-free
  header reader in `tests/helpers/imageMeta.ts` extracts the dimensions and the alpha flag from the
  WebP/PNG/JPEG container headers, so the suite needs no image library.
- `tests/game-art.test.ts` (Vitest, updated): the existing per-game guarantee is extended from
  "one distinct, self-contained SVG" to "one distinct, self-contained image file", so it holds for
  vector and raster artwork alike (FR-032), and it now also asserts the state only the new
  artwork satisfies: the three seasonal entries resolve to the processed 800x450 WebP files, and
  no SVG counterpart remains for those three games.
- `e2e/home-artwork.spec.ts` (Playwright, 4 tests): the mascot is inside the viewport at the top,
  middle, and bottom scroll positions and within its size caps at 320x640, 360x640, 768x1024,
  1024x768, 1440x900, and 1920x1080; no card text is covered at the default text size and a card
  under the mascot still opens its game; the mascot adds no focus stop and no animation; a failed
  mascot and a failed seasonal image both degrade to the neutral placeholder with the catalog
  intact, the home page requesting the three seasonal images, the mascot, and the two unchanged
  illustrations, and never requesting the reserved winter asset.
- **Known limitation in the verification, accepted by the project owner on 2026-11-13.** The
  no-overlap check above runs at the default text size, where no card text is covered at any
  tested viewport. At 200% browser text zoom the mascot overlaps card text at viewports narrower
  than about 1024 pixels: a wrapped card-summary line reaches the corner the mascot occupies, and
  no single size token is both wide enough to be legible at 320 pixels and narrow enough to clear
  the text at 480 pixels. The overlap is accepted for this rare condition; the automated suite
  neither asserts it nor fails on it, and the outcome is recorded rather than engineered away
  (SC-022, `contracts/home-mascot.md` §5, `quickstart.md` §6). The manual check in
  `quickstart.md` §6 records the accepted outcome instead of expecting zero overlap.
- `scripts/artwork/check.py` (build-time): the authoritative re-derivation of the shipped assets
  from the committed sources, with a `--rebuild` byte-comparison mode.
- The recognition study (SC-019) is **not** a test: it is a manual check that the project owner
  runs before release, using the step in `quickstart.md` §8, and the result is recorded there. No
  automated test asserts it, and the feature's test count is unchanged.
- Feature test count: 7 new tests (3 Vitest + 4 Playwright) plus 1 updated existing file
  (`tests/game-art.test.ts`) = 8, against the 15-test cap. The existing suites stay as they are.

### What stays unchanged

The catalog order and the five cards, the card geometry and the 16:9 band, the hover, focus,
finished, unavailable, and error treatments, the countdown, the language control, the development
reset, the game routes, the daily content, the saved result, and both message catalogs.

## Project Structure

### Documentation (this feature)

```text
specs/013-home-artwork/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/
│   ├── artwork-assets.md  # Sources, processed assets, budgets, replacement, checks
│   └── home-mascot.md     # Mascot DOM, placement, sizing, accessibility, failure
├── checklists/
│   └── requirements.md
├── spec.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
artwork/
├── sources/                            # Committed source artwork; never served
│   ├── matchi-board.png                # Mascot source (JPEG data under a .png name)
│   ├── matchi-spring.jpg
│   ├── matchi-summer.jpg
│   ├── matchi-autumn.jpg
│   └── matchi-winter.jpg
└── README.md                           # What the sources are, how they are processed

public/
├── artwork/
│   └── matchi-mascot.webp              # 640x1137 mascot with transparency
└── games/
    ├── groups.svg                      # Unchanged
    ├── more-or-less.svg                # Unchanged
    ├── match-the-series-autumn-2026.webp   # Replaces the seasonal SVG
    ├── match-the-series-spring-2026.webp   # Replaces the seasonal SVG
    ├── match-the-series-summer-2026.webp   # Replaces the seasonal SVG
    └── match-the-series-winter-2026.webp   # Stored for a future edition; mapped to no game

app/
├── assets/css/main.css                 # Mascot fixed-position and sizing rules
├── components/
│   └── HomeMascot.vue                  # Decorative fixed mascot with load-failure fallback
├── pages/index.vue                     # Renders the mascot on the home page only
└── utils/
    └── gameArt.ts                      # Three seasonal paths point at the new WebP files

scripts/artwork/
├── build.py                            # Regenerate the five processed assets from artwork/sources/
└── check.py                            # Verify each shipped asset against its committed source

tests/
├── artwork-assets.test.ts              # Source, size, dimension, alpha, and budget contract
├── game-art.test.ts                    # Updated: one distinct self-contained image per game
└── helpers/
    └── imageMeta.ts                    # Dependency-free image header reader

e2e/
└── home-artwork.spec.ts                # Mascot placement, clearance, click-through, failure

package.json                            # artwork:build / artwork:check scripts (no dependency added)
README.md                               # Layout table and artwork section updated
```

**Structure Decision**: Single Nuxt web application, unchanged in shape. Browser presentation stays
under `app/`, the server and API stay under `server/`, and the served images stay under `public/`.
The committed source artwork goes in a new top-level `artwork/` tree, outside `public/`, so it is
part of the project record and out of reach of the browser (FR-022). The build-time tooling goes
under `scripts/artwork/`, next to the existing operational script in `scripts/`. No server,
migration, or schema file is touched.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. The one judgement call worth recording — using Pillow at build time instead of
adding a JavaScript image library to the project — is not an exception but the point of FR-033: the
tooling is named, it is confined to two developer scripts, and the app keeps its zero-new-npm-
dependency posture.
