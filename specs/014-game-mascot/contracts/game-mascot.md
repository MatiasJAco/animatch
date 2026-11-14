# Contract: Game Screen Mascot

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

Covers the Matchi mascot on the game screens: where it is mounted, how it is placed and sized,
how it behaves for pointer, keyboard and assistive-technology users, how it coexists with the
board, and what happens when it fails to load.

This contract **extends** feature 013's mascot contract, which remains in force for the home
screen, to the five game screens. The home screen's own behaviour is unchanged and is specified in
[`specs/013-home-artwork/contracts/home-mascot.md`](../../013-home-artwork/contracts/home-mascot.md).

## 1. Scope and the supersession

- This feature supersedes **feature 013's FR-011** — "The mascot MUST appear on the home page
  only; game screens MUST keep their current presentation" — with effect from 2026-11-14. The
  mascot appears on the home screen **and** on the five game screens, in every state they can be
  in, with the same asset, the same size rule, the same corner and the same failure behaviour.
- Everything else in feature 013 stays in force: the mascot asset and its budget, the size rule
  and its two viewport bands, the 1024-pixel boundary, the home screen's corner, the decorative
  and still behaviour, the silent failure, and the home screen's own clearance rule.
- The home screen's mascot is unchanged for the visitor: the same rendered size, the same corner,
  the same behaviour and the same file, with **0 differences**. Sharing one component across
  screens, and renaming the mascot's markup, class names and test hooks, are internal changes
  that no visitor can see (SC-012).

## 2. Component and DOM

One component, shared by every screen that carries the mascot:
`app/components/Mascot.vue`, renamed from `app/components/HomeMascot.vue`.

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
  and conveys nothing that the screen's own text does not already say (FR-018).
- The image carries intrinsic `width` and `height` so the browser reserves the box before the
  file arrives (FR-021).
- The component owns one piece of state: a `failed` flag set by the image's `error` event. On
  failure the `<img>` is removed and nothing else changes — the same pattern `GameArt.vue` already
  uses for card artwork.
- The component's behaviour is unchanged from feature 013. Only the file name, the class names and
  the wrapper's test hook differ, and no visitor can see any of them.

## 3. Mount point and screen coverage

- **Home screen** — `app/pages/index.vue` renders `<Mascot />` inside `<main class="home">`, in
  the same position as before.
- **Game screens** — `app/components/GameShell.vue` renders `<Mascot />` as a sibling of its
  slot, after the slot content:

  ```text
  <main class="game-shell">
    <header class="game-header">…</header>
    <slot />
    <Mascot />
  </main>
  ```

- `GameShell.vue` is the frame every game screen already renders through, so one mount covers all
  five: More or Less, Groups, and the Spring 2026, Summer 2026 and Autumn 2026 editions of Match
  the Series (FR-001). A future game built on the same frame carries the mascot with no separate
  decision.
- The mascot is rendered by the frame, **outside every state branch** of the slot — the loading
  copy, the error panel with its retry, the result panel and the board are all branches of the
  same slot. The mascot is therefore present in every state a game screen can be in: loading,
  playing, finished and puzzle-unavailable (FR-002, SC-003).
- The mascot does **not** appear on the app's error page, and on no screen other than the home
  screen and the five game screens (FR-004). The error page is a separate Nuxt root component and
  renders none of the frames above.

## 4. Placement and anchor

- `position: fixed`, anchored to the bottom inline-end corner of the viewport
  (`inset-block-end: 0`, `inset-inline-end: 0`) — the same corner, on every screen (FR-008,
  SC-002).
- It floats over the page and is out of the document flow: it reserves no space, adds no document
  overflow, and does not change the board's geometry or the page's scroll behaviour (FR-012,
  FR-017).
- It does not move relative to the viewport when the visitor scrolls by wheel, touch or keyboard,
  and it re-anchors to the new viewport when the window is resized (FR-011).
- **Constraint on placement.** `position: fixed` resolves against the viewport only while no
  ancestor establishes a containing block for fixed-position descendants. The mascot must not be
  placed inside an ancestor carrying `contain: layout`, `contain: paint`, `transform`, `filter`,
  `backdrop-filter` or `will-change`. `.home` carries `container-type: inline-size`, which does
  not establish one in the browsers this project tests (verified in Chromium); the check in §10
  asserts the viewport anchor on all six screens, so a change that broke the anchoring would fail
  the gate rather than ship.

