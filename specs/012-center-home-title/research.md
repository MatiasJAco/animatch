# Phase 0 Research: Centered Home Page Title

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

All Technical Context items are resolved. There are no `NEEDS CLARIFICATION` markers.

The geometry in this document was measured in Chromium against the project's own stylesheet
(`app/assets/css/main.css`) with a static harness that reproduces the home header's markup, so
every number below is an observed value, not an estimate.

## R-001 — A three-track grid is the only layout that centers the title exactly

**Decision**: Make `.home__header` a CSS grid with `grid-template-columns: minmax(0, 1fr) auto
minmax(0, 1fr)`. The title block occupies the middle track; the control occupies the right track
and is aligned to its end. Both placements land in the same foundational change as the grid
definition.

**Rationale**: With two equal outer tracks, the middle track's center is the content area's center
for any track width, so the title block is centered without measurement. The measured error between
the rendered title text's midpoint and the content area's midpoint was 0.02 px or less at every
width, in both locales, and at 100% and 200% text zoom — two orders of magnitude inside the
specification's 2 px tolerance. The rule is pure CSS, so there is no hydration mismatch and no
resize handler.

The two placements are one decision, not two. With only the title block placed in column 2, grid
auto-placement puts the control in the free left outer track (column 1) — beside the title instead
of flush right — so the control would sit in the wrong place from the moment the grid lands. The
control's *stacking* state is a separate concern and belongs to the language-control story.

**Alternatives considered**:

- **Flexbox with `justify-content: space-between` (today's rule)**: puts the title at the left
  edge; it cannot express "centered".
- **Flexbox with a growing title item**: the title's box grows into the space the control leaves,
  so the title's center sits half the control's width left of the content area's center. The
  control is 11.74 em wide, so the error would be about 5.9 em — far outside the tolerance.
- **Flexbox with `margin-inline: auto` on the title**: the auto margins absorb the free space that
  follows the title, which again shifts the title left by half the control's width.
- **Absolutely positioning the control at the top-right**: the title could span the full width and
  stay centered, but the control leaves the flow (the header would not grow when it stacks) and
  nothing structurally prevents it from overlapping the title.
- **JavaScript measurement writing a CSS variable**: exact, but adds runtime cost, a resize and
  locale-change listener, and a hydration layout shift for a purely visual requirement.
- **`text-align: center` on the header with the control floated**: floating would take the control
  out of flow for the same reason as absolute positioning.

## R-002 — The title and the tagline are one centered unit

**Decision**: Wrap the existing `h1` and tagline in `.home__header__title`, give the block
`text-align: center`, and give both the `h1` and the tagline `width: fit-content` with
`margin-inline: auto`.

**Rationale**: `fit-content` makes each element's box hug its own text, so the element's box and
the text's ink share the same center — the specification's "title's horizontal midpoint" is then
unambiguous and directly measurable, and a left-aligned text inside a centered box cannot pass.
`margin-inline: auto` centers the hugging box inside the block, and `text-align: center` keeps the
text centered inside the box when it has to wrap. The measured offset between the tagline's
midpoint and the title's midpoint was 0.01 px in both locales.

The hug assertion therefore has two forms, and the check picks the one that applies at the width
under test. Where the tagline fits on one line — every tested width at the default text size — the
box width equals the text run's width within 1 px. Where the tagline wraps onto two lines (320 px
and 360 px at 200% text zoom), the box hugs the widest rendered line instead, so the box width
equals the widest line's width within 1 px and every line stays centered on the title's center
line. The midpoint assertion is identical in both cases.

The existing margins (`h1` 0.5 rem below, tagline 0.75 rem below) and the `1.5 rem` title size are
untouched, so the header's height does not change where the control shares the row.

**Alternatives considered**:

- **Centering the block only, leaving the `h1` full width**: the title's *box* would be centered
  while its *text* stayed left-aligned — the exact defect the specification warns about, and a
  check on the box alone would not catch it.
- **Centering the tagline with `text-align: center` but leaving the `h1` as a block**: works
  visually, but the title's measured box would no longer correspond to its text.
- **A fixed width for the title block**: would make the header's geometry locale-independent, but
  pins the header to a magic number and forces unnecessary wrapping when a translation changes.

## R-003 — The control keeps the top-right corner and never overlaps

