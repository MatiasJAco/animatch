# Feature Specification: More or Less — Voice Actors With Over 80 Roles

**Feature Branch**: `008-more-less-role-floor`

**Created**: 2026-10-10

**Status**: Draft

**Input**: User description: "When creating the more or less, make sure that every voice actor selected for the game have over 80 voice roles"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Only established voice actors appear (Priority: P1)

A visitor plays More or Less. Every voice actor who appears — the one whose role count is visible at the start and every actor whose count is hidden behind each round — is an established professional with a career of more than 80 voice roles. Obscure performers with only a handful of credits never appear, so every comparison is between recognizable, well-known voice actors.

**Why this priority**: This is the entire point of the feature. If a single under-qualified actor can still reach the board, the guarantee requested ("over 80 roles") is not met and the feature delivers nothing.

**Independent Test**: Generate or play a More or Less puzzle for a day and inspect all actors it presents — the initial visible actor plus each round's hidden actor — confirming every career role count is 81 or more and none is 80 or fewer.

**Acceptance Scenarios**:

1. **Given** a More or Less puzzle for a UTC day, **When** it is served, **Then** every voice actor presented has a career role count greater than 80.
2. **Given** a round of More or Less, **When** that round's hidden actor is revealed, **Then** the revealed actor's career role count is greater than 80.
3. **Given** an actor whose career role count is 80 or fewer, **When** the day's puzzle is generated, **Then** that actor is never selected for any position in the puzzle.
4. **Given** an actor whose career role count is exactly 80, **When** actors are considered, **Then** the actor does not qualify and is never presented; an actor with 81 or more does qualify.

---

### User Story 2 - The floor never weakens the game's fairness rules (Priority: P2)

Applying the role-count floor narrows the pool of eligible actors, but the game itself is unchanged: it still runs exactly ten rounds, never shows a round whose two counts are equal, serves the same puzzle to everyone on the same UTC day, and does not repeat a recent day's setup.

**Why this priority**: Restricting the actor pool risks starving the generator and producing a short, tied-up, or inconsistent board. A floor that breaks the core game is worse than no floor at all, so these invariants must survive the change.

**Independent Test**: For each day tested, confirm the served puzzle has exactly ten rounds, contains no round with equal hidden and visible counts, is identical for two separate visitors on that day, and differs from the previous days' setups.

**Acceptance Scenarios**:

1. **Given** a puzzle built only from actors meeting the floor, **When** it is played, **Then** it still has exactly ten rounds and contains no round where the hidden and visible counts are equal.
2. **Given** two visitors opening More or Less on the same UTC day, **When** each loads the game, **Then** both receive the same floor-compliant puzzle.
3. **Given** consecutive UTC days, **When** puzzles are generated, **Then** each day's setup differs from the setups of the preceding thirty days.

---

### User Story 3 - A shortage of qualified actors is shown, never hidden (Priority: P3)

If the catalog does not contain enough actors meeting the floor to build a valid ten-round puzzle, the visitor sees the standard bilingual error state with a retry path. The game never quietly lowers the bar, never substitutes an under-qualified actor, and never serves a short or broken board.

**Why this priority**: The guarantee "never less than 80 roles" is only trustworthy if it cannot be silently abandoned. This preserves the project's fail-visible rule and keeps the promise honest when data is thin.

**Independent Test**: On a day where the qualified pool cannot supply a valid puzzle, confirm the visitor gets the bilingual error state with a retry control and that no actor below the floor is presented anywhere.

**Acceptance Scenarios**:

1. **Given** the catalog cannot supply enough actors with more than 80 roles to form a valid ten-round puzzle, **When** the day's puzzle is requested, **Then** the visitor sees the bilingual error state that names the failure and offers a retry control.
2. **Given** such a shortage, **When** the game responds, **Then** no actor below the floor is presented and no partial, short, or duplicated board is shown in its place.
3. **Given** the error state, **When** the visitor retries after the shortage is resolved, **Then** a valid floor-compliant puzzle is served.

---

### Edge Cases

