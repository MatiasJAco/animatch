# UI Contract: Centered Home Header

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)

This contract describes the observable home-page header interface. The daily API payload, the
catalog, and every other part of the page are unchanged. Every rule here is observable in the
rendered page, so the viewport check asserts it from geometry and reading order without reading
stylesheet source or markup snapshots.

## 1. Header Structure

```text
main.home
└── header.home__header
    ├── div.home__header__title      (title block: the h1 and the tagline)
    │   ├── h1                      (the page's only main heading: "Animatch")
    │   └── p.muted                 (the tagline)
    └── div.home__header__control
        └── div.lang-switch[role="group"]
            ├── button.button[lang="es"]
            └── button.button[lang="en"]
```

- The document order is: title block, language control, then the reset countdown and the catalog.
- The `h1` is the page's first heading and its only `h1`. No other main heading is introduced.
- The title block's `h1` is followed immediately by the tagline; no element sits between them.
- The language control keeps its `role="group"`, its `aria-label`, its two `<button>` elements,
  and their `aria-pressed` state.

## 2. Centering

- The **content area** is the home page's content box: the `.home` element's border box minus its
  horizontal padding. Its horizontal midpoint is the reference for every centering rule.
- The **title's midpoint** is the horizontal center of the rendered title text, not of a container.
  It is measured from the text run itself, so a centered box holding left-aligned text fails.
- The **tagline's midpoint** is measured the same way, from the tagline's text run.

| Rule | Tolerance |
|------|-----------|
| `abs(titleMidpoint - contentAreaMidpoint) <= 2` | 2 px |
| `abs(taglineMidpoint - titleMidpoint) <= 2` | 2 px |

These hold at every viewport width from 320 to 1920 pixels, in both locales, after a resize
without a reload, after a locale switch, and at 200% text zoom.

The tested viewport matrix is 320x640, 360x640, 600x800, 768x1024, 1024x768, 1440x900, and
1920x1080. The 600x800 viewport is inside the threshold band of §4 and is the case that tells the
two locales' thresholds apart.

## 3. Title Block

- The title and the tagline form one unit and are centered together on the same horizontal center
  line.
- Each of the title's and the tagline's boxes hugs its own text and is centered on that line. The
  hug assertion has two forms, and the check picks the one that applies at the width under test:
  - **where the text fits on one line** (every tested width at the default text size), the box
    width equals the text run's width within 1 px;
  - **where the text wraps onto two lines** (320 px and 360 px at 200% text zoom), the box hugs the
    *widest* rendered line: the box width equals the widest line's width within 1 px, and every
    rendered line stays centered on the title's center line.
- The title's and the tagline's text never overflows the content area and is never clipped or
  truncated. When the text is too wide for the content area it wraps inside it, and the wrapped
  text stays centered on the same center line.
- The title's typography, size, color, and margins are unchanged from the current home page.

## 4. Language Control

- The control is always visible and fully inside the content area.
- The control's right edge is flush with the content area's right edge, within 1 px, in every
  state.
- The control's box never intersects the title block's box.
- The control keeps its natural width: the wrapper that holds the switch is sized to the switch's
  max-content width, so the two buttons stay on one row and their labels never wrap or clip.
  The switch's own rule is not changed to achieve this — the switch is used only by the home page,
  and the reason it stays untouched is its two button labels ("Español" and "English") and the
  shared switch styling, which are reused exactly as they are.
- One case is narrower than the natural width: at the 320 px viewport with 200% text zoom the
  content area is 288 px while the control's natural width is 371.8 px, so no layout can keep both
  buttons on one row there. The control stays fully inside the content area, flush right, and
  operable, and the switch's own wrapping puts the two buttons on two rows, each still at its
  natural width with its label intact. At the default text size the narrowest supported viewport
  (320 px) leaves a content area of 304 px, wider than the control's 187.9 px natural width, so this
  case does not occur there.
- The control is operable by pointer and by keyboard, and its focus indicator is visible.
- The control never moves to any corner other than the content area's top-right.

### Row placement

