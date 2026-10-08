# Feature Specification: More or Less — Explain Every Loss

**Feature Branch**: `004-more-less-loss-feedback`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "In More or Less, the user must always know why he lost and the correct answer."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Loss is explained the moment it happens (Priority: P1)

A player answers a More or Less round incorrectly and the game ends. On the very screen where the loss is announced, the player immediately sees an explanation of the loss: the failed person's tile framed in red, their true role count, and the count it was compared against — the comparison alone making the correct answer obvious — all in the language the player is using.

**Why this priority**: This is the whole point of the feature. A daily game that ends without saying why feels arbitrary and untrustworthy. Without this, the feature delivers no value at all.

**Independent Test**: Play More or Less, answer one round incorrectly, and verify the loss screen itself shows the failed person's tile in red with the true count, alongside the count it was compared against, with no further clicks, taps, or navigation.

**Acceptance Scenarios**:

1. **Given** a player is on round 3 of More or Less, **When** they answer "More" but the hidden person actually has fewer roles, **Then** the game ends and the loss screen shows the failed person's tile with a red emphasis, their true role count, and the count it was compared against — the two values making the correct answer obvious.
2. **Given** a player answers incorrectly on the very first round, **When** the loss is announced, **Then** the same comparative explanation (red-framed tile, true count, compared count) is shown; nothing about the explanation depends on how many rounds were completed.
3. **Given** a player answers incorrectly on the final round, **When** the loss is announced, **Then** the explanation is shown together with the round they reached, and no content for rounds beyond the failed one is shown.
4. **Given** a player is using the Spanish interface, **When** they lose, **Then** the entire explanation is rendered in Spanish from the shared message catalog, with no untranslated or leftover English text.
5. **Given** a player loses, **When** they read the explanation, **Then** the counts shown make the correct answer self-evident (the comparison is visible), so the player does not have to take the verdict on faith.
6. **Given** a player loses on any round, **When** the loss is announced, **Then** the tile (image and name) of the person whose hidden count ended the game is shown, and that person's true role count is displayed with red emphasis alongside the count it was compared against.

---

### User Story 2 - The explanation survives coming back later (Priority: P2)

A player loses, closes the tab or reloads the page, and returns to the game later the same day. The game still shows that today's result was a loss and still shows the full explanation — the failed person's tile, their true count, and the compared count.

**Why this priority**: A daily game has exactly one result per day. If the explanation evaporates on reload, the promise "the user must always know why he lost" is broken for the most common real-world behavior (navigating away and coming back).

**Independent Test**: Lose a round, reload the page or revisit the game URL later the same day, and verify the loss explanation is still present and identical.

**Acceptance Scenarios**:

1. **Given** a player has lost today's puzzle, **When** they reload the game page, **Then** the loss screen with the full explanation is shown again instead of a fresh playable board.
2. **Given** a player has lost today's puzzle, **When** they navigate to the home page and come back to the game, **Then** the same explanation (the red-framed tile, the true count, the compared count, the round number) is displayed.
3. **Given** a player has lost today's puzzle, **When** the next UTC day begins and they open the game, **Then** the new day's puzzle is offered as playable and the previous day's explanation is not shown for it.

---

### User Story 3 - The explanation is unambiguous and accessible (Priority: P3)

A player — including one using a screen reader or one who does not rely on color — can tell at a glance which count is the correct (true) one and which it was compared against, and can see which round the game ended on.

**Why this priority**: The information exists only if it is legible. Ambiguous presentation ("Wrong" next to two numbers) reintroduces the original problem in a different form.

**Independent Test**: Inspect the loss explanation for an explicit label on the true count (distinct from the compared count), a round indicator, and meaning that does not depend on color alone.

**Acceptance Scenarios**:

1. **Given** a player is viewing the loss explanation, **When** they read it without color cues, **Then** the true count and the compared count are still distinguishable by their text labels and the reveal sentence.
2. **Given** a player uses a screen reader, **When** the loss screen appears, **Then** the explanation is announced/read as part of the loss content in reading order, not only conveyed through styling or position.
3. **Given** a player lost on round 7 of 10, **When** they read the explanation, **Then** it states the round they were on and the total number of rounds.

---

### Edge Cases

