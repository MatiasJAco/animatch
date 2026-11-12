# Phase 1 Data Model: Centered Home Page Title

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Summary

This feature introduces no database table, column, migration, server payload, API route, message
key, or stored browser field. It adds no persisted data of any kind.

What it does add is a set of **presentation entities**: the header's parts and the geometry each of
them must satisfy. Every one of them is derived at render time from the existing message catalog
and the browser's layout, and every one of them is observable in the rendered page, so the
entities below are the model the automated check asserts against.

## Existing Inputs (unchanged)

| Input | Source | Fields used |
|-------|--------|-------------|
| Title text | `app/i18n/es.ts`, `app/i18n/en.ts` | `app.title` ("Animatch", identical in both locales) |
| Tagline text | `app/i18n/es.ts`, `app/i18n/en.ts` | `app.tagline` ("Puzzles diarios de anime" / "Daily anime puzzles") |
| Control labels | `app/i18n/es.ts`, `app/i18n/en.ts` | `lang.label`, `lang.switch.es`, `lang.switch.en` |
| Locale | `useLocale()` → `useHead({ htmlAttrs: { lang } })` | `es` / `en`, published on `<html lang>` |
| Content area | `.home` element in `app/assets/css/main.css` | `max-width: 56rem`, symmetric padding, `margin: 0 auto` |
| Header gap | `--gap` custom property | `clamp(0.5rem, 0.35rem + 0.4vw, 0.75rem)` |
| Daily listing | Existing `/api/daily` response | Unchanged; not part of the header's model |
| Device result | `useLocalProgress()` | Unchanged; not part of the header's model |

No field above changes shape, value, or source. The feature only reads them.

## Entity: Content Area

The horizontal band the home page's content occupies; the reference frame for "centered".

| Field | Type | Rule |
|-------|------|------|
| `left` | number (px) | The `.home` element's border-box left edge plus its left padding |
| `right` | number (px) | The `.home` element's border-box right edge minus its right padding |
| `width` | number (px) | `right - left`; the content box's inline size |
| `midpoint` | number (px) | `(left + right) / 2` — the horizontal center of the content area |
| `inlineSizeEm` | number | `width` expressed in the container's font size; the unit the stacking threshold uses |

**Validation**

- The content area's padding is symmetric and the element is centered, so its midpoint coincides
  with the viewport's horizontal midpoint in every current layout; the check measures the content
  area itself so it stays correct if the padding ever changes.
- The content area is never narrower than the viewport's width minus its padding, and never
  negative.

## Entity: Home Title

The page's main heading, showing the product name.

| Field | Type | Rule |
|-------|------|------|
| `text` | string | Exactly `app.title`; "Animatch" in both locales |
| `textMidpoint` | number (px) | The horizontal center of the rendered text run |
| `boxWidth` | number (px) | The element's border-box width; equals the text's advance width while the text fits on one line |
| `level` | integer | `1`; it is the page's first heading and its only `h1` |
| `positionInDocument` | integer | First heading in reading order |

**Validation**

- `|textMidpoint - contentArea.midpoint| <= 2` (the alignment tolerance) at every supported width,
  in both locales, at 100% and 200% text zoom.
- The title's box never extends past the content area's edges.
- The title's text is never clipped or truncated; it wraps inside the content area instead.

## Entity: Tagline

The muted subtitle directly beneath the title.

| Field | Type | Rule |
|-------|------|------|
| `text` | string | `app.tagline` for the active locale |
| `textMidpoint` | number (px) | The horizontal center of the rendered text run |
| `relation` | enum | `directly-below-title`; the element immediately following the `h1` in the title block |
| `owner` | Home Title | The tagline belongs to the title block and moves with it |

**Validation**

- `|textMidpoint - homeTitle.textMidpoint| <= 2` — the tagline sits on the title's center line.
- The tagline is the element immediately below the title in the rendered page.
- The tagline is never clipped or truncated in either locale, including at 200% text zoom.
- The placement assertion has two forms, and the check picks the one that applies at the width
  under test:
  - where the tagline fits on one line (every tested width at the default text size),
    `|boxWidth - textRunWidth| <= 1`;
  - where the tagline wraps onto two lines (320 px and 360 px at 200% text zoom), the rule is
    measured on the rendered text run, because a block-level box cannot hug its widest wrapped
    line — `fit-content` resolves to `min(max-content, available)`, so the box takes the whole
    available width. Every rendered line stays centered on the title's center line within 2 px,
    the tagline is neither clipped nor truncated, and the tagline's box stays inside the content
    area and centered on it.

## Entity: Header Block

The title and the tagline as one visual unit, centered as one unit.

| Field | Type | Rule |
|-------|------|------|
| `title` | Home Title | The block's first child |
| `tagline` | Tagline | The block's second child |
| `center` | number (px) | Coincides with `contentArea.midpoint` |
| `placement` | enum | `middle-track` (grid column 2, control shares the row) or `full-width-track` (grid columns 1 to -1, control stacked) |

