# Phase 0 Research: Game Screen Mascot

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

All Technical Context items are resolved. There are no `NEEDS CLARIFICATION` markers.

## R-001 — Where the mascot is mounted on the game screens

**Decision**: Mount the mascot once, in `app/components/GameShell.vue`, as a sibling of the
shell's slot and after the slot content:

```text
<main class="game-shell">
  <header class="game-header">…</header>
  <slot />
  <Mascot />
</main>
```

`GameShell.vue` is the frame all five game screens already render through: `app/pages/game/more-or-less.vue`
and `app/pages/game/groups.vue` use it directly, and the three Match the Series editions use it
through `app/components/MatchTheSeriesGame.vue`.

**Rationale**: Every state of a game screen is a branch of the shell's slot — the loading
`<p>`, the `ErrorPanel` with its retry, the `ResultPanel`, the board. A mascot rendered *inside*
the shell, outside every `v-if` / `v-else`, is therefore present in every state by construction
rather than by remembering to add it to each branch (FR-002, SC-003). It also gives the spec's
"a future game is added to the app" edge case its answer for free: a new game built on the shell
carries the mascot with no separate decision.

The alternative — mounting it in `app.vue` — needs a route allowlist to keep the mascot off the
error page and off every other screen, and it moves the home screen's mascot out of `.home`,
changing the home page's DOM for no gain (SC-012 requires 0 differences there).

**Alternatives considered**:

- **In each of the five page components**: five copies of one line, and the mascot would be
  missing from any branch that replaced the page's content — exactly the states FR-002 names.
- **In `app.vue` with a route allowlist**: one mount for everything, but the allowlist is a second
  source of truth about which screens exist, it needs editing every time a route is added, and the
  error page (`app/error.vue`) is a separate Nuxt root that renders instead of `app.vue`'s page
  tree — so the allowlist would have to exclude it explicitly even though the shell needs no
  exclusion at all.
- **In the board components** (`MoreOrLessBoard.vue`, `GroupsBoard.vue`, `MatchGrid.vue`): the
  boards are replaced by the result panel in the finished state, so the mascot would vanish
  mid-game in some flows.

## R-002 — Sharing one component, and renaming it

**Decision**: Rename `app/components/HomeMascot.vue` to `app/components/Mascot.vue`, the wrapper
class `.home-mascot` to `.mascot`, the image class `.home-mascot__img` to `.mascot__img`, and the
test hook `data-home-mascot` to `data-mascot`. The image hook `data-mascot-image` is unchanged. The
component's logic — the `failed` flag, the `@error` handler, the `onMounted` re-check for a
failure that predates hydration — is not modified. `app/pages/index.vue` renders `<Mascot />` in
exactly the position `<HomeMascot />` occupied.

**Rationale**: FR-005 and SC-012 permit renaming the mascot's markup, class names and test
hooks explicitly, because they are internal and no visitor can see them. The component is no
longer home-only, and a component named `HomeMascot` mounted inside `GameShell.vue` is a
misleading name that the next reader has to reconcile. The rename touches three files under `app/`
plus the renamed selector in the existing e2e file, and it keeps the home screen's DOM shape
identical, so the home screen's mascot is the same element in the same place with the same size,
corner, behaviour and file (0 differences, SC-012).

**Alternatives considered**:

- **Keep the `HomeMascot` name**: zero churn, but the name is wrong for a shared component and
  would need a comment explaining the mismatch. The rename is cheaper than the comment.
- **Duplicate the component as `GameMascot.vue`**: two implementations of one settled behaviour
  would drift, and it would break the "same mascot, not a lookalike" requirement (FR-003, SC-001)
  the moment one of them is edited.
- **Move the mascot's markup inline into `GameShell.vue`**: the home page would then need its own
  copy, which is the duplication above with extra steps.

## R-003 — The size rule is reused verbatim

**Decision**: Reuse the home screen's `--mascot-size` rule unchanged — band 1
`min(17vw, calc(17dvh * 640 / 1137))` below 1024 pixels and band 2
`min(calc((100vw - 55rem) / 2 * 0.8), calc(53dvh * 640 / 1137))` from 1024 pixels — with the same
1024-pixel boundary. There is no second rule for the game screens, and the rule is not
re-derived from a game screen's own content width.

**Rationale**: Both bands are expressed purely in viewport units (`vw`, `dvh`, `100vw`), so the
mascot's rendered box on a game screen is arithmetically identical to its box on the home screen
at the same viewport width, whatever the page's own column is. FR-006, FR-007 and FR-009 require
exactly this, and the spec's assumption is explicit that the rule is not re-derived from a game
screen's content width.

