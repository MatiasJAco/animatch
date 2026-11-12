---
description: "Task list for Centered Home Page Title"
---

# Tasks: Centered Home Page Title

**Input**: Design documents from `/specs/012-center-home-title/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md,
contracts/home-header-layout.md, quickstart.md

**Tests**: Included. The specification's clarification rejects a visual-only review as evidence and
requires an automated viewport check, and plan.md/research.md (R-006) define six Playwright tests in
the new file `e2e/home-header.spec.ts`. Keep the feature at or under 15 tests; never assert
stylesheet source text, CSS class strings, or markup snapshots.

**Organization**: Tasks are grouped by user story in priority order (US1 → US4). US1 and US2 are
both P1: the centered title and the tagline riding with it are one visual unit and are shipped
together as the MVP.

**Format**: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: `[US1]` centered title, `[US2]` tagline on the title's center line, `[US3]` language
  control keeps its place, `[US4]` nothing else on the page changes
- Every task names an exact file path and references the relevant requirement, contract section, or
  research decision.

## Path Conventions

Single Nuxt project: `app/` (browser code), `e2e/` (Playwright), `tests/` (Vitest). This feature
touches exactly three files — `app/pages/index.vue`, `app/assets/css/main.css`, and the new
`e2e/home-header.spec.ts` — and adds no `server/` or `migrations/` file, no dependency, and no
message key.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the shared measurement harness and record the pre-change baseline that the
header's growth rule is measured against.

- [X] T001 [P] Create `e2e/home-header.spec.ts` with the shared Playwright harness used by every story's test: a viewport matrix of 320x640, 360x640, 600x800, 768x1024, 1024x768, 1440x900, and 1920x1080; a `setLocale` helper that seeds `animatch:v1:prefs` with `{ v: 1, language }` in local storage before navigation (same shape as `e2e/viewport-fit.spec.ts`); and geometry helpers that return (a) the title's *text run* midpoint measured with a `Range` over the `h1`'s contents, (b) the `.home` element's content box (border box minus its horizontal padding), (c) the tagline's text-run midpoint, its box width, and the width of its widest rendered line, (d) the language control's bounding box and its two buttons' boxes, and (e) the header's and the countdown badge's bounding boxes. Helpers must assert rendered geometry and reading order only — no stylesheet source text, CSS class-string contents, or markup snapshots (spec FR-001; research.md R-006; constitution VI).
- [X] T002 [P] Record the pre-change baseline before any edit: run `npm test` and `npm run test:viewport` from the repository root and confirm both suites are green, and record the rendered height of the `.home__header` element (the header in `app/pages/index.vue`, sized by the rule in `app/assets/css/main.css`) at 320x640, 360x640, 600x800, 768x1024, and 1920x1080 in **both** locales, plus whether the language control shared the title's row or already had a row of its own at each of those widths, plus the content area's width at 600x800. The pre-feature header was a wrapping flex row, so the control already had its own row at 320 px in both locales and at 360 px in Spanish; the reference values on the reference platform are 125.98 px (two rows: 72.80 px title block + 8 px gap + 45.19 px control) and 72.80 px (one row), and 600x800's content area is 581.6 px. These recorded heights are the reference the header-growth rule is measured against: the rule applies only at the widths where the control shared the row before the change, and nowhere else (spec SC-010, SC-013; quickstart.md Automated Validation; plan.md Design Approach — header-growth baseline).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The header's markup structure and the grid container that every story builds on.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [X] T003 Add the two wrapper elements to `app/pages/index.vue`: wrap the existing `h1` and the tagline `p.muted` in `<div class="home__header__title">`, and wrap `<LanguageControl />` in `<div class="home__header__control">`. Keep the document order title block → language control → `<CountdownBadge />` → catalog; keep the `h1` as the page's only `h1`; leave the control's `role="group"`, `aria-label`, its two `<button>` elements, and their `aria-pressed` state untouched; add no ARIA, landmark, or `tabindex` (spec FR-002, FR-009, FR-010; contracts/home-header-layout.md §1, §7; research.md R-007, R-009).
- [X] T004 Replace the flexbox `.home__header` rule in `app/assets/css/main.css` with the three-track CSS grid `grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr)`, keeping `flex: 0 0 auto` (the header is still a flex item of the column-flex `.home`) and `gap: var(--gap)`, replacing `flex-wrap` and `justify-content: space-between` with `align-items: start` (the grid equivalent of the flexbox's `align-items: flex-start`, which keeps the control at its own height instead of stretching it to the title block's), and **in the same change placing both children explicitly**: `.home__header__title { grid-column: 2; }` and `.home__header__control { grid-column: 3; justify-self: end; }`. The two placements are one layout decision, not two: with only the title placed, grid auto-placement would drop the control into the free left outer track (column 1), beside the title instead of flush right. With two equal outer tracks the middle track's center is the content area's center at every width, with no measurement and no JavaScript; a flexbox header cannot express this because a flexible sibling steals space from one side (spec FR-001, FR-007; research.md R-001; plan.md Design Approach — centering mechanism; quickstart.md Failure Triage).
- [X] T005 Declare the home content area as an inline-size container by adding `container-type: inline-size` to the `.home` rule in `app/assets/css/main.css`, leaving `max-width: 56rem`, `margin: 0 auto`, and the symmetric `padding: clamp(0.5rem, 0.35rem + 0.6vw, 1rem)` unchanged. The content area's inline size comes from `width: 100%` and `max-width: 56rem`, never from its contents, so containment cannot change its size (spec FR-006, FR-012; research.md R-005; data-model.md Entity: Content Area).

**Checkpoint**: The header has the two wrapper elements, a three-track grid with both children
explicitly placed in their tracks, and a container context; `npm test` is still green.

---

## Phase 3: User Story 1 - The title sits in the middle of the page (Priority: P1) 🎯 MVP

**Goal**: The rendered "Animatch" text's horizontal midpoint coincides with the home page's content
area's horizontal midpoint within the 2 px alignment tolerance at every supported width, in both
locales, while the page is resized.

**Independent Test**: Load `/` at 320x640, 360x640, 600x800, 768x1024, 1024x768, 1440x900, and
1920x1080 in Spanish and English and compare the `h1`'s text-run midpoint with the `.home` content
box's midpoint; the two must differ by no more than 2 px at every size, including after an in-place
resize.

### Tests for User Story 1

- [X] T006 [P] [US1] Add the centering test to `e2e/home-header.spec.ts`: for each of the seven viewports and each locale (`es`, `en`), load `/`, wait for the catalog, measure the `h1`'s text-run midpoint with a `Range` and the `.home` content box's midpoint, and assert the absolute difference is `<= 2` px (the alignment tolerance); then resize the viewport in place without a reload and re-assert at the new width. Assert the `h1` text is exactly "Animatch" in both locales and that the title's box never extends past the content area's edges. This is one Playwright test (spec FR-001, FR-002, FR-003, FR-004, FR-010; SC-001, SC-002, SC-003, SC-014; contracts/home-header-layout.md §2).

### Implementation for User Story 1

- [X] T007 [US1] Add the title block's centering rule to `app/assets/css/main.css`: the block is already placed in the middle `auto` track by T004, so this task only centers it within that track with `justify-self: center` and gives it `min-width: 0` so it can shrink instead of overflowing. The block's center must coincide with the content area's midpoint in both the shared-row and the stacked state (spec FR-001; contracts/home-header-layout.md §2, §3; depends on T003, T004).
- [X] T008 [US1] Add the title's hug-and-center rule to `app/assets/css/main.css`: the `h1` inside `.home__header__title` gets `width: fit-content` and `margin-inline: auto` so its box hugs the rendered text and the text run's midpoint coincides with the block's center line; a centered box holding left-aligned text must not pass. Keep the existing `h1` `font-size: 1.5rem`, `line-height: 1.2`, and `margin: 0 0 0.5rem` and the existing `p` margin `0 0 0.75rem` unchanged, so the header's height and vertical rhythm do not change (spec FR-005, FR-006, FR-015; research.md R-002; depends on T007).

**Checkpoint**: The title is centered at every supported width in both locales; the first Playwright
test passes.

---

## Phase 4: User Story 2 - The tagline stays attached to the title (Priority: P1) 🎯 MVP

**Goal**: The tagline is the element immediately below the title and its own text run's midpoint
coincides with the title's, in both languages, without clipping or truncation.

**Independent Test**: Render the home page in Spanish and English and confirm the tagline is always
the element immediately below the title, that its box hugs its own text, and that the title's and the
tagline's text-run midpoints coincide within 2 px at every tested width.

### Tests for User Story 2

- [X] T009 [P] [US2] Add the tagline test to `e2e/home-header.spec.ts`: assert the tagline is the element immediately following the `h1` inside the title block with no element between them; assert `abs(taglineMidpoint - titleMidpoint) <= 2` px; and assert the tagline text is exactly "Puzzles diarios de anime" in `es` and "Daily anime puzzles" in `en`, neither clipped nor truncated at 320x640. The hug assertion has two forms and the test picks the one that applies: **where the tagline fits on one line** (every tested width at the default text size) the tagline's box width must equal its text run's width within 1 px; **where the tagline wraps onto two lines** (320 px and 360 px at 200% text zoom) the box hugs the *widest* line instead, so assert the box width equals the widest rendered line's width within 1 px and that every rendered line stays centered on the title's center line. This is one Playwright test (spec FR-005, FR-006, FR-010; SC-004, SC-008; contracts/home-header-layout.md §2, §3; data-model.md Entity: Tagline).

### Implementation for User Story 2

- [X] T010 [US2] Add the tagline's hug-and-center rule to `app/assets/css/main.css`: the tagline `p.muted` inside `.home__header__title` gets `width: fit-content` and `margin-inline: auto`, and the title block gets `text-align: center` so the tagline's own text run stays centered on the title's center line when it wraps. Keep the existing `.muted { color: var(--text-muted) }` and the tagline's `margin: 0 0 0.75rem` unchanged; introduce no message key and no new user-facing string (spec FR-005, FR-010, FR-015; research.md R-002, R-008; depends on T008).

**Checkpoint**: The title and the tagline read as one centered block in both languages; the second
Playwright test passes.

---

## Phase 5: User Story 3 - The rest of the header still works (Priority: P2)

**Goal**: The language control stays visible, non-overlapping, flush with the content area's
top-right edge, operable by pointer and keyboard, and moves onto its own row when the content area
narrows below the active locale's stacking threshold (38 em for Spanish, 35 em for English).

**Independent Test**: Load the home page at every tested width in both locales, locate the language
control, and confirm it is fully visible, never intersects the title block, keeps its natural width,
stays flush with the content area's right edge in both row states, and can be operated with a
pointer and with the keyboard.

### Tests for User Story 3

- [X] T011 [US3] Add the control-placement test to `e2e/home-header.spec.ts`: at each of the seven viewports in both locales, assert the control is visible and fully inside the content area, that its right edge is within 1 px of the content area's right edge, that its box does not intersect the title block's box, and that its width equals its natural width with both buttons on one row and neither label wrapped. Below the locale's stacking threshold assert the control's row is below the title block's row and it is still flush right; at or above the threshold assert it shares the title's row. At 600x800 — whose content area is 581.6 px, that is 36.35 em, between the English threshold (35 em) and the Spanish one (38 em) — assert the locale asymmetry explicitly: in English the control shares the title's row and in Spanish it has a row of its own, and in both locales it stays flush right. This is one Playwright test (spec FR-007; SC-005; contracts/home-header-layout.md §4).
- [X] T012 [US3] Add the reading-order and keyboard-operability test to `e2e/home-header.spec.ts`: assert the `h1` is the first heading in reading order and the only `h1` on the page, assert the heading order is unchanged after switching to English, tab to the language control and assert it receives focus with a visible focus indicator (a non-zero outline width), press Enter on the English button and assert the locale changes to `en` while the title stays centered, then hover the control and assert the title's midpoint is unchanged. This is one Playwright test (spec FR-008, FR-009, FR-010; SC-007, SC-008; contracts/home-header-layout.md §7).

### Implementation for User Story 3

- [X] T013 [P] [US3] Add the control's placement rules to `app/assets/css/main.css`. The control wrapper is already placed in the right outer track with `grid-column: 3` and `justify-self: end` by T004, so this task adds the natural-width rule that keeps the switch whole: `width: max-content` sizes the wrapper to the switch's max-content width, so the two buttons keep their natural widths and their labels never wrap or break mid-word, and `max-width: 100%` caps the wrapper at its grid area so the control can never spill outside the content area. Do **not** modify `.lang-switch` to achieve this: the switch is used only by the home page (`LanguageControl` is rendered only by `app/pages/index.vue`), so the reason for leaving that rule alone is its two button labels ("Español" and "English") and the shared switch styling, which the feature reuses exactly as they are — not any other screen, which does not render the switch at all. Add the two container queries `@container (max-width: 35em)` for both locales and `@container (max-width: 38em)` for the Spanish tagline only, selected through the `html[lang="es"]` attribute the app already publishes reactively via `useHead({ htmlAttrs: { lang: locale } })`; inside the stacked state the title block takes the full-width grid area on the first row (`grid-column: 1 / -1`) and the control occupies a row of its own below it (`grid-column: 1 / -1; grid-row: 2; justify-self: end`), so the control's grid area is the whole content area and its buttons keep their natural width there too. Do not add a JavaScript measurement, a resize or locale listener, a new locale state, or a pixel-based media query (spec FR-007, FR-016; SC-005; contracts/home-header-layout.md §4 row placement; research.md R-003, R-004, R-005, R-008; depends on T004, T005).

**Checkpoint**: The control keeps its place, never overlaps, stacks only below the locale's
stacking threshold, and stays fully operable; the third and fourth Playwright tests pass.

---

## Phase 6: User Story 4 - Nothing else on the page changes (Priority: P3)

**Goal**: The reset countdown, the five-game catalog in its order, the per-card states, the loading
message, the retryable failure state, and the development-only reset control all stay exactly as they
are; the header may grow only by what the stacking requires, and only the countdown and the catalog
move down by that amount.

**Independent Test**: Play a game, finish it, return to the home page, and confirm the catalog, its
order, the countdown, and the finished marker are unchanged; force the catalog to fail and confirm
the retryable failure state still appears; then narrow the viewport below the stacking threshold and
confirm the header grew by exactly the control's height plus the header gap and nothing more.

### Tests for User Story 4

- [X] T014 [US4] Add the header-growth and unchanged-page test to `e2e/home-header.spec.ts`: compare the header's height against the pre-change baseline recorded in T002 at 320x640, 360x640, 600x800, 768x1024, and 1920x1080 in both locales. The growth rule applies only where the control shared the title's row before the change: at those widths the header may grow by exactly the control's height plus the header gap (53.18 px at 360 px and 600 px) and by no more, and the countdown badge's top edge must sit at the header's bottom edge; at the widths where the control already had its own row before the change (320 px in both locales, 360 px in Spanish) the header's height must be unchanged. At 1920x1080 assert the header's height equals the title block's height, so the control adds no second row and the existing home no-scroll check still holds. Then assert the catalog still lists exactly five cards in the unchanged order with the unchanged card states, that the countdown still shows and rolls over, that the loading paragraph still appears while the listing loads, and that a forced listing failure still renders the retryable error panel with its retry action. This is one Playwright test (spec FR-011, FR-016; SC-009, SC-013; contracts/home-header-layout.md §5).
- [X] T015 [US4] Add the 200% text-zoom test to `e2e/home-header.spec.ts`: set the root font size to 32 px, then at 320x640, 360x640, 768x1024, and 1920x1080 in both locales assert `document.scrollingElement.scrollWidth === clientWidth` (no horizontal scrollbar) and that no element extends past the viewport's horizontal edges; assert the title's and the tagline's text-run midpoints still coincide with the content area's midpoint within 2 px, and that the control is still fully visible and operable. At 320x640 and 360x640 the tagline wraps onto two lines there, so assert the alternative form of the hug rule (the box hugs the widest rendered line and every line stays centered on the title's center line), and assert the one case where the content area is narrower than the control: at 320x640 the content area is 288 px while the control's natural width is 371.8 px, so the two buttons sit on two rows, each still at its natural width with its label intact, and the control stays fully inside the content area, flush right, and operable. This is one Playwright test (spec FR-006, FR-007, FR-012; SC-005, SC-006; contracts/home-header-layout.md §3, §4, §6).

### Implementation for User Story 4

- [X] T016 [P] [US4] Confirm in `app/pages/index.vue` that the rest of the home page is untouched: `<CountdownBadge />`, the `home.pick_game` `h2`, `<HomeResetControls />`, the `ul.game-list` with its five `GameCard` entries, the loading paragraph, and `<ErrorPanel>` with its retry action keep their current order, props, and behaviour, and no new element, attribute, or wrapper was introduced outside the two header wrappers. Confirm in `app/assets/css/main.css` that no rule outside `.home`, `.home__header`, `.home__header__title`, and `.home__header__control` was modified, so the game screens and the error screen keep their current headers (spec FR-011, FR-013; SC-009; research.md R-009).
- [X] T017 [P] [US4] Confirm the feature's dependency and data surface is unchanged: `git diff --stat` shows edits only in `app/assets/css/main.css` and `app/pages/index.vue` plus the new `e2e/home-header.spec.ts`; `app/i18n/es.ts` and `app/i18n/en.ts` still define `app.title` as "Animatch" with the taglines "Puzzles diarios de anime" and "Daily anime puzzles"; `server/`, `migrations/`, `package.json`, and `package-lock.json` are untouched; and there is no new browser-storage key, network request, or server-side change (spec FR-010, FR-013, FR-014, FR-015; SC-008, SC-011).

**Checkpoint**: Everything except the header's horizontal placement is unchanged; the fifth and sixth
Playwright tests pass.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate the whole feature and confirm the constitution gates.

- [X] T018 Run `npm test` from the repository root; confirm the existing Vitest suite under `tests/` stays green. The feature adds no Vitest test because it adds no logic beyond layout — the implementation is entirely in `app/assets/css/main.css` and `app/pages/index.vue` (plan.md Technical Context; constitution VI).
- [X] T019 Run `npm run test:viewport` from the repository root with `DATABASE_URL` configured; confirm the six tests in `e2e/home-header.spec.ts` pass and that `e2e/home-catalog.spec.ts` and `e2e/viewport-fit.spec.ts` stay green, including the 1920x1080 home no-scroll check and the 320 px no-horizontal-overflow check.
- [X] T020 [P] Walk through `specs/012-center-home-title/quickstart.md` manually in both locales and in light and dark mode: the seven widths, the resize without a reload, the 320 px edge case, the 600 px threshold-band case in both locales, the stacking threshold crossed in both directions, 200% text zoom, the keyboard and screen-reader check, and the "nothing else changed" section. Record and fix every issue before completing.
- [X] T021 [P] Confirm the shared CSS rules in `app/assets/css/main.css` were not modified — specifically `h1`, `h2`, `h3`, `p`, `.muted`, `.page`, `.page-header`, `.game-header`, and `.lang-switch` — so the game screens and the error screen keep their current headers, and so the switch keeps its two button labels ("Español" and "English") and its shared styling exactly as they are. `.lang-switch` is used only by the home page, so the rule that keeps the switch whole is the `width: max-content` on the new `.home__header__control` wrapper added in T013, not an edit to `.lang-switch` itself (spec FR-015; contracts/home-header-layout.md §3, §8).
- [X] T022 [P] Confirm the constitution gates and the scope boundary: no runtime or development dependency and no lockfile change; the feature's test count is 6 (≤ 15); no external font, script, or hotlinked image was added; no test asserts stylesheet source text, CSS class strings, or markup snapshots; no new user-facing string or message key was introduced; no database write, DDL, migration, or catalog query was added; and `git diff --stat` shows the change is limited to `app/assets/css/main.css`, `app/pages/index.vue`, and `e2e/home-header.spec.ts` (constitution I–VI; spec FR-013, FR-014, FR-015).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; T001 and T002 are parallel.
- **Foundational (Phase 2)**: Depends on Setup; T003 → T004 → T005. Blocks every user story.
- **US1 (Phase 3)**: Depends on Foundational; T006 (test) first, then T007, then T008.
- **US2 (Phase 4)**: Depends on US1; T009 (test) first, then T010.
- **US3 (Phase 5)**: Depends on US2; T011 and T012 (tests) first, then T013.
- **US4 (Phase 6)**: Depends on US3; T014 and T015 (tests) first, then T016 and T017.
- **Polish (Phase 7)**: Depends on all stories; T018 and T019 run after implementation, T020–T022 can
  run together after T019.

### User Story Dependencies

- **US1 (P1)**: No story dependency after Foundational; delivers the centered title.
- **US2 (P1)**: Depends on US1 for the title block's structure; adds the tagline on the same center
  line.
- **US3 (P2)**: Depends on US2 for the finished title block's width; adds the control's natural width
  and the stacking rule. The control's *track placement* is not part of this story: it lands with
  the grid in the Foundational phase, so the control is never auto-placed into the left outer
  track.
- **US4 (P3)**: Depends on US3 for the stacked state; verifies that nothing else changed.

`app/assets/css/main.css` and `e2e/home-header.spec.ts` are single-writer surfaces: never run two
tasks that edit the same file concurrently.

### Within Each User Story

- Write the story's test first and confirm it fails for the intended reason, then implement.
- Implement the markup wrappers before the grid rules; the grid and both track placements together
  before the title's centering rules; the control's track placement and its natural width before
  its stacking thresholds.
- Run the story's focused test before moving to the next priority.
- Stop at each checkpoint to validate the story independently.

---

## Parallel Example: Setup

```bash
# T001 and T002 touch different resources:
Task: "Create the measurement harness in e2e/home-header.spec.ts"
Task: "Record the pre-change baseline from npm test and npm run test:viewport"
```

## Parallel Example: User Story 1

```bash
# The test file and the stylesheet are separate surfaces:
Task: "Add the centering test to e2e/home-header.spec.ts"
Task: "Add the .home__header__title and h1 rules to app/assets/css/main.css"
```

## Parallel Example: User Story 3

```bash
# The control's CSS is independent of the two test files' content:
Task: "Add the control-placement test to e2e/home-header.spec.ts"
Task: "Add the reading-order and keyboard test to e2e/home-header.spec.ts"
Task: "Add the control's natural-width and container-query rules to app/assets/css/main.css"
```

## Parallel Example: Polish

```bash
Task: "Walk through quickstart.md manually"
Task: "Confirm the shared CSS rules were not modified"
Task: "Confirm the constitution gates and the scope boundary"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1 (harness, baseline) and Phase 2 (wrappers, grid with both track placements,
   container context).