**Decision**: The control wrapper is placed in the right grid track with `justify-self: end`, so its
right edge is flush with the content area's right edge in every state. Its natural width is held by
an explicit declaration on the wrapper — `width: max-content` with `max-width: 100%` — so the
switch is never squeezed. When the content area narrows below the active locale's stacking
threshold (38 em for Spanish, 35 em for English), the title block spans the full-width grid area on
the first row and the control moves to the second row, still flush with the content area's right
edge.

**Rationale**: The grid gives the non-overlap guarantee structurally: the control sits in the right
outer track and the title block in the middle one, and the stacking threshold is the measured width
at which the right track still holds the control at its natural width (36.04 em for Spanish,
33.74 em for English) plus the safety margin stated below (38 em for Spanish, 35 em for English), so
the control can never reach the title block while the two share the row. Between the measured width
and the threshold the control stacks even though the right track would still hold it at its natural
width — that band is what the margin buys. The measured result was no overlap and no lost natural
width in any state, and the switch's right edge measured within 0.01 px of the content area's
right edge in both the shared-row and the stacked state — the "keeps its place" requirement holds in
both.

`width: max-content` is the explicit mechanism that keeps the switch whole: it sizes the wrapper to
the switch's max-content width, so the two buttons keep their natural widths and their labels never
wrap or break mid-word. `max-width: 100%` caps the wrapper at its grid area, so the control can
never spill outside the content area. The two together give the control a natural width inside a
bounded box, which is exactly what both row states need.

`.lang-switch` itself is not modified. The switch is rendered only by `LanguageControl`, which is
rendered only by `app/pages/index.vue`, so the switch is used only by the home page. The reason for
leaving its rule alone is the two button labels ("Español" and "English") and the shared switch
styling, which the feature reuses exactly as they are — not any other screen, which does not
render the switch at all.

