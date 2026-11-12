# Implementation Plan: Centered Home Page Title

**Branch**: `012-center-home-title` | **Date**: 2026-11-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-center-home-title/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Center the "Animatch" title on the home page so its horizontal midpoint coincides with the
horizontal midpoint of the page's content area, and keep the tagline directly beneath it on the
same horizontal center line, so the two read as one header unit. The language control keeps its
place at the content area's top-right and moves onto a row of its own when the content area
narrows below the active locale's stacking threshold (38 em for Spanish, 35 em for English).

The change is presentation-only and lives entirely in the home page's header: one stylesheet rule
set in `app/assets/css/main.css` and two wrapper classes in `app/pages/index.vue`. The centering is
computed by the layout engine — a three-track CSS grid whose two outer tracks are equal, so the
title block's center is the content area's center at every width — not by JavaScript measurement.
No game, route, catalog, message catalog, server route, storage, or dependency changes. The
verification is an automated Playwright viewport check that measures the rendered title text and
the content area at seven supported widths in both languages.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22.18 or newer (Nuxt 3 / Vue 3 single project)

**Primary Dependencies**: Nuxt 3, Vue 3, `pg` (server-only), Vitest 5, Playwright 1.59. No new
runtime or development dependency is introduced. The feature adds no package to `package.json`.

**Storage**: Existing PostgreSQL read-only catalog and app-owned `daily_puzzles`; results stay in
the visitor's browser storage. This feature reads and writes neither: it adds no table, column,
migration, stored field, or browser-storage key.

**Testing**: Playwright for rendered geometry, locale, zoom, and keyboard checks. Commands:
`npm test` (unchanged suite must stay green) and `npm run test:viewport` (new
`e2e/home-header.spec.ts`, six tests over seven viewports). No new Vitest test: the feature adds no
pure logic to unit-test.

**Target Platform**: Server-rendered web app in evergreen browsers; widths from 320 to 1920 pixels;
Spanish and English; light and dark display modes. Seven tested viewports: 320x640, 360x640,
600x800, 768x1024, 1024x768, 1440x900, 1920x1080. The header rule uses CSS container queries
(`container-type: inline-size` and `@container`), supported by Chromium 105+, Safari 16+, and
Firefox 110+ — all evergreen by 2026.

**Project Type**: Full-stack Nuxt web application (`app/` browser code, `server/` API and data
access, `public/` static assets).

**Performance Goals**: No additional API request, no JavaScript, no measurement pass, and no
layout thrash: the browser's grid layout produces the centered result in one pass. One additional
presentational wrapper element in the header. No layout shift: the title block's height is
unchanged, and the control's row changes only at the documented stacking threshold.

**Constraints**: Constitution v3.0.0 (read-only catalog, API/UI separation, UTC day, stateless
client results, fail-visible, selected tests only, bilingual UI, original assets). No external
fonts, scripts, or hotlinked images. No copying of branding, copy, layout, or assets from another
puzzle site. New feature tests must stay within the 15-test cap and must not assert stylesheet
source text or markup snapshots. The spelling convention is one word: "center", "centered",
"centering", across the spec, this plan, and the tasks.

**Scale/Scope**: One header region, one stylesheet, one page template, one new Playwright spec of
six tests over seven viewports. No server, migration, component, composable, message catalog, or
asset change.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Evidence |
|------|--------|----------|
| I. Read-Only Catalog Ownership | PASS | No catalog query, write, migration, DDL, or `import_state`/`import_runs` access. The feature changes how the home header is laid out and nothing else. |
| II. API/UI Separation | PASS | No endpoint, payload, or client data access changes. The header keeps rendering the existing `/api/daily` listing, the countdown, and the reset control exactly as before. |
| III. One Deterministic Puzzle per UTC Day | PASS | Daily content, day key, and rollover logic are untouched. The header's re-render on locale switch or resize reads no time value of its own. |
| IV. Stateless v1 | PASS | No account, session, cookie, identity, or server-side player record. The header adds no browser-storage key and reads none. |
| V. Fail Visible, Never Blank | PASS | The header is independent of the listing outcome. The page-level error panel with retry, the loading message, and the per-card states are unchanged; the centering is pure layout and cannot suppress them. |
| VI. Lean Tests, Approved Dependencies | PASS | No dependency added. Six feature tests planned (all Playwright, no Vitest) over seven viewports, against a cap of 15. Assertions target rendered geometry, reading order, and operability — never stylesheet source text, class-string contents, or markup snapshots. Source comments stay short. |
| Additional: Bilingual UI | PASS | No new user-facing string. The title text "Animatch" and both taglines are reused from the existing catalogs. The layout has one rule per locale because the Spanish tagline is longer; the rule set is completed for both `es` and `en`, and no new translation is introduced. |
| Additional: Originality and Naming | PASS | The header uses the project's own tokens, spacing scale, and existing type ramp. No third-party branding, copy, layout, measurements, or assets are reproduced, and no forbidden token is introduced. |
| Additional: Delivery Model | PASS | Plain browser client; no native build, no mandatory local toolchain for players, no new external host. The one new platform requirement (CSS container queries) is a standards-based evergreen-browser feature, not a vendor-specific runtime API. |