2. Complete Phase 3 (US1): the title is centered at every supported width.
3. Complete Phase 4 (US2): the tagline rides on the title's center line.
4. **STOP and VALIDATE**: run `npm test`, `npm run test:viewport`, and the quickstart's centering and
   tagline sections.
5. This is the requested MVP: a centered "Animatch" title with its tagline, in both languages. Deploy
   or demo if ready.

### Incremental Delivery

1. Foundational → the header has a grid with both children placed in their tracks, and a container
   context.
2. US1 → the centered title (MVP half).
3. US2 → the tagline on the same center line (MVP).
4. US3 → the language control keeps its natural width and stacks only below the locale's stacking
   threshold.
5. US4 → the page's vertical layout and everything else are unchanged.
6. Polish → full suite and manual verification.

Each step leaves the page usable; the control's natural width and its stacking rule are not touched
until the title it must not overlap is already centered.

### Parallel Team Strategy

With more than one developer, only the genuinely separate files are parallel (the test file and the
stylesheet within a phase). The stylesheet and the Playwright file are single-writer surfaces by
design. Split work by file ownership rather than by story to avoid merge conflicts.

---

## Notes

- `[P]` tasks touch different files and have no incomplete dependency.
- The feature test count is 6 (all Playwright in `e2e/home-header.spec.ts`), below the 15-test cap.
- The tested viewport matrix is 320x640, 360x640, 600x800, 768x1024, 1024x768, 1440x900, and
  1920x1080. 600x800 is the viewport inside the threshold band: its content area is 581.6 px
  (36.35 em), which is above the English threshold (35 em) and below the Spanish one (38 em), so the
  locale asymmetry is exercised at both thresholds.
- Tests measure the rendered text run with a `Range`, the `.home` content box, and the control's
  bounding box; they never read stylesheet source text, CSS class strings, or markup snapshots.
- The alignment tolerance is 2 px, applied to `abs(titleMidpoint - contentAreaMidpoint)` and
  `abs(taglineMidpoint - titleMidpoint)`.
- The stacking thresholds are 38 em for `es` and 35 em for `en`, expressed in the content area's own
  font-size units so they scale with 200% text zoom.
- The header's growth is measured against the pre-change baseline recorded in T002, and the growth
  rule applies only where the control shared the title's row before the change.
- Spelling is "center", "centered", "centering" everywhere — the spec, this plan, and the contract
  use one convention.
- Do not add a dependency, external font, hotlinked image, message key, database change, migration,
  API route, browser-storage key, JavaScript measurement, or resize/locale listener.
- Commit after each task or logical group, and stop at each checkpoint for independent validation.