- **Wrong answer on round 1**: no prior rounds were revealed; the explanation must still be complete using only the failed round's data.
- **Wrong answer on the final round**: the game ends at round 10 with a loss rather than a win; the explanation must not be mistaken for a win summary.
- **Answer submission fails** (network, service, or data error): this is NOT a loss. The player must see an error state with a retry path, the round stays unanswered, and no loss explanation is produced. An error must never be presented as the reason for losing, and a loss must never be presented as an error.
- **Client storage unavailable or cleared after losing**: the game degrades to a playable empty state (no error, no blocked page). The previously stored explanation may be gone; the game must remain playable.
- **Two tabs / two devices**: state is per browser storage, so a loss recorded in one tab is reflected when that same browser re-reads its stored day result; no cross-device synchronization is expected.
- **Locale switched after losing**: the explanation re-renders in the newly selected language, since all explanation text comes from the message catalog.
- **Day rollover (00:00 UTC) after losing**: the stored result belongs to its own day key; the new day starts clean and playable.
- **Data needed for the explanation missing**: the outcome of an attempt must always include the correct answer and both counts for the failed round; if it ever does not, the player sees the standard error state with retry (never a blank or bare "You lost").
- **Loss record unreadable or incomplete on return**: if the stored explanation is malformed, or the day's puzzle cannot supply the failed round's person, the player still sees the loss result. The explanation degrades: counts are still shown, the tile is omitted if the person cannot be identified. In no case is a blank, bare, or error-labeled screen shown for a recorded loss.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When a player answers a More or Less round incorrectly, the game MUST end and present a persistent loss explanation view that combines the loss result and the reason for it in one screen.
- **FR-002**: The loss explanation MUST show the failed round's comparison: the hidden person's true role count with red emphasis on their tile, and the count it was compared against.
- **FR-003**: The correct answer MUST be self-evident from that comparison (the higher/lower count versus the compared value); a separate sentence stating the player's or correct answer is not required.
- **FR-004**: The loss explanation MUST show both role counts involved in the failed comparison (the hidden person's count and the count it was compared against), presented so that they justify the correct answer.
- **FR-005**: The loss explanation MUST identify the round on which the player lost and the total number of rounds in the game.
- **FR-006**: The loss explanation MUST be visible without any further interaction: the correct answer and the reason must not require a click, tap, scroll-to-separate-view, or navigation away from the loss announcement.
- **FR-007**: The loss explanation MUST remain available for the remainder of that puzzle's UTC day when the player reloads the page or revisits the game, alongside the stored day result.
- **FR-008**: Every string in the loss explanation MUST exist in both supported languages (Spanish and English), be referenced through the shared message catalog, and existing loss/reveal copy in both languages MUST be reviewed for correctness.
- **FR-009**: The loss explanation MUST NOT reveal role counts or answers for any round beyond the failed round, and MUST NOT expose the rest of the chain.
- **FR-010**: A failed answer submission (network, service, or data failure) MUST NOT be recorded or displayed as a loss; it MUST render as an error state naming what failed, with a retry path, and the round remains playable.
- **FR-011**: If the stored day result cannot be read (for example, cleared client storage), the game MUST degrade to a playable empty state rather than an error or a blocked page.
- **FR-012**: The loss explanation MUST be understandable without relying on color alone, and MUST be readable in order by assistive technology.
- **FR-013**: The loss explanation MUST present the tile (image and name) of the person whose hidden role count decided the failed round, and MUST show that person's true role count with red emphasis alongside the comparison count.

### Key Entities

- **Day Result (client-held)**: The player's result for one game on one UTC day: outcome (won/lost), rounds attempted, and — when lost — the loss explanation data: failed round number, total rounds, the answer given, the correct answer, the two compared role counts, and the identity of the failed round's person (derivable from that day's stable puzzle). Held only for today's result, on the player's device, scoped to that game and day; no account or server-side session.
- **Attempt Outcome**: The result of a single answer for one round: whether it was correct, the correct answer, the answer given, the two role counts for that round, and the resulting game state. It is the only source of the counts shown in the explanation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a test of a wrong answer at every one of the 10 rounds, 100% of cases display the failed round's person as a red-framed tile with the true count in red and the compared count on the loss screen.
- **SC-002**: The full explanation is on screen at the moment the loss is announced, with 0 additional interactions required to see the correct answer.
- **SC-003**: After losing, the explanation is still present after a page reload or a return visit later the same day in 100% of test runs where the player's saved result for that day is intact.
- **SC-004**: 0 untranslated, missing, or mixed-language strings on the loss screen in a review of both supported languages.
- **SC-005**: In a short usability check, at least 90% of testers can correctly state, after one glance at the loss screen, the true count, the count it was compared against, and why they lost.
- **SC-006**: 0 observed cases of an error being shown as a loss, a loss shown without an explanation, or a blank/bare loss screen.
- **SC-007**: The explanation for a loss never contains information about rounds after the failed one (0 leaks in review).
- **SC-008**: In 100% of loss views tested, the failed round's person is shown as a tile (image and name) and the true count appears with red emphasis, while remaining identifiable by its text label alone (no-color check).

## Assumptions

- Scope is the More or Less game only; the Groups and Match the Series games are unchanged.
- "Losing" keeps its existing meaning: one incorrect answer ends the game immediately. No change to rounds, scoring, or puzzle generation.
- The attempt response already carries the correct answer and both counts for the resolved round, so no new data disclosure path or server-side game state is introduced; the explanation is composed from data the player is already entitled to for that round.
- The day result and its explanation are stored only on the player's device for today's result, per the project's stateless v1 model (no accounts, no server-side session).
- If the player clears browser storage, the explanation for that day is lost; the acceptable behavior is a playable empty state, not recovery of the explanation.
- Share text for the result is unchanged by this feature; the explanation is shown in the game view, not in the share snippet.
- Cross-device continuity of the explanation is out of scope (there is no identity layer in v1).
- Performance targets follow the project's standard web expectations: the explanation appears with the loss announcement, with no perceptible delay beyond the normal page interaction.
