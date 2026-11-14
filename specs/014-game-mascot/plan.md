# Implementation Plan: Game Screen Mascot

**Branch**: `014-game-mascot` | **Date**: 2026-11-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-game-mascot/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Carry the Matchi mascot from the home screen onto the five game screens, unchanged in every
visitor-visible respect: the same file, the same size rule, the same corner, the same decorative
and still behaviour, and the same silent failure mode.

Nothing is redesigned and nothing is added to the stack. The mascot's component, its asset, its
`--mascot-size` rule and its CSS block are the ones feature 013 already settled, and this feature
reuses them as they are. The only substantive change is **where** the component is mounted:
`app/components/GameShell.vue` — the single frame every game screen already renders through —
gains one `<Mascot />`, and the component itself is renamed from `HomeMascot.vue` to `Mascot.vue`
because it is no longer home-only.

That single mount point is what makes the feature's hard requirement provable: the mascot sits
outside every `v-if` / `v-else` branch of the game screens, so it is present in the loading state,
the playing state, the finished state and the puzzle-unavailable error state **by construction**,
and any future game built on the shell inherits it with no per-game decision.

The feature supersedes feature 013's FR-011 ("the mascot MUST appear on the home page only").
`specs/013-home-artwork/contracts/home-mascot.md` is amended to record the supersession and to
point at this feature's contract; every other requirement of feature 013 stays in force, and the
home screen's own mascot keeps the same rendered size, the same corner, the same behaviour and the
same file, with 0 differences (SC-012).

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22.18 or newer (Nuxt 3.21 / Vue 3 single project).
Unchanged from feature 013.

**Primary Dependencies**: Nuxt 3, Vue 3, `pg` (server-only), Vitest 5, Playwright 1.59 — all
unchanged. **No npm package is added** (FR-026, SC-014). The feature adds no build-time tooling
either: the mascot asset is already committed at `public/artwork/matchi-mascot.webp` and is reused
byte-for-byte (FR-027, SC-011).

**Storage**: No database change. No table, column, migration, server payload or stored browser
field is added or altered. The mascot is a static file; the game's saved result, the share output
and the daily puzzle are all untouched (FR-023).

**Testing**: Playwright for the rendered behaviour (presence per screen and state, size, corner,
file identity, non-interference, failure). The existing Vitest asset contract
(`tests/artwork-assets.test.ts`) already asserts the mascot file's dimensions, transparency and
budget and is reused unchanged. The existing game suites
(`e2e/viewport-fit.spec.ts`, `e2e/home-artwork.spec.ts`) are re-run with the mascot present.
Commands: `npm test`, `npm run test:viewport`.

**Target Platform**: Server-rendered web app in evergreen browsers; widths from 320 to 1920
pixels; Spanish and English; light and dark display modes. Unchanged from feature 013.

**Project Type**: Full-stack Nuxt web application (`app/` browser code, `server/` API and data
access, `public/` static assets). Unchanged.

**Performance Goals**: No new network request beyond the mascot file the home page already
fetches (the browser serves it from its own cache on the game screens); no layout shift when it
loads; no scroll listener, no `ResizeObserver`, no runtime measurement — the placement and the
size are pure CSS (FR-011, FR-012, FR-021).

**Constraints**: Constitution v3.0.0 (read-only catalog, API/UI separation, UTC day, stateless
client results, fail-visible, approved dependencies, bilingual UI, delivery model). The mascot
reserves no layout space, intercepts no pointer or touch input, adds no focus stop, never
animates, and never changes any text. Below 1024 pixels it may visually cover the board's bottom
inline-end region — an accepted known limitation (FR-014), bounded by the properties the contract
records.