**Validation**

- The block's center equals the content area's midpoint in both placements.
- The block's width is its content's natural width while the content fits; it shrinks and wraps
  rather than overflowing when it does not.
- The block's grid column is fixed at 2 in the shared-row state; both grid placements — the
  block's column 2 and the control's column 3 — are established together, so the control is never
  auto-placed into the left outer track.

## Entity: Language Control

The header's language switcher.

| Field | Type | Rule |
|-------|------|------|
| `labels` | string pair | The existing `lang.switch.es` / `lang.switch.en` strings |
| `naturalWidth` | number (px) | The switch's width with both buttons on one row; never reduced while the content area can hold it |
| `rightEdge` | number (px) | Within 1 px of the content area's right edge, in every state |
| `row` | enum | `with-title` (first row, beside the title block) or `below-title` (own row) |
| `overlap` | boolean | Always `false`: the control never intersects the title block |
| `operable` | boolean | Reachable and operable by pointer and by keyboard; focus indicator visible |

**Validation**

- The control's right edge is flush with the content area's right edge in both rows.
- The control's box never intersects the title block's box.
- The control keeps its natural width; its labels never wrap or clip. The width is held explicitly
  by the wrapper (`width: max-content` with `max-width: 100%`), not by editing `.lang-switch`,
  which stays untouched because the switch is used only by the home page and its two button labels
  and shared styling must be reused exactly as they are.
- Two widths are narrower than the control's natural width: the 320 px viewport at 200% text zoom
  (content area 288 px) and the 360 px viewport (content area 328 px), against a natural width of
  371.8 px: the control stays fully inside the content area, flush right, and operable, and the
  switch's own wrapping puts the two buttons on two rows, each still at its natural width with its
  label intact.
- The control is on its own row only when the content area is narrower than the stacking threshold
  for the active locale (38 em for `es`, 35 em for `en`).
- The control's markup, roles, labels, and `aria-pressed` state are unchanged.

## Entity: Header

The header region that contains the header block and the language control.

| Field | Type | Rule |
|-------|------|------|
| `height` | number (px) | Measured against the header's height *before* the feature at the same width and locale |
| `baselineHeight` | number (px) | The pre-change height at that width and locale, recorded before any edit: 125.98 px where the pre-change control already had its own row, 72.80 px where it shared the title's row |
| `growth` | number (px) | The change against the baseline: the control's height plus the header gap where the control shared the row before the change, and 0 everywhere else |
| `followers` | list | The reset countdown badge and the game catalog, which flow immediately after the header |

**Validation**

- `growth` is `0` while the control shares the title's row, and also `0` where the control already
  had its own row before the change — the pre-change wrapping flex row already produced the same
  two rows there.
- `growth` equals the control's height plus the header gap at the widths where the control shared
  the title's row before the change and the new stacking rule moves it to a row of its own: 53.18 px
  at 360 px (English) and at 600 px (Spanish).
- The countdown's top edge is the header's bottom edge, so the countdown and the catalog move down
  by exactly the header's growth and by no more.

## State Transitions

| Current state | Trigger | Next state | Header effect |
|---------------|---------|------------|---------------|
| Shared row | Content area reaches the locale's threshold width | Stacked row | Title block spans the full width; the control moves below it and flush right; the header grows by the control's height plus the gap |
| Stacked row | Content area grows past the locale's threshold width | Shared row | Title block returns to the middle track; the control returns to the title's row; the header returns to its original height |
| Any | Locale switched | Same layout rule, locale's threshold | The tagline's text changes; the title's text does not; the title stays centered and the control keeps its place |
| Any | Viewport resized | Same layout rule | The title re-centers at the new width without a reload |
| Any | Root font size changed (200% text zoom) | Same layout rule, scaled threshold | The title, tagline, and control scale together; the title stays centered; the control keeps its natural width |
| Any | Listing fails or is loading | No change | The header is independent of the catalog; the error panel and loading message are untouched |

## Relationships

```text
Content Area (1) ──> Header (1)
Header (1) ──< Header Block (1)
Header (1) ──< Language Control (1)
Header Block (1) ── (1) Home Title
Header Block (1) ── (1) Tagline
Header Block (1) ── (1) Content Area   (shared center line)
Locale (1) ──> Language Control labels
Locale (1) ──> Tagline text
Locale (1) ──> stacking threshold
```

## Non-Goals

- No new persistence, server response, API route, database access, schema, message key, or
  translation.
- No change to the daily listing, the catalog, the countdown, the game cards, the game rules, the
  availability rules, the routes, the saved results, or the sharing behaviour.
- No change to the game screens' headers, the error screen, or any other page.
- No runtime measurement, no JavaScript, and no resize or locale listener.
