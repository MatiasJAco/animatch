# Feature Specification: Groups Board Rows-Driven Layout

**Feature Branch**: `[003-groups-board-layout]`

**Created**: 2026-10-06

**Status**: Draft

**Input**: User description: "In game Groups: When the player completes a valid group, those tiles must stay on the board. They must not disappear. Arrange that group as one horizontal row with a green background, and show the group's characteristic to the left of the row. When the player loses, rearrange every tile into its correct groups, one row per group, in the same layout as a found group, but with a red background and the group's characteristic shown to the left of each row. Already-found groups should remain visible and keep their green styling. The loss layout is a reveal of the remaining groups, not a reset of found ones."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Found groups stay on the board as green rows (Priority: P1)

After the player submits a correct group of four, the four tiles do not leave the board. They are
lifted out of the selection area and arranged into a single horizontal row with a green
background, and the group's characteristic is shown at the left end of that row. The row is
permanent for the rest of the play session and the tiles in it can no longer be selected.

**Why this priority**: This is the heart of the request — a satisfying, readable record of what
has been solved. Without it the game's progress feedback has nothing to anchor on.

**Independent Test**: Submit one correct group and confirm the board immediately shows a single
green row containing exactly those four tiles with the characteristic label on the left; the
tiles are gone from the selection area and cannot be selected again.

**Acceptance Scenarios**:

1. **Given** a board in play with no found groups, **When** the player submits four tiles that
   form a correct group, **Then** the board shows one horizontal row with a green background
   containing exactly the four submitted tiles and the group's characteristic label at the left
   end, and none of those tiles appear in the selection area.
2. **Given** a board with one green found row, **When** the player submits a second correct
   group, **Then** the board shows two green rows, one per found group, each with its own
   characteristic label, and the later-found group's tiles cannot be selected either.
3. **Given** a found green row, **When** the player tries to select one of its tiles along with
   other tiles, **Then** the selection is not accepted for those tiles; found-row tiles are never
   part of a new proposal.

---

### User Story 2 - Loss reveals every uncovered group as red rows, keeping found rows green (Priority: P1)

When the player reaches the mistake limit, every tile on the board is rearranged into its correct
group, one horizontal row per group, using the same row layout as a found group. Each row shows
its characteristic at the left and uses a red background, except that rows for groups already
found earlier keep their green background and are left exactly where the player left them. This
is a reveal of the day's full solution layout, never a reset of the found groups.

**Why this priority**: Without the loss reveal the player has no way to learn the correct groups
after a loss, and the request spells out that found groups must survive the reveal.

**Independent Test**: Lose a game with at least one group already found and confirm the board
shows one row per group with each uncovered row red and the already-found rows still green and
still showing their characteristics.

**Acceptance Scenarios**:

1. **Given** a board with one or more found green rows, **When** the player makes the losing
   mistake, **Then** the board shows one row per group for all four groups, the newly uncovered
   rows use red backgrounds with their characteristic labels on the left, and the previously
   found rows remain visible with their green backgrounds and labels.
2. **Given** a board with no found groups, **When** the player makes the losing mistake, **Then**
   the board shows four red rows, one per group, each with its characteristic label on the left.
3. **Given** a loss reveal showing four rows, **When** the player looks at the board, **Then**
   every tile appears in exactly one row, no tile appears in two rows, and no tile is missing.

---

### User Story 3 - Found rows persist across a reload (Priority: P2)

If the player reloads the page mid-game, the groups already found are shown in the same green
rows as before the reload, and the selection area still holds only the remaining tiles.

**Why this priority**: The game already keeps today's progress on the device; the new layout must
not regress that. A reloaded board that forgets found rows would look broken.

**Independent Test**: Find one group, reload the page, and confirm the green row is still there
with the same tiles and characteristic label.

**Acceptance Scenarios**:

1. **Given** a board with one found green row, **When** the player reloads the page, **Then** the
   board restores the found group as the same green row with the same tiles and characteristic.
