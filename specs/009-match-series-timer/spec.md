# Feature Specification: Match the Series — Unlimited Mistakes Within a Time Limit

**Feature Branch**: `009-match-series-timer`

**Created**: 2026-10-10

**Status**: Draft

**Input**: User description: "In game Match the series, instead of losing when making a few mistakes the player should have te opportunity to make all the mistakes they want but they will be limited by a timer of 60 90 seconds."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Unlimited wrong guesses, only the clock constrains the player (Priority: P1)

A visitor plays Match the Series. They can pick the wrong series as many times as they want; a wrong guess never ends the game and never counts against them. A wrong guess only produces immediate feedback that the pick was wrong. The only things that end a game are finding the correct series for all nine tiles or running out of the time limit.

**Why this priority**: This is the requested change. Today three wrong guesses end the game (`Mistakes: n/3`); removing that cap and having the player answer freely is the whole point of the feature, and every other story supports it.

**Independent Test**: Open Match the Series and pick an incorrect series repeatedly, well beyond three times. The board stays in progress and keeps showing wrong-answer feedback; it never reaches a game-over state from wrong guesses alone.

**Acceptance Scenarios**:

1. **Given** an in-progress Match the Series board, **When** the player picks a wrong series for the clue on screen, **Then** the board stays in progress, shows wrong-answer feedback, and no green tile changes.
2. **Given** an in-progress board, **When** the player picks a wrong series more times than the old limit (three or more) on one clue or across clues, **Then** the game does not end and the player can keep answering.
3. **Given** an in-progress board, **When** the player picks the correct series for the clue, **Then** that series' tile turns green and locks exactly as it does today, and the reveal is unchanged.

---

### User Story 2 - A visible countdown the player can follow (Priority: P2)

A visitor sees, at all times while the game is in progress, how much time is left. The countdown sits inside the clue card, aligned to its right edge, as a two-digit number inside a circle, and decreases in whole seconds, so the player is never surprised by time running out.

**Why this priority**: The time limit is now the only consequence in the game, so it must be visible and legible; a hidden or notional clock would be unfair.

**Independent Test**: Start a game and confirm a two-digit countdown is visible inside the clue card on its right side, starts at the full time limit, and decreases by one each second while the player keeps answering.

**Acceptance Scenarios**:

1. **Given** a freshly started game, **When** the board appears, **Then** the remaining time is shown inside the clue card, right-aligned, as a two-digit number within a circle, and begins at the full limit.
2. **Given** a running game, **When** one second elapses, **Then** the displayed remaining time decreases by one second, staying two digits (for example `90` → `89`, `09` → `08`).
3. **Given** a running game, **When** the player makes correct or wrong guesses (including skips), **Then** the countdown keeps running and does not reset or pause because of those actions.

---

### User Story 3 - Time runs out: the game ends and shows the answers (Priority: P3)

When the time limit is reached and the player has not found all nine series, the game ends. The player is told time ran out and sees the correct series for every clue, matching the existing end-of-game reveal. The day's result is recorded on the device so the home screen marks the game finished and the reset controls still clear it.

**Why this priority**: Without a defined end, the time limit is meaningless. Reusing the existing reveal keeps the ending consistent with how the game already ends and satisfies the project's fail-visible rule.

**Independent Test**: Start a game and let the countdown reach zero without winning; confirm the game ends, the reveal lists every clue with its correct series, and the home screen marks the game finished for the day.

**Acceptance Scenarios**:

1. **Given** a running game where not all nine tiles are green, **When** the countdown reaches zero, **Then** the game ends and every clue's correct series is revealed.
2. **Given** a running game, **When** the player finds the ninth green tile before the countdown reaches zero, **Then** the game ends as a win and the countdown stops.
3. **Given** a game that ended by time-out, **When** the player returns to the home screen, **Then** the game is marked finished for the day and can be cleared by the existing reset controls.

---

### Edge Cases