- **Actor exactly at the threshold**: an actor with exactly 80 roles does not qualify; an actor with 81 roles does. The boundary is exclusive at 80.
- **Too few qualified actors**: when fewer actors than needed to fill the chain meet the floor, the game shows the bilingual error state rather than downgrading the floor or shortening the game.
- **Catalog counts change between days** (for example after a data import): the floor is evaluated against the role counts in effect when that day's puzzle is generated; once generated, that day's puzzle is fixed for everyone.
- **Qualification is independent of spread**: an actor qualifies on total career role records regardless of how they are distributed across characters, series, or languages, matching the project's existing career-count definition.
- **Equal counts still forbidden**: applying the floor does not relax the rule that a round never shows two equal counts.
- **Loss explanation and share**: the loss explanation and the share summary continue to work unchanged; the floor introduces no new reveal or disclosure path.
- **Puzzle stored before the change**: a day's puzzle is generated once and then fixed. The floor is guaranteed for every puzzle generated after this change takes effect; a puzzle for the current day that was already stored beforehand is grandfathered (see Assumptions).
- **Other games unaffected**: Groups and Match the Series continue to use the actors and entities they use today.
- **Single actor cannot fill a position twice**: if the qualified pool is too small to provide the required distinct positions, it is treated as a shortage and fails visibly rather than repeating an actor.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a More or Less puzzle is generated for a UTC day, every voice actor selected for the puzzle MUST have a career role count greater than 80. The threshold is exclusive: 81 qualifies, 80 does not.
- **FR-002**: The floor MUST apply to every position in the puzzle — the initial visible actor and every hidden actor introduced across all rounds — so that no round exposes an actor below the floor.
- **FR-003**: The floor MUST be evaluated using the project's existing career role count for an actor (the total number of catalog voice-role records attributed to that person, regardless of character, series, or language). No alternative or approximate popularity measure may be introduced.
- **FR-004**: The count used to qualify an actor MUST be the same count shown and compared for that actor, so a presented count can never contradict the floor that admitted the actor.
- **FR-005**: The floor MUST NOT be silently lowered, skipped, or bypassed. If the qualified pool cannot supply a valid puzzle for a day, the game MUST present the bilingual error state (naming the failure and offering a retry path) instead of presenting an actor below the floor or a malformed board.
- **FR-006**: All existing More or Less rules MUST continue to hold among qualified actors: exactly ten rounds, no round with equal hidden and visible counts, an unambiguous single correct answer per round, a puzzle that is deterministic per UTC day and identical for every visitor, and a setup that differs from the preceding thirty days.
- **FR-007**: Selection MUST remain free of non-deterministic inputs so that repeated requests for the same day yield the same floor-compliant puzzle.
- **FR-008**: The floor MUST apply to More or Less only; the Groups and Match the Series games MUST be unchanged.
- **FR-009**: The floor MUST be a fixed product value for the game. It MUST NOT be configurable by, derived from, or influenced by the visitor, locale, device, or timezone.
- **FR-010**: The feature MUST NOT introduce any path — reuse, replay, error fallback, or resume — by which an actor below the floor can be presented in a More or Less puzzle.

### Key Entities

- **Voice Actor (Person)**: A catalog person who performs voice roles. The only attribute relevant here is their career role count (total voice-role records attributed to them), which determines floor eligibility.
- **Qualified Actor Pool**: The subset of voice actors whose career role count is greater than 80. This is the only pool from which More or Less may draw.
- **More or Less Daily Puzzle**: The stored puzzle for one game and one UTC day: the initial visible actor plus the ten hidden actors chained across ten rounds, together with the compared counts. Every actor in it must belong to the qualified pool.
- **Round Outcome**: The existing result of answering one round (correct/incorrect, the counts, the state). Unchanged by this feature except that its actors always come from the qualified pool.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Across a sweep of generated More or Less puzzles, 100% of presented actors have a career role count greater than 80, and 0 actors with 80 or fewer roles appear.
- **SC-002**: In 100% of days tested with sufficient qualified actors, the served puzzle has exactly ten rounds and contains no round with equal hidden and visible counts.
- **SC-003**: Two visitors on the same UTC day receive the identical puzzle in 100% of test runs, confirming the floor does not break determinism.
- **SC-004**: In 100% of days where the qualified pool is insufficient, the bilingual error state with a retry path is shown, and 0 actors below the floor are presented.
- **SC-005**: The threshold is observably exclusive: actors with 80 or fewer roles never appear (0 observed occurrences), while actors with 81 or more can appear.
- **SC-006**: 100% of newly generated More or Less puzzles differ from the setups of the preceding thirty days, as before.
- **SC-007**: The Groups and Match the Series games, the loss explanation, and the share summary show 0 behavioral regressions in their existing checks.
- **SC-008**: The error state shown for an insufficient qualified pool contains 0 missing or untranslated strings in either supported language.

## Assumptions

- Scope is the More or Less game only; Groups and Match the Series are unchanged.
- "Roles" means the project's existing career role count: every catalog voice-role record attributed to the person, counted regardless of character, series, or language (the same definition already used by the comparison).
- The floor is a fixed constant and is exclusive: an actor must have strictly more than 80 roles (81 or more) to qualify.
- The floor is enforced at puzzle generation time. Because a day's puzzle is generated once and then fixed for all visitors, the guarantee applies to every puzzle generated after the change takes effect; a puzzle row already stored for the current day before deployment is grandfathered, and no rewrite of stored puzzles is implied or required.
- A qualified pool too small to build a valid ten-round puzzle is handled with the existing bilingual error state and retry path, consistent with the project's fail-visible rule; the threshold is never relaxed as a fallback.
- No new dependency, no catalog schema change, and no new user-facing copy are required; the change is a narrowing of actor selection plus reuse of the existing error state.
- The floor does not alter rounds, scoring, the loss explanation, the stored day result, or the share summary.
- Performance matches the project's standard web expectations: puzzle generation and page load remain within their current bounds despite the smaller candidate pool.
