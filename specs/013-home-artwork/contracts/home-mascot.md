# Contract: Home Page Mascot

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

Covers the Matchi mascot: how it is rendered on the home page, how it is placed and sized, how it
behaves for pointer, keyboard, and assistive-technology users, and what happens when it fails to
load.

> **Superseded in part by feature 014** ([spec.md](../../014-game-mascot/spec.md)), 2026-11-14.
> FR-011 of this feature — "the mascot MUST appear on the home page only; game screens MUST keep
> their current presentation" — no longer holds: the mascot also appears on the five game screens
> (More or Less, Groups and the Spring/Summer/Autumn 2026 editions of Match the Series), in every
> state they can be in, with the same asset, the same size rule, the same corner and the same
> failure behaviour. The game-screen rules live in
> [feature 014's contract](../../014-game-mascot/contracts/game-mascot.md). Everything else in this
> contract remains in force.
>
> The home screen's own behaviour described here is unchanged: its rendered size, its corner, its
> behaviour and its file stay exactly as they are, with 0 differences. The implementation shares
> a single mascot component across the home screen and the game screens, and renames the
> mascot's markup, class names and test hooks, because those are internal and no visitor can see
> them. The names below are the current ones; the previous names are recorded in §8.

## 1. Component and DOM

One component, shared by the home screen and the game screens:
`app/components/Mascot.vue`, rendered by `app/pages/index.vue` on the home screen and by
`app/components/GameShell.vue` on the five game screens.

```text
<span class="mascot" data-mascot aria-hidden="true">
  <img
    class="mascot__img"
    data-mascot-image
    src="/artwork/matchi-mascot.webp"
    alt=""
    width="640"
    height="1137"
    decoding="async"
    draggable="false"
  />
</span>
```

- The wrapper is `aria-hidden="true"` and the image has an empty `alt`: the mascot is decorative
  and conveys nothing that the catalog text does not already say (FR-006).
- The image carries intrinsic `width` and `height` so the browser reserves the box before the
  file arrives (FR-010).
- The component owns one piece of state: a `failed` flag set by the image's `error` event. On
  failure the `<img>` is removed and nothing else changes — the same pattern `GameArt.vue` already
  uses for card artwork.

## 2. Placement

- `position: fixed`, anchored to the bottom inline-end corner of the viewport (`inset-block-end: 0`,
  `inset-inline-end: 0`).
- It floats over the page and is out of the document flow: it reserves no space, adds no document
  overflow, and does not change the catalog's width or the page's scroll behaviour (FR-001,
  FR-004).
- It does not move relative to the viewport when the visitor scrolls by wheel, touch, or keyboard
  (FR-001).
- **Superseded by feature 014:** the mascot now also appears on the five game screens, in every
  state they can be in. The error page and any other screen keep their current presentation
  (feature 013 FR-011, superseded by feature 014). The home screen's own placement and behaviour
  in this section are unchanged.
- It never animates and has no transition, so a visitor who prefers reduced motion sees exactly
  the same frame as every other visitor (FR-009).

## 3. Sizing

The mascot's inline size comes from one token, `--mascot-size`, whose value is set per viewport
band, and the source aspect ratio is preserved so the browser reserves the box before the file
arrives.

```css
.mascot {
  --mascot-ratio: 640 / 1137;
  --mascot-size: min(17vw, calc(17dvh * 640 / 1137));
  inline-size: var(--mascot-size);
  aspect-ratio: var(--mascot-ratio);
}

@media (min-width: 1024px) {
  .mascot {
    --mascot-size: min(calc((100vw - 55rem) / 2 * 0.8), calc(53dvh * 640 / 1137));
  }
}
```

The rule itself is unchanged by feature 014: the same token, the same two bands, the same 1024-pixel
boundary, and the same values. The game screens use it unchanged and do not re-derive it from
their own, narrower content column — see feature 014's contract §5.

| Band | Applies at viewport widths | Catalog geometry at that width | `--mascot-size` |
|------|---------------------------|-------------------------------|-----------------|
| 1 — edge | 320px – 1023px | `.home` is `max-width: 56rem` (896px) but the viewport is narrower, so the catalog column reaches the viewport's inline-end edge and no free margin exists beside it. | `min(17vw, calc(17dvh * 640 / 1137))` |
| 2 — margin | 1024px – 1920px | The catalog column is capped at 896px and centered, so a free column of `(100vw - 55rem) / 2` exists beside it. The term measures the gap to the catalog's inner list (872px), which is what the mascot must not touch. The mascot takes 80 % of that column, and the `53dvh` term is a ceiling that stops it taking over a wide, short window. | `min(calc((100vw - 55rem) / 2 * 0.8), calc(53dvh * 640 / 1137))` |

- **Owner decision on record, 2026-11-13 — the mascot fills 80 % of the free column.** The
  project owner first asked for a 30 % larger mascot and then, after seeing it rendered, asked
  for the mascot to occupy 80 % of the free column to the right of the centered catalog. Both
  bands were raised to the largest value their band allows:
  - **Band 2** takes `calc((100vw - 55rem) / 2 * 0.8)` — 80 % of the free column beside the
    centered catalog — capped by `53dvh`. The measured box is 194x345 at 1366x655, 224x398 at
    1440x900 and 322x572 at 1920x1080: the mascot is 78 % of the column at 1366px and 1440px,
    and 61 % at 1920px, where the `53dvh` ceiling binds. The margin term is `55rem`, not the
    catalog's own `56rem`: the catalog's inner list measures 872px, so `56rem` under-counted the
    free column by 8px on each side. The mascot never touches the catalog at any width.
  - **Band 1** takes `17vw`/`17dvh` — +6 % of the measured box. Its token is capped by the
    clearance check of §5, not by the +30 % request: `17` is the largest token for which the
    automated geometry check finds no intersection with any card name, summary, or state text,
    and `18` fails at 768x1024, where the mascot covers the card name and the summary text.
- The mascot scales down on narrow viewports and stays inside the viewport at every size (FR-005).
- It never exceeds 35% of the viewport width or 55% of its height. The height ceiling was raised
  from 30% to 55% on 2026-11-13: the mascot is a tall figure (a 640x1137 bitmap, an aspect ratio
  of 1:1.78), so filling the free column necessarily takes more height than width, and the 30%
  ceiling and the owner's requested size were geometrically incompatible. Band 1 keeps margin
  under both ceilings; band 2 reaches 53% of the height at 1920x1080 without ever crossing it:

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

  600x800 is a measured reference viewport for the sizing decision; the automated check runs at
  the other six.

- It never extends past the window's horizontal edges, so no horizontal scrollbar appears between
  320 and 1920 pixels (FR-004).

## 4. Input and Interaction

- `pointer-events: none` on the wrapper: the mascot never intercepts pointer or touch input, and
  any card, link, or control beneath it stays clickable and tappable (FR-003).
- The mascot is an image, so it is not focusable and adds no tab stop (FR-006).
- It has no animation and no hover effect, so it cannot change the card geometry.

## 5. Clearance from Card Text

- The mascot's rectangle must never intersect the rectangle of any card's name, summary, or state
  text, at any supported viewport, in either locale, at any scroll position (FR-002). At the
  default text size — the size the automated check runs at — no card text is covered at any tested
  viewport.
- The rule is per band, because the catalog's geometry changes with the viewport width:
  - **Band 2 (1024px and wider):** the centered catalog column is capped at 896px, so a free
    margin of at least 64px exists beside it and the band-2 token is capped by that margin. The
    mascot stands beside the catalog and never overlaps the card column.
  - **Band 1 (320px – 1023px):** the catalog column reaches the viewport's inline-end edge, so
    there is no free margin and the mascot does overlap the card column. It is anchored to the
    bottom inline-end corner of the viewport, in the region where the card's text does not extend
    — the card's text is left-aligned, so the card's inline-end corner carries no text — and the
    band's token is the largest value for which the automated geometry check finds no
    intersection with any card name, summary, or state text rectangle at the default text size.
    That token is `min(17vw, calc(17dvh * 640 / 1137))`: it was raised from `16vw`/`16dvh` on
    2026-11-13, and `18vw`/`18dvh` fails at 768x1024, where the mascot covers the card name and
    the summary text. Band 1 is therefore capped by this clearance check, not by the +30 % sizing
    request of the same date.
- Because the layout reserves no space for the mascot, this clearance is measured, not assumed.
  The automated check enforces it at every tested viewport, in both locales, at the top, middle,
  and bottom scroll positions. If a band's token does not clear the text at a tested viewport,
  that band's token is lowered until it does — the mascot never moves onto text, and no other
  band's token changes.
- **Known limitation — 200% text zoom.** Below about 1024 pixels, at 200% browser text zoom, the
  mascot overlaps card text. A wrapped card-summary line reaches the corner the mascot occupies,
  and no single size token is both wide enough to be legible at 320 pixels and narrow enough to
  clear the text at 480 pixels. The project owner accepted this overlap on 2026-11-13 as a
  documented limitation for this rare condition, not a defect to be engineered away: at the
  default text size no card text is covered at any tested viewport, and the automated clearance
  check runs at the default text size only. Nothing in the automated suite asserts that no card
  text is covered at 200% text zoom.

## 6. Failure Behavior

- If the mascot file is missing or fails to decode, the image element is removed and the home page
  stays completely usable: the catalog keeps all five cards, their sizes, and their links, and no
  broken-image indicator appears (FR-008, SC-013).
- The failure is silent by design: the mascot carries no information, so there is nothing to
  report and nothing to retry.

## 7. Verification

`npm run test:viewport` → `e2e/home-artwork.spec.ts` asserts, at 320x640, 360x640, 768x1024,
1024x768, 1440x900, and 1920x1080, and at the top, middle, and bottom scroll positions:

1. The mascot is fully inside the viewport, at the bottom edge, at every scroll position, and
   within its width and height shares.
2. No card name, summary, or state text rectangle intersects the mascot's rectangle, at the
   default text size. (At 200% text zoom below about 1024 pixels the overlap is an accepted
   limitation — see §5 — and is deliberately not asserted here.)
3. A playable card under the mascot's region still opens its game when clicked there.
4. The mascot adds no focusable element, performs no animation, and changes neither the
   catalog's width nor the page's scroll behaviour.
5. With the mascot request failed, the catalog is complete, no broken-image indicator appears,
   and the card images fall back to the existing neutral placeholder.

The measured boxes are the ones tabulated in §3. In band 2 the mascot's height reaches 44.2 % of
the viewport height at 1440x900 and 53.0 % at 1920x1080, both inside the 55 % ceiling that
FR-005 sets, so the size-share assertion runs close to its limit there; in band 1 the widest
measured box is 17.0% of the viewport width and the tallest is 17.0%
of the viewport height, both inside the FR-005 ceilings.

`npm test` → `tests/artwork-assets.test.ts` asserts the mascot asset's own contract: 640x1137
pixels, a transparent background, at most 150 KB, smaller than its source, and not a copy of it.

Feature 014 extends this verification to the five game screens: it asserts the same rendered size,
the same corner and the same file on each of them, and re-runs the existing game checks with the
mascot present. See `specs/014-game-mascot/spec.md` (SC-001, SC-002, SC-012, SC-018) and
[feature 014's contract](../../014-game-mascot/contracts/game-mascot.md) §10.

## 8. Renamed identifiers

Feature 014 renamed the mascot's internal identifiers when the component became shared. The
rendering, the size, the corner, the behaviour and the file are unchanged; the names below are
internal and no visitor can see them.

| Before | After |
|--------|-------|
| `app/components/HomeMascot.vue` | `app/components/Mascot.vue` |
| `.home-mascot` | `.mascot` |
| `.home-mascot__img` | `.mascot__img` |
| `data-home-mascot` | `data-mascot` |
| `data-mascot-image` | `data-mascot-image` (unchanged) |
| `/artwork/matchi-mascot.webp` | unchanged |

The home screen's own suite, `e2e/home-artwork.spec.ts`, is updated for the renamed test hook
only: no test is added, removed or weakened.
