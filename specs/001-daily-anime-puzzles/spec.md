# Feature Specification: Daily Anime Puzzles (v1)

**Feature Branch**: `feat/sdd-inicial`

**Created**: 2026-10-02

**Status**: Draft

**Input**: User description: "v1 of a daily anime puzzle site: three daily games about voice
actors, characters and anime, played without an account, with the day's puzzle persisted in new
game tables."

## Overview

A browser game site with three short daily puzzles about anime voice acting, built on the
existing read-only catalog. A visitor arrives, sees the three games of the day and whether
today's game is already finished, reads a short help text, and plays. At 00:00 UTC the puzzle
changes and the previous day's puzzle is no longer playable. The site is original work: its
names, copy, layout, and assets are not taken from any existing puzzle site.

The three v1 games are:

1. **More or Less** - compare a hidden voice actor's career role count against an exposed one,
   ten rounds in a row.
2. **Match the Series** - a three-by-three grid of current-season series titles with one character
   or voice actor shown at a time on a single clue card above the grid; the visitor clicks the
   series that entity belongs to, and three wrong clicks end the game.
3. **Groups** - find the four shared criteria among sixteen tiles, five mistakes ends the game.

### Vocabulary

| Term | Meaning |
|------|---------|
| Catalog | The existing read-only anime data owned by other systems |
| Puzzle | The stored, fixed set of inputs for one game on one UTC day |
| Day | A calendar date in UTC; the day rolls over at 00:00 UTC |
| Round | One question inside a game session |
| Attempt | One player input validated against the day's puzzle |
| Allowed fact | One of the eight permitted catalog facts listed below |
| Grid tile | One cell of the three-by-three grid, showing one current-season series title |
| Clue card | The single square above the grid showing one character or voice actor to place |
| Mistake | One wrong click on a grid tile; three mistakes end Match the Series |

### Allowed facts (exhaustive)

The games may present, and derive counts from, only these catalog facts:

1. Person (voice actor) name
2. Character name
3. Anime title
4. Anime type
5. Anime year
6. Anime season
7. Voice language
8. Voice role

Studio, biography, favorites ranking, images, and any other attribute are out of v1 scope.
Favorites ranking may be considered in a future version, but no v1 screen may use it.

---

## Clarifications

### Session 2026-10-02

- Q: When a visitor closes the tab in the middle of a game and returns the same UTC day, do they
  resume the game or start the day's puzzle over? → A: Resume where they left off (decided during
  `/speckit.plan`).
- Q: Does the "attempt count" in the result and share text mean every answer given, or only the
  wrong ones? → A: Every answer given, correct plus wrong.
- Q: When a visitor submits four tiles that are not a correct group, does the game say how many of
  those tiles were in the right group? → A: Yes, say how many belong to the same hidden group,
  without naming the group.
- Q: How does a visitor choose between Spanish and English? → A: Detect the visitor's browser
  language on the first visit and offer a visible control to switch.
- Q: In Match the Series, does a wrong click that does not end the game reveal which series that
  entity belongs to? → A: No. Show only that it was wrong; reveal the correct pairings when the
  game ends.
- Q: How quickly must a page be usable on a mid-range phone on a normal connection? → A: Under 2
  seconds on a mid-range phone over 4G.

### Session 2026-10-05

- Q: How large is the Match the Series grid? → A: Three by three, so nine series titles and nine
  clue cards per day. An earlier nine-by-nine draft of this session was corrected to three by three.
- Q: What should the clue card above the three-by-three grid show for each character or voice
  actor? → A: The entity's name as text plus one neutral in-project placeholder image, identical
  in form for every clue card, with no image requested from any external host.
- Q: When the visitor presses the Next button on the clue card, what happens to the current card?
  → A: A free skip: it loads a different entity, costs nothing, and is counted neither as an
  attempt nor as a mistake.
- Q: When the debug reset button is pressed, what state should it clear for the current game?
  → A: Only the visitor's own saved state for that game and UTC day in the browser; no
  server-side change, so the day's stored puzzle is untouched.
- Q: Who should see the debug reset control — should it exist in production? → A: Development
  environments only; it appears nowhere while the site runs in production, so no visitor can use
  it to replay a finished game.
- Q: When the home-screen reset button is pressed, should it clear only what is saved in the
  browser, or should it also delete today's stored puzzle rows from the database? → A: Clear the
  saved state for all three games in the browser only; stored puzzle rows are never read or
  written.
- Q: After a wrong click rotates the clue card to another entity, can the entity that was showing
  come back later in the same game? → A: The entity stays in the pool and may return on a later
  mistake rotation or Next press; only correctly answered entities leave the deck.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pick today's games from the home page (Priority: P1)

A visitor opens the site on a phone or computer. The home page lists all three games of the
day. For each one the visitor can see whether today's game is already finished, a state kept
on their own device from earlier today. The visitor taps a game to open it.

**Why this priority**: Every other journey starts here. Without the home page nothing else is
reachable, and the "already finished today" state is what lets a returning visitor avoid
accidentally replaying a finished game.

**Independent Test**: Load the site with no stored data and again after storing a finished
result for one game; the home page must list three games and mark exactly one as finished. This
slice delivers the whole navigation surface on its own.

**Acceptance Scenarios**:

1. **Given** no stored result, **When** the visitor loads the home page, **Then** all three
   games appear for today's UTC date and each shows a short help entry point.
2. **Given** a stored finished result for one game today, **When** the visitor loads the home
   page, **Then** that game is marked as finished today and the other two are not.
3. **Given** a stored result from a previous UTC day, **When** the visitor loads the home page,
   **Then** no game is marked finished, because yesterday's result does not apply today.
4. **Given** the visitor is on a phone-sized screen, **When** the home page loads, **Then** the
   three games are readable and tappable without horizontal scrolling.
5. **Given** the visitor's browser language is Spanish or English, **When** the home page loads,
   **Then** the page appears in that language, and using the language control switches every
   visible string immediately and keeps that choice on later visits.

---

### User Story 2 - Play More or Less (Priority: P1)

The visitor opens More or Less and reads the short help. The game shows two voice actors: the
left one with their role count hidden, the right one with the number visible. The visitor
answers "more" or "less". A correct answer reveals the hidden number, moves the answered actor
to the right side, and brings in a new hidden actor, for ten rounds. A wrong answer ends the
game immediately. The visitor reaches an end state - won or lost - with a summary and a share
action, and never sees a blank or frozen screen.

**Why this priority**: More or Less is the simplest complete game loop and needs no season
filtering, so it is the reliable proof that the daily puzzle pipeline, play loop, and result
flow all work end to end.

**Independent Test**: Play ten correct answers and confirm the win summary appears with the
hidden count revealed on the final round; then play one wrong answer and confirm immediate game
over. The slice delivers a complete playable game by itself.

**Acceptance Scenarios**:

1. **Given** a fresh More or Less puzzle, **When** the visitor loads the game, **Then** two
   voice actors are shown, the right one with a visible role count and the left one without,
   plus the help text.
2. **Given** the first round is active, **When** the visitor answers correctly, **Then** the
   hidden count is revealed, the actor moves to the right side, a new hidden actor appears on
   the left, and the round counter advances.
3. **Given** a correct answer on round ten, **When** the round resolves, **Then** the game is
   marked won, the summary is shown, and the share action becomes available.
4. **Given** any round, **When** the visitor answers incorrectly, **Then** the game ends
   immediately as a loss, the answer and the true count are revealed, and no further rounds
   are offered.
5. **Given** the game has ended, **When** the visitor reloads the page or returns to the home
   page, **Then** today's finished result is restored from their device and no further rounds
   can be played today.
6. **Given** the visitor is partway through the game, **When** they close the tab and return on the
   same UTC day, **Then** play resumes at the same round with the same attempt count.

---

### User Story 3 - Play Match the Series (Priority: P2)

The visitor opens Match the Series and reads the short help. A single three-by-three grid of
current-season series titles appears, with one clue card above it showing a character or a voice
actor and their name. The visitor clicks the series that entity belongs to. A correct click
colors that tile green, locks it, and immediately loads another entity onto the clue card. A
wrong click colors nothing, reveals nothing, costs one of three mistakes, and rotates the clue
card to another entity, which may be shown again later. Coloring all nine tiles green wins; the
third wrong click ends the game and reveals every pairing.

**Why this priority**: This is the game that makes the site feel current, but it depends on
current-season catalog coverage, so it lands after the simpler game proves the pipeline.

**Independent Test**: Click the correct series for all nine clue cards and confirm the win
summary; separately click three wrong series and confirm game over on the third. The slice is
independently playable and testable.

**Acceptance Scenarios**:

1. **Given** a fresh Match the Series puzzle, **When** the visitor loads the game, **Then** one
   grid of nine tiles appear, each showing a distinct series title from the current season,
   together with exactly one clue card above the grid.
2. **Given** a clue card is showing an entity, **When** the visitor clicks the tile of the series
   that entity belongs to, **Then** that tile is colored green, is locked against further input,
   and the next entity is loaded onto the clue card automatically.
3. **Given** any clue card is showing, **When** the visitor activates the Next control, **Then**
   another, different entity is loaded onto the clue card, the game continues, already-green
   tiles are unaffected, and neither the attempt count nor the mistake count changes.
4. **Given** three wrong clicks have been made, **When** the third wrong click is made, **Then**
   the game ends immediately as a loss and the correct pairing of every tile is revealed.
5. **Given** fewer than three mistakes, **When** the visitor clicks a wrong series, **Then** the
   click is reported as wrong, that tile stays uncolored and playable, the correct series for that
   entity is not shown, and the clue card has already rotated to a different entity.
6. **Given** all nine tiles are green, **When** the last correct click is made, **Then** the
   game is marked won and the summary is shown with the share action available.
7. **Given** a tile is already green, **When** the visitor clicks it, **Then** nothing changes and
   the click is not counted as an attempt or a mistake.
8. **Given** a mistake rotated the clue card away from an entity, **When** later rotations or Next
   presses occur, **Then** that entity may be shown again, and the visitor is never left without
   a playable clue card as a result.

---

### User Story 4 - Play Groups (Priority: P2)

The visitor opens Groups and reads the short help. Sixteen tiles appear, each a character or a
voice actor, arranged in a four-by-four board. Four groups of four tiles share one allowed fact
among themselves. The visitor selects tiles to propose a group; correct groups are removed from
the board and the shared criterion is shown. Five wrong proposals end the game.