**Scale/Scope**: One component renamed and re-mounted, one CSS rule block renamed, one new
Playwright file with **4 tests**, one existing e2e file updated for the renamed test hook (no new
test), one new contract file, one contract amendment to feature 013. Feature test count: **4 new
+ 1 updated existing file = 5**, against the constitution's 15-test cap (SC-018). No server-side,
API, schema, dependency, route or copy change.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|------|--------|----------|
| I. Read-Only Catalog Ownership | PASS | No catalog query, write, migration or DDL, and no `import_state`/`import_runs` access. The feature touches one browser-side component, one CSS block and one e2e file. |
| II. API/UI Separation | PASS | The game screens keep consuming the existing `/api/daily` payloads unchanged. The mascot is a static image with no data dependency and no request of its own beyond the file the home page already fetches. |
| III. One Deterministic Puzzle per UTC Day | PASS | Daily content, day selection and puzzle generation are untouched. The mascot is a static image that is identical for every visitor, on every locale and every UTC day (FR-028), so it cannot influence or be influenced by the day key. |
| IV. Stateless v1 | PASS | No account, session, cookie, user table or server-side player record. The mascot is decorative and carries no state. The saved result, the share output and the reset behaviour are untouched (FR-023). |
| V. Fail Visible, Never Blank | PASS | The mascot's own failure is silent by design — it is decorative, carries no information, and therefore has nothing to report; this is the same handling feature 013 settled and it is unchanged here. The game screens' data failure paths are untouched: the puzzle-unavailable `ErrorPanel` with its retry still renders, now with the mascot beside it, and the mascot does not intercept the retry. A decorative asset that fails to load therefore degrades to the mascot's absence, exactly as on the home page, while this gate's obligation — that every *data* failure path renders a bilingual, retryable state — applies to the puzzle paths this feature does not touch. |
| VI. Lean Tests, Approved Dependencies | PASS | No npm dependency and no build-time tool is added (FR-026, SC-014). Feature tests: 4 new Playwright tests plus 1 updated existing file (`e2e/home-artwork.spec.ts`, renamed test hook only, no new test) = 5, against the 15-test cap. Every assertion targets rendered geometry or rendered behaviour — no stylesheet-source text, no CSS class-string contents, no markup snapshots. The checks loop over screens, viewports and states rather than adding one test per combination (SC-018). |
| Additional: Bilingual UI | PASS | No user-facing string is introduced. The mascot carries no text, so `app/i18n/en.ts` and `app/i18n/es.ts` stay complete and unchanged (FR-025, SC-013). |
| Additional: Originality and Naming | PASS | The mascot asset is the project's own artwork, reused byte-for-byte from `public/artwork/matchi-mascot.webp`; nothing is copied from any third-party site, no external host is referenced, and no forbidden token is added (FR-025, FR-027). |
| Additional: Delivery Model | PASS | Plain browser client; no native build, no mandatory local toolchain for a player, no new external origin. The mascot is served from the site origin like every other asset. |

**Result**: All gates pass. No complexity tracking entry is required.

## Design Approach

### One component, one mount point per screen family

- **The component is shared, not duplicated.** `app/components/HomeMascot.vue` becomes
  `app/components/Mascot.vue`; the wrapper class `.home-mascot` becomes `.mascot`, the image class
  `.home-mascot__img` becomes `.mascot__img`, and the test hook `data-home-mascot` becomes
  `data-mascot`. The image hook `data-mascot-image` is unchanged. The component's behaviour — the
  `failed` flag, the `@error` handler that removes the `<img>`, the `onMounted` re-check for a
  failure that predates hydration — is untouched.

  This rename is explicitly permitted by FR-005 and SC-012: it is internal, and no visitor can see
  a class name. It is done because the component is no longer home-only, and a component called
  `HomeMascot` mounted inside `GameShell.vue` would be a lie the next reader has to untangle.

- **The home screen keeps its mascot exactly where it is.** `app/pages/index.vue` renders
  `<Mascot />` inside `<main class="home">`, as before. The element's position in the DOM does not
  change, so the home page's mascot has the same rendered size, the same corner, the same
  behaviour and the same file — 0 visitor-visible differences (SC-012). The only home-screen diff
  is the component's name.

