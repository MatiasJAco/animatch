# Implementation Plan: Responsive Home Game Catalog

**Branch**: `011-home-game-catalog` | **Date**: 2026-10-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-home-game-catalog/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Rebuild the home-page game cards as one uniform, original-artwork card pattern that is itself the
link into each game. Every card gets the same width and height at a given viewport, a small local
SVG image, a consistent text block, a distinct hover/focus colour, and an inert grey treatment
when the game is finished, unavailable, or in error. The Play button disappears; clicking or
tapping anywhere on a playable card opens its game.

The change is presentation-only: the existing daily listing, game routes, availability probing,
local result storage, countdown, language switching, and development reset all keep working. No
database, API, dependency, or game-rule changes are involved. All artwork is original and stored
in the project; the reference site is used only as a general example of uniform card sizing.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22.18 or newer (Nuxt 3 / Vue 3 single project)

**Primary Dependencies**: Nuxt 3, Vue 3, `pg` (server-only), Vitest 5, Playwright 1.59. No new
runtime or development dependency is introduced.

**Storage**: Existing PostgreSQL read-only catalog and app-owned `daily_puzzles`; results stay in
the visitor's browser storage. This feature adds no table, column, migration, or stored field.

**Testing**: Vitest for pure card-state and artwork-mapping tests; Playwright for rendered
geometry, interaction, keyboard, locale, fallback, and overflow checks. Commands: `npm test`,
`npm run test:viewport`.

**Target Platform**: Server-rendered web app in evergreen browsers; widths from 320 to 1920 pixels;
Spanish and English; light and dark display modes.

**Project Type**: Full-stack Nuxt web application (`app/` browser code, `server/` API and data
access, `public/` static assets).

**Performance Goals**: No additional API request; five local SVG images small enough to load with
the page; zero layout shift from images because the artwork area has fixed dimensions; hover and
focus feedback within 150 ms; existing first-render behavior preserved.

**Constraints**: Constitution v3.0.0 (read-only catalog, API/UI separation, UTC day, stateless
client results, fail-visible, selected tests only, bilingual UI, original assets). No external
fonts, scripts, or hotlinked images. No copying of the referenced site's branding, copy, layout, or
assets. New feature tests must stay within the 15-test cap and must not assert stylesheet source
text or markup snapshots.

**Scale/Scope**: One home page, five current games, one card component, one artwork component, two
small utilities, five SVG assets, CSS tokens, and eight feature tests. No server-side change.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|------|--------|----------|
| I. Read-Only Catalog Ownership | PASS | No catalog query, write, migration, DDL, or `import_state`/`import_runs` access. The feature touches only browser presentation and static assets. |
| II. API/UI Separation | PASS | Cards consume the existing `/api/daily` payload. No database driver, credential, or query is added to browser code. |
| III. One Deterministic Puzzle per UTC Day | PASS | Daily content and day selection are unchanged. The finished marker keeps using the existing UTC-day local progress load; no timezone or rollover logic changes. |
| IV. Stateless v1 | PASS | No account, session, cookie, or server-side player record. Finished state remains device-local for the current UTC day. |
| V. Fail Visible, Never Blank | PASS | The existing listing failure panel and retry remain; per-card unavailable/error states stay visible; missing artwork falls back to a neutral placeholder; no error is swallowed. |
| VI. Lean Tests, Approved Dependencies | PASS | No dependency added; eight feature tests planned (2 Vitest, 6 Playwright); tests assert geometry, rendered behaviour, accessibility, and asset presence, not stylesheet source or snapshots; source comments stay short. |
| Additional: Bilingual UI | PASS | No new user-facing copy is required. Existing name, summary, finished, unavailable, and error strings are reused; the obsolete `home.play` string is removed from both catalogs. Artwork is decorative and has no text. |
| Additional: Originality and Naming | PASS | Five original, text-free SVGs are created in-project. The reference site informs only the generic requirement that cards share a size; its branding, copy, layout, and assets are not copied. No forbidden token is introduced. |
| Additional: Delivery Model | PASS | Plain browser client, no native build, no mandatory local toolchain for players, no new external host. |

**Result**: All gates pass. No complexity tracking entry is required.

## Design Approach

