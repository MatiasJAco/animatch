# Feature Specification: Board-First Game Page Layout

**Feature Branch**: `007-board-first-layout`

**Created**: 2026-10-08

**Status**: Draft

**Input**: User description: "Game page layout consistency. Reference: futbol11 bingo — play area first; how-to-play text below it. Every game must share the same visual hierarchy. The board is the focus. Explanatory copy is secondary and may sit below the fold. A vertical scroll is acceptable. (1) Move the status bar and instructional copy below the primary action buttons, not above the board. Groups: mistakes bar, 'Find groups of four that share a common criterion.', and 'Select four tiles' go below Clear selection and Propose group. More or Less: round bar, 'Compare career voice roles: does the left have more or fewer than the right?', and 'Does the left actor have more or fewer roles than the right?' go below the More and Fewer buttons. Match the Series: mistakes bar and 'Which current-season series does the clue's character or voice actor belong to?' go below the grid. (2) The freed space above the fold must enlarge grids, images, and tiles; focus stays centered on the game; the explanation is visible only after scrolling down. (3) On More or Less and Match the Series, Home and Reset sit on the same row/height as the title, matching Groups."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The board is the first thing a player sees (Priority: P1)

A player opens any of the three games. Directly under the page header they see the play area — the tile grid for Groups, the clue plus grid for Match the Series, or the comparison for More or Less — with nothing above it but the title and its controls. The mistake/round status and every instructional sentence sit below the primary controls, so the first screen is the game itself. When the player scrolls down (a page scroll is acceptable), the status and the how-to-play copy are there.

**Why this priority**: This is the core of the feature. Today the status bar and instructions push the board down on every screen, so the player's first view is chrome and prose instead of the game. Moving that copy below makes the play area the focus and gives it room to grow.

**Independent Test**: Open each of the three game screens at a supported size and confirm that the first content region under the header is the board, and that the status/instructional copy now renders after the primary controls (after the Clear/Propose buttons for Groups, the More/Fewer buttons for More or Less, and after the grid for Match the Series).

**Acceptance Scenarios**:

1. **Given** the Groups screen is open, **When** the page loads, **Then** the first content region below the header is the 4x4 board, and the mistakes bar, the "Find groups of four that share a common criterion." help line and the "Select four tiles" line appear after the Clear selection and Propose group buttons.
2. **Given** the More or Less screen is open, **When** the page loads, **Then** the first content region below the header is the comparison, and the round bar, the page help line and the in-board question line appear after the More and Fewer buttons.
3. **Given** the Match the Series screen is open, **When** the page loads, **Then** the first content region below the header is the clue and the 3x3 grid, and the mistakes bar and the page help line appear after the grid.
4. **Given** any of the three games at a supported size, **When** the player makes their first move without scrolling, **Then** the board and its primary controls are fully visible and usable.
5. **Given** an attempt fails while a game is in play, **When** the failure is shown, **Then** the error panel and its retry action (when the failure is retryable) are visible inside the viewport without scrolling and are not placed in the below-the-fold status/how-to-play copy.

---

### User Story 2 - Freed space makes the game bigger (Priority: P2)

Because the status and instructions moved below the actions, the board takes back the vertical space they used: grids, images and tiles render larger and the game stays centered, so the focus is on the board rather than on blank space.

**Why this priority**: The value of moving the copy is not empty whitespace — it is a larger, more legible board. Without this, the change only reorders text.

**Independent Test**: At a fixed viewport, compare the board's rendered size (grid bounding box and tile/image size) before and after the change; the board consumes the reclaimed space and is larger, while remaining horizontally centered and unclipped.

**Acceptance Scenarios**:

1. **Given** a fixed supported viewport, **When** the Groups screen is open, **Then** the 4x4 board is larger than before the change, using the space the mistakes bar and the two copy lines previously occupied.
2. **Given** a fixed supported viewport, **When** the More or Less screen is open, **Then** the comparison and its images are larger than before the change.
3. **Given** a fixed supported viewport, **When** the Match the Series screen is open, **Then** the clue and 3x3 grid are larger than before the change.
4. **Given** any of the three games, **When** the board grows, **Then** it stays horizontally centered and nothing is clipped at the viewport edges.

---

### User Story 3 - Headers align consistently (Priority: P3)

On Groups, More or Less and Match the Series, the Home and Reset controls sit on the same row and at the same vertical position as the game title, so the three screens share one header pattern.

**Why this priority**: Inconsistent headers make the three games feel like different products. Groups already aligns the controls with the title; the other two must match.

**Independent Test**: Open each game at each supported width; confirm the title and the Home/Reset controls share a single row with aligned vertical centers, and that the controls do not drop to a separate row while the title fits.

**Acceptance Scenarios**:

1. **Given** the Match the Series screen at any supported width, **When** the page loads, **Then** the Home and Reset controls sit on the same row and height as the title.
2. **Given** the More or Less screen at any supported width, **When** the page loads, **Then** the Home and Reset controls sit on the same row and height as the title.
3. **Given** the Groups screen, **When** the page loads, **Then** its header remains aligned as before (the reference for the other two).
4. **Given** a width too narrow for the title and controls together, **When** the header wraps, **Then** it wraps consistently across all three games and the title stays legible.

---

### Edge Cases

- **Short viewport**: moving copy below the actions can push the instructions below the fold. Scrolling to them is acceptable, but the board and its primary controls must remain reachable without scrolling.
- **Long localized copy**: the moved Spanish strings are longer than the English ones and must wrap below the actions without causing horizontal overflow.
- **Attempt-error state**: the error panel and its retry must stay visible and reachable; a failure must not be hidden under the board or buried so the player cannot act.
- **Finished state**: the result summary and any loss explanation/ reveal sit below the board and actions; scrolling down to read them is acceptable.
- **Transient feedback**: in-progress messages (for example "Group found", "That is not the series", "Correct!") must still be perceivable with the board on top.
- **Narrow widths**: header controls may wrap when the title and controls cannot share a row; when they wrap, the behavior is the same across all three games.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On each of the three game screens, the primary play area (the board) MUST be the first content region after the page header; no status bar or instructional copy may appear above it.
- **FR-002**: The Groups mistakes bar, the "Find groups of four that share a common criterion." help line and the "Select four tiles" line MUST render below the Clear selection and Propose group buttons.
- **FR-003**: The More or Less round bar, the page help line and the in-board question line MUST render below the More and Fewer buttons.
- **FR-004**: The Match the Series mistakes bar and its page help line MUST render below the 3x3 grid.
- **FR-005**: The vertical space freed above the board MUST be given to the board — grids, images and tiles enlarge — rather than left as blank space; the board MUST stay horizontally centered.
- **FR-006**: On every game screen the page header MUST present the title and the Home/Reset controls on the same row with aligned vertical position.
- **FR-007**: Vertical page scrolling is permitted on the game screens; horizontal page scrolling MUST NOT occur at supported widths.
- **FR-008**: The change MUST NOT remove, add to, or reword user-facing copy, and MUST NOT change gameplay, scoring, stored data, or the set of controls; moved copy keeps its exact meaning in both supported languages.
- **FR-009**: Every failure path MUST remain visible and actionable **without scrolling**: on a failed attempt the error panel and its retry action (when the failure is retryable) MUST render inside the viewport, and MUST NOT be placed in the below-the-fold status/how-to-play copy or hidden by the board.
- **FR-010**: The board and its primary controls MUST be fully usable without scrolling the page at the supported sizes.

### Key Entities

No new data entities. This feature concerns presentation (ordering and sizing of existing content) only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On 100% of the three game screens at every supported size, the first content region under the header is the board, with zero status or instructional blocks above it.
- **SC-002**: At every supported size, each game's play area renders strictly taller than the status-and-instruction block it displaced (so the reclaimed height visibly enlarges the board rather than leaving blank space), stays horizontally centered within 2px of the page center, and is not clipped at the viewport edges.
- **SC-003**: On 100% of the game screens at supported widths, the title and the Home/Reset controls share one row with aligned vertical centers.
- **SC-004**: Zero horizontal overflow occurs at supported widths; vertical scrolling reaches every moved string when content exceeds the viewport.
- **SC-005**: 100% of the existing user-facing strings remain present in both Spanish and English (moved, not removed), with no missing or mixed-language text.
- **SC-006**: At every supported size, a player can see and activate the board's primary controls with zero page scrolls.

## Assumptions

- Vertical page scrolling is now acceptable on the game screens. This intentionally relaxes the "no document scroll" rule that feature 006 enforced for these screens; horizontal no-scroll is retained.
- Supported viewport widths remain at or above 768px (as established by feature 006). Mobile phone layouts below that width are out of scope.
- "Primary action buttons" means the Clear selection and Propose group buttons for Groups and the More and Fewer buttons for More or Less; Match the Series has no submit button, so its status bar and help line move below the grid.
- The intended enlargement is "use the space that was freed" (fill available width/height within the supported sizes); no specific pixel or percentage target is required.
- The home screen and the error page are out of scope; this feature concerns the three game play screens.
- "Centered" means horizontally centered within the page's content column; the board is not required to be vertically centered in the viewport.
- On a failed attempt, the error panel stays with the play area and is visible without scrolling, regardless of which region renders it; only the persistent status/how-to-play copy moves below the fold.
- Presentation-only change: no data model, API, storage, dependency, or copy-meaning change.
