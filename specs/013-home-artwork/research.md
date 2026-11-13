# Phase 0 Research: Home Page Character Artwork

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

All Technical Context items are resolved. There are no `NEEDS CLARIFICATION` markers.

## R-001 — Where the source artwork lives and how it is named

**Decision**: Commit the five supplied files verbatim to `artwork/sources/` at the repository
root, keeping the delivered names: `matchi-board.png`, `matchi-spring.jpg`, `matchi-summer.jpg`,
`matchi-autumn.jpg`, `matchi-winter.jpg`. The tooling identifies the format from the file
content, never from the extension, and `artwork/sources/` stays outside `public/`, the only
directory the app serves.

**Rationale**: The sources are the provenance record required by FR-022 and SC-011: every shipped
asset must be traceable to exactly one committed source. Keeping the names as delivered makes
that record match what was actually handed over. `matchi-board.png` contains JPEG data, so the
suffix is wrong; that is a property of the delivered file, not of the repository, and the
correction belongs in the tooling rather than in a silent rename. Nuxt serves `public/` only, so a
top-level `artwork/` directory is unreachable from a browser by construction.

**Alternatives considered**:

- Rename `matchi-board.png` to `matchi-board.jpg`: tidier, but it breaks the link between the
  repository and the delivered file, and any external reference to the supplied name.
- Keep the sources under `public/`: that would serve multi-hundred-kilobyte originals and
  directly violates FR-022.
- Put the sources in `docs/` or `specs/`: mixes project assets with documentation and gives no
  obvious home for a directory that later tooling must read.

## R-002 — Artwork processing tooling

**Decision**: Use **Python 3 (3.11+) with Pillow 12.x** for the artwork pipeline, in two
developer-run scripts under `scripts/artwork/`: `build.py` (regenerate the processed assets) and
`check.py` (verify them against the sources). Pillow is not added to `package.json`, is not
imported by the app or the test suite, and is not required to build, run, or deploy the app: the
processed assets are committed.

**Approval record**: FR-033 and Constitution VI require the tooling to be approved by name
before use. The name is "Python 3 with Pillow 12.x"; the project owner's written approval of
that name is captured by the feature's tasks, not assumed: task **T002** in `tasks.md` records the
approver, the date, and the approval statement in `plan.md` (§Constitution Check, Gate VI) and
here in R-002, and it is a blocking prerequisite for every task that imports Pillow (T006, T007,
T008). No script that uses Pillow is written or run before that record exists.

**Rationale**: FR-033 forbids adding a dependency to the app's runtime or test toolchain but
requires any tooling used to produce artwork to be named and approved — so the constraint is on
the *project's* dependency surface, not on the developer's machine. The host already carries
Python 3.14 with Pillow 12.3, and Pillow provides exactly the four operations the feature needs:
crop and resize with a chosen resampling filter, alpha compositing, background matte construction
through pixel access, and WebP encoding with alpha. The alternative JavaScript libraries
(`sharp`, `jimp`) would each be a new npm dependency in the project, which FR-033 and the feature
request forbid.

**Alternatives considered**:

- `sharp` as a devDependency: the standard Node image pipeline, but it adds a package to the
  project's dependency tree and ships native binaries — exactly what FR-033 rules out.
- ImageMagick CLI: the classic choice, but it is not installed on the host, its background
  removal is a global colour key that would eat the mascot's white coat, and it adds an
  OS-level prerequisite.
- `ffmpeg` filters: available on the host, but its `colorkey`/`chromakey` filters are global
  brightness keys with no connectivity test, so the white coat would be keyed out too.
- Writing the pipeline in the browser or at request time: would put the source images and the
  tooling in the delivery path. Rejected outright by FR-030 and the delivery model.

**Owner approval**: Approved by the project owner on 2026-11-13: "Python 3 with Pillow 12.x" is approved as the artwork build-time tooling for feature 013-home-artwork. It is a build-time tool only: it is not added to package.json dependencies or devDependencies, it is not imported by app/, server/, tests/ or e2e/, and the processed assets are committed so the app never needs it to build, run or deploy. Toolchain verified on the developer machine: Python 3.14.7 with Pillow 12.3.0.

## R-003 — Output format and encoding settings

**Decision**: Ship WebP for all five new assets — the three seasonal card images at quality 78 and
the mascot at quality 80 with an alpha channel. Keep the two unchanged illustrations as SVG.