**Result**: All gates pass. No complexity tracking entry is required.

## Design Approach

### Centering mechanism — a three-track grid

The home header becomes a three-track CSS grid: `minmax(0, 1fr) auto minmax(0, 1fr)`. The title
block takes the middle (`auto`) track, and the two outer tracks are equal, so the middle track's
center is exactly the content area's center at every width, with no measurement and no JavaScript.
A flexbox header cannot express this: a flexible sibling always steals space from one side, so
the title's center would sit half the control's width off center. An absolutely positioned control
would work but removes it from the flow and lets it overlap the title.

**All three tracks are placed by one decision.** The title block takes `grid-column: 2` and the
control wrapper takes `grid-column: 3` with `justify-self: end`; both placements ship in the same
foundational change as the grid definition itself. They are one layout decision, not two separate
ones: with only the title placed, grid auto-placement would drop the control into the free left
outer track (column 1) — beside the title instead of flush right — and the header would carry the
control in the wrong place from the moment the grid lands. The control's *stacking* state, meaning
the thresholds and the row it moves to, is a separate concern and belongs to the language-control
story.

Two wrapper classes scope the placement:

- `.home__header__title` — the existing wrapper `<div>` around the `h1` and the tagline, placed in
  the middle track and centered in it.
- `.home__header__control` — a new wrapper around `<LanguageControl />`, placed in the right track
  and aligned to its end, so the control's right edge stays flush with the content area's right
  edge.

### Title and tagline as one centered unit

Inside the title block, both the `h1` and the tagline get `width: fit-content` with
`margin-inline: auto`, and the block gets `text-align: center`. Each element's box therefore hugs
its own text and is centered on the block's center line, which is the content area's center line.
The existing `h1`/`p` margins and the `h1` font size are untouched, so the block's height and the
header's vertical rhythm do not change.

`fit-content` also gives the required overflow behaviour: a title or tagline wider than the
content area wraps and shrinks inside it instead of spilling past the page edges, and at 200% text
zoom the wrapped text stays centered on the same line.

The hug assertion therefore has two forms, and the check picks the one that applies at the width
under test. Where the tagline fits on one line — every tested width at the default text size — the
tagline's box width must equal its text run's width within 1 px, because the box hugs one line of
text. Where the tagline wraps onto two lines (320 px and 360 px at 200% text zoom), the box hugs
the *widest* line instead: its width must equal the widest line's width within 1 px, and each
rendered line must stay centered on the title's center line. The midpoint assertion is the same in
both cases.

### Language control placement and stacking

The control keeps the content area's top-right corner in every state. It moves onto a row of its
own when the content area narrows below the active locale's stacking threshold (38 em for
Spanish, 35 em for English); in that state it stays flush with the content area's right edge, on
the row below the title block, and the header grows by exactly the control's height plus the
existing gap.

**The control's natural width is held by an explicit declaration on the new wrapper**, not by a
side effect of the grid:

```text
.home__header__control { grid-column: 3; justify-self: end; width: max-content; max-width: 100%; }
```

`width: max-content` sizes the wrapper to the switch's max-content width — the two buttons side
by side at their natural widths — so the switch is never squeezed and its two labels never wrap or
break mid-word. `max-width: 100%` caps the wrapper at its grid area, so the control can never
spill outside the content area. Together they give the control a natural width inside a bounded
box, which is what the shared-row and stacked states both need.

The non-overlap guarantee is structural: the control sits in the right outer track and the title
block in the middle one, and the stacking threshold is the measured width at which the right track
still holds the control at its natural width (36.04 em for Spanish, 33.74 em for English) plus the
safety margin stated below (38 em for Spanish, 35 em for English). While the two share the row the
track is wide enough for the control, so the control can never reach the title block; below the
threshold the control moves to a row of its own. Between the measured width and the threshold the
control therefore stacks even though the right track would still hold it at its natural width —
that band is what the margin buys.

