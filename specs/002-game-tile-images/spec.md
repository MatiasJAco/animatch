# Feature Specification: Game Tile Images

**Feature Branch**: `002-game-tile-images`

**Created**: 2026-10-06

**Status**: Draft

**Input**: User description: "The games tiles must show images from the voice actors, characters and anime series referenced so the player can have an easier time playing and improving the visualization."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entity images on puzzle tiles (Priority: P1)

While playing any of the daily games, each tile (and each clue card) displays an image of the
entity it represents: the anime series, the character, or the voice actor referenced by that
tile. The image sits next to the existing name text, helping the player recognize entities at a
glance instead of reading every label.

**Why this priority**: This is the core of the request. Visual recognition is the stated reason
for the feature; without it there is nothing to deliver.

**Independent Test**: Open a day's puzzle in each of the three games and confirm every tile whose
entity has an available image shows that entity's image alongside its name.

**Acceptance Scenarios**:

1. **Given** a day's Match the Series board, **When** the board renders, **Then** each series
   tile shows an image of that series and the clue card shows an image of the clue's entity.
2. **Given** a day's Groups board, **When** the board renders, **Then** each of the 16 tiles
   shows an image of the character, person, or series that tile represents.
3. **Given** a day's More or Less comparison, **When** the two sides render, **Then** each side
   shows an image of the entity being compared next to its name.

---

### User Story 2 - Graceful fallback when an image is unavailable (Priority: P2)

If an entity has no image available, or an image fails to load, the tile still renders with its
existing placeholder and name text. The game stays fully playable and never shows a broken-image
icon or an empty box.

**Why this priority**: Catalog image coverage is uneven and image hosts can fail; without a
fallback the feature would break the "Fail Visible, Never Blank" promise and make games
unplayable.

**Independent Test**: Force an image to be unavailable (missing data or failed request) and
confirm the tile shows its placeholder and name, and the game can be completed.

**Acceptance Scenarios**:

1. **Given** a tile whose entity has no image available, **When** the board renders, **Then**
   the tile shows the existing striped placeholder and the entity name, with no broken-image
   indicator.
2. **Given** an image request that fails or times out, **When** the tile settles, **Then** the
   placeholder and name remain visible and the tile stays interactive.
3. **Given** images are entirely unavailable (blocked host, offline images), **When** the player
   plays a full game, **Then** the game is completable exactly as it was before images existed.

---

### User Story 3 - Same images for every player of the same day (Priority: P3)

Every visitor playing the same UTC day's puzzle sees the same images for the same tiles, so the
shared daily puzzle stays comparable between players and images never hint differently to
different people.

**Why this priority**: Preserves the shared, deterministic nature of the daily game; important
for fairness but the feature is still usable while this is verified.

**Independent Test**: Load the same day's puzzle from two different browsers/locations and
compare the image shown for each tile.

**Acceptance Scenarios**:

1. **Given** two players on the same UTC day, **When** both open the same game, **Then** each
   tile shows the same image for both players.
2. **Given** a puzzle stored for a date, **When** it is served again, **Then** the set of images
   shown for its tiles is unchanged.

---

### Edge Cases

- An entity referenced by a tile has no image at all in the available data → placeholder shown
  (covered by US2).
- An image address points to a missing, slow, or unreachable resource → placeholder shown,
  tile remains usable.
- The same entity appears in multiple games or tiles on the same day → the same image is shown
  everywhere it appears.
- An image is visually similar for two different entities (e.g., shared artwork) → names remain
  visible so the player can always distinguish tiles.
- A past day's puzzle is re-served → images shown are consistent with that stored puzzle.
- A player has a slow connection → tiles and game controls become usable without waiting for
  images; images enhance the view progressively.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every puzzle tile and clue card MUST display an image representing the entity it
  shows (anime series, character, or voice actor) whenever an image for that entity is
  available.
- **FR-002**: The image shown on a tile MUST correspond to the entity named on that tile; the
  system MUST NOT show a generic or mismatched image.
- **FR-003**: When no image is available for an entity, or an image fails to load, the tile MUST
  render its existing placeholder plus the entity name, and MUST NOT display a broken-image
  indicator or an empty region.
- **FR-004**: Images MUST be an enhancement only: every game MUST remain fully playable and
  completable when no images load at all.
- **FR-005**: Images MUST NOT alter puzzle content, puzzle identity, or any answer. The puzzle
  served for a UTC day MUST be identical regardless of whether images are shown.
- **FR-006**: Images MUST NOT disclose information about an entity beyond the entity already
  referenced and named on the tile.
- **FR-007**: All players of the same UTC day MUST see the same image for the same tile; images
  MUST NOT be personalized per visitor.
- **FR-008**: Entity name text MUST remain visible alongside images in all games; images MUST
  NOT replace labels.
- **FR-009**: Any user-facing text introduced by this feature (alt text, captions, error copy)
  MUST exist in both Spanish and English through the message catalog.
- **FR-010**: An image that loads slowly MUST NOT delay the player's ability to see and interact
  with tiles.
- **FR-011**: The feature applies to all three games: More or Less (both compared sides), Match
  the Series (nine series tiles and the clue card), and Groups (all 16 tiles).

### Key Entities *(include if feature involves data)*

- **Entity Image Reference**: The link between a referenced entity (anime series, character, or
  voice actor) and the artwork that represents it. Key attributes: entity identity, image
  availability, absence is valid and yields the placeholder.
- **Tile**: A single playable item on a game board (or the clue card). Key attributes: the
  entity it represents, its name text, and its optional image.
- **Daily Puzzle**: The stored, immutable set of tiles for a game and UTC day. Images attach to
  its tiles as presentation only; the puzzle's content and answers are unchanged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In each of the three games, at least 95% of tiles whose entities have an image
  available in the catalog display that image on first render.
- **SC-002**: Across a full play session of all three games, zero tiles ever display a
  broken-image icon or a blank image region.
- **SC-003**: With images completely unavailable, 100% of players can still start and complete
  every game.
- **SC-004**: Two players on the same UTC day see identical images on identical tiles in 100%
  of cases.
- **SC-005**: Players can see and interact with all tiles within 2 seconds on a typical
  connection, regardless of image loading speed.
- **SC-006**: Surveyed players report the boards are easier to read: at least 70% say images
  make recognizing entities easier compared to text-only tiles.

## Assumptions

- Images are drawn from the image references already carried by the read-only catalog for
  anime, characters, and people; this feature does not build a new image sourcing, scraping,
  or creation pipeline.
- The catalog does not guarantee image coverage for every entity, so placeholders remain a
  permanent, supported state (FR-003), not an error to be fixed.
- Scope covers tiles and clue cards inside the three games. Cards on the home/game-listing page
  are out of scope unless a later feature requests them.
- Entity name labels stay visible next to images; images are an aid, not a replacement (FR-008).
- This feature is authorized by Constitution v3.0.0, which removed the originality/licensing
  constraint on visual assets. Prior restrictions in `specs/001-daily-anime-puzzles` that
  forbid external images (FR-055, SC-014, FR-029's "no external artwork" stance) are superseded
  by this specification and must be reconciled during planning.
- No accounts or personalization exist in v1, so "same images for everyone" requires no user
  preferences (FR-007).