**Why this priority**: Groups is the site's signature board format and the highest-value
playable piece, but it needs correct multi-criteria generation, which is riskier than the other
two.

**Independent Test**: Find and submit one group correctly and confirm the criterion is revealed;
then make five wrong proposals and confirm game over on the fifth. The slice is independently
playable and testable.

**Acceptance Scenarios**:

1. **Given** a fresh Groups puzzle, **When** the visitor loads the game, **Then** sixteen tiles
   appear, each labelled with a character or person name, and the help text is shown.
2. **Given** the visitor selects four tiles that form a hidden group, **When** they submit the
   proposal, **Then** the tiles are removed from the board and the shared criterion is revealed.
3. **Given** five wrong proposals have been made, **When** the fifth is submitted, **Then** the
   game ends immediately as a loss and the four correct groups are revealed.
4. **Given** all four groups have been found, **When** the last group is submitted, **Then** the
   game is marked won and the summary is shown with the share action available.
5. **Given** the visitor submits four tiles that are not a correct group, **When** the proposal is
   rejected, **Then** the game reports how many of the four tiles belong to the same hidden group,
   counts the proposal as a mistake, and names neither the group nor its shared fact.

---

### User Story 5 - Share a spoiler-free result (Priority: P3)

After any game ends, the visitor can share a text summary. The summary states the game, the
outcome, and the attempt count, and it does not reveal any answer, hidden count, pairing, or
criterion.

**Why this priority**: Sharing is what makes a daily puzzle social, but it is worthless until a
game can actually end and report a result.

**Independent Test**: End each of the three games in any outcome, copy the share text, and
confirm it identifies the game and outcome without containing any solution detail.

**Acceptance Scenarios**:

1. **Given** a finished game, **When** the visitor activates share, **Then** a text summary is
   produced that names the game, the outcome, and the attempt count.
2. **Given** any finished game, **When** the share text is inspected, **Then** it contains no
   answer, hidden role count, correct pairing, or group criterion.
3. **Given** a finished game, **When** the share action is unavailable to the platform, **Then**
   the summary text is still visible on the page so the visitor can copy it manually.

---

### User Story 6 - Recover from a failure to load (Priority: P3)

The catalog is unreachable or slow when the visitor loads the site or a game. Instead of a blank
page, the visitor sees a clear message in their language explaining that the puzzle could not be
loaded, with an action to try again. Trying again either loads the puzzle or shows the same
message again, never a blank screen.

**Why this priority**: A daily site with no server-side session gets one chance to explain
itself. A blank screen on a bad database day reads as a dead site and is treated as a defect.

**Independent Test**: Load the site with the catalog unavailable, then available again; the
error state must appear, then the normal home page after retry.

**Acceptance Scenarios**:

1. **Given** the catalog cannot be reached, **When** the visitor loads the home page, **Then** an
   error message appears in the visitor's language with a retry action, and no part of the page
   is blank or in a permanent loading state.
2. **Given** the error message is showing, **When** the visitor activates retry and the catalog
   is available again, **Then** the home page loads normally.
3. **Given** the catalog cannot be reached, **When** the visitor opens a game directly,
   **Then** the same bilingual error state appears rather than an empty board.

---

### User Story 7 - Return home or reset a game while debugging (Priority: P3)

Every game screen carries a control back to the home page, so a visitor can leave a game without
a browser back gesture or a page reload, and their saved state for the day is untouched for when
they come back. The same screen carries a reset control for development: pressing it clears the
visitor's own saved state for that game and day so the puzzle can be played again from the start,
with no manual database edit and no change to the puzzle any other visitor is given. The home page
carries a matching development control that clears all three games' saved state in one action, so
an entire day can be retested without touching stored data by hand.

**Why this priority**: Neither control adds player-facing game value, but leaving a game without
losing your place is basic navigation, and the reset control removes the manual stored-data
cleanup that currently blocks every retest of a day's puzzle.

**Independent Test**: Start a game, leave via the home control and return to confirm the same
round resumes; then press reset and confirm the game starts over while the puzzle itself is
unchanged.

**Acceptance Scenarios**:

1. **Given** a game in progress, **When** the visitor activates the home control, **Then** the
   home page loads and that game's saved state for the day is unchanged, so opening the game again
   resumes the same position.
2. **Given** a game already finished today, **When** the visitor activates the home control,
   **Then** the home page loads and still marks that game as finished today.
3. **Given** a game with saved state, **When** the visitor activates the reset control, **Then**
   that game and day's saved state is cleared and the screen shows the day's puzzle from its
   start with the attempt and mistake counts back at zero.
4. **Given** the reset control is pressed, **When** the puzzle is requested again, **Then** the
   same puzzle is served and no stored puzzle was created, changed, or deleted.
5. **Given** the site runs in production, **When** any game screen loads, **Then** no reset
   control appears, and a visitor cannot clear a finished-today result to replay that game.
6. **Given** saved state for one or more games, **When** the developer activates the home reset
   control, **Then** the saved state of all three games for the current UTC day is cleared, each
   game is playable from the start again, and the visitor's language choice still applies.
