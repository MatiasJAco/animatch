# Contract: Viewport Fit (UI Contract)

- **Feature**: specs/006-responsive-viewport-fit
- **Date**: 2026-10-08
- **Type**: UI / presentation contract (no API surface changes; the existing endpoint contracts
  in `specs/001-daily-anime-puzzles/contracts/openapi.yaml` are untouched)
- **Consumers**: the four pages + `error.vue` (producers), the browser verification gate
  (enforcer)

This contract defines the viewport-locked shell, the inner-scroll policy, and the exact
verification predicates. It is the enforceable form of spec FR-001…FR-006 and FR-008.

## 1. Shell contract

| Selector | Required properties | Notes |
|----------|--------------------|-------|
| `html` | `height: 100vh;` then `height: 100dvh;` (fallback order); `overflow: hidden;` | Second declaration wins where `dvh` is supported (Chrome/Edge 108+, Firefox 101+, Safari 15.4+) |
| `body` | `height: 100%; overflow: hidden;` | The legacy `overflow-x: hidden` band-aid is removed — horizontal overflow must surface in the gate, not be silently clipped |
| `.app` (`app/app.vue` root) | `height: 100%; overflow: hidden; display: flex; flex-direction: column;` | Class currently has no CSS rule anywhere |
| `.page`, `.home`, and the `main.page` root in `error.vue` | `flex: 1 1 auto; min-height: 0; overflow: hidden; display: flex; flex-direction: column;` (keeping `max-width` + centering) | Page roots become the inner column that holds the screen |
| Every intermediate container in the column chain (`.stack`, board section roots, `.card` where it hosts a board) | `min-height: 0` where it participates in height budgeting | The `min-height: 0` chain that lets `minmax(0, 1fr)` grid rows compress |

**Forbidden**: any fixed `height`/`min-height` in px on layout containers or tile art (button
`min-height: 44px` touch target and `outline` widths are exempt); any `position: fixed/sticky`
introduced to dodge the budget; any element whose layout height depends on the document scrolling.

## 2. Inner-scroll policy

**Default: none.** No region inside the shell scrolls unless it appears in the table below *and*
measurement at 1024x768 proves R-002 compression insufficient (research R-003).

| Region | Scroll allowed | Conditions |
|--------|----------------|------------|
| `html` / `body` / `.app` / page roots | **Never** | Shell is locked (directive) |
| Headers, board grids, action rows, `ResultPanel` summary + share, `ErrorPanel` + retry | **Never** | P1 tier — must be visible without any scrolling (FR-003) |
| `.reveal-list` container (Match loss) | Only if measured overflow remains after compression | P3; `min-height: 0; overflow: auto`; pinned siblings stay fully visible |
| `.group-rows` stack (Groups finished/in-progress) | Only if measured overflow remains after compression | P3; same conditions |

Every granted exception must be recorded in `quickstart.md` with its measurement (before/after px
at 1024x768). If no state overflows after compression, the policy degrades to "none" and the
exception rows stay unused.

## 3. Verification predicates (enforcement gate)

Run at each viewport **1920x1080, 1440x900, 1280x800, 1024x768** for every screen
(home, match-the-series, groups, more-or-less, error page) in every reachable state
(loading, playing, error, finished-session, finished-reloaded), per the state matrix in
`data-model.md` §2:

```js
// P1 — directive: no document scroll in either axis
const d = document.scrollingElement
d.scrollHeight === d.clientHeight   // vertical
d.scrollWidth  === d.clientWidth    // horizontal

// P2 — no clipped primary region
[...document.querySelectorAll(P1_SELECTORS)].every((el) => {
  const r = el.getBoundingClientRect()
  return r.left >= 0 && r.top >= 0
      && r.right <= window.innerWidth
      && r.bottom <= window.innerHeight
})

// P3 — no horizontal overflow anywhere at width >= 768
[...document.querySelectorAll('body *')].every((el) => {
  const r = el.getBoundingClientRect()
  return r.left >= -1 && r.right <= window.innerWidth + 1
})
```

Plus the **resize sweep**: from 1920x1080 step the width to 1024 in 60px increments (and heights
1080→768 in 48px steps), re-evaluating P1 at every step (SC-002), and the **locale sweep**: repeat
the core checks under `es` and `en` (SC-005).

**Assertion rules** (Principle VI): only rendered metrics (`scrollHeight`, `clientHeight`,
`getBoundingClientRect`) and user-visible text are asserted. Never stylesheet source, class string
contents, or markup snapshots.

**Fallback**: `@playwright/test` is owner-approved (2026-10-08) and the automated suite is the
gate; the devtools snippet in `quickstart.md` remains as a contingency check for reviewers
without the suite (research R-006). Scope of the suite is fixed: the four viewports, the 60px
resize sweep, both locales, and the bounding-box anti-clip assertions — no other checks, and no
other dependency.

## 4. Layout rules the contract relies on

- Content column stays `max-width: 46rem`, centered; all widths ≥768px keep ≥288px of horizontal
  slack at 1024px, so horizontal fit is structural (research R-008) — the P3 predicate exists to
  prove it, not because overflow is expected.
- Tile art: `aspect-ratio` acts as a ceiling under a height-derived `max-height`; images keep
  `object-fit: cover` so compression crops artwork instead of distorting it.
- Spacing: `--gap`, page/card/tile padding are `clamp()`-based, monotonic from 1024→1920.
- Grids: `grid-template-rows: repeat(N, minmax(0, 1fr))` inside the definite-height chain.

## 5. Out of scope (explicit)

Widths <768px (existing 640px behavior unchanged), browser zoom ≠100%, copy/i18n changes,
gameplay or payload changes, visual redesign beyond fit, new runtime dependencies.