| State | Condition | Placement |
|-------|-----------|-----------|
| Shared row | The content area is at least the locale's threshold width | The control sits on the title's row, to the right of the title block, flush right |
| Stacked row | The content area is narrower than the locale's threshold width | The title block occupies the full-width grid area on the first row; the control occupies a row of its own below it, flush right |

Thresholds, expressed in the content area's font-size units:

| Locale | Threshold | Equivalent content width at a 16 px root font |
|--------|-----------|------------------------------------------|
| `es` | 38 em | 608 px |
| `en` | 35 em | 560 px |

The control is stacked when the content area narrows below the locale's threshold width — 38 em for
`es`, 35 em for `en` — which includes the safety margin over the measured requirement, so the
control stacks even where the right track would still hold it at its natural width. The threshold
scales with the visitor's text size, so at 200% text zoom the same rule applies.

The two thresholds are distinguishable only inside the band between 35 em and 38 em, which is the
content area of a viewport between 578 px and 627 px wide. The tested viewport 600x800 produces a
content area of 581.6 px (36.35 em at a 16 px root font), so the control shares the title's row in
English and has a row of its own in Spanish at that width.

## 5. Vertical Consequences

- While the control shares the title's row, the header's height is unchanged from the current home
  page, and the reset countdown and the game catalog do not move.
- While the control is stacked, the header is taller by exactly the control's height plus the
  header's gap, and no more.
- The reference for the header's height is the header's height **before** the feature, measured at
  the same width, per locale. That baseline is not one number: the pre-change header was a
  wrapping flex row, so the control already had a row of its own at the narrow widths.
- **The growth rule applies only where the control shared the title's row before the change.**
  At those widths the header may grow by exactly the control's height plus the header's gap, and by
  no more — 53.18 px at 360 px and at 600 px on the reference platform. Where the control already
  had its own row before the change, the header's height does not change at all.
- The reset countdown and the game catalog move down by that same amount and by no more; they flow
  immediately after the header.
- No other vertical change to the home page is permitted: the catalog's order, the per-card
  states, the loading message, the retryable failure state, and the development-only reset
  control are unaffected.

Reference baseline, measured on the reference platform (Chromium, the project's own stylesheet, a
16 px root font):

| Viewport | Content area | Header height before the feature | Control's row before the change |
|----------|--------------|----------------------------------|---------------------------------|
| 320x640 | 304 px (19.00 em) | 125.98 px in both locales | its own row in both locales |
| 360x640 | 344 px (21.50 em) | 125.98 px (`es`), 72.80 px (`en`) | its own row (`es`), the title's row (`en`) |
| 600x800 | 581.6 px (36.35 em) | 72.80 px in both locales | the title's row in both locales |
| 768x1024 | 747.58 px (46.72 em) | 72.80 px in both locales | the title's row in both locales |
| 1920x1080 | 864 px (54.00 em) | 72.80 px in both locales | the title's row in both locales |

## 6. Responsive and Failure Behaviour

- From 320 to 1920 pixels wide, in both locales and at 200% text zoom, the document has no
  horizontal scrollbar and no element extends past the viewport's horizontal edges.
- At 1920x1080 the home page still fits without vertical scrolling, exactly as before the feature.
- A total listing failure keeps the existing page-level error panel with a retry action, and the
  header is unaffected by the listing outcome.
- While loading, the page shows the existing loading message; the header is unaffected.

## 7. Accessibility

- The title is announced as the home page's main heading, first in reading order, and centering
  does not change the reading order or the header's meaning.
- The language control's accessible name, roles, and pressed states are unchanged.
- Centering does not depend on motion or hover effects, so `prefers-reduced-motion` and
  `prefers-color-scheme` change nothing about it.

## 8. Existing Behaviour Preserved

- The title text is exactly "Animatch" in both locales, and no new user-facing string is
  introduced.
- The daily API shape, route paths, game content, availability probing, puzzle identity, local
  result keys, sharing, and reset behaviour are unchanged.
- The reset countdown and the language control remain on the page.
- The language switch's two button labels and its shared styling are unchanged.
- The development-only reset control remains development-only.
- No dependency, storage, network request, or server-side change is introduced.