2. **Given** a restored board after reload, **When** the player selects from the remaining tiles,
   **Then** selection and submission behave exactly as in a session that never reloaded.

---

### Edge Cases

- Loss on the very first mistake: no green rows exist, the reveal shows four red rows.
- Win: the final correct group completes the last green row; there is no red reveal.
- The board at the moment of loss has both found rows and uncovered rows — found rows must not
  move, be restyled, or lose their label.
- A tile belongs to exactly one row in both the in-play layout and the reveal.
- Found-row tiles are inert: selecting, submitting, or retrying can never include them.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When the player submits a correct group, the board MUST keep those tiles visible
  and arrange them into one horizontal row per group, showing the group's characteristic label at
  the left end of the row.
- **FR-002**: Found rows MUST use a visually distinct, green styling that is recognizably
  different from the selection area and from uncovered rows.
- **FR-003**: Tiles inside a found row MUST NOT be selectable or included in any later proposal.
- **FR-004**: When the player loses, the board MUST lay out every tile in its correct group as
  one horizontal row per group, labelled with its characteristic, and in the same row layout
  already used for found groups.
- **FR-005**: Uncovered rows in the loss reveal MUST use a visually distinct red styling.
- **FR-006**: The loss reveal MUST preserve previously found rows exactly: same tiles, same green
  styling, same characteristic label, and same position/order relative to play; the reveal is a
  disclosure of remaining groups, not a reset of found ones.
- **FR-007**: The board MUST retain found rows across a reload so a resumed session shows the
  same green rows it had before.
- **FR-008**: The Board MUST render the same layout and labels in both supported languages, with
  the colored row signal never being the only identification of a found or revealed group.

### Key Entities *(include if feature involves data)*

- **Group row**: The four tiles that share a characteristic plus the characteristic label itself;
  rendered as one horizontal row. A row is either found (green) or revealed (red).
- **Tile**: A single playable entity that belongs to exactly one group row; once placed in a
  found row it is no longer selectable.
- **Board**: The stateful surface — in play it shows the selectable tiles and every found row;
  on a loss it shows every group row and no interactive tiles.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Within one second of a correct submission, the four tiles appear in a single green
  row with the characteristic label, and they never reappear in the selection area for the rest
  of the session.
- **SC-002**: A loss always ends with the board showing exactly one row per group (four rows
  total, one per group), with every tile present exactly once and the characteristics shown on
  every row.
- **SC-003**: In a session that finds at least one group before losing, 100% of the found rows in
  the loss view keep their green styling, and 100% of the remaining rows use the red styling.
- **SC-004**: After a reload mid-game, every found row is restored identically (same tiles, label,
  and order) with no player action beyond opening the page.
- **SC-005**: In both supported languages, the identity of a found or revealed group is
  communicated by text in addition to color, so color alone never carries the information.
- **SC-006**: Automated verification for this feature stays within the project's capped test
  count, measuring rendered grouping and labels rather than source or style text.

## Assumptions

- Group ordering: found rows appear in the order they were discovered during play; uncovered rows
  appear in the order the game discloses the solution after a loss. No explicit ordering is
  imposed by the feature description.
- One horizontal row per group is the intended layout on a typical desktop width; on narrower
  screens a row may wrap or scroll while keeping the characteristic label anchored at the left
  and the row's group identity intact.
- The group characteristic shown for each row is the existing characteristic label already used
  for found groups (bilingual, from the game's message catalog).
- The game already stores found groups and the full solution disclosure on the device, so this
  feature changes presentation only and needs no new data or server behavior.
- The in-play board continues to show the remaining tiles in the existing selection area; the
  change is how solved groups are displayed, not the selection mechanics.

## Manual vs Automated Verification Note

The failure to render is observable behavior, so automated checks may assert the rendered outcome
(which tiles and labels appear together as a group, their grouping, their disabled state, and
their bilingual labels) but MUST NOT assert against stylesheet text, CSS class strings, or markup
snapshots, per project governance.