**Rationale**: WebP is rendered directly by every current evergreen browser (Chrome, Firefox,
Edge, Safari 14 and newer), which satisfies FR-025's "a format the supported browsers render
directly", and it carries an alpha channel, which the mascot needs. It is also the only practical
choice for the mascot: a 640-pixel-wide RGBA PNG of that illustration measures about 435 KB,
which would break both the 150 KB ceiling and the "smaller than its source" rule, while WebP at
quality 80 measures 59,758 bytes (59.8 KB) with no visible loss on flat illustration colour. The
two existing illustrations are untouched, so the artwork set is not uniform by format — and that is
fine, because the contract is one self-contained file per game, not one format for all games.

**Alternatives considered**:

- JPEG for the seasonal images and PNG for the mascot: universal support and trivially parseable
  headers, but the seasonal files would be 40-55 KB instead of 20-25 KB and the mascot PNG would
  blow the budget unless palette-quantized, which bands the skin and hair gradients.
- SVG tracing of the seasonal scenes: would keep the vector art family, but the sources are
  raster paintings, and tracing them would alter the artwork beyond the "resizing, cropping,
  compression, and background removal" that FR-027 permits.

## R-004 — Seasonal crop windows and card composition

**Decision**: The seasonal assets are **composed**, not merely cropped. Each scene is taken with a
760 px tall window at a per-scene vertical offset — spring `y=120`, summer `y=40`, autumn `y=60`,
winter `y=0` — and that window is pasted at 1:1 onto a 1351 px wide 16:9 canvas. The lateral
margins outside the 832 px wide foreground are filled with the whole scene scaled to cover the
canvas and blurred (radius 16), the foreground's edges are feathered 40 px into that backdrop, and
the finished canvas is resized to 800x450 with Lanczos and encoded as WebP at quality 78.

**Rationale**: The sources are 832x1248 portraits. A 16:9 window at the source's full width is
only 468 px tall — 37% of the source — and that first cut framed the character's head alone and
cut the chin at the bottom edge. The project owner reviewed the assets on **2026-11-13** and
found the framing too tight, asking for more of the character and more of the background; the
owner chose a waist-up framing with a blurred backdrop in the lateral margins, keeping the face
large and prominent. A plain crop cannot deliver that: the window's height is fixed by the 16:9
ratio, and the character is narrower than the frame, so no choice of `y` both keeps the head and
reaches the waist.

So the canvas height becomes the free parameter instead. 760 px is the window the framing needs:
it starts at or above the crown of the hair in every scene — spring's hair begins at `y≈172`,
summer's at `y≈76`, autumn's at `y≈102`, and the winter window starts at the very top of its
source (`y=0`) — and it reaches down to the character's waist, which is where the owner asked the
frame to stop. A 16:9 canvas 760 px tall is 1351 px wide, so
the composition is wider than the source is: the foreground keeps its own 832 px and the margins
take the rest.

The foreground is pasted at 1:1 so the character is never stretched; the margins carry the same
scene scaled to cover and blurred, so the colour and the atmosphere of the season continue past
the figure instead of leaving flat bands; and the 40 px feather blends the two together, so the
join reads as depth of field rather than as a pasted panel. The canvas and the 800x450 target are
both 16:9, so the final downscale is identical on both axes and nothing is distorted (FR-015,
FR-016, SC-008). The per-scene offsets are still needed — each scene puts the character at a
different height — and each one is chosen so the crown of the hair is never clipped.

**Alternatives considered**:

- A fixed fraction for all four scenes: simpler to state, but it cuts the top of the head in some
  scenes or pushes the face out of frame in others.
- A plain 16:9 crop, resized: rejected — it framed the head alone and cut the chin, which is what
  the owner reported on 2026-11-13.
- Scaling the foreground down to fit the 16:9 band instead of keeping it at 1:1: the whole scene
  would fit, but the character would shrink, which contradicts the owner's "keep the face large
  and prominent".
- Letterboxing the portrait into the 16:9 band (`object-fit: contain` does this at render time):
  it would keep the whole scene but shrink the character to a small figure with wide empty bars.
- Center crop on the detected face: needs face detection, which would add a dependency or a
  hand-tuned per-image offset with no better result.

## R-005 — Mascot background removal

**Decision**: Build the mascot's alpha with a **stacked border flood**. For a descending series of
whiteness thresholds (250, 244, 238, 232, 226, 220, 214, 208), mark the near-white pixels, flood
that region inward from the image border, and accumulate the result into an alpha channel: a pixel
that is reached from the border at some threshold becomes partly transparent, a pixel that is
never reached stays opaque. Then trim to the alpha bounding box.