- **The game screens get the mascot from `GameShell.vue`.** `app/components/GameShell.vue` is the
  frame every game screen already renders through: `app/pages/game/more-or-less.vue` and
  `app/pages/game/groups.vue` use it directly, and the three Match the Series editions use it
  through `app/components/MatchTheSeriesGame.vue`. One mount therefore covers all five game
  screens, and a future game built on the shell carries the mascot with no separate decision
  (the spec's "a future game is added to the app" edge case).

  The mascot is placed as a **sibling of the shell's slot**, after the slot content:

  ```text
  <main class="game-shell">
    <header class="game-header">…</header>
    <slot />
    <Mascot />
  </main>
  ```

  This placement is the reason the feature's hardest requirement holds. Every state of a game
  screen is a branch of the slot — the loading `<p>`, the `ErrorPanel` with its retry, the
  `ResultPanel`, the board — and the mascot sits outside all of them. The mascot is therefore
  present in every state **by construction**, not by remembering to add it to each branch
  (FR-002, SC-003).

- **Why the shell and not `app.vue`.** Mounting in `app.vue` would require a route allowlist to
  keep the mascot off the error page and off any other screen, and it would move the home
  screen's mascot out of `.home`, changing the home page's DOM for no gain. The shell already
  scopes the mascot to exactly the five game screens, and the error page (`app/error.vue`) is a
  separate Nuxt root component that never renders `app.vue`'s page tree, so the mascot is absent
  there without any extra rule (FR-004).

- **The contract's "same corner" claim rests on `position: fixed` resolving against the
  viewport.** `.game-shell` has no `container-type` and no `contain`, and neither do `.app` and
  `#__nuxt`, so the mascot's containing block is the viewport on every game screen. This was
  verified empirically in Chromium (research R-004): `container-type: inline-size` does **not**
  establish a containing block for fixed-position descendants there, while `contain: layout`
  does. The home screen's `.home` carries `container-type: inline-size`, so the mascot's
  viewport anchoring on the home screen depends on that browser behaviour — the existing feature
  013 suite already asserts it at every tested viewport, and this feature's new suite asserts the
  same anchor on all six screens, so a regression in either direction fails the gate. The
  contract records the constraint so no future change moves the mascot inside a containing block.

### The size rule is reused verbatim

- The `--mascot-size` token, the two viewport bands and the 1024-pixel boundary are **not
  touched**. There is no second rule for the game screens and the rule is not re-derived from a
  game screen's own content width (FR-006, FR-007, FR-009).

  | Band | Applies at viewport widths | `--mascot-size` |
  |------|---------------------------|-----------------|
  | 1 — edge | 320px – 1023px | `min(17vw, calc(17dvh * 640 / 1137))` |
  | 2 — margin | 1024px – 1920px | `min(calc((100vw - 55rem) / 2 * 0.8), calc(53dvh * 640 / 1137))` |

- Both bands are expressed purely in viewport units (`vw`, `dvh`, `100vw`), so the mascot's
  rendered box on a game screen is arithmetically identical to its box on the home screen at the
  same viewport width, whatever the page's own column width is. The measured boxes are therefore
  the ones feature 013 recorded, and they are the same on both screens:

  | Viewport | Band | Mascot box | Share of width | Share of height |
  |----------|------|------------|----------------|-----------------|
  | 320x640 | 1 | 54x97 | 17.0% | 15.1% |
  | 360x640 | 1 | 61x109 | 17.0% | 17.0% |
  | 768x1024 | 1 | 98x174 | 12.8% | 17.0% |
  | 1024x768 | 2 | 58x102 | 5.6% | 13.3% |
  | 1440x900 | 2 | 224x398 | 15.6% | 44.2% |
  | 1920x1080 | 2 | 322x572 | 16.8% | 53.0% |

  Every box stays inside FR-010's ceilings (at most 35 % of the viewport's width, at most 55 % of
  its height).