7. **Given** the home reset control was activated, **When** the day's puzzles are requested
   again, **Then** the same three puzzles are served, and no stored puzzle row was read, created,
   changed, or deleted.

---

### Edge Cases

- **Rollover during play**: the visitor's local date and the UTC date disagree, or the day rolls
  over while the page is open. The puzzle served is the one for the current UTC day; times shown
  to the visitor are in the visitor's own browser timezone.
- **Yesterday's result**: a stored result from a previous UTC day is never applied to today's
  puzzle, and yesterday's puzzle is not playable or reachable.
- **Two visitors, one day**: two visitors opening the same game on the same UTC day see exactly
  the same puzzle, even if they open it at different hours.
- **Repeating setup**: a day's setup must not be a repeat of a previous day's setup, even though
  the same people, characters, and series may appear again on a later day.
- **Invalid attempt**: an attempt naming a character or person that is not in the day's puzzle,
  or not in the catalog at all, is rejected as an invalid attempt and never silently ignored.
- **Empty or exhausted catalog coverage**: the current calendar season contains fewer than nine
  series, or too few distinct series, characters, or people to fill a board, a clue pool, or a
  chain. The affected game must show the bilingual error state rather than a short, unfair,
  duplicated, or older-season board.
- **Ties in More or Less**: the hidden count equals the visible count, so neither "more" nor
  "less" is correct. This must not be presented as a round with no valid answer.
- **Duplicate tiles in Groups**: two tiles label the same person or character, making a group
  ambiguous.
- **Wrong tile click that does not end the game**: in Match the Series, a mistake below the
  mistake limit. The tile stays uncolored and playable, the mistake is counted, nothing about the
  correct series is shown, and the clue card rotates to another entity.
- **Mistake rotation with nothing else available**: a mistake occurs when no different entity is
  left to rotate to. The mistake is still counted, the same entity keeps showing, and play
  continues rather than ending or blocking.
- **Third mistake**: the game ends on the third wrong click. No rotation happens, the abandoned
  entity is irrelevant, and every pairing is revealed.
- **Entity that belongs to more than one grid series**: a character or voice actor appearing in
  more than one of the nine series would have no single correct answer, so such an entity is
  never placed on a clue card.
- **Clue cards exhausted**: the visitor has used Next until no different clue card remains. Next
  becomes disabled, the game continues with the entity already showing, and play is never blocked
  or ended by an exhausted pool.
- **Skipping is unlimited**: Next costs nothing, so a visitor may skip freely. This MUST NOT alter
  the mistake limit, and a skipped card MUST NOT be re-served after being answered.
- **Scattered guess in Groups**: a wrong proposal whose tiles come from two or more different
  groups, or from none. The feedback count is the largest number sharing one group, so a scattered
  guess can report 1 or 0 even when several tiles are individually part of some group.
- **Interruption mid-game**: the visitor closes the tab mid-round and returns the same UTC day. The
  day's puzzle resumes at the same round or board position from the visitor's own device.
- **Cleared device storage mid-game**: the visitor returns the same UTC day with storage cleared.
  The game's puzzle is playable from the start, with no error and no partial state.
- **Browser without local storage**: the finished-today state cannot be remembered; the game is
  still playable and the site stays usable.
- **Browser language is neither Spanish nor English**: the site falls back to Spanish and the
  language control still offers the switch, rather than showing an untranslated page.
- **Server-rendered page opened in a language the server did not detect**: the language control
  switches the whole page without a reload, including the help text and any error state on screen.
- **Stale client data**: client-held state from a future or malformed day key is discarded
  silently.
- **Reset with no saved state**: the reset control is pressed on a screen with nothing saved for
  that game and day. It is a no-op that leaves the game fully playable from the start.
- **Reset while a game is in progress**: the game returns to its first round or board position
  with the attempt and mistake counts back at zero, and the day's puzzle itself is unchanged.
- **Device storage unavailable**: on a browser that cannot store state, the reset control
  performs no write and play continues unaffected.
- **Reset must not reach the server**: the reset control MUST work with the network unavailable,
  because it touches only device storage.
- **Reset in production**: the control is absent, so the finished-today result on the home page
  cannot be cleared by a visitor and a finished game stays final for the day.
- **Home reset with nothing saved**: the home reset control is pressed with no saved state for any
  game today. It is a no-op that leaves all three games playable from the start.
- **Home reset on a different day**: the home reset control is pressed the day after a game was
  finished. Nothing from the previous day existed to clear, and today's games stay playable from
  the start.
- **Home reset and stored preferences**: the home reset control clears game state only. The
  visitor's language choice and any other stored preference survive it.
- **Home reset on a page that failed to load**: the home page shows its error state because the
  catalog is unreachable. The reset control still clears device state for all three games, and
  retrying afterwards loads the same puzzles as any other visitor receives.

---

## Requirements *(mandatory)*

### Game and Puzzle Framework

- **FR-001**: The site MUST offer exactly three games in v1: More or Less, Match the Series, and
  Groups.
- **FR-002**: The system MUST derive the current day from UTC, with the day rolling over at
  00:00 UTC, and MUST NOT derive the day from the visitor's timezone or the server's default
  timezone.
- **FR-003**: Each game MUST have exactly one stored puzzle per UTC day, and repeated requests
  for the same game and day MUST return the identical puzzle.