**Rationale**: The mascot is drawn on a flat white backdrop, but its coat, shirt, clipboard, and
face are white or near-white too, so brightness alone cannot separate them. What separates them is
*connectivity*: the backdrop reaches the image border and the coat does not, because the drawing's
outline closes around it. Flooding from the border therefore removes exactly the backdrop and
keeps the white interior of the character. Stacking several thresholds produces a soft, antialiased
edge instead of a jagged one, which matters when the mascot sits over a dark page. The prototype
confirms the white coat, the clipboard, and the face all survive, with no speckling.

**Alternatives considered**:

- A global white key (`min(r,g,b) > 236`, no connectivity test): removes the coat as well. The
  first prototype did exactly this and produced a transparent character.
- A per-pixel luminance-to-alpha ramp: same failure mode — the coat is as bright as the backdrop.
- Manual masking of the character in an external editor: not reproducible from the committed
  sources, so the "derived from its source" guarantee could not be re-verified by the checker.
- Shipping the mascot with its white rectangle and relying on `mix-blend-mode: multiply`: breaks
  in dark mode (FR-007) and still needs a transparent asset.

## R-006 — Mascot output geometry

**Decision**: Trim the matted mascot to its bounding box and resize to 640 pixels wide, keeping the
proportional height (640x1137). The image is served as WebP with alpha.

**Rationale**: FR-024 fixes the width at 640 and requires a proportional height; trimming first
means the width is the character's own width rather than the width of the source canvas, so the
mascot is not padded by dead space. The trimmed result measures 59,758 bytes (59.8 KB),
comfortably inside the 150 KB ceiling and 58% of its 103,036-byte source, so the "smaller than its
source" rule holds with room to spare. The source aspect ratio is also recorded as a CSS token so
the browser reserves the box before the image arrives.

**Alternatives considered**:

- Keep the source canvas (1152x1712 scaled to 640x951): dead transparent margins shrink the
  character inside its box and make it render smaller for the same nominal width.
- Cap the height as well (for example 640x900, cropping the feet): the specification asks for a
  proportional height, so cutting the character is not an option.

## R-007 — Served locations and the artwork map

**Decision**: Serve the seasonal images at `public/games/<route-slug>.webp`, the mascot at
`public/artwork/matchi-mascot.webp`, and update `app/utils/gameArt.ts` so the three seasonal games
point at their new files. Delete the three replaced seasonal SVGs.

**Rationale**: The existing replacement contract — one stable public path per game, resolved
through a typed `Record<GameId, string>` — is what FR-018 and FR-032 keep in force, and it survives
a format change: swapping an SVG for a WebP is a one-line map edit plus a file replacement, with
no card markup, CSS, or behavior change. The mascot is not a game card, so it gets its own
directory rather than pretending to be a sixth game. The map stays exhaustive at compile time, so a
future game without artwork is a type error.

**Alternatives considered**:

- Keeping the `.svg` extension and writing raster bytes into it: breaks the file's format contract
  and every tool that trusts the extension.
- Importing the images through `app/assets/` so Vite hashes them: build-hashed names are less
  obvious to replace, and a dropped-in replacement would need a new import.
- Serving the mascot from `public/games/`: it would then look like a game's artwork in a directory
  whose meaning is "one image per game".

## R-008 — Where the winter asset lives

**Decision**: Process the winter scene and store it at
`public/games/match-the-series-winter-2026.webp`, mapped to no game and referenced by no
component, and assert in the Playwright suite that the home page never requests it.

**Rationale**: FR-020 wants the winter scene processed and stored beside the other seasonal
assets so that a future winter edition needs no re-sourcing. The path a future edition would map
is exactly this one, so storing it there means the future feature is a map entry and nothing
else. The file is inert: no card points at it, the home page never requests it, and it is excluded
from the 450 KB page budget. Keeping it out of `public/` instead would mean a future move, and
keeping it out of the repository would mean re-sourcing.

**Alternatives considered**:

- Do not process the winter scene at all: violates FR-020.
- Put it in a non-served directory such as `artwork/processed/`: contradicts "stored alongside the
  other seasonal assets" and forces a second move when the edition is built.
- Add a winter edition to the catalog: out of scope (FR-028).

## R-009 — Mascot placement and sizing

**Decision**: Render the mascot as `position: fixed` at the bottom inline-end corner of the
viewport, with `pointer-events: none`, and size it from one token, `--mascot-size`, whose value
is set per viewport band:

| Band | Applies at viewport widths | `--mascot-size` |
|------|---------------------------|-----------------|
| 1 — edge | 320px – 1023px | `min(17vw, calc(17dvh * 640 / 1137))` |
| 2 — margin | 1024px – 1920px | `min(calc((100vw - 55rem) / 2 * 0.8), calc(53dvh * 640 / 1137))` |

