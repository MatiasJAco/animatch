# Contract: Home Artwork Assets

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

Covers the committed source artwork, the processed assets the app serves, the tooling that
produces them, and the rules that keep every shipped image a verifiable derivative of a
committed source.

## 1. Source Artwork

Committed originals. They are the provenance record and are never served.

| File | Format (by content) | Intrinsic size | Bytes | Derived asset |
|------|--------------------|----------------|-------|---------------|
| `artwork/sources/matchi-board.png` | JPEG | 1152x1712 | 103,036 | `public/artwork/matchi-mascot.webp` |
| `artwork/sources/matchi-spring.jpg` | JPEG | 832x1248 | 167,343 | `public/games/match-the-series-spring-2026.webp` |
| `artwork/sources/matchi-summer.jpg` | JPEG | 832x1248 | 111,180 | `public/games/match-the-series-summer-2026.webp` |
| `artwork/sources/matchi-autumn.jpg` | JPEG | 832x1248 | 138,118 | `public/games/match-the-series-autumn-2026.webp` |
| `artwork/sources/matchi-winter.jpg` | JPEG | 832x1248 | 116,700 | `public/games/match-the-series-winter-2026.webp` |

Rules:

- The names are the delivered names, kept verbatim. `matchi-board.png` contains JPEG data; every
  tool must detect the format from the content and must never trust the extension.
- The directory lives at the repository root, outside `public/`, so no visitor can request a
  source file.
- Each source has exactly one derived asset, and each processed asset has exactly one source,
  identified by name. The two pre-existing illustrations are not processed by this feature, so
  they have no source.

## 2. Processed Assets

Shipped files, served from the site origin.

| Served path | Source | Kind | Size | Bytes (measured) | Mapped game |
|-------------|--------|------|------|------------------|-------------|
| `/games/match-the-series-spring-2026.webp` | `matchi-spring.jpg` | `card` | 800x450 | 24,030 | `match_the_series_spring_2026` |
| `/games/match-the-series-summer-2026.webp` | `matchi-summer.jpg` | `card` | 800x450 | 18,154 | `match_the_series_summer_2026` |
| `/games/match-the-series-autumn-2026.webp` | `matchi-autumn.jpg` | `card` | 800x450 | 20,646 | `match_the_series_autumn_2026` |
| `/games/match-the-series-winter-2026.webp` | `matchi-winter.jpg` | `reserved` | 800x450 | 18,376 | none (reserved) |
| `/games/more-or-less.svg` | `null` (pre-existing, not processed) | `pre-existing` | 320x180 | 842 | `more_or_less` |
| `/games/groups.svg` | `null` (pre-existing, not processed) | `pre-existing` | 320x180 | 1,491 | `groups` |
| `/artwork/matchi-mascot.webp` | `matchi-board.png` | `mascot` | 640x1137, alpha | 59,758 | none (mascot) |

Rules:

- Each asset is a single file in a format the supported browsers render directly. No asset
  depends on a second fallback file, and no asset references an external origin.
- The three seasonal assets are 800x450 and at most 90 KB each. Each frames the character from the
  crown of the head down to the waist, at the character's own 1:1 scale, with the lateral margins
  carrying a blurred continuation of the same scene (FR-015, SC-008).
- The mascot asset is 640 pixels wide with a height proportional to the trimmed composition of its
  source — the shipped asset measures 640x1137 pixels — keeps a transparent background, and is at
  most 150 KB.
- Every processed asset is smaller in bytes than its source and is not byte-for-byte identical to
  it. The two pre-existing illustrations are not processed by this feature: they have no source
  artwork (`source` is `null`), they are not re-encoded, and they must stay byte-identical to
  their pre-feature files.
- The reserved winter asset is stored but mapped to no game and requested by no page. It is the
  seventh image of the artwork set and is excluded from the page budget.

## 3. Page Budget

The home page downloads the three seasonal card images, the mascot, and the two unchanged
illustrations: 124,921 bytes (about 125 KB) against the 450 KB ceiling. The reserved winter
asset is excluded because no page requests it. The budget is the sum of the set the home page
actually serves — three processed seasonal assets plus the mascot plus the two pre-existing
illustrations — not the sum of the processed assets alone.

## 4. Processing Pipeline

Tooling: **Python 3 (3.11 or newer) with Pillow 12.x**, run through two developer scripts. It is
build-time only: not a project dependency, not imported by the app or the tests, and not needed to
build, run, or deploy the app. The processed assets are committed. Neither script may be written
or run before the project owner's written approval of that tooling name is on record (FR-033,
Constitution VI; task T002 in `tasks.md`).

```bash
python3 scripts/artwork/build.py     # regenerate the processed assets from artwork/sources/
python3 scripts/artwork/check.py     # verify every shipped asset against its source
```

Steps, in order:

