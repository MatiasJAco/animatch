# Feature Specification: Replace the "same language" Groups Criterion

**Feature Branch**: `005-replace-same-language-group`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "In Groups, the criterion group 'same_language' is too difficult and doesnt make sense."

**Problem**: The Groups game's "same voice language" group takes four characters from a single
anime who share one voice language. Because every tile in that group comes from one anime, players
can only solve it as a second "same anime" group; the language fact itself is never shown on a tile
and is virtually identical across the available catalog. The group is therefore confusing ("doesn't
make sense") and unsolvable by the criterion it is labelled with ("too difficult").

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every Groups board stays four groups of four, with the language group gone (Priority: P1)

When a player opens a Groups puzzle, the board still holds sixteen tiles that resolve into four
groups of four, but none of the four groups is described as "the same voice language". Each of the
four group labels describes a fact that a player could actually have observed from the tiles and
from the anime knowledge the game already relies on.

**Why this priority**: This is the core of the request. The language group is both wrongly labelled
and unsolvable, so removing it from the board is the whole point of the change.

**Independent Test**: Solve (or lose, or inspect the daily solution of) Groups boards across several
days and confirm the board always shows exactly four groups of four, exactly one of the three
existing criteria plus the replacement, and never a group labelled as the shared voice language.

**Acceptance Scenarios**:

1. **Given** any Groups board for any UTC day, **When** the player resolves or reveals all four
   groups, **Then** exactly four groups of four tiles are disclosed and none of the four group
   labels refers to a shared voice language.
2. **Given** a board after the change, **When** the player views the revealed solution, **Then** the
   three existing criteria ("the same anime", "the same season", "the same voice actor") still appear
   and the fourth group uses the new criterion.
3. **Given** a completed board, **When** the player reviews the groups, **Then** the new group's
   label is present in both Spanish and English and matches the fact the group actually shares.

---

### User Story 2 - The replacement group can be told apart from the "same anime" group (Priority: P1)

When a player studies the replacement group, it is not just another version of the "same anime"
group: its four tiles do not all come from one anime. The player can reason about the shared fact
using the same kind of general anime knowledge that already makes the "same anime" and "same voice
actor" groups solvable.

**Why this priority**: The confusion today comes from the language group silently being a "one anime"
group. If the replacement is not visually and conceptually distinct, the complaint is not fixed.

**Independent Test**: Reveal the replacement group on any board and confirm its four tiles come from
more than one anime, and that its label names a shared fact rather than pointing back to one show.

**Acceptance Scenarios**:

1. **Given** a board that reveals the replacement group, **When** the player inspects the four
   tiles, **Then** the tiles belong to more than one anime, so the group cannot be explained solely
   as a single shared anime.
2. **Given** the replacement group's label, **When** the player reads it, **Then** it describes a
   fact that can be told from the tile names and everyday anime knowledge, not a fact that is
   invisible on tiles and uniform across the catalog.

---

### User Story 3 - Daily availability is not harmed by the swap (Priority: P2)

Replacing the language group does not start leaving days without a Groups puzzle. On any day, the
board either exists as four valid groups exactly as before, or it behaves the same way today's
unavailable day behaves — it never ships a board with a broken or surreptitiously weakened group.

**Why this priority**: Swapping one source of content for another risks shrinking the pool of
viable boards. Availability must not regress as a side effect.

**Independent Test**: Generate boards across a multi-week horizon (as is done today) and confirm the
share of days that yield a playable board does not decrease compared with the current design.

**Acceptance Scenarios**:

1. **Given** a horizon of consecutive UTC days, **When** the app generates each day's Groups puzzle,
   **Then** the share of days that produce a valid four-by-four board is no lower than the share
   under the current design.
2. **Given** a day whose catalog cannot fill the replacement group, **When** the day's board is
   requested, **Then** the outcome is the same clear unavailable state the game already produces,
   never a malformed or ambiguously solvable board.

---

### Edge Cases

- A day whose catalog cannot supply four candidates for the replacement group.
- A replacement criterion whose fact is common enough that many four-tile subsets satisfy it,
  threatening the game's "exactly one subset per group" guarantee.
- The replacement group accidentally behaving as a hidden "same anime" group again (all tiles from
  one anime) or as a hidden duplicate of another of the four criteria.
- The corresponding bilingual labels (Spanish and English) being missing for the new criterion.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Groups boards MUST NOT include the shared-voice-language ("same language") criterion
  on any day.
- **FR-002**: Every Groups board MUST continue to present exactly four groups of exactly four tiles,
  one group per criterion, and the replacement criterion MUST take the place of the removed language
  criterion.
- **FR-003**: The replacement group's tiles MUST NOT all belong to a single anime, so the group is
  never indistinguishable from the "same anime" group.
- **FR-004**: The replacement criterion's shared fact MUST be one a player can infer from the tile
  names and the general anime knowledge already required to solve the "same anime" and "same voice
  actor" groups, and MUST NOT be a fact that is invisible on tiles and effectively uniform across
  the catalog (which is what made the language group too difficult).
- **FR-005**: The replacement group's shared fact MUST be the anime's source material: its four
  tiles come from different anime that were adapted from the same source type (for example, all
  four from manga). The fact MUST be drawn from the read-only catalog already in place, with no new
  data or schema dependency.
- **FR-006**: The game's solvability guarantee MUST hold for boards using the replacement criterion:
  across the board's sixteen tiles, exactly one subset of four satisfies each of the four criteria
  and those four subsets are the four intended groups.
- **FR-007**: The replacement group's label MUST exist in both Spanish and English from the first
  release and MUST accurately describe the shared fact.
- **FR-008**: Day-to-day determinism MUST be preserved: the same day with the same catalog state
  yields the same board, and boards that cannot be validly built keep today's clear unavailable
  outcome instead of a weakened or malformed board.

### Key Entities *(include if feature involves data)*

- **Tile**: A playable character shown by name only; carries the facts (anime, season, language,
  voice actor) its group is judged on.
- **Group**: A set of four tiles plus the criterion they share; exactly four groups exist per board.
- **Criterion**: The shared fact a group is labelled with ("same anime", "same season", "same voice
  actor", and the replacement fact); the language criterion is removed.
- **Board**: The sixteen tiles that must resolve into the four groups.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Across a 30-day generation horizon, 100% of produced Groups boards contain no group
  labelled with the shared-voice-language criterion.
- **SC-002**: Across that same horizon, 100% of produced boards resolve to exactly four distinct
  groups of four, each matching exactly one criterion, with no ambiguous board admitted.
- **SC-003**: 100% of produced boards give a replacement group whose four tiles span more than one
  anime.
- **SC-004**: 100% of produced boards keep the pre-existing three criteria unchanged in count and
  label.
- **SC-005**: The replacement group's label renders in both supported languages on the first release
  that introduces it.
- **SC-006**: The share of days yielding a playable board on that horizon does not fall below the
  share under the current design, and regeneration of any already-published day reproduces the same
  board.

## Assumptions

- The Groups game keeps its four-groups-of-four structure; removing the language criterion is not a
  request to change the board size or group count.
- The difficulty target for the replacement group matches the "same anime" and "same voice actor"
  groups (solvable from names and general anime knowledge), not the current language group.
- The replacement fact is limited to what the read-only catalog already stores (the source
  material an anime was adapted from, for example manga), so the change needs no new data and no
  change to the governance of catalog reads.
- The other three criteria ("same anime", "same season", "same voice actor") stay exactly as they
  are.
- Solvability (exactly one valid subset per group) remains a hard requirement on every published
  board, and rarity of the golden fact is on the generator, never on looser acceptance.

## Manual vs Automated Verification Note

Automated checks may confirm observable game behavior: the set of criteria used on generated boards,
the absence of the language criterion, the four-by-four structure, tiles spanning more than one
anime on the replacement group, bilingual labels, and deterministic regeneration for the same day.
Assertions MUST NOT depend on stylesheet or markup text.