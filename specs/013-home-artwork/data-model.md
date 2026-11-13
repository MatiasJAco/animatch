# Phase 1 Data Model: Home Page Character Artwork

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Summary

This feature introduces no database table, column, migration, server payload, or stored browser
field. It adds one static, file-based structure:

1. A **source artwork** record: a committed original image plus the identity of the one shipped
   asset derived from it.
2. A **processed asset** record: a shipped image with its dimensions, format, byte size, and
   transparency, bound to exactly one source and to at most one game — or, for the two
   pre-existing illustrations, a shipped image with `source` = `null` and `kind` =
   `pre-existing`, which this feature ships unchanged and does not process.
3. An **artwork set**: the collection of shipped images available to the app — seven in all: one per
   game (three processed seasonal assets plus the two pre-existing illustrations), plus the mascot,
   plus the winter asset reserved for a future edition.
4. A **home mascot** presentation state: a purely client-side, render-time decision about whether
   the decorative image is shown or has failed.

Everything is derived from files on disk at build time or at render time. Nothing is stored.

## Existing Inputs (unchanged)

| Input | Source | Fields used |
|-------|--------|-------------|
| Game identity | `server/game/ids.ts` | `GameId` union and `GAME_IDS` order |
| Artwork map | `app/utils/gameArt.ts` | `GameId` → served path under `public/` |
| Card markup | `app/components/GameArt.vue` | `data-art-image` / `data-art-fallback` |
| Home catalog | `app/pages/index.vue` | Five cards in `GAME_IDS` order |
| Display copy | `app/i18n/en.ts`, `app/i18n/es.ts` | Unchanged; no new key |
| Daily listing | Existing `/api/daily` response | Unchanged; the artwork does not depend on it |

No field above changes shape, and no field is added to any payload.

## Entity: Source Artwork

A committed original image in `artwork/sources/`, and the origin of exactly one processed asset.

| Field | Type | Rule |
|-------|------|------|
| `name` | string | The delivered file name, unchanged (`matchi-board.png`, `matchi-spring.jpg`, …) |
| `format` | `'jpeg' \| 'png' | other` | Detected from the file content, never from the extension |
| `bytes` | integer | Size of the committed file on disk |
| `dimensions` | `{ width, height }` | Intrinsic pixel size of the source |
| `derivedAsset` | path | Exactly one shipped asset; the inverse of the processed asset's `source` |

**Validation**

- The file exists in `artwork/sources/` and is committed to the repository.
- The directory is outside `public/`, so the file is not reachable by a visitor's browser.
- The format is read from the content: `matchi-board.png` carries JPEG data under a `.png` name,
  and every tool in the pipeline must ignore the suffix.
- Exactly one processed asset points at each source; a source with no derived asset fails the
  asset check (the edge case in the spec: a missing source means the shipped asset has nothing to
  be checked against).

## Entity: Processed Asset

A shipped image. Five of them are processed derivatives of exactly one source artwork; the two
pre-existing illustrations are shipped unchanged and have no source.

| Field | Type | Rule |
|-------|------|------|
| `path` | string | Served path from the site origin; unique per asset |
| `source` | string \| null | Name of the one source artwork it derives from; `null` for a pre-existing asset |
| `kind` | `'card' \| 'mascot' \| 'reserved' \| 'pre-existing'` | What the asset is for |
| `game` | `GameId \| null` | Set only for a card asset; exactly one game per card asset |
| `format` | `'webp' \| 'svg'` | One file, rendered directly by the supported browsers |
| `dimensions` | `{ width, height }` | Card asset: exactly 800x450. Mascot: 640x1137 — 640 wide, with a height proportional to the trimmed composition of its source |
| `bytes` | integer | Smaller than its source, and inside its class ceiling |
| `alpha` | boolean | True only for the mascot; false for card assets |
| `served` | boolean | False for a reserved asset that no game maps |

**Validation**

- Every card asset is 800x450 and at most 90 KB (FR-024).
- The mascot asset is 640 pixels wide with a height proportional to the trimmed composition of its
  source — the shipped asset measures 640x1137 pixels — has a transparent background, and is at
  most 150 KB (FR-023, FR-024).
- Every processed asset is smaller in bytes than its source and is not byte-for-byte identical to
  it (FR-021).
- Every processed asset derives from exactly one committed source, and every source has exactly
  one processed asset (FR-022). A pre-existing asset is not processed by this feature: its
  `source` is `null`, it is not re-encoded, and the source comparison does not apply to it — it
  is only required to be byte-identical to its pre-feature file (FR-017).
- The asset is a single file: no second fallback file, no external reference, no hotlinked
  origin (FR-025, FR-030).