- **Repeated wrong guess on the same clue**: allowed without limit and without penalty; only wrong-answer feedback is shown.
- **Correct answer exactly as time reaches zero**: finding the final tile at the same moment the clock hits zero is a win, not a time-out. The win condition takes precedence when the final correct answer is accepted at or before zero time remaining.
- **Page reload or leaving the page mid-game**: the remaining time is preserved on the device, and returning resumes the countdown from where it stopped. A reload never adds time back and never restarts the countdown at the full limit.
- **Background tab / device sleep mid-game**: the countdown pauses while the board is not being viewed and resumes when the player returns; time spent away from the visible board is not charged against the limit.
- **Answer in flight when time reaches zero**: an answer already sent and accepted at or before the limit still counts normally; the ending state must never be applied twice to one game.
- **Puzzle or attempt request fails mid-game**: the existing bilingual error state with a retry control is shown (constitution Principle V); the countdown must not silently run down the player's game while the board cannot be used.
- **Day rollover during play**: the board is tied to the UTC day, so a game that crosses 00:00 UTC follows the existing day-rollover behavior; the timer never changes which puzzle is served.
- **Progress stored before this change**: a result already recorded on the device for the current day (including one that ended under the old mistake cap) remains finished; the change does not retroactively reopen it.
- **Timer presentation**: the remaining time is a duration, not a clock time, so it is not affected by the viewer's timezone; it is shown in both supported languages, always as two digits inside the clue card's right-aligned circle.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST NOT end a Match the Series game because of wrong guesses. A wrong guess MUST only produce wrong-answer feedback and leave the game in progress.
- **FR-002**: A wrong guess MUST NOT reduce the remaining time beyond the ordinary passage of time, MUST NOT lock or unset existing green tiles, and MUST NOT introduce any other penalty.
- **FR-003**: The system MUST enforce a single time limit on a Match the Series game. The limit MUST be a fixed product value that is the same for every player and is not configurable by or derived from the player, locale, device, or timezone.
- **FR-004**: The time limit MUST be visible as a countdown for the whole time the game is in progress, and it MUST decrease in whole seconds.
- **FR-005**: The system MUST end the game as a win at the moment all nine series tiles are green, and the countdown MUST stop then.
- **FR-006**: When the time limit is reached and the game is not won, the system MUST end the game and reveal the correct series for every clue, matching the existing end-of-game reveal.
- **FR-007**: A game that ends by time-out MUST be recorded on the device as the day's result for Match the Series, so the home screen marks the game finished for the day, the share summary remains available, and the existing reset controls clear it exactly as today.
- **FR-008**: A game MUST begin its countdown at the full time limit when the board is first shown, and MUST count down only while the player is viewing that board. Switching away, minimizing, or sleeping the device MUST pause the countdown, and returning MUST resume it from the remaining time. A reload MUST preserve the remaining time rather than restarting or draining it.
- **FR-009**: Every user-facing timer string (countdown label and the time-out message) MUST exist in both Spanish (`es`) and English (`en`) from the first commit, referenced through the message catalog.
- **FR-010**: The change MUST apply to Match the Series only; the Groups and More or Less games MUST be unchanged.
- **FR-011**: Every failure path (puzzle unavailable, attempt rejected, unexpected error) MUST continue to render the existing bilingual error state with an appropriate retry path; the feature MUST NOT introduce a blank or stuck state.
- **FR-012**: The feature MUST NOT introduce server-held game state, player identity, or a new server session; the timer and the day's result remain device-owned, consistent with the stateless v1 design.
- **FR-013**: A result already recorded on the device for the current day MUST stay finished; the feature MUST NOT silently reopen a completed game.
- **FR-014**: The countdown MUST be rendered inside the clue card, aligned to its right edge, as a two-digit number inside a circular badge. The value MUST always show two digits (a leading zero below ten) and MUST NOT displace or clip the clue card's existing content at supported viewport widths.

### Key Entities

- **Match the Series Game (in progress)**: The device-owned game for the current UTC day: the clue on screen, the green/locked series tiles, the clue cards already answered correctly, and the remaining time. Its single terminal conditions are all-nine-green (win) or time limit reached (time-out).
- **Countdown**: The visible, decreasing representation of the game's time limit in whole seconds, shown inside the clue card, right-aligned, as a two-digit number within a circle. A duration, independent of the viewer's timezone.
- **Time Limit**: The fixed total playing time for one Match the Series game: 90 seconds, identical for every player regardless of locale, device, or timezone. It is measured only while the board is being viewed.
- **Day Result**: The device-stored outcome (won or ended by time-out) for the current UTC day, used by the home screen marker, the share summary, and the reset controls.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Across a play session, 100% of wrong guesses — including more than three on a single clue and more than three in total — leave the game in progress; 0 games end because of wrong guesses.
- **SC-002**: A game that is not won ends within 1 second after the displayed countdown reaches zero.
- **SC-003**: A game where the ninth green tile is found before the countdown reaches zero ends as a win, and the countdown stops within 1 second of that final correct answer.
- **SC-004**: The countdown is visible for 100% of the in-progress playing time; while the board is visible it decreases by exactly one second per second of real elapsed time, and while the board is hidden it does not decrease and resumes on return (0 seconds added or lost by a tab switch or reload).
- **SC-005**: 100% of new timer strings exist in both Spanish and English, with 0 missing or untranslated strings.
- **SC-006**: In 100% of time-out endings and wins, the home screen marks the game finished for the day, and the reset controls clear it.
- **SC-007**: Groups and More or Less show 0 behavioral regressions in their existing checks.
- **SC-008**: Two players on the same day observe the identical fixed time limit, and the limit is unaffected by locale, device, or timezone (0 observed variation).

## Assumptions

- **The mistake cap is removed entirely**: the `Mistakes: n/3` display and the third-mistake loss no longer exist for Match the Series. They are replaced by the countdown, which is presented as a two-digit circular badge inside the clue card, right-aligned.
- **The time limit is a fixed 90 seconds**, identical for every player, locale, device, and timezone.
- **The countdown pauses whenever the board is not visible** (hidden tab, minimized window, or sleeping device) and resumes on return; the remaining time is preserved across reloads rather than restarted or drained.
- **Time-out is a finished game, not a blank state**: running out of time ends the day's game as a completed result, reusing the existing end-of-game reveal rather than inventing a new disclosure path.
- **Winning is unchanged**: all nine series found, one correct pairing per series, exactly as today.
- **Skipping with the existing `Next` control is unchanged** and does not consume or reset the timer beyond ordinary elapsed time.
- **The day's game is still one per UTC day**: the timer does not change which puzzle is served or when the day rolls over.
- **No new dependency, catalog schema change, or server write is required**; the feature is a change to the game's ending rule plus visible device-side timing, consistent with the project's stateless v1 design.
- **Fail-visible behavior is preserved**: every error path keeps its existing bilingual, retryable state.