### Card geometry

- Replace the content-driven card with a fixed block size per breakpoint and a responsive grid:
  one column on phones, two columns from `40rem`, three columns from `60rem`.
- Use a 24-25rem block size and a 56rem centered content width so all five cards are identical
  at any viewport and the 1920x1080 home view still fits without document scrolling.
- Fixed `rem` sizing also scales with the visitor's text-size preference, keeping the card body
  proportional at 200% text zoom. This avoids the unequal heights produced by intrinsic content
  and the clipping produced by a fixed pixel/aspect-ratio card.
- The internal layout is one art band (16:9), then name, summary, and state; the state sits at the
  bottom so cards read as a set. The last row keeps normal column widths instead of stretching.

### Card interaction and states

- A playable card renders as one link covering the entire card. There is no nested button or
  secondary action.
- Hover and keyboard focus share the same accent surface, border, and shadow emphasis. Hover
  applies only to hover-capable pointers; focus uses a visible outline so colour is not the only
  signal.
- A finished card renders as a non-focusable article with a grey surface, muted artwork, and the
  existing "Finished today" marker. It has no hover change, no pointer cursor, and no href.
- Unavailable and error cards use the same inert geometry and muted surface, with their existing
  explanatory text. A derived card presentation helper keeps the four states mutually exclusive.
- Reduced-motion preferences continue to suppress transitions through the existing global rule.

### Artwork

- Store one original SVG per game under `public/games/`, named by the game's route slug.
- Resolve paths through a typed `Record<GameId, string>` so every game has exactly one stable
  location; replacing a card image means replacing that file, not editing markup.
- Render through a small `GameArt` component with a fixed 16:9 frame, `object-fit: contain`,
  decorative accessibility, and an on-error neutral placeholder that keeps the frame size.
- Artwork is geometric and text-free, uses no external references or fonts, and is visibly
  different per game (More or Less, each Match season, Groups).

### Page and test integration

- Split the shared `.page, .home` rule so the home page can grow and scroll vertically while game
  screens keep their existing frame; horizontal overflow stays forbidden.
- Update the existing viewport test's home-card selector to the new stable data attribute.
- Add a focused Playwright file for catalog completeness, equal geometry, hover/inactive states,
  full-card activation, keyboard semantics, artwork fallback, text zoom, and locale switching.
- Add two Vitest tests: one for the artwork map/file contract, one for the four card presentation
  states. Total feature tests: eight.

## Project Structure

### Documentation (this feature)

```text
specs/011-home-game-catalog/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── home-catalog-ui.md
│   └── game-artwork.md
├── checklists/
│   └── requirements.md
├── spec.md
└── tasks.md             # Created later by /speckit.tasks
```

### Source Code (repository root)

```text
app/
├── assets/css/main.css                 # Home frame, grid, card and state tokens
├── components/
│   ├── GameArt.vue                     # Fixed-frame artwork with fallback
│   └── GameCard.vue                    # Link/article card, states, no Play button
├── i18n/
│   ├── en.ts                           # Remove obsolete home.play
│   └── es.ts                           # Remove obsolete home.play
├── pages/index.vue                     # Home catalog markup and heading level
└── utils/
    ├── gameArt.ts                      # Typed game -> artwork path map
    └── gameCardState.ts                # Pure playable/finished/unavailable/error derivation

public/games/
├── more-or-less.svg
├── match-the-series-autumn-2026.svg
├── match-the-series-spring-2026.svg
├── match-the-series-summer-2026.svg
└── groups.svg

tests/
├── game-art.test.ts
└── game-card-state.test.ts

e2e/
├── home-catalog.spec.ts                # New feature verification
└── viewport-fit.spec.ts                # Home selector updated; layout contract preserved

README.md                               # Note the artwork location and replacement rule
```

**Structure Decision**: Single Nuxt web application. Browser presentation lives under `app/`, the
unchanged server/API under `server/`, and replaceable original artwork under `public/games/`.
No server, migration, or schema files are touched.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. The fixed-rem card frame is chosen over JavaScript measurement because it guarantees
equal geometry with no new runtime code, while scaling with text size; the only trade-off is a
breakpoint token that must be revisited if future card copy grows substantially.
