# Research: Responsive Viewport Fit (No Page Scroll)

- **Feature**: specs/006-responsive-viewport-fit
- **Date**: 2026-10-08
- **Input**: `/speckit.plan` directive — "Viewport-locked shell: html/body and the app root are
  height 100dvh, overflow hidden. Only intentional inner regions may scroll, and only if the spec
  allows it (default: none). Fluid layout, relative units, 1024–1920px. Avoid fixed pixel heights
  that force document overflow. Verify in the browser at 1920x1080, 1440x900, 1280x800, 1024x768:
  `document.scrollingElement.scrollHeight === clientHeight` and `scrollWidth === clientWidth`."

The spec fixes the *what* (no document scrolling, no clipping, no horizontal overflow, compress
instead of overflow). The directive fixes the *how* at the shell level and mandates a browser
measurement gate. Every decision below records what was chosen, measured, or deferred.

## R-001 — Viewport-locked shell via `100dvh` + `overflow: hidden`

**Decision**: `html { height: 100vh; height: 100dvh; overflow: hidden }`, `body { height: 100%;
overflow: hidden }`, and `.app { height: 100%; overflow: hidden; display: flex; flex-direction:
column }`. Page roots (`main.page`, `main.home`, `main > .page` in `error.vue`) become flex
children with `flex: 1 1 auto; min-height: 0; overflow: hidden; display: flex; flex-direction:
column`. The document is structurally incapable of scrolling, so the directive's predicates
(`scrollHeight === clientHeight`, `scrollWidth === clientWidth`) hold by construction *only if no
child overflows* — which makes them a genuine overflow detector rather than a scrollbar check
(hidden overflow still contributes to `scrollHeight`).

**Rationale**: The directive names this pattern explicitly. `overflow: hidden` on the document is
the only way to guarantee "no page scrollbar at any sampled size during live resize" (SC-002);
`100dvh` tracks dynamic browser chrome instead of the stale `100vh` maximum. `body { overflow-x:
hidden }` (`main.css:54`) is removed in favor of the shell — it silently *clipped* horizontal
overflow before, which would have masked FR-002 failures from the measurement gate.

**Alternatives considered**: (a) `height: 100%` chain without `dvh` — rejected, directive requires
`100dvh` and `100%` collapses when any ancestor establishes a new containing block; (b)
`position: fixed` body — rejected, it breaks SSR paint and back/scroll restoration for no gain;
(c) `overflow-y: clip` only — rejected, `clip` forbids programmatic scroll but is less consistent
across engines than `hidden` for the scroll-metric predicates; (d) keeping `overflow-x: hidden` —
rejected, it hides horizontal overflow instead of failing the gate.

## R-002 — Compression strategy: height-bounded art, fluid grids, relative units

**Decision**: Content compresses in this priority order, all in relative units, **no fixed pixel
heights anywhere**:

1. **Spacing collapse**: `.stack` gaps currently double-count `p`/`h` margins (24px after any
   `p`, ~20px after any `h3`). `.stack > :where(p, h1, h2, h3) { margin-bottom: 0 }` reclaims
   ~50–60px per screen. `--gap`, `.page`/`.home` padding, `.card`/`.tile`/`.group-row` padding
   become `clamp()` expressions that shrink toward 1024px and grow toward 1920px.
2. **Height-bounded tile art**: `.tile__art` / `.comparison` art keeps `aspect-ratio` as a
   *ceiling* (`max-height` in rem/vh-derived terms), not the driver; the existing
   `.entity-art__img { height: 100%; object-fit: cover }` (`main.css:356-361`) already crops
   instead of distorting, so a shorter art box never breaks the artwork.
3. **Grids fill the remaining budget**: `.grid-3x3` / `.grid-4x4` get `grid-template-rows:
   repeat(N, minmax(0, 1fr))` inside a definite-height flex chain (`min-height: 0` on every
   ancestor), with `.tile { min-height: 0 }` so rows compress instead of forcing the document
   taller. Tile labels keep `overflow-wrap: anywhere` and stay visible.
