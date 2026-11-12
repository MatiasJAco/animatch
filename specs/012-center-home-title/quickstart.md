# Quickstart Validation: Centered Home Page Title

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This guide proves the home page title is centered end to end. It is a validation runbook, not an
implementation guide. The interface rules live in
[contracts/home-header-layout.md](./contracts/home-header-layout.md) and the geometry rules live in
[data-model.md](./data-model.md).

## Prerequisites

- Node.js 22.18 or newer
- PostgreSQL 13 or newer with the read-only catalog from `docs/catalog-schema.sql`
- A local `.env` containing `DATABASE_URL` (never commit it)
- Chromium installed for Playwright: `npx playwright install chromium`

## Setup

```bash
npm install
cp .env.example .env      # set DATABASE_URL
npm run db:migrate
npm run dev
```

Open `http://localhost:3000/`. The home page shows the "Animatch" title and its tagline.

## Manual Validation

### 1. The title is centered

1. Open the home page at 1920x1080.
2. In the browser inspector, compare the `h1`'s bounding box with the `.home` element's content
   box: the title's horizontal center must coincide with the content area's horizontal center.
3. Repeat at 1440x900, 1024x768, 768x1024, 600x800, 360x640, and 320x640.
4. Drag the window from narrow to wide without reloading.

Expected: the title sits in the middle of the page at every width, and it never drifts while the
window is resized.

### 2. The tagline rides with the title

1. At 1920x1080, confirm the tagline is the element immediately below the title.
2. Compare the tagline's horizontal center with the title's.
3. Switch to English, then back to Spanish.

Expected: the tagline is centered on the title's own center line in both languages; it is not
left-aligned under a centered title, and it is neither clipped nor truncated. Where the tagline
wraps onto two lines, each line stays centered on the same center line and the tagline's box hugs
its widest line.

### 3. The language control keeps its place

1. At 1920x1080, confirm the language control sits at the top-right of the content area, on the
   same row as the title.
2. Narrow the window to 360 pixels.
3. Confirm the control moves onto a row of its own below the title block, still flush with the
   content area's right edge.
4. Narrow the window to 600x800 — its content area is 581.6 px, between the two locales'
   thresholds — and confirm that in English the control still shares the title's row while in
   Spanish it has a row of its own.
5. Widen the window back past the threshold.

Expected: the control never overlaps the title or the tagline, never changes corner, and returns to
the title's row when there is room again.

### 4. The header grows by exactly what stacking requires

1. Before any change, note the header's height at 320x640, 360x640, 600x800, 768x1024, and
   1920x1080 in both languages; that is the baseline.
2. After the change, measure the header's height at the same widths and compare.
3. Narrow the window until the control stacks, and compare the countdown badge's position.

Expected: at the widths where the control shared the title's row before the change, the header grew
by exactly the control's height plus the header's gap and by no more; at the widths where the
control already had its own row before the change, the header's height did not change at all. The
countdown and the catalog moved down by exactly that amount. Nothing else on the page moved.

### 5. Text zoom

1. Set the browser's default font size to 200% (or set the root font size to 32 px in the
   inspector).
2. Reload the home page at 1920x1080, then at 360 pixels and 320 pixels.

Expected: the title stays centered on the content area's center line, the tagline stays on the same
center line, the control stays fully visible and operable, and the page gains no horizontal
scrollbar. At 320 pixels the content area is narrower than the control, so the two buttons sit on
two rows, each still at its natural width, and the control stays inside the content area and
flush right.

### 6. Nothing else changed

1. Play a game, finish it, and return to the home page.
2. Confirm the catalog still lists the five games in the same order with the same card states, that
   the finished marker is still shown, and that the countdown still counts down.
3. Confirm the development-only reset control is still available in a development build.

Expected: only the header's horizontal placement differs from before the feature.

### 7. Keyboard and assistive technology

1. Press Tab from the top of the page.
2. Confirm the language control is reachable, shows a visible focus ring, and switches the language
   with Enter or Space.
3. With a screen reader, confirm the title is announced as the page's main heading and that the
   reading order is unchanged.

Expected: the header is fully operable without a pointer and the title is still the first heading.

## Automated Validation

```bash
npm test
npm run test:viewport
```

`npm test` covers the existing unit and route suites; the feature adds no Vitest test because it
adds no logic beyond layout.

`npm run test:viewport` boots Nuxt with the local database and adds `e2e/home-header.spec.ts`,
which covers:

- the rendered title text's midpoint against the content area's midpoint at 320, 360, 600, 768,
  1024, 1440, and 1920 pixels, in both locales, within the 2 px alignment tolerance;
- the tagline's center line and its position immediately below the title, with the hug assertion
  in its one-line or its wrapped form;
- the control's non-overlap, its natural width, and its flush-right placement in both the shared
  and the stacked row, including the locale asymmetry at 600 pixels;
- the header's growth against the pre-change baseline, and the countdown's position below it;
- 200% text zoom with no horizontal scrolling and the title still centered;
- the title as the page's first and only `h1`, and the control's keyboard operability.

Expected: all tests pass. The feature adds six tests, staying within the project's 15-test cap,
and the pre-existing home-catalog and viewport-fit suites stay green.

## Failure Triage

| Symptom | Check |
|---------|-------|
| The title is off center | The header must be a three-track grid with two equal outer tracks; a flex or absolute control shifts the title by half the control's width. |
| The control sits on the left of the title | Both grid placements must ship together: the title block in column 2 and the control in column 3. With only the title placed, auto-placement drops the control into the left outer track. |
| The tagline is left-aligned | The tagline needs its own hug-and-center rule, not only a centered parent. |
| The control overlaps the title | The control must sit in the right outer track and stack below the threshold; check the container query's `em` threshold against the measured natural widths. |
| The control's labels wrap | The control wrapper must carry `width: max-content`; a squeezed switch means the stacking threshold is too generous for the active locale. |
| The control is not flush right | The control wrapper must be aligned to the end of its track in both the shared and the stacked state. |
| The two languages stack at the same width | Check the two container-query thresholds: Spanish 38 em, English 35 em, both against the content area. At 600 pixels the content area is 36.35 em, so the locales must differ. |
| The header grew too much | The header may only grow by the control's height plus the header gap, and only at the widths where the control shared the title's row before the change; check that the control is not creating an extra row. |
| The page scrolls sideways | Check the content area's padding and the widest element at 320 px and at 200% text zoom. |
| The title is centered but the text is not | The check must measure the text run, not the heading's container box. |