- **FR-004**: The first request for a game and day MUST create that day's puzzle atomically, so
  that concurrent first requests produce one puzzle and never a duplicate or an alternative
  setup.
- **FR-005**: Puzzle generation MUST be deterministic from the game identity and the UTC day
  alone; repeated generation for the same game and day MUST produce the same selection.
- **FR-006**: Generated puzzles MUST contain only catalog entities that exist in the catalog at
  generation time. Invented, renamed, or placeholder entities are forbidden.
- **FR-007**: A day's puzzle setup MUST NOT repeat the setup of any earlier day. Individual
  people, characters, and series MAY reappear on later days.
- **FR-008**: The system MUST NOT modify the catalog. It MUST NOT read or write the import job
  tables. It MUST add only its own new game tables.
- **FR-009**: Only the eight allowed facts and data derived from them by counting or grouping
  MUST be presented to the visitor. No other catalog attribute may appear in any v1 screen.
- **FR-010**: The browser MUST NOT talk to the database. All puzzle and catalog data MUST reach
  the browser through the application's own service.
- **FR-011**: The system MUST NOT require an account, sign-in, or any server-side record of a
  visitor in v1.

### Home Page

- **FR-012**: The home page MUST list all three games of the current UTC day.
- **FR-013**: The home page MUST show, for each game, whether the visitor already finished that
  game's puzzle today, using state stored on the visitor's own device.
- **FR-014**: Selecting a game MUST open that game's screen with a short help text before play
  begins.
- **FR-015**: A finished-today state MUST NOT be shown for a result from any other UTC day.
- **FR-016**: The home page MUST be usable on a phone-sized screen without horizontal scrolling.

### Navigation and Debug Reset

- **FR-056**: Every game screen MUST offer a visible control that returns the visitor to the home
  page, available at all times including while a game is in progress and on the won or lost
  screen, and it MUST NOT discard that game's saved state for the day.
- **FR-057**: Every game screen MUST offer a visible reset control that clears the visitor's own
  saved state for that game and the current UTC day from device storage and returns that screen to
  the start of the day's puzzle. Its label MUST come from the message catalog in both languages.
- **FR-057a**: The reset control is a development tool and MUST NOT appear anywhere while the
  site runs in production, so that no visitor can clear a finished-today result and replay that
  game. In any other environment it MUST be reachable on every game screen.
- **FR-057b**: The home page MUST offer a control that clears, in a single action, the visitor's
  own saved state for all three games for the current UTC day, so that a developer can retest a
  day without deleting stored data by hand. Its label MUST come from the message catalog in both
  languages.
- **FR-057c**: The home reset control MUST NOT read, create, change, or delete any stored puzzle
  row on the server, and MUST leave the visitor's language choice and any other stored preference
  intact. Like every other reset control, it MUST NOT appear while the site runs in production, so
  no visitor can clear a finished-today result and replay that game.
- **FR-058**: The reset control MUST affect only the visitor's own device state. It MUST NOT
  create, change, or delete the day's stored puzzle on the server, and MUST NOT change the puzzle
  served to any other visitor.

### More or Less

- **FR-017**: Each round MUST show two voice actors: the left one with the career role count
  hidden, the right one with the count visible.
- **FR-018**: The visitor MUST be able to answer "more" or "less" for the left actor's hidden
  count compared with the right actor's visible count.
- **FR-019**: A correct answer MUST reveal the hidden count, move the answered actor to the
  right side, and bring a new actor with a hidden count into the left side.
- **FR-020**: A correct answer MUST advance the round counter, and the game MUST run for exactly
  ten rounds.
- **FR-021**: An incorrect answer MUST end the game immediately, reveal the true count, and offer
  no further rounds.
- **FR-022**: A puzzle MUST NOT present a round in which the hidden and visible counts are equal,
  so that no round has two correct answers or none.
- **FR-023**: The career role count MUST be the number of voice role records in the catalog
  attributed to that person, counting every record regardless of character, series, or language.
  The stored count MUST be the value used for the comparison and for the reveal, so the number a
  visitor sees after answering is the same number that decided the answer.

### Match the Series

- **FR-024**: The game MUST show exactly one grid of three by three: nine tiles, each showing
  one distinct series title from the current season, together with exactly one clue card above
  the grid. It MUST NOT show a second grid of characters or voice actors.
- **FR-024a**: The clue card MUST show one character or one voice actor at a time, identified by
  catalog id, and that entity MUST belong to exactly one of the grid's nine series, so the
  answer is never ambiguous.
- **FR-025**: The visitor MUST answer by clicking a single grid tile for the entity currently on
  the clue card. There MUST NOT be a first step that selects an entity tile and a second step that
  selects its series.
- **FR-026**: A correct click MUST color that tile green, MUST lock it against further input, and
  MUST advance the visitor's position in the game.
- **FR-026a**: After a correct click resolves, the clue card MUST load the next entity
  automatically, with no further action from the visitor.
- **FR-026b**: The game MUST offer a Next control that loads another entity onto the clue card
  without ending the game and without altering any already-green tile. Next is a free skip: it
  MUST NOT be counted as an attempt, MUST NOT be counted as a mistake, and MUST NOT change the
  attempt or mistake counts reported at the end of the game.