4. **List/row compression**: Match's reveal list becomes two columns (it is already
   `display: grid`; 18 entries drop ~350px); `.group-row__tile` basis 5.5rem → ~3.5–4rem and
   `.group-row__criterion` 5rem → 4rem cut each row ~50px (4 rows: ~758px → ~500px).
5. **Comparison column trim** (More-or-Less): the middle "—" column is a full `1fr` (~220px for
   one glyph); `1fr auto 1fr` with bounded side columns reclaims ~90px of art height.

**Rationale**: The budget analysis (R-008) shows the sole cause of overflow is width-driven 3/4
art at 704px content width — grids alone exceed 768px before any header. Bounding art by
available height attacks 90% of the overage while keeping relative units throughout, as the
directive requires. Nothing here changes copy, DOM content, or gameplay (spec FR-007).

**Alternatives considered**: (a) shrinking root font-size to scale everything — rejected, it
degrades text legibility uniformly to fix a problem that is 90% art height, and it fights the
`rem`-based system; (b) fixed px tile heights — rejected outright by the directive; (c) hiding
the board in finished states — rejected as a visual redesign beyond what is required (spec scope)
and a regression of feature 003's "rows stay visible" decision; (d) CSS zoom/transform scaling —
rejected, transforms do not change layout height and would blur artwork.

## R-003 — Inner scroll: default none, exceptions only by measurement + approval list

**Decision**: No inner region scrolls by default. After R-002 compression is implemented, each
screen × state is measured at 1024x768 (the tightest supported viewport). If — and only if — a
state still overflows its locked shell, an inner-scroll exception may be granted to a region on
this approved list, in this order of preference:

1. **Match loss reveal list** (`.reveal-list` container) — 18 detail rows, secondary content
   (the loss *detail*, not the result or the controls).
2. **Groups revealed/found rows stack** (`.group-rows`) — secondary progress detail.

Never eligible for inner scroll: `html`/`body`/`.app`, page roots, `.page-header`/`.home__header`,
board grids (`grid-3x3`, `grid-4x4`, `.comparison`), action rows (Clear/Submit, More/Less, Next),
`ResultPanel` header and its share control, `ErrorPanel` with its retry button. Each exception is
`min-height: 0; overflow: auto` on that region only, sized by the flex budget so the pinned
regions stay fully visible.

**Rationale**: The spec's Assumptions permit prioritizing "secondary/transient content below
primary controls" while requiring that primary controls and the main board never need *document*
scrolling — and the directive allows intentional inner regions "only if the spec allows it".
The budget shows at least one state (Match loss in-session) cannot fit 18 reveal rows + grid +
result + controls in 768px even after compression, so a blanket "no scroll ever" rule would force
clipping (FR-004 violation) or a redesign (out of scope). Gating the exception on a measurement
keeps it honest: if compression wins, no region scrolls.

**Alternatives considered**: (a) one scroll wrapper for everything below the header — rejected, it
makes primary controls (share, submit) reachable only by scrolling a region, which fails SC-003's
spirit even though it is not document scroll; (b) no inner scroll under any circumstance —
rejected, it makes clipping inevitable in the documented worst case; (c) modal result/loss
dialogs — rejected as a redesign.

## R-004 — Verification: Playwright viewport suite asserting the directive's predicates

**Decision**: A dev-only Playwright suite (`e2e/viewport-fit.spec.ts`, `playwright.config.ts`)
serves the app and, for each of 1920x1080, 1440x900, 1280x800, 1024x768 across all four screens
in loading/playing/error/finished states:

1. `document.scrollingElement.scrollHeight === clientHeight` **and**
   `scrollWidth === clientWidth` — the directive's exact predicate;
2. every primary region's bounding box lies inside the viewport (`top ≥ 0`, `bottom ≤ innerHeight`,
   `left ≥ 0`, `right ≤ innerWidth`) — proves FR-003's "not clipped";