The temptation is to re-derive band 2's margin term from the game screens' column, because
`.game-shell` is `max-width: 46rem` (736px) while the home catalog's inner list measures 872px.
That would be wrong twice over: it would make the mascot **larger** on the game screens than on
the home screen at the same width, breaking "the same mascot at the same size" (FR-006, SC-001);
and it would create the second size rule FR-007 forbids. The same token clears the game column by
*more* room, not less:

| Viewport | Game column right edge | Mascot left edge | Clearance |
|----------|-------------------------|------------------|-----------|
| 1024x768 | 880px | 966px | 86px |
| 1440x900 | 1088px | 1216px | 128px |
| 1920x1080 | 1328px | 1598px | 270px |

The clearance is at least `(W − 736) / 2 − 0.4(W − 880) = 0.1W − 16`, positive for every `W ≥ 1024` and
smallest at the band boundary. So FR-013 and SC-005 hold with 0 pixels of overlap, without the
rule being touched.

**Alternatives considered**:

- **Re-derive band 2 from the game column's 46rem**: makes the mascot bigger on the game screens
  than on the home screen — the exact "lookalike" failure the feature exists to prevent.
- **A separate game-screen size rule**: forbidden by FR-007, and it would double the surface the
  automated check has to keep in step.
- **Cap the mascot's width by the game column at narrow widths**: that is a second rule again,
  and it would change the mascot's size depending on the page.

## R-004 — Viewport anchoring, and what would break it

**Decision**: Keep `position: fixed` with `inset-block-end: 0` and `inset-inline-end: 0`, and
keep the mascot outside any ancestor that establishes a containing block for fixed-position
descendants. The contract records this as an explicit constraint.

**Rationale**: The feature's "same corner" claim (FR-008, SC-002) means the mascot's inline-end
and block-end edges coincide with the *viewport's* on all six screens. `position: fixed` resolves
against the viewport only when no ancestor establishes a containing block. The game screens are
safe: `.game-shell`, `.app` and `#__nuxt` carry no `container-type`, no `contain`, no `transform`,
no `filter` and no `will-change`.