`.lang-switch` itself is not modified. The switch is used only by the home page — `LanguageControl`
is rendered only by `app/pages/index.vue` — so the reason for leaving the rule alone is the two
button labels ("Español" and "English") and the shared switch styling that the feature must reuse
exactly as they are, not any other screen: no other screen renders the switch at all.

The switch is *not* allowed to shrink to fit: its two buttons keep their natural width, because a
squeezed switch wraps its labels and reads as broken. The stacking threshold is therefore derived
from the natural widths of the three participants, measured in the browser against the project's
own stylesheet:

| Quantity | Spanish (`es`) | English (`en`) |
|----------|----------------|----------------|
| Title block natural width | 11.55 em (184.8 px at 16 px) | 9.25 em (148.0 px at 16 px) |
| Language switch natural width | 11.74 em (187.9 px at 16 px) | 11.74 em (187.9 px at 16 px) |
| Content area needed for one row | 36.04 em | 33.74 em |

The thresholds are expressed in `em` inside a container query on the home content area, so they
scale with the visitor's text size instead of being tied to device pixels — at 200% text zoom the
same ratios hold, because the title block, the switch, and the gap all scale with the root font
size. English and Spanish get separate thresholds because the Spanish tagline is the longer of the
two; the locale is already published on the `<html lang>` attribute by the app's own locale
handling, so the distinction costs two rules and no new state.

Chosen thresholds (a margin of 5.4% for Spanish and 3.7% for English over the measured
requirement, to absorb platform font-metric differences):

```text
@container (max-width: 35em) { …stack… }                    /* both locales */
@container (max-width: 38em) { …stack… }                    /* Spanish tagline only */
```

Inside the stacked state both children take the full-width grid area of the header — the title
block on the first row, the control on a row of its own below it, still aligned to the end — so
the control's grid area is the whole content area and its buttons keep their natural width there
too:

```text
.home__header__title   { grid-column: 1 / -1; }
.home__header__control { grid-column: 1 / -1; grid-row: 2; justify-self: end; }
```

**One tested viewport inside the threshold band**: 600x800. Its content area is 581.6 px, which is
36.35 em at the default 16 px root font — between the English threshold (35 em) and the Spanish one
(38 em). At that width the locale asymmetry is actually exercised: in English the control keeps the
title's row, in Spanish it has a row of its own. Every other tested width is far outside the band
(320 px and 360 px are below both thresholds, 768 px and wider are above both), so without this
viewport the two thresholds would never be told apart in either direction.