**Rationale**: The catalog is `.home { max-width: 56rem }` — 896 pixels — and it is centered, so
the free margin beside it is `(100vw - 896px) / 2`. That margin is zero for every viewport below
about 930 pixels: at 768 and at 1024 the mascot overlaps the catalog column, and at 360 and below
the single card column fills the viewport and its summary text spans the full card width. The
specification's own assumption — that wide viewports leave free margin for the mascot — is
therefore true only in the upper band, and the plan states the rule per band instead of assuming
one:

- **Band 2 (1024px and wider)** has a free margin of at least 64 pixels, so the token is capped by
  it: the mascot stands beside the catalog and never overlaps the card column.
- **Band 1 (320px – 1023px)** has no free margin. The mascot is anchored to the bottom
  inline-end corner of the viewport, in the region where the card's text does not extend — the
  card's text is left-aligned, so the card's inline-end corner carries no text — and the band's
  token is the largest value for which the automated geometry check finds no intersection
  between the mascot's rectangle and any card name, summary, or state text rectangle.

**Owner decision, 2026-11-13 — a 30 % larger mascot**: the project owner asked for the mascot to
be 30 % bigger, and each band took the largest value its band allows. Band 2's token became
`min(calc((100vw - 55rem) / 2 * 0.8), calc(53dvh * 640 / 1137))` — the mascot fills 80 % of the free column beside the
catalog caps it, so the measured box grows by +32 % at 1440x900, +31 % at 1920x1080, +32 % at
1280x800 and +31 % at 1152x768, and by +12 % at 1024x768, +9 % at 1088x768 and +26 % at 1120x768,
where the gap between the catalog's inner list and the viewport edge is too narrow to carry the
full 30 %. The margin term is `55rem`, not the catalog's own `56rem`: the term is a `min()`, so a
smaller value makes the mascot larger, and the catalog's inner list measures 872px, so `56rem`
under-counted the available gap and held the mascot below the requested size. `55rem` measures
the real gap, keeps 4px of clearance at the tightest widths, and never lets the mascot touch the
catalog. Band 1's token became `min(17vw, calc(17dvh * 640 / 1137))` — +6 % of the measured box —
because it is capped by the clearance rule above rather than by the +30 % request: `17` is the
largest token that clears every card text rectangle, and `18` fails at 768x1024, where the mascot
covers the card name and the summary text.

Both bands stay inside the hard ceilings (at most 35% of the viewport width and 55% of its
height): 17.0% of the width at 320x640 and 16.8% at 1920x1080, and 17.0% of the height in band 1
while band 2 reaches 53.0% of the height at 1920x1080 without crossing it. The height ceiling
was raised from 30% to 55% on 2026-11-13: the mascot is a tall figure, so filling the free
column to the right of the catalog necessarily takes more height than width, and the 30% ceiling
and the owner's requested size were geometrically incompatible. `pointer-events: none` is the only way to satisfy FR-003 without changing the
cards: a click under the mascot reaches the card exactly as it would without the mascot. Fixed
positioning keeps the mascot out of the document flow, so it reserves no space, adds no
scrollbar, and never moves with the scroll (FR-001, FR-004).

**Alternatives considered**:

- A JavaScript listener that repositions the mascot or measures the catalog: runtime cost, a
  hydration seam, and a second source of truth for a layout-only requirement.
- Reserving space in the layout for the mascot (padding, a footer row): directly forbidden by
  FR-001 and by the clarification that the layout reserves no space.
- Bottom inline-start (left) corner: the catalog's text is left-aligned, so the left corner is the
  worst place for clearance; the state row sits there.
- Stacking the mascot behind the cards: it would be hidden behind them on narrow viewports and
  fail the "entirely visible" requirement.
- A larger mascot (up to the 35%/30% ceilings): more presence, but less clearance from card text
  at every viewport where the catalog fills the width. Rejected for band 1 by the clearance rule
  itself, and adopted for band 2 by the project owner on 2026-11-13, where the free margin keeps
  the mascot off the catalog.

**Trade-off**: With no reserved space, the mascot can only be guaranteed not to cover text by
being small enough and by sitting where the left-aligned text leaves room. That is a
measurement, not an assumption, so the plan makes it a test: the mascot's rectangle must never
intersect the rectangle of any card name, summary, or state text, at every tested viewport, in
both locales, at three scroll positions. The rule is per band, not global: if a band's token
does not clear the text at a tested viewport, that band's token is lowered until it does — the
mascot never moves onto text, and no other band's token changes.