- **FR-026c**: A clue card loaded by Next MUST be a different entity from the one it replaced, and
  MUST NOT be an entity the visitor has already answered correctly in this game.
- **FR-026d**: When no different clue card remains that satisfies FR-026c, Next MUST be disabled
  and the game MUST continue with the entity already showing rather than ending or blocking play.
- **FR-027**: Three incorrect clicks MUST end the game immediately and reveal the correct pairing
  of every tile.
- **FR-027a**: An incorrect click that does not end the game MUST report only that the answer was
  wrong. It MUST NOT reveal the correct series for that entity, or any other correct pairing; the
  clicked tile MUST stay uncolored and remain playable, and the mistake MUST be counted.
- **FR-027b**: A click on a tile that is already green MUST change nothing and MUST NOT be counted
  as an attempt or as a mistake.
- **FR-027c**: An incorrect click MUST rotate the clue card to a different entity automatically,
  with no further action from the visitor, whenever an entity satisfying FR-026c is available, and
  MUST NOT leave the abandoned entity showing in that case. The rotation MUST NOT reveal the
  correct series for the abandoned entity or for any other entity, and MUST NOT change the mistake
  limit. When no such entity is available, the mistake is still counted and the same entity keeps
  showing.
- **FR-027d**: The entity abandoned by a mistake rotation MUST remain in the pool and MAY be
  loaded again by a later mistake rotation or by the Next control. Only a correctly answered
  entity leaves the pool.
- **FR-028**: Coloring all nine tiles green MUST complete the game as a win.
- **FR-029**: The clue card MUST show the entity's name as text together with a neutral
  placeholder image area. The placeholder MUST be original, in-project, and identical in form for
  every clue card; no external image may be fetched, and no image source is stored in the day's
  puzzle. The design MUST allow real artwork to be added later as a separate change that does not
  alter puzzle content, puzzle identity, or any answer.
- **FR-029a**: The generator MUST NOT place on a clue card an entity that appears in more than one
  of the day's nine series, and MUST NOT place an entity whose series is absent from the
  grid.
- **FR-030**: "Current season" MUST mean the calendar season at play time, in UTC, identified by
  the season together with its year. The system MUST NOT substitute an older season, and MUST NOT
  shrink the grid below three by three. If the catalog holds fewer than nine series for that
  season, Match the Series MUST show the bilingual error state with a retry action, exactly as for
  any other unavailable puzzle.

### Groups

- **FR-031**: Each puzzle MUST consist of sixteen tiles, each a character or a voice actor, of
  which exactly four are hidden groups of four.
- **FR-032**: The four groups MUST each share one allowed fact among themselves: the same anime,
  the same season, the same voice language, or the same voice actor.
- **FR-033**: The visitor MUST be able to select up to four tiles and submit them as a group
  proposal.
- **FR-034**: A correct proposal MUST arrange those four tiles into a permanent horizontal row on the board showing the group's shared criterion, and they must remain visible until the game ends. The tiles in that row are no longer selectable.
- **FR-035**: Five incorrect proposals MUST end the game immediately and reveal the four correct
  groups.
- **FR-035a**: A proposal that is not a correct group MUST report how many of the submitted tiles
  belong to the same hidden group, defined as the largest count among the submitted tiles that share
  one hidden group, and zero when no two submitted tiles share a group. It MUST NOT name the group,
  its tiles, or its shared fact. This count is a hint and MUST NOT count toward the mistake limit.
- **FR-036**: Finding all four groups MUST complete the game as a win.
- **FR-037**: The puzzle MUST NOT contain duplicate tiles within the same label, and MUST NOT
  admit a proposal of four tiles that is correct under more than one criterion at the same time.
- **FR-038**: "Same season" as a group criterion MUST use the same season identity as the
  current-season definition in FR-030, so that seasons from different years are never treated as
  one season.

### Attempts, Results, and Sharing

- **FR-039**: An attempt MUST be validated against the day's stored puzzle. An attempt naming an
  entity that is not in the day's puzzle, or not in the catalog, MUST be rejected as an invalid
  attempt, visibly and without changing the game state.
- **FR-040**: Each game MUST reach an explicit end state of won or lost, shown to the visitor in
  the same session, with no blind reload required.
- **FR-041**: An end state MUST report the attempt count for that game, defined as every answer the
  visitor gave, correct and wrong. Attempts rejected as invalid MUST NOT be counted, since they do
  not change game state.
- **FR-042**: The day's end state MUST be stored on the visitor's own device, keyed by game and
  UTC day, and MUST NOT be stored on the server.
- **FR-043**: A stored end state MUST be presented as final: no further rounds can be played for
  that game on that day.
- **FR-043a**: In-progress state for the current UTC day MUST be stored on the visitor's own device
  and restored when the visitor returns the same UTC day, so a closed tab resumes the same round or
  board position. No in-progress state may be stored on the server.
- **FR-043b**: Cleared, missing, or unreadable device storage MUST leave the game fully playable
  from the start of that day's puzzle, and MUST NOT block play or show an error.
- **FR-044**: The site MUST offer a share action that produces a text summary naming the game,
  the outcome, and the attempt count.
- **FR-045**: The share summary MUST NOT contain any answer, hidden role count, correct pairing,
  group criterion, or any other detail that reveals the solution.