- **The band-2 term is the home page's term and stays the home page's term.** `55rem` is the free
  column beside the **home** catalog (the catalog's inner list measures 872px). The game screens'
  column is narrower — `.game-shell` is `max-width: 46rem` (736px) — so the same token clears the
  game column by *more* room than it clears the catalog, and re-deriving the term from 46rem would
  make the mascot **larger** on the game screens than on the home screen, which FR-007 and
  FR-006 forbid. The arithmetic, with `W` the viewport width:

  | Viewport | Game column right edge | Mascot left edge | Clearance |
  |----------|-------------------------|------------------|-----------|
  | 1024x768 | 880px | 966px | 86px |
  | 1440x900 | 1088px | 1216px | 128px |
  | 1920x1080 | 1328px | 1598px | 270px |

  The clearance is at least `(W − 736) / 2 − 0.4(W − 880) = 0.1W − 16`, which is positive for
  every `W ≥ 1024` and is smallest at the band boundary, where it is 86px. (At 1920x1080 the
  `53dvh` ceiling binds and the real clearance is larger.) So at 1024 pixels and wider the mascot
  overlaps the game screen's content column by **0 pixels** (FR-013, SC-005) — with the home page's
  own rule, unchanged.

### Placement, non-interference and input

- `position: fixed` at the bottom inline-end corner of the viewport (`inset-block-end: 0`,
  `inset-inline-end: 0`). It floats over the page, reserves no layout space, adds no document
  overflow and never moves with the scroll (FR-011, FR-012).
- `pointer-events: none` on the wrapper: the mascot never intercepts pointer or touch input, so
  every tile, button and link beneath it still answers clicks and taps (FR-015, SC-006).
- Because the layout reserves no space for it, the mascot's presence changes the game screens'
  board geometry, header geometry, action positions and scroll behaviour by 0 pixels and 0 scroll
  units (FR-017, SC-007). The existing board-first suite measures exactly these and is re-run
  unchanged with the mascot present.
- The mascot never produces a horizontal scrollbar and never extends past the window's horizontal
  edges at any width from 320 to 1920 pixels (FR-016, SC-004).

### Accessibility, motion and display modes

- The wrapper is `aria-hidden="true"` and the image has an empty `alt`: the mascot is decorative,
  conveys no information that is not already on the screen as text, and is ignored by assistive
  technology (FR-018, SC-008).
- It is an image, so it is not focusable and adds no tab stop.
- It is a still image with no animation, no transition and no `prefers-reduced-motion` special
  case, so every visitor — including one whose system requests reduced motion — sees the same
  frame (FR-020, SC-009).
- It has no background of its own, so it shows no opaque rectangle against the dark surface, and
  it is the same drawing in both display modes. No contrast ratio is specified and none is
  asserted (FR-019, SC-017).

### Failure behaviour

- The existing pattern is reused unchanged: the `@error` handler flips a local `failed` flag that
  removes the `<img>`, and the `onMounted` re-check catches a failure that predates hydration. On
  a game screen the result is that the mascot simply is not there: the game stays fully playable,
  no broken-image indicator appears and no fallback image is requested (FR-022, SC-010).
- The mascot's box is sized in CSS (`inline-size` plus `aspect-ratio`), and the image carries
  intrinsic `width` and `height`, so the mascot cannot shift the layout when its file arrives
  (FR-021).

### Known limitation — the narrow-viewport cover

- Below 1024 pixels the game screen's column reaches the window's edge, so the mascot floats over
  the board's bottom inline-end region, exactly as it overlaps the catalog's card column on the
  home page. It may visually cover tile artwork, labels, counts, the More/Fewer buttons and the
  status copy. This is **accepted and recorded, not engineered away** (FR-014, SC-016): the
  project owner's premise is that the mascot looks the same everywhere, and a mascot that
  changed size depending on the page would not be the same mascot.
- The limitation is bounded by five properties that MUST never break, and that the automated
  suite checks: the mascot changes no layout, swallows no click, adds no scrollbar, removes,
  hides or truncates no text, and leaves no covered content trapped under it.
- Feature 013's 200 % text-zoom limitation carries over unchanged: the mascot's size is set by the
  viewport rather than by the text, so below roughly 1024 pixels it overlaps text at that zoom.
  That was accepted on 2026-11-13 and is not reopened here.

### Verification

- **`e2e/game-mascot.spec.ts` (new, 4 Playwright tests).** Every check loops over the screens,
  viewports and states, so the suite stays inside the constitution's cap:

  1. **Presence per screen and per state.** The five game screens × the four states (loading,
     playing, finished, error). The mascot is present and visible in every combination; a 404
     route shows no mascot.
     *Reaching the states deterministically:* the **loading** branch is entered by resolving the
     daily payload as `null` (the page's own `v-else-if="pending || !puzzle"` branch then
     renders); **playing** is the default; **finished** is seeded through the device's progress
     store; **error** is produced by failing the daily request with the structured error body the
     app already handles. No state is raced or timed.

     The two non-default states are reached through a **client-side navigation**, not a cold
     `page.goto()`. All five game screens load the daily payload with `await useFetch`, so on a
     cold load the request is issued by the Nitro SSR process rather than by the browser:
     `page.route()` never fires, Nuxt transfers the SSR payload, and `useFetch` does not
     re-request on hydration — a cold-load interception would silently exercise the *playing*
     state in every iteration. The test therefore primes a full SSR load of the game route, waits
     for the board to render, installs a route interception scoped to that game's own daily URL,
     and then navigates client-side into the route, following the project's own working precedent
     in `e2e/home-header.spec.ts:864-888`. The interception is scoped per game, never a bare
     `**/api/daily`, so the home page's own listing fetch is not broken by it.
  2. **Same size, same corner, same file.** The 6 test viewports × the 6 screens. The home
     screen's mascot box is measured once per viewport and compared with each game screen's:
     width and height within 1 pixel, the inline-end and block-end edges within 1 pixel of the
     viewport's, and the loaded image URL identical on all six screens.
  3. **It never gets in the way of playing.** The 5 routes: a resize sweep from 320 to 1920
     pixels with no horizontal scrollbar; board and header geometry and the scroll metrics
     identical with and without the mascot (the element is removed and the page re-measured);
     every control that lies beneath the mascot's rectangle still answers a click; no focus stop;
     no animation.
  4. **A failed mascot leaves the game playable.** The 5 routes with the mascot request aborted:
     the board still renders and answers a click, no broken-image indicator appears, and no
     fallback image is requested.

- **`e2e/home-artwork.spec.ts` (existing, updated).** The test hook is renamed from
  `[data-home-mascot]` to `[data-mascot]`. No test is added, removed or weakened: the home screen's
  own contract — size, corner, clearance from card text, click-through, focus stop, motion, and
  the failure fallback — continues to be asserted exactly as before (SC-012).
- **`e2e/viewport-fit.spec.ts` (existing, unchanged).** The board-first order, the header
  alignment, the board's growth, the horizontal-overflow guarantee, both locales and the finished
  states are re-run with the mascot present on every game screen. This is the "existing game checks
  re-run with the mascot present" of SC-015 and SC-018, and it needs no edit: the mascot is
  fixed-position and pointer-transparent, so it does not disturb any of those measurements.
- **`tests/artwork-assets.test.ts` (existing, unchanged).** It already asserts the mascot asset's
  own *properties* — 640x1137 pixels, a transparent background, at most 150 KB, smaller than its
  source and not a copy of it — which covers FR-027's re-encoding, re-cropping and duplication
  rules. It does **not** assert the file's byte-identity across this feature's diff, so SC-011's
  "byte-for-byte the same file as before the feature" is checked by a diff of the asset against
  its pre-feature revision rather than by that test. The file is not re-encoded, re-cropped or
  duplicated, so no new asset test is needed.
- **Feature test count**: 4 new tests + 1 updated existing file = 5, against the 15-test cap.
- **Manual checks** (the project's own owner, in `quickstart.md`): the mascot in both display
  modes, at 200 % text zoom, the known narrow-viewport cover, and the browser that is not
  Chromium.

### What stays unchanged

The mascot asset; the size rule and its two bands; the 1024-pixel boundary; the home page's own
mascot rendering; the five routes; the daily content and its availability; the scoring, the saved
result, the share output and the reset; the board-first order, the board's growth, the header's
alignment, the finished-state layout and the horizontal-overflow guarantee; both message
catalogs; the dependency list; the server, the API and the database.

## Project Structure

### Documentation (this feature)

```text
specs/014-game-mascot/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/
│   └── game-mascot.md   # Mascot on the game screens: mount, size, clearance, failure
├── checklists/
│   └── requirements.md
├── spec.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

Feature 013's contract is amended in place:

```text
specs/013-home-artwork/contracts/home-mascot.md   # FR-011 superseded by feature 014
```

### Source Code (repository root)

```text
app/
├── assets/css/main.css                 # .mascot rules (renamed from .home-mascot); the size rule is unchanged
├── components/
│   ├── Mascot.vue                      # Renamed from HomeMascot.vue; behaviour unchanged
│   └── GameShell.vue                   # Gains one <Mascot /> — the single mount point for all five game screens
└── pages/
    └── index.vue                       # Renders <Mascot /> in place of <HomeMascot />

public/artwork/matchi-mascot.webp      # Unchanged: the same file, the same bytes

e2e/
├── game-mascot.spec.ts                 # New: presence, size, corner, file, non-interference, failure
└── home-artwork.spec.ts                # Updated: the renamed test hook only

tests/
└── artwork-assets.test.ts              # Unchanged: the asset contract already covers FR-027
```

**Structure Decision**: Single Nuxt web application, unchanged in shape. No new directory, no new
module, no server or schema change. The feature touches exactly three files under `app/`
(`main.css`, `Mascot.vue`, `GameShell.vue`) plus the one-line rename in `app/pages/index.vue`, and
two files under `e2e/`. The mascot's asset stays where it is, under `public/artwork/`, because it
is the same file (FR-027).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. The two judgement calls worth recording are not exceptions:

- **Renaming the component and its class names** is permitted by FR-005 and SC-012, and it is the
  honest name for a component that is no longer home-only. The alternative — keeping
  `HomeMascot.vue` and `.home-mascot` for a component mounted in `GameShell.vue` — would leave a
  misleading name and a misleading test hook for the next reader, at no benefit.
- **Mounting in `GameShell.vue` instead of `app.vue`** keeps the mascot scoped to exactly the
  game screens with no route allowlist, keeps the home screen's DOM untouched (0 differences,
  SC-012), and puts the mascot outside every state branch, which is what makes FR-002 provable.