One measured case is narrower than the control's natural width: at the 320 px viewport with 200%
text zoom the content area is 288 px while the control's natural width is 371.8 px. `max-width:
100%` keeps the control inside the content area, and the switch's own `flex-wrap` puts the two
buttons on two rows, each still at its natural width with its label intact, so the control stays
visible, flush right, and operable. At the default text size the narrowest supported viewport
(320 px) leaves a content area of 304 px, wider than the control's 187.9 px natural width, so this
case does not occur there — it is asserted in the 200% zoom test, not in the width matrix.

**Alternatives considered**:

- **Letting the switch shrink to fit its track**: measured to squeeze the two buttons so their
  labels wrapped, which reads as broken. Rejected in favor of `width: max-content` on the wrapper.
- **Editing `.lang-switch` to `flex-wrap: nowrap` or `white-space: nowrap`**: would change the
  shared switch styling and reach into the component the feature does not own. Rejected.
- **Moving the control to the header's bottom-left or under the title**: explicitly forbidden by
  FR-007 ("MUST NOT be moved to any other position").
- **Hiding the control below the threshold**: forbidden by FR-007 (it must stay visible and
  operable) and by US3.

## R-004 — The stacking threshold follows the measured natural widths

**Decision**: Stack the control onto its own row when the home content area is narrower than
`38em` (Spanish tagline) or `35em` (English tagline), expressed in a container query.

**Rationale**: The measured requirement is the content width at which the right track still holds
the control at its natural width, and the threshold sits above it, so the control stacks a little
earlier than the measurement alone would require. Measured against the project's own stylesheet at
a 16 px root font:

| Quantity | Spanish | English |
|----------|---------|---------|
| Title block natural width | 11.55 em (184.78 px) | 9.25 em (147.95 px) |
| Language switch natural width | 11.74 em (187.91 px) | 11.74 em (187.91 px) |
| Header gap at these widths | 0.5 em (8 px) | 0.5 em (8 px) |
| Content area needed for one row | 36.04 em | 33.74 em |

The thresholds add a margin over the measured requirement — 5.4% for Spanish (36.04 em → 38 em)
and 3.7% for English (33.74 em → 35 em) — which covers the font-metric differences between
platforms (the ratios are measured on one platform; a wider system font changes them). The
threshold therefore sits above the measured requirement, so between the measured width and the
threshold the control is stacked even though the right track would still hold it at its natural
width — that band is the margin's purpose, not a gap in the non-overlap guarantee. A fine sweep in
2 px steps across both transition bands showed the switch keeping its natural width at every width,
with no squeezed state in either locale.

Because the threshold is in `em` and every participating width (title block, switch, gap) scales
with the root font size, the same ratios hold at 200% text zoom: measured there, the control still
shared the row with the centered title from a 1160 px viewport upward, and the title's midpoint
stayed within 0.02 px of the content area's center.

**The band between the two thresholds needs a viewport of its own.** 35 em is a 560 px content
area and 38 em is a 608 px content area, so only a viewport between 578 px and 627 px wide lands
between them. The tested matrix adds 600x800 for that: its content area is 581.6 px, which is
36.35 em at a 16 px root font — above the English threshold and below the Spanish one. At that
width the control shares the title's row in English and has a row of its own in Spanish, so the
locale asymmetry is exercised in both directions. Every other tested width is outside the band:
320 px and 360 px are below both thresholds, and 768 px and wider are above both.

### The header-growth baseline

The header's height before the feature is the reference for the growth rule, and it is not one
number: the pre-change header was a wrapping flex row, so the control already had a row of its
own at the narrow widths. Measured on the reference platform (Chromium, the project's own
stylesheet, a 16 px root font):

| Viewport | Content area | Header height before the feature | Control's row before the change |
|----------|--------------|----------------------------------|---------------------------------|
| 320x640 | 304 px (19.00 em) | 125.98 px in both locales | its own row in both locales |
| 360x640 | 344 px (21.50 em) | 125.98 px (`es`), 72.80 px (`en`) | its own row (`es`), the title's row (`en`) |
| 600x800 | 581.6 px (36.35 em) | 72.80 px in both locales | the title's row in both locales |
| 768x1024 | 747.58 px (46.72 em) | 72.80 px in both locales | the title's row in both locales |
| 1920x1080 | 864 px (54.00 em) | 72.80 px in both locales | the title's row in both locales |

The one-row header is 72.80 px (the title block) and the two-row header is 125.98 px = 72.80 + 8
(the header gap) + 45.19 (the control's height).

**The growth rule applies only where the control shared the title's row before the change.** At
those widths the header may grow by exactly the control's height plus the header's gap — 53.18 px
at 360 px and at 600 px — and by no more. Where the control already had its own row before the
change, the header's height does not change at all, because the pre-change wrapping flex row
already produced the same two rows.

The tightest case in the matrix is English at 360 px: the pre-change row needed
147.95 + 187.91 + 8 = 343.86 px in a 344 px content area, a margin of 0.14 px. A platform with
slightly wider font metrics would have wrapped the control there already, so the baseline is
recorded on the implementation machine before any edit and the growth rule is asserted against
that recorded baseline rather than against hard-coded numbers.

**Alternatives considered**:

- **A viewport media query in pixels**: the threshold would not follow the visitor's text size, so
  the 200% text-zoom case (FR-012, FR-006) would be uncovered.
- **A single threshold for both locales**: simpler, but it would stack the control in English at
  widths where the shorter English tagline still fits beside it — unnecessary stacking in English,
  for a difference of 2.3 em between the two thresholds.
- **A fixed-width title block to remove the locale difference**: rejected under R-002.

## R-005 — A container query, not a media query

**Decision**: Declare the home content area as an inline-size container
(`container-type: inline-size` on `.home`) and express the stacking rule with `@container`.

**Rationale**: The decision the header must make depends on the *content area's* width, not the
viewport's: the content area is the reference frame for "centered" and it is narrower than the
viewport by the home page's padding. A container query also makes the `em` threshold scale with
the visitor's text size, because `em` inside a container query resolves against the container's
own font size.

The containment applies inline-size, layout, and style containment. The home content area's inline
size comes from `width: 100%` and `max-width: 56rem`, never from its contents, so containment
cannot change its size; the home page has no absolutely positioned or `position: fixed`
descendants, so the layout containment creates no behavioural difference. The home page has one
scroll surface (the document), which is unaffected.

**Alternatives considered**:

- **Media query on the viewport**: ties the rule to device pixels and to a width that is not the
  reference frame for "centered".
- **JavaScript `ResizeObserver` on the header**: re-introduces runtime measurement for a decision
  CSS can make.
- **Flex wrapping as the stacking mechanism**: flexbox cannot center the title against the content
  area while a control shares the row (R-001), so wrapping alone cannot deliver the feature.

## R-006 — Verification strategy

**Decision**: Add `e2e/home-header.spec.ts` with six Playwright tests; add no Vitest test; leave
the existing suites untouched.

The six tests cover, in both locales where the locale matters:

1. The rendered title text's midpoint is within 2 px of the content area's midpoint at 320, 360,
   600, 768, 1024, 1440, and 1920 px.
2. The tagline is the element immediately below the title and its midpoint coincides with the
   title's within 2 px, with the hug assertion in its one-line or its wrapped form.
3. The control never intersects the title block, keeps its natural width, and stays flush with the
   content area's right edge — either on the title's row or on its own row below it — including
   the locale asymmetry at 600 px.
4. Where the control is stacked, the header is taller by exactly the control's height plus the
   header gap measured against the pre-change baseline, and the countdown that follows sits
   immediately below the header.
5. At 200% text zoom there is no horizontal scrolling at 320, 360, 768, and 1920 px, the title
   stays centered, and the control stays fully visible and operable — including the one case
   where the content area is narrower than the control.
6. The title is the page's first heading and the only `h1`, and the control is reachable and
   operable with the keyboard while the title stays centered.

**Rationale**: The specification's clarification requires an automated viewport check and rejects
a visual-only review, so the centering must be asserted from rendered geometry. Playwright can read
real bounding boxes and text ranges, computed styles, and focus behaviour without reading
stylesheet source, which the constitution forbids. The title's text is measured with a `Range` over
the heading's contents, so the assertion holds for any implementation that centers the *text*,
not only for one that happens to center a particular box. Six tests sit well inside the
constitution's 15-test cap, and the feature adds no pure logic that would justify a unit test.

**Alternatives considered**:

- **A snapshot or markup test**: forbidden by the constitution and useless for a geometry feature.
- **Measuring only the `h1` element's box**: would pass even if the text were left-aligned inside a
  centered box.
- **Adding the checks to the existing `e2e/viewport-fit.spec.ts`**: possible, but a separate file
  keeps this feature's verification self-contained and keeps the existing suite's contract intact.
- **A Vitest unit test**: there is no pure function to test; the logic is entirely in the layout.

## R-007 — Accessibility and reading order are preserved

**Decision**: Keep the document order as it is: title block, then language control, then the
countdown and the catalog. Add no ARIA, no landmark, and no `tabindex`.

**Rationale**: The `h1` stays the page's first heading and its only main heading, so the reading
order and the heading outline are unchanged (FR-009). The control keeps its existing
`role="group"` with its `aria-label`, its two real `<button>` elements, and their `aria-pressed`
state, so it stays operable by pointer and by keyboard with the existing global focus outline
(FR-008). Centering is a visual placement only; nothing about the semantics changes.

**Alternatives considered**:

- **Reordering the control before the title in the DOM to satisfy the grid**: would change the
  reading order and break FR-009. The grid needs no reordering, because both items are placed
  explicitly (R-001).
- **Adding `aria-hidden` or a `role` to the title block**: unnecessary; the block adds no meaning.

## R-008 — Localization

**Decision**: Introduce no message key and no new string. The title text, both taglines, and the
control's labels are reused unchanged. The only locale-dependent rule is the stacking threshold,
which uses the `lang` attribute the app already publishes on `<html>`.

**Rationale**: "Animatch" is the product name and reads the same in both locales, so the title
needs no translation; both taglines already exist in `es.ts` and `en.ts` (FR-010, SC-008). The
app sets `htmlAttrs: { lang: locale }` reactively, so `html[lang='es']` and `html[lang='en']` are
already accurate at runtime and react to a language switch without extra state. The Spanish
threshold is the wider one, because the Spanish tagline is the longer one; the English threshold
is the narrower one, because the shorter English tagline fits beside the control at widths where
the Spanish one does not. The 600x800 viewport is what makes that difference observable (R-004).

**Alternatives considered**:

- **One threshold for both locales**: simpler, but stacks the control in English when it does not
  need to be stacked.
- **Measuring the tagline's width at runtime to pick the threshold**: adds a measurement pass for a
  difference of 2.3 em.

## R-009 — Scope boundary

**Decision**: Touch exactly three files: `app/pages/index.vue` (two wrapper classes),
`app/assets/css/main.css` (the header rules), and the new `e2e/home-header.spec.ts`.

**Rationale**: The specification is a presentation-only change (FR-013, FR-014, FR-015): no game
rules, daily content, availability rules, routes, saved results, sharing behaviour, storage, network
request, server change, or dependency changes. The existing visual language — typography, spacing,
rounded surfaces, colors, the `56rem` content column — is reused unchanged; only the title
block's horizontal placement differs.

**Alternatives considered**:

- **Extracting the header into a new `HomeHeader.vue` component**: a larger refactor of a region
  that only the home page uses, with no behavioural benefit for this feature.
- **Reworking the game's `GameShell` header at the same time**: out of scope; the specification
  limits the change to the home page.