## 5. Sizing

The mascot's inline size comes from one token, `--mascot-size`, whose value is set per viewport
band, and the source aspect ratio is preserved so the browser reserves the box before the file
arrives. **The rule is the home screen's rule, reused unchanged.**

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

| Band | Applies at viewport widths | `--mascot-size` |
|------|---------------------------|-----------------|
| 1 — edge | 320px – 1023px | `min(17vw, calc(17dvh * 640 / 1137))` |
| 2 — margin | 1024px – 1920px | `min(calc((100vw - 55rem) / 2 * 0.8), calc(53dvh * 640 / 1137))` |

- Both bands are expressed in viewport units only, so the mascot's rendered box on a game screen
  is identical to its box on the home screen at the same viewport width: the width and the height
  each match within one pixel (FR-006, SC-001).
- There is **no second size rule** for the game screens, and the rule is **not** re-derived from
  a game screen's own content width (FR-007). Band 2's margin term is the home screen's free
  column term (`55rem`); re-deriving it from the game screens' narrower column would make the
  mascot *larger* on the game screens than on the home screen, which is exactly what "the same
  mascot, at the same size" forbids.
- The band boundary stays at 1024 pixels (FR-009).
- The mascot remains entirely inside the viewport at every supported width and never occupies
  more than 35% of the viewport's width or 55% of its height (FR-010).

| Viewport | Band | Mascot box | Share of width | Share of height |
|----------|------|------------|----------------|-----------------|
| 320x640 | 1 | 54x97 | 17.0% | 15.1% |
| 360x640 | 1 | 61x109 | 17.0% | 17.0% |
| 768x1024 | 1 | 98x174 | 12.8% | 17.0% |
| 1024x768 | 2 | 58x102 | 5.6% | 13.3% |
| 1440x900 | 2 | 224x398 | 15.6% | 44.2% |
| 1920x1080 | 2 | 322x572 | 16.8% | 53.0% |

- **Clearance from the game screen's content column at 1024 pixels and wider.** The game screens'
  column is `.game-shell { max-width: 46rem }` (736px), narrower than the home catalog's, so the
  shared token clears it by more room than it clears the catalog. With `W` the viewport width the
  clearance is at least `(W − 736) / 2 − 0.4(W − 880) = 0.1W − 16`, positive for every `W ≥ 1024`:

  | Viewport | Game column right edge | Mascot left edge | Clearance |
  |----------|-------------------------|------------------|-----------|
  | 1024x768 | 880px | 966px | 86px |
  | 1440x900 | 1088px | 1216px | 128px |
  | 1920x1080 | 1328px | 1598px | 270px |

  At 1024 pixels and wider the mascot overlaps the game screen's content column by **0 pixels**
  (FR-013, SC-005).

## 6. Non-interference with play

- `pointer-events: none` on the wrapper: the mascot never intercepts pointer or touch input, and
  every tile, button and link beneath it stays clickable and tappable (FR-015, SC-006).
- The mascot MUST NOT change the game screens' board geometry, header geometry, action positions
  or scroll behaviour by any measurable amount (FR-017, SC-007). Because it is fixed-position and
  reserves no space, this holds by construction.
- The mascot MUST NOT produce a horizontal scrollbar at any window width from 320 to 1920 pixels,
  and MUST NOT extend beyond the window's horizontal edges (FR-016, SC-004).
- The mascot MUST NOT remove, hide or truncate any text. "Remove, hide or truncate" means
  changing the text or taking it out of the layout — not covering it (FR-014).

## 7. Accessibility, motion and display modes

- The mascot is decorative: it conveys no information that is not otherwise available as text, is
  ignored by assistive technology, and introduces no new focusable element or tab stop
  (FR-018, SC-008).
- It is a still image: no animation, no transition and no `prefers-reduced-motion` special case,
  so every visitor sees the same frame (FR-020, SC-009).
- It paints no opaque background against the dark surface, and it is the same drawing in both
  light and dark display modes. No contrast ratio is specified for the mascot and no automated
  check asserts one (FR-019, SC-017).
- It introduces no user-facing string; both message catalogs stay complete (FR-025, SC-013).

## 8. Failure behaviour

- If the mascot file is missing or fails to decode, the image element is removed and the game
  screen stays fully playable: the board still renders and still answers clicks and taps, no
  broken-image indicator appears, and no fallback image is requested (FR-022, SC-010).