- **FR-046**: The share summary MUST remain readable on the page when the platform's share
  feature is unavailable, so it can be copied manually.
- **FR-047**: The visitor's device time zone MUST be used only to display dates, clock times, and
  countdowns to the next rollover, and MUST NOT influence which puzzle is served.

### Language, Content, and Failure

- **FR-048**: Every visitor-facing string, including all help text, error messages, and share
  text, MUST exist in Spanish and English, with Spanish as the initial language.
- **FR-049**: Visitor-facing strings MUST come from a single message catalog rather than being
  written inline, so both languages stay complete.
- **FR-049a**: On a first visit the site MUST use the visitor's browser language when it is Spanish
  or English, and any regional variant of either MUST map to that base language, never to a pinned
  region. A browser language that is neither MUST fall back to Spanish.
- **FR-049b**: A visible language control MUST let the visitor switch languages at any time. The
  switch MUST take effect immediately on the current page, including help text, error states, and
  share text, and an explicit choice MUST be remembered on the visitor's device and take precedence
  over browser detection on later visits.
- **FR-050**: When the catalog cannot be reached or the day's puzzle cannot be produced, the site
  MUST show a bilingual error state that names the failure and offers a retry, and MUST NOT show
  a blank page, blank board, or endless loading state.
- **FR-051**: Failure messages MUST NOT expose internal details such as connection strings,
  queries, or stack traces.
- **FR-052**: If the visitor's device cannot store state, the site MUST remain fully playable and
  MUST NOT block play.

### Originality

- **FR-053**: All names, copy, help text, layout, and visual assets MUST be original to this
  project and MUST NOT be copied from Futbol11 or any other puzzle site.
- **FR-054**: The product name and every addressable URL MUST NOT contain the prohibited
  comparison-game token.
- **FR-055**: All visual assets MUST be original, properly licensed, or generated in project. The
  image placeholder required by FR-029 is an in-project asset; no external image host may be
  hotlinked and no scraped artwork may be used.

### Out of Scope for v1

The following are explicitly excluded from v1 and MUST NOT be built: user accounts or any login,
server-side history or result storage, streaks, a bingo game separate from Match the Series,
impostor, pyramid, timed mode, an archive or browse view of past days, and any catalog editing or
catalog write of any kind. Favorites ranking is not used in v1 and may be considered later.

### Key Entities

- **Person**: a voice actor, identified by catalog id, with a display name and the count of voice
  role records attributed to them.
- **Character**: a character, identified by catalog id, with a display name, belonging to one or
  more anime.
- **Anime**: a series, identified by catalog id, with a title, type, year, and season.
- **Season**: an anime season identified by season and year together.
- **Voice role**: the link that attributes a person to a character in an anime, in a language, in
  a role.
- **Daily puzzle**: the stored, immutable set of inputs for one game on one UTC day: its round
  chain, its tile grids, or its group layout.
- **Grid tile**: one cell of the Match the Series three-by-three grid, showing one current-season
  series title, with a state of unclicked or green.
- **Clue card**: the single Match the Series card showing one character or voice actor, its name,
  and a neutral placeholder image area, whose entity belongs to exactly one grid tile's series.
- **Puzzle item**: one stored element of a daily puzzle, such as a pair in More or Less, a grid
  tile and its clue card in Match the Series, or a group's four tiles and its criterion.
- **Client result**: a won-or-lost end state held on the visitor's device, keyed by game and UTC
  day, with its attempt count, which is every answer given and correct or wrong, excluding attempts
  rejected as invalid.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All three games appear on the home page with a finished-today indicator, on both a
  phone-sized and a desktop-sized screen, in 100% of manual checks.
- **SC-002**: Two visitors opening the same game on the same UTC day, at any two times of day,
  see an identical puzzle in 100% of checks.
- **SC-003**: Today's finished result is shown on the home page after a page reload and after the
  browser is closed and reopened on the same UTC day, in 100% of checks.
- **SC-004**: A stored result from a previous UTC day is never shown as today's result, in 100%
  of checks.
- **SC-005**: In every manual pass of all three games, each reaches an explicit won or lost end
  state with no page reload and no blank or stuck screen.
- **SC-006**: In every finished game, the share text contains no answer, role count, pairing, or
  criterion, confirmed by inspection in 100% of checks.
- **SC-007**: An attempt naming a character or person that is absent from the day's puzzle is
  visibly rejected as invalid in 100% of attempts, and never silently ignored.
- **SC-008**: With the catalog unavailable, or on a day whose calendar season has no catalog
  coverage, the site shows a bilingual error state with a retry action in 100% of checks, and
  never a blank page or a silent substitution of an older season.
- **SC-009**: With the catalog unavailable and then restored, retry loads the puzzle successfully
  in 100% of checks.
- **SC-010**: No v1 screen displays any catalog fact outside the eight allowed facts, confirmed by
  inspection in 100% of checks.
- **SC-011**: Every visitor-facing string exists in both Spanish and English, with zero missing
  translations found in review.
- **SC-012**: The automated test suite for this feature contains at most 15 tests, covering home
  load, today's puzzle for each game, a valid attempt, an invalid attempt, the client's
  already-played-today state, and the database-not-responding error.