## R-010 — Mascot failure behavior and layout stability

**Decision**: Copy the existing `GameArt.vue` failure pattern: an `@error` handler flips a local
flag that removes the `<img>` and leaves an empty, fixed-size box. The mascot's box is sized by
CSS (`inline-size` plus `aspect-ratio`), and the image carries `width` and `height` attributes.

**Rationale**: Constitution V requires every failure path to render something usable, and the
existing card artwork already solved this problem the same way; reusing the pattern keeps the
codebase consistent and needs no new placeholder design. Because the box never depends on the
image's intrinsic size, the mascot cannot cause layout shift while loading (FR-010) and its
failure is invisible apart from the mascot's absence (FR-008).

**Alternatives considered**:

- A neutral placeholder box like the cards': the mascot has no background, so a visible placeholder
  would read as a broken card rather than a missing decoration.
- Leaving the `<img>` in place after an error: the browser would draw its broken-image indicator,
  which FR-008 forbids.
- Preloading the mascot and rendering it only after it loads: hides the mascot for the whole load
  and adds a state machine for no benefit.

## R-011 — Verification strategy

**Decision**: Three Vitest tests in a new `tests/artwork-assets.test.ts`, one updated
`tests/game-art.test.ts`, four Playwright tests in a new `e2e/home-artwork.spec.ts`, and the
build-time `scripts/artwork/check.py`.

**Rationale**: The requirements that are objectively checkable — that a shipped asset is smaller
than its source, is not a copy of it, has the required dimensions, and carries transparency — are
file facts, and they belong in `npm test` so they run in the normal gate. Reading an image's
dimensions and alpha flag without a library is a container-header parse: the WebP `VP8X`/`VP8L`/
`VP8 ` chunks and the PNG `IHDR` chunk both carry them, and a small helper
(`tests/helpers/imageMeta.ts`) covers the formats actually shipped. The rendered requirements —
the mascot's position, its clearance from text, click-through, no focus stop, no animation, and
the fallback — are Playwright's job, because only a real browser can measure them. The Python
checker stays the authoritative re-derivation: it rebuilds each asset from the committed sources
and can compare bytes, which proves the committed assets really are the sources' derivatives.
Seven new tests plus the one updated existing file (`tests/game-art.test.ts`) make eight feature
tests, against the constitution's 15-test cap.

**Alternatives considered**:

- Verifying the assets only in the Python checker: the normal `npm test` gate would not catch a
  wrongly committed or hand-edited asset.
- Snapshot or markup tests: forbidden by the constitution and useless for a visual feature.
- A component-testing library to mount the mascot in isolation: a new dependency for one
  decorative element.
- Reading the stylesheet source to assert the mascot's rules: forbidden by the constitution; the
  rendered geometry is asserted instead.

## R-012 — Copy and localization

**Decision**: Add no message keys. The mascot and the seasonal artwork carry no text, and the card
names, summaries, and state messages already exist in both catalogs.

**Rationale**: FR-029 and SC-016 require the two catalogs to stay complete and identical in
coverage. Nothing in this feature is spoken, so the catalogs need no change at all, and the
feature adds no user-facing string in either language.

**Alternatives considered**:

- An accessible label for the mascot ("Matchi"): the mascot is decorative, and FR-006 requires it
  to be ignored by assistive technology and to add no focus stop.
- A caption naming the season on each card: the season is already in the card's name.

## R-013 — Budget arithmetic

**Decision**: Ship the measured set: 24,030 bytes spring (24.0 KB), 18,154 bytes summer (18.2 KB),
20,646 bytes autumn (20.6 KB), 59,758 bytes mascot (59.8 KB), plus the unchanged 842-byte
`more-or-less.svg` and 1,491-byte `groups.svg` — 124,921 bytes in total, about 125 KB for the home
page, against the 450 KB ceiling. The winter asset (18,376 bytes) is stored but never requested.

**Rationale**: The ceilings are ceilings, but shipping at a quarter of the budget leaves room for
future quality increases without renegotiating the spec. The binding constraint is not the page
budget but the per-asset rule that a shipped asset must be smaller than its source: the mascot's
150 KB ceiling is looser than its 103,036-byte source, so the mascot is re-encoded until it is
under that source, which the WebP encoding satisfies at 59,758 bytes.

**Alternatives considered**:

- Shipping the seasonal scenes as PNG to keep one lossless pipeline: 360-460 KB per file, far
  beyond the 90 KB ceiling.
- Shipping at maximum quality: still inside the ceilings, but it would leave no headroom and
  would not change how the artwork looks at the sizes it is displayed.