- The failure is silent by design: the mascot carries no information, so there is nothing to
  report and nothing to retry.
- The mascot's box is sized in CSS, so its arrival or its failure causes no layout shift
  (FR-021).

## 9. Known limitation — the narrow-viewport cover

- Below 1024 pixels the game screen's column reaches the window's edge, so the mascot floats over
  the board's bottom inline-end region, exactly as it overlaps the catalog's card column on the
  home page.
- It MAY visually cover any board content in that region — tile artwork, labels, counts, the
  More/Fewer buttons and the status copy — provided that every tile, button and link beneath it
  still answers clicks and taps, and provided the covered content can be scrolled out from under
  the mascot by scrolling (FR-014, FR-015).
- The overlap is a **recorded known limitation**, accepted by the project owner on 2026-11-14,
  and it MUST NOT be resolved by changing the mascot's size or its corner.
- The properties it must never break: it changes no layout, swallows no click, adds no
  scrollbar, removes, hides or truncates no text, and leaves no covered item trapped under it
  (SC-016).
- Feature 013's 200% text-zoom limitation carries over unchanged: the mascot's size is set by the
  viewport rather than by the text, so below roughly 1024 pixels it overlaps text at that zoom.
  That was accepted on 2026-11-13 and is not reopened here.

## 10. Verification

`npm run test:viewport` → `e2e/game-mascot.spec.ts` asserts, in 4 tests that loop over the
screens, the viewports and the states:

1. **Presence per screen and per state.** The five game screens × the four states (loading,
   playing, finished, error): the mascot is present and visible in every combination. The states
   are reached deterministically — the loading branch by resolving the daily payload as `null`,
   the finished state through the device's own progress store, the error state by failing the
   daily request with the structured error body the app already handles. A 404 route shows no
   mascot (FR-002, FR-004, SC-003).

   The two non-default states are reached through a **client-side navigation**. All five game
   screens load the daily payload with `await useFetch`, so on a cold `page.goto()` the request
   is issued by the Nitro SSR process rather than by the browser: `page.route()` never fires and
   the screen renders the *playing* state, so a cold-load interception would pass without ever
   exercising loading or error. The test primes a full SSR load of the route, waits for the board,
   installs an interception scoped to that game's own daily URL, and then navigates client-side
   into the route — the pattern the project already uses in `e2e/home-header.spec.ts:864-888`.
   The interception is scoped per game, never a bare `**/api/daily`, so the home page's own
   listing fetch is not broken by it. Each state is confirmed to have been reached before the
   mascot is asserted: the loading branch shows the loading copy with no board, and the error
   branch shows the `section[role="alert"]` error panel.
2. **Same size, same corner, same file.** The 6 test viewports × the 6 screens: the home
   screen's mascot box is measured once per viewport and compared with each game screen's — the
   width and the height within 1 pixel, the inline-end and block-end edges within 1 pixel of the
   viewport's, and the loaded image URL identical on all six screens (FR-006, FR-008, SC-001,
   SC-002).
3. **It never gets in the way of playing.** The 5 routes: a resize sweep from 320 to 1920 pixels
   with no horizontal scrollbar; board and header geometry and the scroll metrics identical with
   and without the mascot; every control beneath the mascot's rectangle still answers a click; no
   focus stop; no animation (FR-015, FR-016, FR-017, FR-018, FR-020, SC-004, SC-006, SC-007,
   SC-008, SC-009).
4. **A failed mascot leaves the game playable.** The 5 routes with the mascot request aborted:
   the board still renders and answers a click, no broken-image indicator appears, and no
   fallback image is requested (FR-022, SC-010).

`npm run test:viewport` → `e2e/viewport-fit.spec.ts` is re-run **unchanged** with the mascot
present on every game screen: the board-first order, the header alignment, the board's growth,
the horizontal-overflow guarantee, both locales and the finished states all hold (FR-024, SC-015,
SC-018).

`npm run test:viewport` → `e2e/home-artwork.spec.ts` continues to assert the home screen's own
mascot contract — size, corner, clearance from card text, click-through, focus stop, motion and
the failure fallback — with the renamed test hook and no other change (SC-012).

`npm test` → `tests/artwork-assets.test.ts` already asserts the mascot asset's own contract:
640x1137 pixels, a transparent background, at most 150 KB, smaller than its source, and not a
copy of it. The file is reused byte-for-byte and is not re-encoded, re-cropped or duplicated
(FR-027, SC-011).