3. a resize sweep 1920→1024 in 60px steps re-checks (1) at every step (SC-002);
4. both locales (es, en) for the wrap checks (SC-005).

**Rationale**: The predicate must run in a real layout engine — `scrollHeight` from jsdom/happy-dom
is not layout. The scroll check alone cannot distinguish "fits" from "hidden overflow behind
`overflow: hidden`", so the bounding-box check is the anti-clipping half of the same gate. Vitest
stays the unit runner; Playwright lives in its own `testDir` so the vitest include pattern
(`tests/**/*.test.ts`) never picks it up.

**Alternatives considered**: (a) manual devtools checks at four sizes — rejected as the primary
gate (not repeatable, no resize sweep), but retained as the fallback in `quickstart.md` (R-006);
(b) vitest + a layout library — rejected, no real layout engine exists in the Node ecosystem that
the project may add without replacing Playwright anyway; (c) Puppeteer — equivalent capability,
Playwright chosen for first-class viewport/multi-page ergonomics; (d) system Chrome + raw CDP —
rejected, no browser is installed in the environment and CDP scripting would be more code than a
Playwright spec; (e) screenshot diffing — rejected, Principle VI forbids trivia assertions and
screenshots are brittle.

## R-005 — Change confined to the global stylesheet + app root

**Decision**: All shell and compression rules land in `app/assets/css/main.css` (the only
stylesheet; zero `<style>` blocks exist in `app/`), plus `.app` rules for the class that today
has no CSS anywhere (`app.vue:17`). Page roots keep their existing `main.page` / `main.home`
classes; the expected diff in the four `.vue` files and `error.vue` is zero-to-cosmetic (wrapper
attributes only if the flex chain needs an anchor). The dead `640px` media query and unused
`.match-board` rules are left untouched — they neither help nor hinder the fit and removing them
is scope creep.

**Rationale**: The grep audit found `overflow` only in `main.css`, no `100vh`/`100dvh`/
`max-height`/`position: fixed|sticky` anywhere in `app/`, and no layout assertions in `tests/` —
so a single-file layout change cannot break server code, i18n, storage, or existing tests. Feature
005's plan established the same "one stylesheet is the whole surface" observation.

**Alternatives considered**: (a) a new `shell.css` registered in `nuxt.config.ts` — rejected, adds
a file and a config edit for rules that belong next to the tokens they use; (b) scoped component
styles — rejected, the project has none and the shell must apply to every route including the
framework error page.

## R-006 — `@playwright/test` named for approval, with a manual fallback

**Decision**: This plan names **`@playwright/test` (dev-only)** as the single new dependency, per
Principle VI's procedure — **approved by the owner in writing on 2026-10-08**, scoped to the
viewport checks only (four viewports, 60px resize sweep, both locales, bounding-box anti-clip
assertions) with no other dependency permitted. It is never imported by `app/` or `server/`, never
shipped in deployment artifacts (Delivery Model). The manual procedure in `quickstart.md` is kept
only as a contingency record (e.g., CI without a browser); the automated suite is the gate.

**Rationale**: The directive mandates browser verification with a specific predicate; no browser
or automation package exists in the repo or environment today (grep: zero matches; no chrome/
firefox binary installed). Registry access is available (`npm view playwright` → 1.64.0, registry
HTTP 200), so approval is the only blocker. Naming it here — rather than sneaking it into
`package.json` — is exactly the approval path the constitution prescribes.

**Alternatives considered**: (a) unpinned `npx playwright` at verification time — rejected, it is
a dependency in disguise and worse (unversioned); (b) requiring a pre-installed system browser —
rejected, the environment has none and it would make the suite non-portable; (c) skipping
automation entirely — rejected while approval is available, because SC-002's sweep is
impractical by hand.

## R-007 — Test budget and assertion rules