The home screen needed checking, because `.home` carries `container-type: inline-size` — and
`container-type` applies layout containment, which per the CSS Containment specification makes an
element a containing block for fixed-position descendants. This was verified empirically in
Chromium 1217 (the project's test browser) with a standalone page:

| Ancestor | Fixed child's bottom edge | Anchored to |
|----------|----------------------------|-------------|
| none | 600 (the viewport's bottom) | the viewport |
| `container-type: inline-size` | 600 (the viewport's bottom) | the viewport |
| `contain: layout` | 4000 (the ancestor's bottom) | the ancestor |

So `container-type: inline-size` does **not** establish a containing block for fixed descendants
in Chromium, while `contain: layout` does. The home screen's mascot is therefore genuinely
viewport-anchored today, which is what feature 013's suite already asserts.

The finding is recorded rather than acted on, for two reasons. FR-005 forbids changing what a
visitor sees on the home screen, so the home page's mascot is not moved; and the automated check
asserts the viewport anchor on all six screens at every tested viewport, so a change that broke
the anchoring — in Chromium or in the home screen's `.home` container — would fail the gate
rather than ship silently. The contract tells the next implementer not to move the mascot inside
a containing block.

**Alternatives considered**:

- **Move the mascot out of `.home` into `app.vue`**: it would make the anchoring unconditional in
  every browser, but it changes the home screen's DOM and, on a browser where `container-type`
  does establish a containing block, it would change what a visitor sees on the home page — which
  FR-005 and SC-012 forbid.
- **Position the mascot with `position: absolute` relative to the document**: it would scroll away
  with the page, breaking FR-011.
- **A JavaScript repositioning pass on scroll and resize**: a runtime cost, a hydration seam and a
  second source of truth for a purely visual requirement.

## R-005 — Non-interference with play

**Decision**: Keep `pointer-events: none` on the wrapper and `position: fixed` on the same
element, with no layout space reserved for it anywhere.

**Rationale**: These two declarations are the whole of the non-interference contract. `position:
fixed` removes the mascot from the document flow, so it reserves no space, adds no document
overflow, never moves with the scroll and changes no board or header geometry (FR-012, FR-016,
FR-017, SC-004, SC-007). `pointer-events: none` makes the mascot transparent to pointer and
touch input, so every tile, button and link beneath it still answers clicks and taps without any
per-control work (FR-015, SC-006). Together they are what makes "the board is exactly where it
was before the character arrived" true by construction rather than by measurement.

The mascot's box is sized in CSS (`inline-size` plus `aspect-ratio: 640 / 1137`) and the image
carries intrinsic `width` and `height`, so the browser reserves the box before the file arrives
and the mascot cannot shift the layout when it loads (FR-021).

**Alternatives considered**:

- **Reserving a gutter for the mascot in the game layout**: it would change the board's geometry,
  which FR-017 and FR-024 forbid, and it would make the mascot a different size on the game
  screens.
- **Hiding the mascot while a pointer is over it**: a hover behaviour that would make the mascot
  flicker and would be the first animation in the feature (FR-020).
- **Clipping the mascot to a region that excludes the board**: that is a second size rule and a
  second corner.

## R-006 — Failure behaviour

**Decision**: Reuse the existing pattern unchanged: the `@error` handler flips a local `failed`
flag that removes the `<img>`, and the `onMounted` re-check catches a failure that predates
hydration.

**Rationale**: The mascot is decorative and carries no information, so its failure has nothing to
report and nothing to retry; the silent degradation is the feature 013 behaviour the home page
already has, and reusing it means the game screens behave identically (FR-022, SC-010). The
`onMounted` re-check matters more on the game screens than on the home page: the game screens are
entered by a client-side navigation, so the image can begin loading — and fail — before Vue has
attached the listener, exactly the race the existing check was written for.

**Alternatives considered**:

- **A neutral placeholder box**: the mascot has no background, so a visible placeholder would read
  as a broken element rather than a missing decoration, and it would introduce a second visual
  state that the size rule does not describe.
- **Leaving the `<img>` in place after an error**: the browser would draw its broken-image
  indicator, which FR-022 forbids.
- **Requesting a fallback image**: forbidden by FR-022, and it would add a second asset.

## R-007 — Accessibility, motion and display modes

**Decision**: Keep the wrapper `aria-hidden="true"`, the image's `alt` empty, no animation, no
transition, no `prefers-reduced-motion` special case, and no background of the mascot element
itself.

**Rationale**: The mascot is decoration. It carries no information that is not already on the
screen as text, so it must be ignored by assistive technology and must not add a tab stop
(FR-018, SC-008). Because it never animates, a visitor whose system requests reduced motion sees
exactly the same frame as every other visitor (FR-020, SC-009). The element has no background, so
it shows no opaque rectangle against the dark surface, and it is the same drawing in both display
modes (FR-019, SC-017). "Legible" is not turned into a numeric contrast target and no automated
check asserts one — the spec is explicit that it is not.

**Alternatives considered**:

- **An `alt` describing the character**: would give assistive technology something to announce
  that no sighted visitor can read, and would contradict the decorative role.
- **A `prefers-reduced-motion` branch**: there is no motion to reduce; a branch would be dead
  code.
- **A dark-mode variant of the artwork**: a second file, a second budget, and a "different
  mascot on some screens" failure mode.

## R-008 — The narrow-viewport cover, recorded as a limitation

**Decision**: Accept the mascot's visual cover of the board's bottom inline-end region below
1024 pixels, record it in the contract, and bound it with five properties that must never break:
no layout change, no swallowed click, no scrollbar, no removed, hidden or truncated text, and no
covered content trapped under the mascot.

**Rationale**: Below 1024 pixels the game screen's column reaches the window's edge, so a mascot
pinned to that corner must overlap the board — the same way it overlaps the catalog's card column
on the home page. The request's premise is that the mascot looks the same everywhere, and a
mascot that changes size depending on the page is not the same mascot. The project owner accepted
the overlap on 2026-11-14 as a documented limitation rather than a defect to engineer away. The
bounded properties are what make it safe in practice: `pointer-events: none` keeps every covered
control operable, `position: fixed` keeps the layout untouched, and the game screens scroll
vertically, so covered content moves out from under the mascot as the visitor scrolls.

**Alternatives considered**:

- **Shrinking or hiding the mascot below 1024 pixels**: a second size rule and a second
  behaviour; it would also break "the same size at every viewport width".
- **Reserving space beside the board for the mascot**: it would change the board's geometry
  (FR-017, FR-024) and would move the mascot off the corner.
- **Keeping the mascot clear of the board by anchoring it to the page instead of the viewport**:
  it would break the scroll anchoring (FR-011) and the corner (FR-008).

## R-009 — Verification strategy

**Decision**: One new Playwright file, `e2e/game-mascot.spec.ts`, with **4 tests** that loop over
the screens, viewports and states; one existing e2e file updated for the renamed test hook
(`e2e/home-artwork.spec.ts`, no test added, removed or weakened); the existing
`e2e/viewport-fit.spec.ts` re-run unchanged with the mascot present; and the existing
`tests/artwork-assets.test.ts` re-used unchanged.

**Rationale**: The feature's outcomes are almost all *rendered* facts — a box's size, an edge's
position, an element's presence in a state, a click's effect — and only a real browser can
measure them. SC-018 caps the feature's own suite at 15 tests and asks for the checks to loop
rather than to add one test per screen × viewport × state combination; four tests that each loop
cover 5 screens, 4 states, 6 viewports and 30 size comparisons.

The asset's own contract is already covered by `tests/artwork-assets.test.ts` — 640x1137 pixels, a
transparent background, at most 150 KB, smaller than its source and not a copy of it — which is
precisely FR-027 and SC-011, so no new asset test is needed and the file is not re-encoded.

The states are reached deterministically, never raced:

| State | How it is reached |
|-------|-------------------|
| loading | the daily payload resolves as `null`, which is the page's own `v-else-if="pending \|\| !puzzle"` branch |
| playing | the default render |
| finished | the device's own progress store is seeded with a finished game |
| error | the daily request fails with the structured error body the app already handles |

**Alternatives considered**:

- **One test per screen, state or viewport**: the constitution's cap is 15 and the combinations
  are 5 × 4 × 6 = 120; SC-018 requires the looping form.
- **Component-level tests with a mounting library**: a new dependency for a decorative element
  (FR-026).
- **Asserting the stylesheet's source text**: forbidden by Constitution VI, and it would pin the
  implementation instead of the behaviour.
- **Timing the loading state with a throttled network**: a race. The `null`-payload route reaches
  the same template branch deterministically.

## R-010 — Copy and localization

**Decision**: Add no message keys. `app/i18n/en.ts` and `app/i18n/es.ts` are unchanged.

**Rationale**: The mascot carries no text and the feature introduces no user-facing string
(FR-025, SC-013). Both catalogs stay complete, and no locale-dependent behaviour is introduced —
the mascot is the same file for every visitor, in every locale and on every UTC day (FR-028).

**Alternatives considered**:

- **An alt-text caption for the mascot**: would contradict the decorative role (FR-018) and would
  need both languages.

## R-011 — Superseding feature 013's FR-011

**Decision**: Amend `specs/013-home-artwork/contracts/home-mascot.md` with a supersession notice
that names this feature, states which requirement is superseded (feature 013's FR-011, "the mascot
MUST appear on the home page only"), and records that everything else in that contract — the home
screen's own size, corner, behaviour and file — stays in force with 0 differences. The feature's
own contract, `contracts/game-mascot.md`, carries the game-screen rules.

**Rationale**: The spec requires the previous feature's contract to stay consistent with the new
scope, and the two contracts must not contradict each other. Feature 013's §2 still says the
mascot appears on the home page only, and §1 still names a component used by the home page only;
both statements are amended in place, with a pointer to this feature's contract, rather than
leaving a stale rule in the repository or deleting a contract that still describes the home
screen.

**Alternatives considered**:

- **Leaving feature 013's contract untouched**: it would keep asserting "game screens keep their
  current presentation", which this feature contradicts.
- **Deleting feature 013's contract**: it still describes the home screen's mascot, its size rule,
  its clearance rule and its asset budget, all of which remain in force.
- **Moving the whole mascot contract into feature 014's directory**: it would orphan the home
  screen's rules from the feature that introduced them and make the supersession harder to audit.

## R-012 — How a future game inherits the mascot

**Decision**: Rely on the shell. A new game screen built on `app/components/GameShell.vue` — the
frame every game screen already uses — carries the mascot with no additional work, and no
per-game decision is needed.

**Rationale**: The spec's edge case asks for exactly this. Because the mascot lives in the shell
rather than in the pages or the boards, a new game page that uses the shell gets it for free, and
a new game built on a different frame would need one line — which the contract records as the
single decision point.

**Alternatives considered**:

- **A route allowlist in `app.vue`**: the opposite of "by default" — every new route would have to
  be added, and a forgotten entry would silently drop the mascot (R-001).
- **Copying the mascot into every new game page**: exactly the duplication this feature removes.