- **SC-013**: A visitor can reach and start any of the three games from the home page in at most
  three taps on a phone-sized screen.
- **SC-014**: No v1 page shows a studio, biography, favorites ranking, or external image, and no
  v1 page requests an image from any host other than the site's own.
- **SC-015**: Closing the tab mid-game and returning on the same UTC day resumes the same round or
  board position in 100% of checks, and no in-progress state is ever sent to the server.
- **SC-016**: Every wrong Groups proposal states how many of the four tiles belong to the same
  hidden group, in 100% of wrong proposals, and never names a group, its tiles, or its shared fact.
- **SC-017**: The site opens in the visitor's browser language when it is Spanish or English and in
  Spanish otherwise, and a switch made with the language control takes effect immediately and
  persists on later visits, in 100% of checks.
- **SC-018**: In Match the Series, no wrong click below the mistake limit reveals the correct
  series for that entity or any other pairing, in 100% of wrong clicks checked.
- **SC-019**: On a mid-range phone over a 4G connection, the home page shows all three games and a
  game page shows a playable puzzle in under 2 seconds in at least 95% of measurements, with no
  client-side loading step after the page appears.
- **SC-020**: In Match the Series, every clue card names an entity that belongs to exactly one of
  the grid's nine series, in 100% of cards checked, so no card has zero or more than one
  possible answer.
- **SC-021**: In Match the Series, pressing Next changes neither the attempt count nor the mistake
  count and never ends the game, in 100% of presses checked, and Next is disabled rather than
  repeating an already-answered entity.
- **SC-026**: In Match the Series, every wrong click below the mistake limit rotates the clue card
  to a different entity in 100% of wrong clicks checked, reveals no correct pairing, and leaves
  the abandoned entity available to be shown again later.
- **SC-022**: Every game screen offers a working control back to the home page, in 100% of game
  screens checked, while playing and after finishing, and leaving that way never loses the day's
  saved progress.
- **SC-023**: After the reset control is pressed, the same day's puzzle is served again unchanged
  and no stored puzzle was written or deleted, in 100% of resets checked.
- **SC-024**: No reset control appears anywhere while the site runs in production, confirmed by
  inspection in 100% of checks, so a finished game cannot be replayed today through it.
- **SC-025**: The home reset control clears all three games' saved state for the day in one
  action in 100% of activations, leaves the visitor's language choice intact, and is followed by
  the same three puzzles being served with no stored puzzle row written or deleted.

### Edge-Case Coverage

- **EC-001**: A day whose setup would duplicate an earlier day's setup is resolved to a different
  valid setup, or reported as an error state; it never silently reuses a previous setup.
- **EC-002**: A day whose calendar season has no catalog coverage, or fewer than nine series, is
  reported as a bilingual error state with retry. Match the Series never substitutes an older
  season and never shrinks the grid, and no game serves a short, unfair, or duplicated board.
- **EC-003**: A player in a timezone whose local date differs from the UTC date still receives the
  UTC day's puzzle and sees times in their own timezone.

---

## Out of Scope

- User accounts, login, or any server-side visitor record.
- Server-side history, statistics, or result storage.
- Streaks, a bingo game separate from Match the Series, impostor, pyramid, and timed mode.
- An archive or browse view of past days.
- Any edit or write to the catalog, including the import job tables.
- Favorites ranking in v1.
- Additional puzzle games beyond the three named here.

---

## Assumptions

- The catalog and its five read-only tables (`people`, `anime`, `characters`, `voice_roles`,
  `anime_seasons`) are already populated and owned by other systems.
- Identifiers from the catalog (for example the anime database id) are internal data references and
  never appear in visitor-facing text.
- The site is deployed to a public address reachable over HTTPS, with the database reachable only
  from the application's own service.
- Runtime configuration, including the database connection, is supplied by the environment and
  never committed.
- A new set of game tables is created by this app to hold puzzles; it does not alter the catalog.
- Timezone display is available to the browser's own internationalization facilities, so no
  hand-built offset table is needed.
- The device state store is a standard browser storage facility available in current mainstream
  browsers.
- Visitors arrive on a modern phone or desktop browser with a stable connection for the session;
  intermittent connectivity is handled by the retry behavior, not by offline play.
- Copy, help text, and visual design are written from scratch for this project.
- Every reset control, including the home control that clears all three games at once, is a
  development-only tool for retesting a day's puzzle; no production visitor can use one, so the
  finished-today result stays final for real play.
- Planned follow-ups that are not part of v1 may include favorites ranking, but no v1 requirement
  may depend on them.

## Dependencies

- The existing read-only anime catalog and its import pipeline, which this app never modifies.
- A new set of game-owned tables to persist daily puzzles, created by this app.
- The project's own service layer between the browser and the catalog.

## Resolved Decisions

Three points were open during drafting and have been decided, so no clarification markers remain:

- **Role count** (FR-023): a career role count is every voice role record attributed to the person.
- **Clue card images** (FR-029): the clue card shows the entity's name plus a neutral in-project
  placeholder, identical for every card; real artwork arrives later as a separate change that
  does not touch puzzle content or answers.
- **Current season** (FR-030, FR-038): the calendar season at play time in UTC, identified by
  season and year; no older-season substitution, no smaller grid, and an error state when the
  season has fewer than nine series.