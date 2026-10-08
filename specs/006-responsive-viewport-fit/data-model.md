# Data Model: Responsive Viewport Fit (No Page Scroll)

- **Feature**: specs/006-responsive-viewport-fit
- **Date**: 2026-10-08

This feature changes **no data at all**: no tables, no API fields, no payload shapes, no
`useLocalProgress` storage entries, no i18n keys (research R-009). The model that matters is the
**rendered-state matrix** — every screen × state the fit contract must hold for — and the
**region priority tiers** that decide what compresses first and what (if anything) may scroll
inside the locked shell.

## 1. Region priority tiers

Every rendered region on a supported viewport is assigned exactly one tier (spec FR-003/FR-004,
research R-003):

| Tier | Rule | Members |
|------|------|---------|
| **P1 — Pinned** | Always fully visible, never scrolls, never clipped, never compressed below legibility | `.page-header` / `.home__header` (title, help, home link, language control), board grids (`grid-3x3`, `grid-4x4`, `.comparison`), action rows (Clear/Submit, More/Less, Next), `ResultPanel` summary + share control, `ErrorPanel` message + retry |
| **P2 — Compressible** | Shrinks via relative-unit spacing, height-bounded art, and grid rows before any scroll is considered | tile art (aspect as ceiling, cover-crop), gaps/padding (`clamp()`), clue card, badges, feedback lines, `CountdownBadge`, game cards |
| **P3 — Scroll-eligible** | Secondary detail; may receive an inner-scroll exception **only** if measurement at 1024x768 shows overflow after P2 compression (research R-003) | Match loss `.reveal-list`, Groups `.group-rows` stack |

Tiers are a contract, not a suggestion: verification asserts every P1 region's bounding box lies
inside the viewport on every screen × state (contract §3).

## 2. Rendered-state matrix

The gate runs against every reachable state. "Session" = same page load that produced the state;
"reloaded" = state restored from `useLocalProgress` (feature 003 keeps Groups rows mounted, Match
drops its reveal list on reload — research R-008).

| Screen | State | Regions present | P3 candidate | Budget note |
|--------|-------|-----------------|--------------|-------------|
| Home | loading | header, countdown, loading line | — | fits |
| Home | normal | header, countdown, h2, reset (dev-only), 3 game cards | — | fits (545–600) |
| Home | total failure | header, countdown, ErrorPanel | — | fits |
| Match | loading / error | header, loading line or ErrorPanel | — | fits |
| Match | in-progress | header, badge, clue card, feedback, h2, 3x3 grid, Next | — | +930…+1,020 → P2 compression required |
| Match | attempt error (in-progress) | above + attempt ErrorPanel | — | worst in-progress case |
| Match | loss, session | above + 18-entry reveal list + ResultPanel + share | `.reveal-list` | +1,630…+1,990 → deepest compression; P3 exception most likely here |
| Match | finished, reloaded | header, badge, clue, grid, ResultPanel + share (no reveal list) | — | +820…+910 → P2 required |
| Groups | loading / error | header, loading line or ErrorPanel | — | fits |
| Groups | in-progress (0 found) | header, badge, instruction, feedback, 4x4 grid, Clear/Submit | — | +556…+812 → P2 required |
| Groups | in-progress (some found) | above + 1–3 `.group-rows` + smaller grid | `.group-rows` if needed | rows and grid are mutually coupled |
| Groups | attempt error | any in-progress state + attempt ErrorPanel | — | +174px overlay case |
| Groups | finished, session (loss) | header, ResultPanel, badge, feedback, 4 revealed rows (grid hidden) | `.group-rows` | +335…+418 → P2 likely sufficient; P3 fallback |
| Groups | finished, reloaded | header, ResultPanel (0 rows) | — | fits (≈415) |
| More-or-Less | loading / error | header, loading line or ErrorPanel | — | fits |
| More-or-Less | in-progress | header, round badge, question, comparison, More/Less | — | fits (610) but fragile with error |
| More-or-Less | attempt error | above + nested ErrorPanel | — | **+23 → P2 mandatory** |
| More-or-Less | finished (loss + explanation) | header, ResultPanel with comparison + share | — | fits by ~27 → P2 mandatory |
| Error page (`error.vue`) | any | `main.page` + alert card + home button | — | fits |

## 3. Invariants per rendered state

For every row above, at every viewport ≥1024x768 (and every width ≥768px in the sweep):

1. **I-1 — No document scroll**: `document.scrollingElement.scrollHeight === clientHeight` and
   `scrollWidth === clientWidth` (directive; structural via the locked shell, verified because
   hidden overflow still inflates `scrollHeight`).
2. **I-2 — No clipping of P1**: every P1 region's `getBoundingClientRect()` lies within
   `0..innerWidth` × `0..innerHeight`.
3. **I-3 — No horizontal overflow**: no element's `right > innerWidth` or `left < 0` at any
   width ≥768px (FR-002).
4. **I-4 — Compression, not overflow**: content that does not fit shrinks/reflows inside the
   shell (FR-004); the only permitted overflow sink is an approved P3 region's own scroll
   container, and only after measurement proves P2 insufficient (R-003).
5. **I-5 — Failure visibility**: error/loading states obey I-1…I-3 with their retry action in P1
   (FR-008, Constitution V).

## 4. State transitions

None. The feature changes no state machine; the matrix above enumerates existing states for
verification coverage only.
