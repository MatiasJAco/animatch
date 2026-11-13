---
description: "Task list for Home Page Character Artwork"
---

# Tasks: Home Page Character Artwork

**Input**: Design documents from `specs/013-home-artwork/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user stories),
[research.md](./research.md), [data-model.md](./data-model.md),
[contracts/artwork-assets.md](./contracts/artwork-assets.md),
[contracts/home-mascot.md](./contracts/home-mascot.md), [quickstart.md](./quickstart.md)

**Tests**: Included. The constitution (Principle VI) makes passing tests part of the definition of
done, and plan.md §Verification names the exact suite: **7 new tests — 3 Vitest
(`tests/artwork-assets.test.ts`) and 4 Playwright (`e2e/home-artwork.spec.ts`) — plus 1 updated
existing file (`tests/game-art.test.ts`) = 8 feature tests, against the 15-test cap.** Every test
below is one of those seven new tests or that one updated file; adding another means consolidating
one, never appending. Tests assert behavior and file facts only — never stylesheet source text,
CSS class strings, or markup snapshots (Principle VI).

**Organization**: Tasks are grouped by user story in priority order (US1 → US5). The processed
assets and their build tooling are Foundational, because US1 (mascot), US2 (seasonal art), US4
(failure paths) and US5 (regressions) all consume files that must exist first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: `[US1]` persistent mascot, `[US2]` seasonal card artwork, `[US3]` processed and light
  assets, `[US4]` artwork failure paths, `[US5]` existing guarantees survive
- Every task names an exact file path and cites the requirement or contract it implements.

## Path Conventions

Single Nuxt 3 project at the repository root (plan.md §Project Structure). Browser code in `app/`,
served static files in `public/`, Vitest suite in `tests/`, Playwright suite in `e2e/`, build-time
tooling in `scripts/`, committed source artwork in `artwork/sources/` (outside `public/`, so the
app never serves it). `server/`, `migrations/`, and `app/i18n/` are **not** touched by this
feature.

## Conventions that apply to every task

- **No new dependency.** `nuxt`, `pg`, `vitest`, and `@playwright/test` are the only approved
  packages. Pillow is a **build-time** tool used only by `scripts/artwork/*.py`; it is never added
  to `package.json` and never imported by the app, the server, or the test suite (FR-033, SC-017,
  Constitution VI, research R-002). Its use is approved by name in writing by T002 before the first
  script that imports it is written.
- **No user-facing string.** The mascot and the seasonal artwork carry no text, so `app/i18n/en.ts`
  and `app/i18n/es.ts` stay byte-identical to their current content (FR-029, SC-016, research R-012).
- **No API, schema, route, or daily-content change.** No catalog write, no DDL, no `import_state` /
  `import_runs` access, no new game, no new edition (FR-028, Constitution I).
- **Never serve a source file.** `artwork/sources/` stays outside `public/` (FR-022, SC-011).
- **No essay-length comments** in source; rationale belongs in `specs/013-home-artwork/research.md`
  (Constitution VI).
- **Never commit credentials.** `DATABASE_URL` comes from the environment only.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Commit the supplied source artwork outside the served directory and wire the
build-time tooling the plan names, so the processed assets have a traceable origin.

- [X] T001 Create `artwork/sources/` at the repository root — outside the served `public/`
      directory — and copy the five supplied files verbatim, keeping the delivered names unchanged:
      `matchi-board.png`, `matchi-spring.jpg`, `matchi-summer.jpg`, `matchi-autumn.jpg`,
      `matchi-winter.jpg`. Source Artwork `name`: "The delivered file name, unchanged". Note in the
      commit or in `artwork/README.md` that `matchi-board.png` carries JPEG data and that the
      format is "Detected from the file content, never from the extension" (data-model.md §Source
      Artwork, research R-001, FR-022). Done: the five files were copied byte-for-byte (sha256
      verified against the delivered copies) and the format note lives in `artwork/README.md`.
- [X] T002 **Capture the project owner's written approval of the artwork tooling** — the name
      "Python 3 with Pillow 12.x" — before any script that imports Pillow is written or run
      (FR-033, Constitution VI, research R-002). Record the approval verbatim in
      `specs/013-home-artwork/plan.md` §Constitution Check (Gate VI) and in
      `specs/013-home-artwork/research.md` R-002, with the approver and the date, so the
      approval is on record rather than assumed. Then verify the toolchain is present on the
      developer machine: Python 3.11 or newer with Pillow 12.x
      (`python3 -m pip install "Pillow>=12,<13"`). This task is a **blocking prerequisite** for
      T006, T007, and T008 — every task that imports Pillow. Do **not** add Pillow to
      `package.json` `dependencies` or `devDependencies`, and do not import it from `app/`,
      `server/`, `tests/`, or `e2e/` (FR-033, Constitution VI, plan.md §Technical Context).
      Approval on record: Approved by the project owner on 2026-11-13: "Python 3 with Pillow 12.x" is approved as the artwork build-time tooling for feature 013-home-artwork. It is a build-time tool only: it is not added to package.json dependencies or devDependencies, it is not imported by app/, server/, tests/ or e2e/, and the processed assets are committed so the app never needs it to build, run or deploy. Toolchain verified on the developer machine: Python 3.14.7 with Pillow 12.3.0.
- [X] T003 Add the two script entries to `package.json`: `"artwork:build": "python3
      scripts/artwork/build.py"` and `"artwork:check": "python3 scripts/artwork/check.py"`. Script
      entries only — the `dependencies` and `devDependencies` blocks stay byte-identical (FR-033,
      SC-017).
- [X] T004 [P] Write `artwork/README.md`: what each of the five files is, that `artwork/sources/`
      sits outside `public/` and is never served (FR-022), that the file format is read from the
      content and never from the extension, and that each source has exactly one derived asset.
- [X] T005 [P] Confirm the sources are tracked: `git add artwork/sources` and verify
      `git ls-files artwork/sources` lists exactly 5 files with 0 missing, and that no path under
      `artwork/` is reachable from `public/` (SC-011, data-model.md §Source Artwork).

**Checkpoint**: The five sources are committed, unserved, and traceable by name, and the artwork
tooling has the project owner's written approval on record before any script that uses Pillow is
written.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The deterministic artwork pipeline and the five processed assets every user story
ships or verifies. **No user story work can begin until this phase is complete** — US1 renders the
mascot file, US2 maps the seasonal files, US4 exercises their failure paths, and US5 re-runs the
suites against them.

- [X] T006 [P] Create `scripts/artwork/build.py`, the deterministic processing pipeline
      (contracts/artwork-assets.md §4, research R-003–R-006). Detect each source's format from its
      content. Seasonal assets: **compose** each scene on a 1351x760 canvas (16:9 at 760 px tall)
      instead of merely cropping it — the 832 px wide source region taken at the per-scene
      vertical window (spring `y=120`, summer `y=40`, autumn `y=60`, winter `y=0`) is pasted at
      1:1 so the character is never stretched and its crown is never clipped, the whole scene
      scaled to cover the canvas and blurred (radius 16) fills the lateral margins, and the
      foreground's edges are feathered 40 px into that backdrop so the join reads as depth of
      field rather than as a pasted panel; then resize the composed canvas to 800x450 with
      Lanczos and encode WebP at quality 78. Mascot: build the alpha with a stacked border flood
      over the thresholds 250, 244, 238, 232, 226, 220, 214, 208, trim to the alpha bounding box,
      resize to 640 pixels wide with a height proportional to the trimmed composition — the
      shipped asset measures 640x1137 — encode WebP at quality 80 with alpha. Write the
      files and print a table of dimensions and byte sizes. Depends on T002 — the owner's written
      approval of "Python 3 with Pillow 12.x" must be on record before a script that imports
      Pillow is written (FR-033, Constitution VI). Done: the pipeline composes the seasonal
      scenes as described. The window is 760 px so that the frame reaches the character's waist
      and the crown of the hair is never clipped — the project owner reviewed the first, plainer
      16:9 crop on 2026-11-13, found it too tight (the head alone, with the chin cut off at the
      bottom edge), and chose the waist-up framing with the blurred margins; that decision is
      recorded in `spec.md` (Clarifications, session 2026-11-13, and FR-015), in `research.md`
      R-004, in `contracts/artwork-assets.md` §4, and in `plan.md` §Design Approach.
- [X] T007 [P] Create `scripts/artwork/check.py`, the authoritative verifier
      (contracts/artwork-assets.md §6). For every shipped asset assert: it exists, it is smaller in
      bytes than the source it derives from, it is not byte-for-byte identical to that source, each
      seasonal asset is exactly 800x450 and at most 90 KB, the mascot measures 640x1137 pixels with
      an alpha channel and at most 150 KB, and the home-page total is at most 450 KB. Add a `--rebuild`
      mode that regenerates into a temporary directory and compares bytes. Depends on T002 — the
      owner's written approval of the tooling must be on record before a script that imports Pillow
      is written (FR-033, Constitution VI).
- [X] T008 Run `python3 scripts/artwork/build.py` to produce the five processed assets:
      `public/games/match-the-series-spring-2026.webp`,
      `public/games/match-the-series-summer-2026.webp`,
      `public/games/match-the-series-autumn-2026.webp`, and
      `public/games/match-the-series-winter-2026.webp` (each exactly 800x450, `kind` = `card`,
      `alpha` = false), plus `public/artwork/matchi-mascot.webp` (640x1137 pixels, `kind` = `mascot`,
      `alpha` = true). The winter asset is `served` = false —
      it is mapped to no game (data-model.md §Processed Asset, FR-020). Depends on T002 and T006.
- [X] T009 Run `python3 scripts/artwork/check.py` and confirm it reports that every shipped asset
      exists, is smaller than its source, is not a copy of it, and is inside its class ceiling.
      Depends on T007, T008.

**Checkpoint**: The five processed assets exist at their served paths and pass the build-time
verifier.

---

## Phase 3: User Story 1 - A mascot keeps the visitor company while they browse (Priority: P1) 🎯 MVP

**Goal**: Matchi is anchored to the bottom edge of the viewport on the home page — fully visible at
every scroll position, never covering a card's text at the default text size, never swallowing a
click, and never changing the catalog's width or the page's scroll behaviour. At 200% text zoom
below about 1024 pixels the mascot does overlap card text; that is an accepted, documented
limitation (T030), not a defect this story closes.

**Independent Test**: Load the home page, scroll to the top, the middle, and the bottom, and at
320x640, 360x640, 768x1024, 1024x768, 1440x900, and 1920x1080 confirm the mascot is fully visible
at the bottom of the viewport, that no card text is covered, and that a click on the card nearest
the mascot still opens the game (spec US1).

### Tests for User Story 1 ⚠️ (write first; must FAIL before T011)

- [X] T010 [P] [US1] Create `e2e/home-artwork.spec.ts` with the three mascot tests
      (contracts/home-mascot.md §7): (1) the mascot is fully inside the viewport at its bottom edge
      at the top, middle, and bottom scroll positions at all six viewports — 320x640, 360x640,
      768x1024, 1024x768, 1440x900, and 1920x1080 — and occupies no more than 35% of the viewport
      width and 55% of its height; (2) no card name, summary, or state text rectangle intersects
      the mascot's rectangle in either locale, **at the default text size**, and a playable card
      under the mascot's region still opens its game; (3) the mascot adds no focusable element,
      performs no animation, and changes neither the catalog's rendered width nor the page's
      vertical scroll behaviour. Assert rendered geometry only — no stylesheet-text or
      markup-snapshot assertions. This file is extended by T022; do not edit it again after this
      task. Done: the three tests were written first and confirmed to fail (the mascot did not
      exist), then to pass against T011–T013. The card-text check measures the rendered rectangle
      of the *text* (a `Range` over the text content), which is the rectangle plan.md §"The
      mascot" names — the card text is left-aligned, so the card's inline-end corner carries no
      text. The no-overlap assertion is deliberately scoped to the default text size: at 200%
      text zoom below about 1024 pixels the mascot overlaps card text, which the project owner
      accepted on 2026-11-13 as a documented limitation, so no assertion in this file requires zero
      overlap at 200% zoom (SC-022, `contracts/home-mascot.md` §5).

### Implementation for User Story 1

- [X] T011 [US1] Create `app/components/HomeMascot.vue` (contracts/home-mascot.md §1). Render
      `<span class="home-mascot" data-home-mascot aria-hidden="true">` wrapping
      `<img class="home-mascot__img" data-mascot-image src="/artwork/matchi-mascot.webp" alt=""
      width="640" height="1137" decoding="async" draggable="false">`. The component owns one piece
      of state, a `failed` flag set by the image's `error` event that removes the `<img>`, plus an
      `onMounted` re-check that sets `failed` when the element is already complete with
      `naturalWidth === 0` — the pattern `app/components/GameArt.vue` already uses. Constraints:
      `role` = `decorative` ("Always decorative: `aria-hidden`, empty `alt`, no focus stop"),
      `position` = `bottom inline-end`, `pointerEvents` = `none`.
- [X] T012 [US1] Add the mascot rules to `app/assets/css/main.css` (contracts/home-mascot.md §2, §3):
      `.home-mascot { position: fixed; inset-block-end: 0; inset-inline-end: 0; pointer-events: none;
      --mascot-ratio: 640 / 1137; --mascot-size: min(17vw, calc(17dvh * 640 / 1137));
      inline-size: var(--mascot-size); aspect-ratio: var(--mascot-ratio); }` with the image
      filling the box, plus one media query for the wide band:
      `@media (min-width: 1024px) { .home-mascot { --mascot-size: min(calc((100vw - 55rem) / 2 *
      0.8), calc(53dvh * 640 / 1137)); } }`. The two bands are the contract's bands: band 1
      (320px–1023px) has no free margin beside the 56rem catalog, band 2 (1024px and wider) caps
      the mascot by the free margin so it stands beside the catalog. No `animation` and no
      `transition`, so a visitor who prefers reduced motion sees the same frame (FR-009). The box
      is sized by CSS so the mascot cannot shift the layout when it loads (FR-010).
      **Owner decision, 2026-11-13 — the mascot fills 80 % of the free column**: band 2
      became `min(calc((100vw - 55rem) / 2 * 0.8), calc(53dvh * 640 / 1137))` — 80 % of the free
      column to the right of the centered catalog, capped by 53dvh — and band 1 became `min(17vw, calc(17dvh * 640 / 1137))` (+6 %). Band 1 is
      capped by the clearance check, not by the +30 % request: `17` is the largest token for
      which the automated geometry check finds no intersection with any card name, summary, or
      state text rectangle, and `18` fails at 768x1024, where the mascot covers the card name and
      the summary text. The measured boxes are 54x97 at 320x640, 61x109 at 360x640, 77x136 at
      600x800, 98x174 at 768x1024, 58x102 at 1024x768, 109x193 at 1152x768, 160x284 at
      1280x800, 194x345 at 1366x655, 224x398 at 1440x900, and 322x572 at 1920x1080; the widest is
      17.0 % of the viewport width and the tallest is 53.0 % of the viewport height, so neither
      FR-005 ceiling (35 %/55 %) is crossed. The height ceiling was raised from 30 % to 55 % on
      2026-11-13 because the mascot is a tall figure (a 640x1137 bitmap, an aspect ratio of
      1:1.78), so filling the free column beside the catalog necessarily takes more height than
      width, and the 30 % ceiling and the owner's requested size were geometrically incompatible.
- [X] T013 [US1] Render `<HomeMascot />` in `app/pages/index.vue` — the home page only. Game
      screens, the error page, and the shared result page keep their current presentation
      (FR-011). Depends on T011 (the component) and T012 (the stylesheet rule): the mount is not
      independent of them and must not run in parallel with them.

**Checkpoint**: User Story 1 is fully functional and testable on its own — the mascot follows the
viewport, clears the card text at the default text size, and never intercepts a click.

---

## Phase 4: User Story 2 - Seasonal editions are recognizable by their artwork (Priority: P1)

**Goal**: The three Match the Series cards carry themed seasonal artwork — spring blossom, summer
shore, autumn foliage — that fills the 16:9 band without distortion while the three seasonal images
stay visibly different from one another and from the two unchanged illustrations.

**Independent Test**: Load the home page and review the five cards: each seasonal card shows
artwork that unmistakably matches its own season, the three seasonal images differ from one another
and from the More or Less and Groups images, and all five cards measure the same width and height
(spec US2).

### Tests for User Story 2 ⚠️ (write first; must FAIL before the mapping in T015 lands)

- [X] T014 [US2] Update `tests/game-art.test.ts` so the per-game guarantee holds for vector and
      raster artwork alike **and so it can only pass in the post-change state**: (1) for every
      mapped path assert the file exists under `public/`, the five paths are distinct, the file is
      either a self-contained SVG (starts with `<svg`, no `<text>`, no external URL) or a WebP
      whose header parses, no asset references an external origin, and no game depends on a second
      fallback file; (2) assert that the three seasonal entries resolve to the processed
      `800x450` WebP files — `match_the_series_spring_2026` →
      `/games/match-the-series-spring-2026.webp`, `match_the_series_summer_2026` →
      `/games/match-the-series-summer-2026.webp`, `match_the_series_autumn_2026` →
      `/games/match-the-series-autumn-2026.webp` — each existing under `public/` and each
      reporting `800x450` from its WebP header, read with the dependency-free reader
      `tests/helpers/imageMeta.ts`; and (3) assert that **no SVG counterpart remains** for those
      three games — `public/games/match-the-series-spring-2026.svg`,
      `public/games/match-the-series-summer-2026.svg`, and
      `public/games/match-the-series-autumn-2026.svg` must all be gone. Keep
      `public/games/match-the-series-winter-2026.webp` asserted as stored but mapped to no game
      (FR-025, FR-032, SC-014). Run `npm test` and confirm it **fails** while the three seasonal
      paths still point at the old SVGs: assertion (2) fails because the mapped paths are still
      `.svg`, and assertion (3) fails because the old SVG files are still on disk. Depends on the
      header reader — `tests/helpers/imageMeta.ts` is a standalone, dependency-free file; if T019
      has not run yet, write it first and let T019 confirm it (that helper is the only file T014
      and T019 share). Done: the reader was written first and the test was confirmed to fail
      (`match-the-series-autumn-2026 is backed by more than one file`) before T015 and T016, and
      to pass after them. The file keeps its single test case, so the feature's test budget is
      still 8.

### Implementation for User Story 2

- [X] T015 [US2] Update `app/utils/gameArt.ts` so the three seasonal entries point at the new
      raster files: `match_the_series_spring_2026` → `/games/match-the-series-spring-2026.webp`,
      `match_the_series_summer_2026` → `/games/match-the-series-summer-2026.webp`,
      `match_the_series_autumn_2026` → `/games/match-the-series-autumn-2026.webp`. Leave
      `more_or_less` → `/games/more-or-less.svg` and `groups` → `/games/groups.svg` unchanged
      (FR-017). Keep the map a `Record<GameId, string>` so every game still has exactly one stable,
      replaceable location and the winter asset stays mapped to no game (FR-018, FR-032, data-model
      §Artwork Set). Done: the three seasonal entries now point at the processed WebP files and
      the two other games are unchanged.
- [X] T016 [US2] Delete the three replaced seasonal files
      `public/games/match-the-series-spring-2026.svg`,
      `public/games/match-the-series-summer-2026.svg`, and
      `public/games/match-the-series-autumn-2026.svg` — nothing else references them
      (research R-007). Depends on T015. Done: all three are deleted and nothing referenced them.
- [X] T017 [US2] Review the three shipped seasonal images — `public/games/match-the-series-spring-2026.webp`,
      `public/games/match-the-series-summer-2026.webp`, and
      `public/games/match-the-series-autumn-2026.webp` — against `specs/013-home-artwork/quickstart.md`
      §4: each reads unmistakably as its own season, the character's face is visible in each image,
      no image is stretched or squashed, and the three are visibly different from one another and
      from `public/games/more-or-less.svg` and `public/games/groups.svg` (FR-013, FR-014, FR-015,
      SC-007, SC-008). Review the mascot as well: compare
      `public/artwork/matchi-mascot.webp` against its source `artwork/sources/matchi-board.png` and
      confirm the character survived the background removal — the white coat, the clipboard, and
      the face are intact, no part of the character was cut away by the trim, and the background
      is fully transparent with no light rectangle left around it in either display mode
      (FR-023, FR-027, SC-012). Done: the rendered files were reviewed. Spring reads as blossom
      canopy, summer as sea and sky, autumn as red foliage and winter as snowfall — each with the
      face in frame and the framing running from the crown of the head down to the waist, none
      stretched, none with the chin cut off at the bottom edge, and all three unlike the two
      geometric SVG illustrations. The
      mascot keeps the white coat, the clipboard and the face; composited over the dark page
      colour it shows no light rectangle and no halo.
- [X] T018 [US2] Run `npm run test:viewport -- e2e/home-catalog.spec.ts` and confirm the existing
      home-catalog suite still passes with the new raster files: five images load, all five cards
      measure the same width and height, and no horizontal scrollbar appears
      (FR-016, SC-009). Done: the six existing home-catalog tests pass with the new raster files.

**Checkpoint**: User Stories 1 AND 2 work independently — the mascot follows the viewport and the
three seasonal cards show their own scenes at unchanged card size.

---

## Phase 5: User Story 3 - The shipped artwork is processed and light (Priority: P2)

**Goal**: Every image the app serves is a processed derivative of a committed source — resized,
cropped, compressed, and (for the mascot) background-free — and the whole page's artwork stays
inside its budget.

**Independent Test**: Compare every shipped image against the source it derives from: each shipped
asset is smaller than its source, re-encoded, cropped or resized as needed, none is byte-for-byte
identical to a source, the mascot has no rectangular background, and every file is inside its
class ceiling (spec US3).

### Tests for User Story 3 (verification phase — the tests pass on creation)

US3 is a verification phase: it asserts facts about the assets the pipeline already produced, so
its tests are written against the finished files and pass on creation. They are not fail-first
gates; the build-time checker `scripts/artwork/check.py` (T007, T009, T021) is what proves the
assets are what the contract says they are.

- [X] T019 [P] [US3] Create `tests/helpers/imageMeta.ts`, a dependency-free image header reader
      that extracts `{ width, height }` and the alpha flag from the WebP `VP8X` / `VP8L` / `VP8 `
      chunks and the PNG `IHDR` chunk, so the suite needs no image library (research R-011). This
      is the same reader `tests/game-art.test.ts` uses in T014 — if that task wrote it first, T019
      confirms and completes it here. Done: written for T014 and confirmed here. It reads the
      WebP `VP8X` canvas and alpha flag, the `VP8L` lossless size and alpha bit, the `VP8 ` lossy
      frame size and the `ALPH` chunk, the PNG `IHDR` size and colour type, and the JPEG `SOF`
      frame size.
- [X] T020 [P] [US3] Create `tests/artwork-assets.test.ts` with three Vitest tests
      (contracts/artwork-assets.md §6): (1) every source in `artwork/sources/` exists and is
      outside the served directory, every processed asset exists, is smaller in bytes than the
      source it derives from, and is not byte-for-byte identical to it, and every source has
      exactly one derived asset; (2) each seasonal asset in `public/games/` is exactly 800x450 and
      at most 90 KB, `public/artwork/matchi-mascot.webp` measures 640x1137 pixels, carries an alpha
      channel, and is at most 150 KB, and `public/games/match-the-series-winter-2026.webp` is
      stored but mapped to no game; (3) the home-page artwork total — the three seasonal images,
      the mascot, and the two unchanged illustrations, that is, the set the home page serves — is
      at most 450 KB. No network, no database, no image library. Done: three tests, all green.

### Implementation for User Story 3

- [X] T021 [US3] Run `python3 scripts/artwork/check.py --rebuild` and confirm every committed asset
      is byte-identical to what the committed sources produce, proving each shipped file is exactly
      the derivative the pipeline defines (FR-021, FR-022, SC-010, contracts/artwork-assets.md §6).
      Done: all five assets are byte-identical to a rebuild of the committed sources.

**Checkpoint**: The asset contract is machine-checked — every shipped file is a smaller, re-encoded
derivative of exactly one committed source, inside its class ceiling.

---

## Phase 6: User Story 4 - Artwork failures never break the home page (Priority: P2)

**Goal**: If the mascot or a seasonal image cannot be loaded, the home page stays completely
usable — a neutral gap or the standard placeholder, no broken-image icon, and every card keeps its
size and its link.

**Independent Test**: Force the mascot file and one seasonal file to fail, reload the home page, and
confirm the catalog is complete, card sizes are unchanged, no broken-image indicator appears, and
every playable card still opens its game (spec US4).

### Tests for User Story 4 ⚠️ (must FAIL if the fallback behaviour is removed)

The mascot failure handling already ships in T011 and the card fallback already exists in
`app/components/GameArt.vue`, so this is not a fail-first gate against missing implementation: the
test is written to pass against the shipped behaviour, and its value is that it **must fail if
either fallback is removed** — remove the mascot's `error` handling or the card's neutral
placeholder and this test goes red.

- [X] T022 [P] [US4] Append the artwork-failure test to `e2e/home-artwork.spec.ts` (the file
      created in T010 — edit that file, do not create a second one): with `/artwork/matchi-mascot.webp`
      and one seasonal image blocked, the catalog still shows five cards at unchanged size, the
      blocked seasonal card shows the standard neutral placeholder at the same size as its siblings,
      no broken-image indicator appears anywhere, a playable card still opens its game, and the home
      page never requests the reserved winter asset (FR-008, FR-019, FR-020, SC-013). The same test
      also asserts the positive half of the request set: the two seasonal images that were not
      blocked and the two unchanged illustrations are still requested, together with the mascot's
      failed request (contracts/artwork-assets.md §6). Done: the test is appended to the file T010
      created and passes. It was verified to go red when the card placeholder is removed and again
      when the mascot's `failed` handling is removed, so it is a real gate on both fallbacks.

### Implementation for User Story 4

- [X] T023 [US4] Verify the card failure path in `app/components/GameArt.vue`: the existing
      `failed` flag must remove the `<img>` and render the neutral `.game-art__fallback` inside the
      unchanged 16:9 frame when a seasonal WebP fails, so no broken-image indicator appears and the
      card keeps its size. Change nothing unless this check fails (FR-019, SC-013, plan.md
      §Constitution Check V). Done: verified — the failed seasonal card shows
      `[data-art-fallback]` at the same size as its siblings and the card's `<img>` is removed.
      The component needed no change.
- [X] T024 [US4] Verify the mascot failure path in `app/components/HomeMascot.vue`: on `error` the
      `<img>` is removed, the fixed box collapses to nothing visible, no broken-image indicator
      appears, and the catalog is untouched and fully usable (FR-008, SC-013, data-model.md
      §Home Mascot). Done: verified — the failed mascot leaves an empty fixed box that shows
      nothing, no broken-image indicator appears anywhere on the page, and the catalog keeps its
      five cards, their sizes and their links. The component needed no change.

**Checkpoint**: All four stories work independently — a failed asset degrades silently and the
catalog stays intact.

---

## Phase 7: User Story 5 - The catalog's existing guarantees survive (Priority: P3)

**Goal**: The new artwork changes nothing else: the same five games in the same order, the same
uniform cards, no horizontal scrollbar at any width, the whole catalog still fitting a 1920x1080
screen, the same keyboard and screen-reader behavior, and the More or Less and Groups artwork
untouched.

**Independent Test**: Run the existing home-page checks for catalog completeness, uniform card size,
overflow, hover and focus behavior, locale switching, and artwork replacement, with the mascot and
the new seasonal art in place (spec US5).

- [X] T025 [US5] Run `npm test` and confirm every pre-existing Vitest suite still passes unchanged
      with the mascot and the new seasonal art in place, including `tests/i18n.test.ts` and
      `tests/game-art.test.ts` (FR-028, SC-018). Done: 66 tests in 23 files pass (63 before this
      feature, plus the three new asset-contract tests).
- [X] T026 [US5] Run `npm run test:viewport` and confirm `e2e/home-catalog.spec.ts` and
      `e2e/viewport-fit.spec.ts` still pass: the same five games in the same order, no horizontal
      scrollbar at any supported width, the catalog still fitting 1920x1080 without vertical
      scrolling with the mascot present, the hover and focus behavior unchanged, and the More or
      Less and Groups artwork unchanged (FR-017, FR-031, SC-015, SC-021). Done: the whole
      Playwright suite passes — 16 tests, the 6 existing home-catalog tests and the 6 existing
      viewport-fit tests among them.
- [X] T027 [US5] Confirm `app/i18n/en.ts` and `app/i18n/es.ts` are byte-identical to their
      pre-feature content: the feature introduces 0 user-facing strings, so both catalogs stay
      complete with 0 missing or fallback strings, and switching locale leaves the artwork
      unchanged (FR-029, FR-034, SC-016, spec US5 scenario 4). Done: both files hash identically
      to their `HEAD` versions, and `tests/i18n.test.ts` passes.

**Checkpoint**: All five stories are independently functional and every pre-existing guarantee still
holds.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, dependency hygiene, and the full validation pass.

- [X] T028 [P] Update `README.md`: the layout table entry for `public/games/` and the "Home game
      artwork" section, which currently states that each home card uses one original SVG from
      `public/games/`, must now describe the three seasonal WebP files, the mascot under
      `public/artwork/`, and the committed sources under `artwork/sources/` that are never served.
      Done: the layout table gained `public/artwork/` and `artwork/sources/` rows and the
      `public/games/` row now reads "one image file per game"; the "Home game artwork" section
      describes the three seasonal WebP files, the mascot, the unserved sources, and the
      `artwork:build` / `artwork:check` scripts.
- [X] T029 [P] Confirm the feature adds 0 dependencies: `git diff package.json` shows only the two
      script entries added in T003, with `dependencies` and `devDependencies` unchanged, and neither
      `Pillow` nor any image library appears anywhere in `app/`, `server/`, `tests/`, or `e2e/`
      (FR-033, SC-017, Constitution VI). Done: `package.json` differs from `HEAD` only by the two
      script entries, `dependencies` and `devDependencies` are identical, and `PIL` is imported
      only by `scripts/artwork/build.py` and `scripts/artwork/check.py`.
- [X] T030 Run the full validation pass from `specs/013-home-artwork/quickstart.md`: `npm test`,
      `npm run test:viewport`, `python3 scripts/artwork/build.py`,
      `python3 scripts/artwork/check.py`, `python3 scripts/artwork/check.py --rebuild`, and the
      manual checks in the guide — the mascot follows the viewport, no card text is covered at the
      default text size, the click under the mascot opens the game, the mascot has no light
      rectangle in dark mode, the three seasonal cards read as their seasons, a blocked image
      degrades to the placeholder, no horizontal scrollbar appears from 320 to 1920 pixels, and at
      200% text zoom the mascot stays inside the viewport, the page never scrolls sideways and the
      five cards keep the same size — with the documented overlap below about 1024 pixels recorded
      as an accepted limitation rather than treated as a failure — and
      `GET /artwork/sources/matchi-spring.jpg` returns 404.
      Done — commands: `npm test` 66/66 in 23 files pass; `npm run test:viewport` 16/16 pass;
      `build.py` rebuilds the five assets byte-for-byte (the working tree is unchanged afterwards);
      `check.py` and `check.py --rebuild` both report every asset smaller than its source, not a
      copy of it, inside its class ceiling and byte-identical to a rebuild. Manual checks: the
      mascot follows the viewport and never moves with the scroll (quickstart §1); no card text is
      covered at the default text size and the click under the mascot opens the game, in both
      locales (§2, covered by `e2e/home-artwork.spec.ts`); the mascot shows no light rectangle —
      its four alpha corners are 0 and only 87 of its 3,554 border pixels are opaque (§3); the
      three seasonal cards read as blossom, shore and red foliage (§4); a blocked mascot and a
      blocked seasonal image degrade to the neutral placeholder with the catalog intact (§5);
      `GET /artwork/sources/matchi-spring.jpg` returns 404 (§7).
      **Finding — 200% text zoom (§6)**: the mascot stays entirely inside the viewport, the page
      never scrolls horizontally and the five cards keep the same size at 200% text zoom, but the
      mascot overlaps card text at viewport widths of about 480, 640 and 900 pixels. The cause is
      that the clearance in band 1 rests on the card text being left-aligned and short: at 200%
      the text is twice as large, so a wrapped line reaches the viewport's inline-end corner where
      the mascot stands. The contract's band-1 token cannot be lowered to fix this, because a
      single token that is at least `17vw` at 320px/100% (the contract's measured value) and at
      most 0 at 480px/200% does not exist as a combination of `vw` and `rem`; band 2 avoids the
      overlap only because `(100vw - 55rem) / 2` goes negative at 200% and the mascot collapses to
      nothing.
      **Owner decision — accepted limitation, recorded 2026-11-13**: the project owner accepted the
      overlap at 200% text zoom below roughly 1024 pixels as a known, documented limitation for
      this rare condition, not a defect to be engineered away. The three ways to close it were
      each rejected — lower or drop band 1's token (which would make the mascot illegible at 320
      pixels), reserve a gutter for the mascot in the card text (which contradicts FR-001's "the
      layout reserves no space"), or engineer the mascot around the text. This task therefore
      **records the accepted limitation instead of failing on it**: the validation pass does not
      fail because of the overlap, and the manual check in `quickstart.md` §6 records the accepted
      outcome instead of expecting zero overlap. At the default text size no card text is covered
      at any tested viewport, and the automated no-overlap check in `e2e/home-artwork.spec.ts`
      runs at the default text size only, so it still holds. The limitation is recorded in
      `spec.md` (SC-022, the 200% edge case, the assumption, and the Clarifications bullet),
      `plan.md` §Verification, `contracts/home-mascot.md` §5, and `quickstart.md` §6. Everything
      else in this task passes.
- [ ] T031 [US2] Run the recognition study in `specs/013-home-artwork/quickstart.md` §8 with 10
      visitors and record the result in that guide. This is a manual study run by the project
      owner before release; it is not part of the automated test suite, and no automated test
      asserts it (SC-019). Not done: the study needs 10 people who have not seen the home page
      before, so it can only be run by the project owner. The "Recognition study result" section
      in `quickstart.md` §8 is left blank for that run.
- [ ] T032 Commit the feature on branch `013-home-artwork` with the source artwork, the processed
      assets, the tooling, the component, the stylesheet rule, the mapping change, the tests, and
      the README update — leaving `.env` uncommitted. Not done: the run was instructed not to
      create any commit, branch or push, so every change is left in the working tree for the owner
      to commit. `.env` is uncommitted and gitignored.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately. T002 (the project owner's written
  approval of "Python 3 with Pillow 12.x") is a **blocking prerequisite** for every task that
  imports Pillow: T006, T007, and T008.
- **Foundational (Phase 2)**: Depends on Setup (T006, T007 need the committed sources and the
  T002 approval on record; T008 needs T006; T009 needs T007 and T008) — **BLOCKS all user
  stories**, because US1 renders the mascot file and US2 maps the seasonal files.
- **User Stories (Phases 3-7)**: All depend on Foundational completion. They can then proceed in
  parallel or sequentially in priority order (P1 → P1 → P2 → P2 → P3).
- **Polish (Phase 8)**: Depends on the desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational — no dependency on another story. It consumes
  `public/artwork/matchi-mascot.webp` and creates `e2e/home-artwork.spec.ts`.
- **User Story 2 (P1)**: Starts after Foundational — no dependency on another story. It consumes
  the three seasonal WebP files.
- **User Story 3 (P2)**: Starts after Foundational — no dependency on another story. It verifies the
  files US1 and US2 ship, so its assertions run green either before or after them.
- **User Story 4 (P2)**: Starts after Foundational, and **edits the same file** as US1
  (`e2e/home-artwork.spec.ts`) — T022 must run after T010, not in parallel with it.
- **User Story 5 (P3)**: Starts after the stories it regresses against — it re-runs the existing
  suites with the mascot and the new art in place.

### Within Each User Story

- Tests are written and confirmed to FAIL before their implementation where the behaviour does not
  exist yet (US1, US2, and US4's card fallback). US3 is a verification phase whose tests pass on
  creation, and US4's failure test must fail if the shipped fallback behaviour is removed.
- Models before services before endpoints — for this feature: assets (Foundational) before the
  component that renders them, and the component before the page that mounts it.
- Core implementation before integration — the mascot component and the stylesheet rule before
  `app/pages/index.vue` mounts it.
- Story complete before moving to the next priority.

### Parallel Opportunities

- Setup tasks T001, T002, T003 are sequential by nature (the sources must exist before the build
  runs), but T004 (`artwork/README.md`) and T005 (commit check) touch different files from T003
  and are marked `[P]`.
- Foundational T006 (`build.py`) and T007 (`check.py`) are independent and run in parallel, once
  T002's approval is on record.
- T010 (the Playwright spec) is written in parallel with the component and stylesheet work.
- T019 (`tests/helpers/imageMeta.ts`) and T020 (`tests/artwork-assets.test.ts`) are marked `[P]`
  and are written in parallel.
- T022 (the failure test) is written in parallel with T023 and T024.
- T028 (README) and T029 (dependency check) are independent.
- Across stories, US1, US2, and US3 touch disjoint files and can be worked on by different people
  once Foundational is done.

---

## Parallel Example: User Story 1

```bash
# Launch the mascot work together (tests first, then the component and the rule).
# T013 (mounting <HomeMascot /> in app/pages/index.vue) is NOT part of this launch:
# it depends on T011 (the component) and T012 (the stylesheet rule).
Task: "Create e2e/home-artwork.spec.ts with the three mascot tests"
Task: "Create app/components/HomeMascot.vue"
Task: "Add the mascot rules to app/assets/css/main.css"
```

## Parallel Example: User Story 3

```bash
# Launch the header reader and the asset contract test together:
Task: "Create tests/helpers/imageMeta.ts"
Task: "Create tests/artwork-assets.test.ts with three Vitest tests"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup — commit the sources and record the owner's approval of the tooling.
2. Complete Phase 2: Foundational — build and check the pipeline, produce the five assets.
3. Complete Phase 3: User Story 1 — the mascot.
4. **STOP and VALIDATE**: load the home page, scroll top/middle/bottom at the six viewports, and
   confirm the mascot is visible, clears the text at the default text size, and never swallows a
   click.
5. Ship the mascot if it is ready on its own.

### Incremental Delivery

1. Setup + Foundational → the assets exist and are verifiable.
2. Add User Story 1 (the mascot) → validate independently → ship.
3. Add User Story 2 (seasonal card art) → validate independently → ship.
4. Add User Story 3 (the automated asset contract) and User Story 4 (failure paths) → validate
   independently → ship.
5. Add User Story 5 (regression pass) and the Polish phase → ship.

### Parallel Team Strategy

With multiple developers:

1. The team completes Setup + Foundational together.
2. Once Foundational is done:
   - Developer A: User Story 1 — the mascot component, rule, and mount (`e2e/home-artwork.spec.ts`).
   - Developer B: User Story 2 — the mapping change, the SVG deletions, and the artwork-map test.
   - Developer C: User Story 3 — the header reader and the asset contract test.
3. User Story 4's failure test is merged after User Story 1's spec file lands; User Story 5 runs the
   full regression pass last.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] labels map each task to a user story for traceability: US1 mascot, US2 seasonal artwork,
  US3 processed and light assets, US4 failure paths, US5 existing guarantees.
- Every task names the exact file it touches and the requirement it implements.
- The feature adds 7 new tests (3 Vitest new, 4 Playwright) plus 1 updated existing file
  (`tests/game-art.test.ts`) = 8 feature tests, against the 15-test cap (Constitution VI).
- No task may add an npm dependency; Pillow stays a build-time tool and its use is approved by
  name in writing by T002 before any script that imports it is written (FR-033).
- Verify the tests fail before implementing them, except where a task says otherwise (US3 is a
  verification phase; US4's failure test must fail if the shipped fallback is removed).
- Commit after each task or logical group.
- Stop at any checkpoint to validate the story independently.
- Avoid: vague tasks, same-file conflicts (`e2e/home-artwork.spec.ts` is written twice, by T010 and
  then T022, in that order; `tests/helpers/imageMeta.ts` may be written by T014 and then confirmed by
  T019, in that order), and cross-story dependencies that break independence.