- A reserved asset is stored but mapped to no game and is requested by no page (FR-020).

## Entity: Artwork Set

The complete collection of shipped images available to the app — seven in all: five card assets,
the mascot, and the reserved winter asset.

| Field | Type | Rule |
|-------|------|------|
| `cardAssets` | one per `GameId` | Five entries, one per game, each a distinct existing file: three processed seasonal assets and two pre-existing illustrations |
| `mascotAsset` | one | Exactly one mascot asset, referenced by the home page only |
| `reservedAssets` | zero or more | Stored, unmapped, and not requested (currently the winter scene) |
| `homePageBytes` | integer | Sum of the five card assets plus the mascot — the set the home page actually serves; at most 450 KB (FR-026) |

**Validation**

- The card assets map one-to-one onto `GAME_IDS`; the paths are distinct and each file exists
  (FR-018, SC-014).
- The More or Less and Groups assets are byte-identical to their pre-feature files (FR-017), and
  they are `kind` = `pre-existing` with `source` = `null` — they have no source artwork and are
  not processed by this feature.
- `homePageBytes` counts the set the home page serves: the three processed seasonal images, the
  mascot, and the two pre-existing illustrations, and it excludes reserved assets. It is the sum
  of the served set, not the sum of the processed assets alone (FR-026).
- No asset in the set is reachable from an external host.

## Entity: Home Mascot

The decorative presentation state of the mascot on the home page.

| Field | Type | Rule |
|-------|------|------|
| `asset` | path | The one mascot asset |
| `loaded` | boolean | True while the image is available; false after a load failure |
| `role` | `'decorative'` | Always decorative: `aria-hidden`, empty `alt`, no focus stop (FR-006) |
| `position` | `'bottom inline-end'` | Viewport-anchored, outside the document flow (FR-001) |
| `size` | per-band token | `--mascot-size`: band 1 (320px–1023px) `min(17vw, calc(17dvh * 640 / 1137))`; band 2 (1024px–1920px) `min(calc((100vw - 55rem) / 2 * 0.8), calc(53dvh * 640 / 1137))` |
| `pointerEvents` | `'none'` | Never intercepts pointer or touch input (FR-003) |

**Validation**

- The mascot renders on the home page and nowhere else (FR-011).
- Its box is inside the viewport at every scroll position, and it is at most 35% of the viewport
  width and 55% of its height (FR-001, FR-005); in band 2 its height reaches 53% of the ceiling
  without crossing it. The height ceiling was raised from 30% to 55% on 2026-11-13, because the
  mascot is a tall figure and filling the free column beside the catalog — the owner's
  requested size — necessarily takes more height than width.
- Its rectangle never intersects the rectangle of a card's name, summary, or state text (FR-002).
- It adds no focusable element and no information of its own (FR-006).
- It performs no animation and no motion effect (FR-009).
- A load failure removes the image and leaves the page fully usable with no broken-image
  indicator (FR-008).
- Its presence changes neither the catalog's width nor the page's scroll behaviour (FR-001).

## State Transitions

| Current state | Trigger | Next state | Home-page effect |
|---------------|---------|------------|------------------|
| Absent | Home page renders | Loading | Fixed box reserved; no layout shift |
| Loading | Image decoded | Loaded | Mascot visible at the bottom inline-end corner |
| Loading | Image fails | Failed | Image removed; catalog unchanged and fully usable |
| Loaded | Visitor scrolls | Loaded | Position unchanged relative to the viewport |
| Loaded | Window resized | Loaded | Box re-measured from the CSS tokens; still inside the viewport |
| Loaded | Locale switched | Loaded | Artwork unchanged; only card text changes |
| Loaded | UTC day rolls over | Loaded | Artwork unchanged; it does not depend on the day |
| Loaded | Any | Absent | Leaving the home page removes the mascot entirely |

## Relationships

```text
Source Artwork (1) ──< Processed Asset (1 per source)
Processed Asset (0..1) ──> GameId (0..1 per card asset)
Processed Asset (1) ──< Home Mascot (0..1, the mascot asset)
GAME_IDS (1) ──< Artwork Set (1 card asset per game)
Artwork Set (1) ── (1) Home Catalog (unchanged; three entries now reference seasonal artwork)
```

The two pre-existing illustrations belong to the artwork set and to the home catalog, but to no
source artwork: they are `kind` = `pre-existing` with `source` = `null`.

## Non-Goals

- No database, migration, server response, or API change.
- No user account, session, saved state, or cross-device record.
- No new game, route, edition, or daily content; the winter edition stays out of scope.
- No user-facing text, so no message-catalog change in either language.
- No runtime or test dependency, and no build step in the deployment path: the processed assets
  are committed files.