**Decision**: The feature ships ~6 tests, all in the Playwright viewport suite: (1) scroll
predicates across all screens/states at 1920x1080; (2) same at 1440x900; (3) same at 1280x800;
(4) same at 1024x768 including both locales; (5) resize sweep 1920→1024; (6) primary-region
bounding-box visibility across screens. They assert rendered DOM metrics (scroll numbers,
`getBoundingClientRect`) and user-visible text presence only — never stylesheet source, class
string contents, or markup snapshots (Principle VI). Suite skips cleanly when `DATABASE_URL` or
the dev server is absent, matching the existing tests' no-network/no-DB behavior.

**Rationale**: Viewports × screens is a matrix, not 60 test cases — one test iterating the matrix
covers SC-001 while staying far under the 15-test cap with room for any post-implementation
consolidation. Geometry assertions are observable behavior, which is what Principle VI permits.

**Alternatives considered**: (a) one test per viewport × screen × state — rejected, blows the cap
for zero extra coverage; (b) asserting computed styles (e.g. `overflow` is `hidden`) — rejected,
that is stylesheet-text-adjacent trivia; the scroll metrics already prove the behavior.

## R-008 — Worst-case vertical budget (measured from the current CSS)

**Decision**: The plan's compression effort is prioritized by this budget, computed from the
current stylesheet at 1024x768 (content column 46rem = 736px, inner 704px, `1rem = 16px`):

| Screen / state | Est. height | vs 768 | Primary driver |
|---|---:|---:|---|
| Home, normal | 545–600 | fits | 3 game cards |
| Home, total-failure ErrorPanel | 310–330 | fits | — |
| Match, in-progress | 1,700–1,790 | **+930…+1,020** | `.grid-3x3` ≈ 1,000–1,060 (art 287px/row) |
| Match, loss in-session | 2,400–2,760 | **+1,630…+1,990** | 18-entry reveal list 739–1,100 + grid + result |
| Match, finished reloaded | 1,590–1,680 | +820…+910 | grid + ResultPanel |
| Groups, in-progress (0 found) | 1,324–1,406 (+174 with attempt error) | **+556…+812** | `.grid-4x4` ≈ 1,016–1,098 (art 208px/row) |
| Groups, finished in-session (4 rows + result) | 1,103–1,186 | **+335…+418** | `.group-rows` 663–758 + ResultPanel |
| Groups, finished reloaded (0 rows) | ≈415 | fits | rows dropped on reload |
| More-or-Less, in-progress | 610–615 | fits | comparison 367 |
| More-or-Less + attempt ErrorPanel | ≈791 | +23 | nested ErrorPanel 174 |
| More-or-Less, finished loss + explanation | ≈741 | fits by ~27 (fragile) | comparison inside ResultPanel |
| `error.vue` | ≈200 | fits | — |

**Rationale**: Only Home and bare More-or-Less fit today. The single root cause is width-driven
3/4 art (R-002). Consequences baked into the plan: Match loss in-session and Groups finished
in-session are the two states where an inner-scroll exception (R-003) may be needed even after
compression; More-or-Less + attempt error has only 23px of slack, so spacing collapse (R-002.1)
must land even though that state "fits"; the fragile fits are why the gate runs *all* states, not
just the happy path. Group rows and the full grid are mutually coupled (found tiles leave the
grid), so "4 rows + full grid" never co-occurs.

**Alternatives considered**: (a) budgeting only the happy path — rejected, SC-001 explicitly
covers error and finished states; (b) treating the estimates as final — rejected, the browser
gate (R-004) is authoritative and estimates only order the work.

## R-009 — No copy, i18n, data, or gameplay change

**Decision**: The feature touches no string, no payload, no storage shape, no game rule. Both
locales are exercised by the verification gate because Spanish strings are longer (spec FR-006 /
SC-005); if a string must wrap differently it wraps — it is never edited or truncated.

**Rationale**: Spec FR-007 and the constitution's bilingual rule; a layout feature that changes
copy would fail review on scope alone.

**Alternatives considered**: none — trimming or rewording copy to make it fit would violate
FR-007 and the bilingual completeness tests.
