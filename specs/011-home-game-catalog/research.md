# Phase 0 Research: Responsive Home Game Catalog

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

All Technical Context items are resolved. There are no `NEEDS CLARIFICATION` markers.

## R-001 — Uniform card geometry

**Decision**: Use a CSS grid with one column below `40rem`, two columns from `40rem`, and three
columns from `60rem`, with a centered home content width of `56rem`. Every card receives the same
fixed block size in `rem` (`24rem` on one and three columns, `25rem` on two columns). Each card is
`inline-size: 100%` inside an equal `1fr` grid track. The card body is a flex column with the
artwork band fixed at 16:9 and the state row pushed to the bottom.

**Rationale**: All cards in a viewport become mathematically identical in width and height,
including cards on a different row and the short last row. Because the height is expressed in
`rem`, it scales when the visitor enlarges text, so the card grows with its content instead of
clipping it. The 24rem block size and 56rem page width keep the five-card, two-row catalog under
1080 pixels on a 1920x1080 screen.

**Alternatives considered**:

- Intrinsic content height with equal-height grid rows: rows are sized independently when the grid
  has indefinite height, so a shorter description or a two-card last row can still produce
  different card heights.
- CSS `aspect-ratio` on the card: attractive at the default text size, but fixed aspect plus
  variable text and 200% text zoom either clips text or forces unequal cards.
- JavaScript measurement with a CSS variable and `ResizeObserver`: can equalise after measuring,
  but adds runtime complexity, a hydration layout shift, and a second source of truth for a
  layout-only requirement.
- Fixed pixel height: breaks text zoom and does not scale with the visitor's font settings.

**Trade-off**: The block-size tokens are a design contract. If future copy or a longer translation
needs more room, the token must be raised and the equal-card tests rerun. The plan includes an
overflow assertion so this cannot regress silently.

## R-002 — Original, replaceable game artwork

**Decision**: Add five original, text-free SVGs in `public/games/`, one per game, named by route
slug:

```text
public/games/more-or-less.svg
public/games/match-the-series-autumn-2026.svg
public/games/match-the-series-spring-2026.svg
public/games/match-the-series-summer-2026.svg
public/games/groups.svg
```

A typed `Record<GameId, string>` in `app/utils/gameArt.ts` maps each game to its path. A new
`GameArt.vue` component renders the image in a fixed 16:9 frame using `object-fit: contain`,
`alt=""`, `aria-hidden="true"`, and an `@error` fallback. The fallback is a neutral patterned block
with the same frame size.

**Rationale**: Replacing a card image becomes replacing one file with the same name; no card
markup, CSS selector, or behavior changes. The mapping is exhaustive at compile time, so adding a
future game without artwork is a type error. `public/` assets are served directly and are easy to
find and swap. Original geometric SVGs keep the repository self-contained, avoid an external host,
and satisfy the originality constraint.

**Alternatives considered**:

- Inline SVG components per game: harder to replace because the artwork lives inside Vue markup.
- Imported assets under `app/assets/`: build-hashed and less obvious to replace; a dropped-in file
  would also need a new import.
- Remote image URLs: violates the no-hotlinking and fail-visible constraints and adds a network
  dependency.
- A single sprite sheet: one file to replace, but every change risks all five cards and makes
  per-game replacement less direct.

**Replacement contract**: Keep the 16:9 view box (320x180). If a replacement has a different
aspect ratio, `object-fit: contain` letterboxes it inside the fixed frame instead of changing the
card's dimensions. If a production CDN caches the old file, rename the file and update the one-line
mapping to bust the cache.

## R-003 — Whole-card activation semantics

**Decision**: Render a playable card as a single `NuxtLink`-backed anchor that wraps the artwork,
name, summary, and state. Render every inactive card as a plain `article` with no `href`, no
`tabindex`, and no click handler. There is no Play button or nested interactive element.

**Rationale**: An anchor gives pointer, touch, keyboard, middle-click, and assistive-technology
semantics for free, and its accessible name is built from the visible game content. Removing the
button satisfies the requested interaction and increases the target to the entire card. A plain
article for inactive cards avoids the common anti-pattern of a disabled-looking link that remains
focusable.

**Alternatives considered**:

- Keep an article and add a click handler: loses native link behavior and requires custom keyboard
  handling.
- Stretch an absolutely positioned link over the card: duplicates focus/stacking complexity and
  makes text selection and nested semantics harder.
- Use an anchor with `aria-disabled="true"` for inactive cards: still announces a link and can
  still be activated or focused; a non-link element is clearer.

## R-004 — Hover, focus, finished, and error treatments

**Decision**: Add surface, border, shadow, muted, and finished tokens. Playable cards get a pointer
cursor and, on hover-capable fine pointers, a changed surface plus accent border and shadow.
Keyboard focus gets the same emphasis plus the existing visible outline. Finished cards get a
muted grey surface, a muted/desaturated artwork treatment, and the existing finished marker.
Unavailable and error cards share the inert surface and show their existing feedback text. No
transition runs under `prefers-reduced-motion`.

**Rationale**: Colour changes are measurable and visible without moving the card, so equal geometry
is preserved. Explicit tokens keep contrast acceptable in light and dark modes; using opacity on
the whole card would reduce text contrast below the requirement. The focus outline ensures the
state is not communicated by colour alone.

**Alternatives considered**:

- Scale/lift on hover: visually pleasing but changes perceived geometry and can complicate the
  equal-size contract.
- `opacity` on inactive cards: greys everything but also weakens the state text and image contrast.
- Hover on all devices: touch devices would leave sticky hover states and misleading affordances.

## R-005 — Card state derivation and UTC-day boundary

**Decision**: Add a pure `gameCardPresentation(status, localState)` helper. Priority is
`finished` (won or lost) → `error` → `unavailable` → `playable`. A finished card returns the
existing `home.finished_today` message; unavailable and error return the existing error messages.
The home page keeps loading local progress in `onMounted`, using the existing UTC-day key, so a
finished marker disappears automatically on the next UTC day.

**Rationale**: The four visual states stay mutually exclusive even when, for example, a game is
finished locally and its status later becomes unavailable. A pure helper can be tested without a
component-testing dependency, which keeps the test budget and dependency surface small.

**Alternatives considered**:

- Inline conditionals in the template: workable but untestable without mounting a component; four
  states and their priority are easy to get wrong.
- Server-provided finished state: violates the stateless client-result principle.

## R-006 — Home page scrolling and viewport fit

**Decision**: Split the existing shared `.page, .home` rule. `.page` keeps its current frame; `.home`
gets `overflow: visible`, `flex: 1 0 auto`, `min-height: 100dvh`, and the wider `56rem` content
width. Horizontal overflow remains locked through the existing body rule. The catalog grid scrolls
as part of the document when it exceeds the viewport.

**Rationale**: Feature 011 permits vertical scrolling on the home page when cards do not fit, while
keeping a single scroll surface (no independently scrolling catalog). A `min-height: 100dvh` rather
than a shrinking flex item prevents the flex container from clipping taller content. At 1920x1080
the computed two-row catalog still fits, so the existing large-screen no-scroll assertion remains
valid.

**Alternatives considered**:

- Keep `overflow: hidden`: at 1024x768 the taller card list would be clipped and unreachable.
- Make only `.game-list` scroll: creates a nested scroll region and hides cards behind a local
  scrollbar.
- Reduce cards until everything fits at every size: conflicts with readable text and the requested
  same-size, image-bearing cards.

## R-007 — Verification strategy

**Decision**: Keep the feature's automated tests at eight, within the constitution's cap:

- `tests/game-art.test.ts` — every `GameId` maps to a distinct existing SVG under `public/games/`.
- `tests/game-card-state.test.ts` — the four presentation states and their priority.
- `e2e/home-catalog.spec.ts` — six tests:
  1. Completeness and stable order of all five cards in every state, at phone and desktop widths.
  2. Identical card boxes, loaded artwork, and no horizontal overflow across 360x640, 768x1024,
     1024x768, 1440x900, and 1920x1080.
  3. Missing-artwork fallback and 200% root-font text zoom keep equal card boxes, keep every card's
     content inside its frame, and avoid horizontal overflow.
  4. Whole-card activation from the image and from a non-text area, keyboard activation, and
     absence of Play buttons.
  5. Hover colour change on a playable card, grey/inert/no-hover behaviour on a finished card, and
     skipped focus on inactive cards.
  6. Locale switching, the 1920x1080 no-scroll state, and retention of the countdown and
     development reset controls.

The existing `e2e/viewport-fit.spec.ts` home waits change from `.game-list .card` to the stable
`[data-game-card]` attribute. No new test dependency is added.

**Rationale**: Playwright can observe real bounding boxes, computed surface colours, hrefs, focus,
image loading, keyboard activation, and layout overflow without reading CSS source. Vitest covers
the two pure mappings that would otherwise need brittle DOM mounting. Eight tests stay well below
the cap and avoid duplicating the existing viewport suite.

**Alternatives considered**:

- Snapshot or markup tests: forbidden by the constitution and brittle for a visual feature.
- A component-testing library: new dependency, not justified for one card.
- Manual-only visual checks: cannot protect equal geometry, overflow, or keyboard behaviour.

## R-008 — Localization and copy

**Decision**: Reuse all existing game names, summaries, and state messages. Remove the now-unused
`home.play` key from both `en.ts` and `es.ts`. The artwork is decorative (`alt=""`) and contains no
text, so no new translation key is introduced.

**Rationale**: The feature removes the Play button, so keeping a dead string is misleading. Every
remaining string already exists in both locales. The card's accessible name comes from the visible
name, summary, and state, which are translated.

**Alternatives considered**:

- Add per-card accessible labels such as "Play {game}": requires new bilingual copy and would not
  match the visible link text.
- Keep `home.play` unused: harmless but leaves dead user-facing copy.

## R-009 — Reference-site originality boundary

**Decision**: Apply only the generic idea of a uniform, image-led card that is clickable as a whole.
Do not reuse the referenced site's branding, colour scheme, copy, card composition, icons, layout
measurements, or assets. The Animatch card uses its own existing tokens, a 16:9 original art band,
and a left-aligned text block.

**Rationale**: The constitution explicitly forbids copying branding, copy, layout, visual
structure, or assets from Futbol11 or any other puzzle site. The user's request is satisfied by the
uniformity and interaction model, not by visual imitation.

**Alternatives considered**:

- Recreate the reference layout: prohibited and unnecessary.
- Ignore the reference entirely: would leave the uniformity requirement under-specified.