1. **Detect** the source format from the file content.
2. **Seasonal assets**: compose each scene on a 1351x760 canvas — 16:9 at 760 px tall, which is
   wider than the 832 px source allows:
   - **Foreground**: the 832 px wide source region taken at the per-scene vertical window (spring
     `y=120`, summer `y=40`, autumn `y=60`, winter `y=0`) and pasted at **1:1**, centred, so the
     character is never stretched. Every window starts at or above the crown of the character's
     hair — spring's hair begins at `y≈172`, summer's at `y≈76`, autumn's at `y≈102`, and the
     winter window starts at the very top of its source — so the top of the head is never
     clipped, and each one reaches down to the character's waist.
   - **Lateral margins**: the whole scene scaled to cover the 1351x760 canvas and blurred with a
     Gaussian radius of 16, so the season's colour and setting continue past the figure instead of
     leaving flat bands.
   - **Feather**: the foreground's left and right edges are blended into that backdrop over 40 px
     with a quadratic alpha ramp, so the join reads as depth of field rather than as a pasted
     panel.

   The composed 1351x760 canvas is then resized to 800x450 with Lanczos — the canvas and the
   target share the 16:9 ratio, so the downscale is identical on both axes and nothing is
   distorted — and encoded as WebP at quality 78.
3. **Mascot asset**: build the alpha with a stacked border flood (thresholds 250, 244, 238, 232,
   226, 220, 214, 208) so only the flat backdrop becomes transparent, trim to the alpha bounding
   box, resize to 640 pixels wide with Lanczos, then encode WebP at quality 80 with alpha.
4. **Write** the assets and print a table of dimensions and byte sizes.

The build is deterministic: the same sources and the same Pillow version produce the same bytes.

## 5. Replacement Procedure

### Replace an existing game's image

1. Put the new image at the same served path.
2. Keep the 16:9 ratio for a card image; `object-fit: contain` letterboxes a different ratio
   without changing the card's size.
3. If the new file has a different extension, rename the file and update the one line in
   `app/utils/gameArt.ts`; that is the only code change.
4. Reload the page and confirm the card's image changed and all five cards remain equal in size.

### Add artwork for a future game

1. Add the game to `GameId` / `GAME_IDS` through the normal feature process.
2. Add its file under `public/games/` using the route slug.
3. Add the matching mapping entry in `app/utils/gameArt.ts`; TypeScript requires it.

A future Winter 2026 edition needs only step 3: `public/games/match-the-series-winter-2026.webp`
is already processed and stored.

### Re-derive an asset from its source

1. Edit the crop window, the composition settings (canvas height, backdrop blur, feather), the
   matte thresholds, or the encoder settings in `scripts/artwork/build.py`.
2. Run `python3 scripts/artwork/build.py`.
3. Run `python3 scripts/artwork/check.py --rebuild`, which regenerates into a temporary directory
   and compares bytes, and `npm test`.

## 6. Verification

- `npm test` → `tests/artwork-assets.test.ts` asserts: every source is present and outside the
  served directory; every shipped asset exists, is smaller than its source, and is not identical to
  it; each seasonal asset is 800x450 and at most 90 KB; the mascot measures 640x1137 pixels, carries
  an alpha channel, and is at most 150 KB; the home-page total is at most 450 KB; the winter asset
  is stored and mapped to no game. A dependency-free header reader in `tests/helpers/imageMeta.ts`
  supplies the dimensions and the alpha flag, so no image library is needed.
- `npm test` → `tests/game-art.test.ts` asserts the per-game guarantee for vector and raster
  artwork alike: one distinct, self-contained, existing file per game, with no external
  references.
- `npm run test:viewport` → `e2e/home-artwork.spec.ts` asserts the home page's request set: the
  three seasonal images, the mascot, and the two unchanged illustrations are requested, and the
  reserved winter asset never is. The negative half of that assertion lives in the failure test,
  where the mascot request and one seasonal image are blocked and the remaining requests — the
  other two seasonal images and the two unchanged illustrations — are still made.
- `python3 scripts/artwork/check.py` re-derives every asset from the committed sources and
  reports any mismatch.

## 7. Approval and Licensing

- The tooling (Python 3 with Pillow 12.x) is named here for the approval that FR-033 and
  Constitution VI require, and it adds nothing to the app's runtime or test toolchain. The
  project owner's written approval of that name is **captured by the feature's tasks, not
  assumed**: task T002 in `tasks.md` records the approver, the date, and the approval statement in
  `plan.md` (§Constitution Check, Gate VI) and in `research.md` R-002, and it blocks every task
  that imports Pillow (T006, T007, T008).
- The supplied artwork is the project owner's own original artwork, created for this product; its
  provenance is the owner, and the feature copies nothing from any third-party site. The
  constitution's rule that branding, copy, layout, visual structure, and assets must not be
  copied from Futbol11 or any other puzzle site is satisfied affirmatively. The assets are used
  as supplied, credited to their source files, and are never copied, traced, or hotlinked from
  another site.