Measured result of this rule set (Chromium, project's own stylesheet, 16 px and 32 px root font):

- the title text's midpoint sits within 0.02 px of the content area's midpoint at every tested
  width, in both locales, at 100% and 200% text zoom (tolerance is 2 px);
- the tagline's midpoint coincides with the title's within 0.01 px;
- the switch never overlaps the title block and never loses its natural width;
- the switch's right edge stays flush with the content area's right edge in both the shared-row and
  the stacked state.

**The one case where the content area is narrower than the control** is the 320 px viewport at
200% text zoom: the content area is 288 px there, while the control's natural width is 371.8 px, so
no layout can keep both buttons on one row. `max-width: 100%` keeps the control inside the content
area, and the switch's own `flex-wrap` puts the two buttons on two rows, each still at its natural
width with its label intact; the control stays visible, flush right, and operable. At the default
text size the narrowest supported viewport (320 px) leaves a content area of 304 px, wider than the
control's 187.9 px natural width, so this case does not occur there — the narrowest case is
asserted in the 200% zoom test, not in the width matrix.

If a future platform's font metrics make the threshold too generous, the failure mode is benign:
the switch wraps onto two rows instead of overlapping the title, and the new viewport check fails
rather than the layout silently breaking.

### Vertical consequences — the header-growth baseline

The header's height *before* the feature is the reference for the growth rule, and it is not the
same at every width: the pre-change header was a wrapping flex row, so at the narrow widths the
control already had a row of its own.

Measured on the reference platform (Chromium, the project's own stylesheet, 16 px root font):

| Viewport | Content area | Pre-change header | Pre-change rows | Post-change header | Growth |
|----------|--------------|-------------------|-----------------|--------------------|--------|
| 320x640 | 304 px (19.00 em) | 125.98 px (`es`), 125.98 px (`en`) | the control already had its own row in both locales | 125.98 px | 0 |
| 360x640 | 344 px (21.50 em) | 125.98 px (`es`), 72.80 px (`en`) | `es`: own row; `en`: shared the title's row | 125.98 px | 0 (`es`), +53.18 px (`en`) |
| 600x800 | 581.6 px (36.35 em) | 72.80 px (`es`), 72.80 px (`en`) | shared the title's row in both locales | 125.98 px (`es`), 72.80 px (`en`) | +53.18 px (`es`), 0 (`en`) |
| 768x1024 | 747.58 px (46.72 em) | 72.80 px | shared the title's row | 72.80 px | 0 |
| 1920x1080 | 864 px (54.00 em) | 72.80 px | shared the title's row | 72.80 px | 0 |

The one-row header is 72.80 px (the title block: the `h1`, its margin, the tagline, its margin);
the two-row header is 125.98 px = 72.80 + 8 (the header gap) + 45.19 (the control's height). The
baseline is recorded by the baseline task before any edit, per locale and per width, because one
number cannot describe it.

**The growth rule applies only where the control shared the row before the change.** Where it did,
the new stacking rule may move the control to a row of its own, and the header then grows by
exactly the control's height plus the header's gap — 53.18 px at 360 px and at 600 px — and by no
more. Where the control already had its own row before the change (320 px in both locales, 360 px
in Spanish), the header's height does not change at all, because the pre-change wrapping flex row
already produced the same two rows. Where the control still shares the row (768 px and wider), the
header's height is unchanged, the reset countdown and the game catalog — which flow immediately
after the header — do not move, and the existing no-scroll home check at 1920x1080 still holds.
Nothing else in the page's vertical layout changes.

The English fit at 360 px is the tightest case in the matrix: the pre-change row needed
147.95 + 187.91 + 8 = 343.86 px in a 344 px content area, a margin of 0.14 px. A platform with
slightly wider font metrics would have wrapped the control there already, so the baseline task
records the measured heights on the implementation machine and the growth rule is asserted against
that recorded baseline rather than against hard-coded numbers.

### Page and test integration

- `app/pages/index.vue` keeps its document order: title block first, language control second, then
  the countdown and the catalog. The title stays the page's first and only `h1`.
- `app/assets/css/main.css` gains the `.home` container declaration, the header grid rules with
  both track placements and the control's natural-width rule, and the two container queries.
  Existing tokens, type ramp, and spacing are reused unchanged.
- `e2e/home-header.spec.ts` is added with six Playwright tests over seven viewports, covering
  centering at the seven widths in both locales, the tagline's center line, the control's placement
  and non-overlap, the locale asymmetry at 600 px, the header's growth rule against the recorded
  baseline, 200% text zoom with no horizontal scrolling, and the title's reading order with the
  control's keyboard operability.

## Project Structure

### Documentation (this feature)

```text
specs/012-center-home-title/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── home-header-layout.md
├── checklists/
│   └── requirements.md
├── spec.md
└── tasks.md             # Created later by /speckit.tasks
```

### Source Code (repository root)

```text
app/
├── assets/css/main.css                 # EDIT — .home container, header grid, both track
│                                       # placements, control natural width, stacking queries
└── pages/index.vue                     # EDIT — header wrapper classes only

e2e/
├── home-header.spec.ts                 # New feature verification (6 tests, 7 viewports)
├── home-catalog.spec.ts                # Unchanged; must stay green
└── viewport-fit.spec.ts                # Unchanged; must stay green

tests/                                  # Unchanged (i18n, day, routes, progress, etc. still pass)
server/                                 # Unchanged
```

**Structure Decision**: Single Nuxt web application. The whole feature is a presentation change in
the home page's header: one stylesheet and one page template, plus one new end-to-end spec. No
server, migration, component, composable, message catalog, or asset file is touched.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. The grid-with-equal-outer-tracks rule is chosen over a flex header because flexbox
cannot keep a centered title centered while a fixed-width control shares the row, and over
JavaScript measurement because the layout engine can express the requirement exactly and a
measurement pass would add runtime cost and a hydration shift. The locale-specific stacking
thresholds are a deliberate trade: one extra rule pair keeps the control from stacking when the
shorter English tagline still fits beside it, at the cost of a small, documented asymmetry
between the two locales. The control's natural width is held by an explicit `width: max-content`
on the new wrapper rather than by editing `.lang-switch`, so the shared switch styling and its two
button labels stay exactly as they are. Placing the title block and the control in their tracks is
one layout decision, made once in the foundational phase, rather than two story-scoped decisions
that could leave the control auto-placed into the wrong track.
