# Specification Quality Checklist: Responsive Viewport Fit

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-08
**Feature**: [spec.md](spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Validation run 2026-10-08: all items pass on first iteration.
- Scope boundaries recorded in Assumptions: supported sizes ≥768px width and ≥768px height; below-768px behavior must not regress but is not a target; no new dependencies; tests assert rendering behavior only and stay within the 15-test cap (constitution Principle VI).
- Constitution gates applicable to this feature: bilingual strings wrap correctly in both locales (FR-006), error/loading states remain visible and un-scrolled (FR-008, Principle V), no gameplay/data/copy changes (FR-007).

## Implementation verification (2026-10-08)

- Automated viewport gate (`npm run test:viewport`, Playwright 1.59.0): **6 tests pass** — document
  scroll predicates at 1920x1080 / 1440x900 / 1280x800 / 1024x768 across home, Match, Groups and
  More-Or-Less in loading, playing, attempt-error, finished-session and finished-reloaded states;
  primary-region bounding boxes; the 60px resize sweep 1920→1024 and back; and both locales.
- Existing suite green: `npm test` → 14 files, 48 tests passing.
- Horizontal check to the 768px floor: no element extends past the viewport on any primary screen.
- **SC-001**: pass — zero document scrollbars, all screens × states × 4 viewports.
- **SC-002**: pass — 0 failures across the resize sweep in both directions.
- **SC-003**: pass — every P1 region's bounding box lies inside the viewport.
- **SC-004**: pass — every state fitted at 1024x768 with the locked shell; nothing unreachable.
- **SC-005**: pass — both locales, no horizontal overflow, no truncated strings.
- Constitution VI review: 6 feature tests ≤ 15 cap; `@playwright/test` (pinned 1.59.0, see
  quickstart) is the only added dependency and is dev-only; assertions use rendered metrics only
  (no stylesheet text, class strings, or markup snapshots); no essay comments. Constitution V:
  ErrorPanel/loading states verified visible and un-clipped in both locales. Bilingual UI: no
  strings changed; both locales exercised end to end. Inner-scroll exceptions for Match's
  `.reveal-list` and Groups' `.group-rows` are recorded with measurements in `quickstart.md`.

### Design-feedback revision (2026-10-08, owner review)

- **No cropping**: `object-fit` is now `contain`; art keeps its 3:4 ratio and scales down rather
  than being squashed. (Previously `cover` cropped badly when rows compressed.)
- **Match**: the Next control sits beside the clue card, and the redundant "Current-season series"
  heading is removed so the grid gets the height; the finished grid yields to the reveal list.
- **More-or-Less**: the board fills its spare height, so the comparison images are large and
  uncropped; the answer buttons are now styled like the rest of the app.
- **Finished lists**: the Match reveal list uses auto-fit columns (3 at 1024px) so it is readable
  without excessive scrolling; Groups rows show real artwork.
- Re-verified after the revision: `npm run test:viewport` 6/6 and `npm test` 48/48 pass; the
  measured table and inner-scroll exceptions in `quickstart.md` are updated to the new numbers.
  No data, API, i18n-key, or gameplay change; the removed heading's message keys stay in both
  catalogs, so bilingual completeness is unaffected.

### Second design-feedback revision (2026-10-08, owner review)

Owner feedback: "in every game the 'You lost' card is wasted space … showing the results is
enough"; "in Groups a scroll appears when a group is discovered — it should occupy the same space as
the tiles"; "in More or Less some images are taller than others — all images should have the same
height".

- **Result card removed.** `ResultPanel.vue` no longer renders a `.card` with a `You lost`/`You won`
  heading — that heading duplicated the board's own reveal. The attempts line, the optional slot
  (More-or-Less loss explanation) and the Share/Copy controls now render inline in a new
  `.result-summary` block, for both wins and losses; in `groups.vue` the summary renders below the
  board. No copy or share behavior changed.
- **Groups rows live inside the board grid.** `GroupsBoard.vue` renders found/revealed rows inside
  the single `.grid-4x4` grid (`grid-column: 1 / -1`) instead of a separate `.group-rows` region, so
  a discovered group occupies exactly the space its four tiles did and the remaining tiles reflow
  below (the Connections/futbol11 pattern). The `.group-rows` inner-scroll exception is withdrawn:
  the board never scrolls.
- **More or Less compared images share one height.** In the live board the count-less side gets a
  hidden badge twin so both images receive identical flex space; in the loss explanation the
  compared side is wrapped in the same padded frame as the red-framed failed side.

Re-verified after the revision at 1024x768 with the gate: `document.scrollingElement` reports
`768×768` and `1024×1024` (no document scroll) in every state. Groups loss grid 297px (was a
621→370px `.group-rows` scroller); More-or-Less live images `[392, 392]` and loss images
`[230, 230]`. `npm test` 48/48 and `npm run test:viewport` 6/6 pass (the suite's Groups
finished-state selector moved from `.group-rows` to the board grid). No data, API, i18n-key,
dependency, or gameplay change; Constitution VI: no new tests were added — the revision is covered
by the existing viewport gate.
