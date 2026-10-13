# Feature Specification: Match the Series Seasonal Editions (Autumn, Spring, Summer 2026)

**Feature Branch**: `010-match-series-season-variants`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "The game Match the Series covers only the current season and that must be clear in the game name, so add the current season to the name (Autumn 2026). Also two more versions of the 'Match the Series' games should be available for the past seasons of the current year: Spring 2026 and Summer 2026."

## Overview

Match the Series is scoped to a single anime season: its grid shows series from one season only.
Until now that fact was hidden behind a generic name. This feature makes the season an explicit,
user-facing part of the game identity and adds two further Match the Series editions built on
past seasons of the current year.

After this feature, players see three distinct Match the Series editions on the home page:

1. **Match the Series — Autumn 2026** (the current season, formerly the unnamed "Match the Series").
2. **Match the Series — Spring 2026**.
3. **Match the Series — Summer 2026**.

Each edition keeps the existing Match the Series mechanics unchanged (three-by-three grid of nine
season series, eighteen clue cards, 90-second limit, unlimited mistakes, existing reveal and
result flow). Only the season the puzzle is drawn from, the game identity used throughout the app,
and the visible name differ.

## Vocabulary

| Term | Meaning |
|------|---------|
| Edition | One season-specific Match the Series game identity, including its fixed season and year |
| Current edition | The Autumn 2026 edition, which corresponds to the season the unnamed game covered before |
| Past-season edition | The Spring 2026 or Summer 2026 edition, drawn from an earlier season of the current year |
| Game identity | The key the app and storage use to distinguish one game from another (also used in routes and saved state) |
| Fixed season | The season and year an edition is permanently tied to; it does not change with the UTC date |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The three Match the Series editions are offered as separate games (Priority: P1)

A visitor opens the home page and sees all of today's games. Instead of one generic
"Match the Series", three clearly named editions are offered: Autumn 2026, Spring 2026, and
Summer 2026. Each card independently shows whether that edition is already finished on this
device today and can be opened to play.

**Why this priority**: The home page is the entry point and the first place the new multi-season
offering becomes visible. Without distinct, unambiguously named cards, the later editions cannot
be reached or understood.

**Independent Test**: Load the home page with no stored data. Three Match the Series cards appear,
each named with its season and year in the active language, alongside More or Less and Groups.
Markers for finished-today state are tracked separately per edition.

**Acceptance Scenarios**:

1. **Given** no stored result, **When** the visitor loads the home page, **Then** three Match the Series edition cards are shown (Autumn 2026, Spring 2026, Summer 2026), each with its season and year in its name.
2. **Given** a stored finished result for the Spring 2026 edition only, **When** the home page loads, **Then** only the Spring 2026 card is marked finished and the other two editions are not.
3. **Given** a stored result from the previous UTC day for an edition, **When** the home page loads, **Then** no edition is marked finished, because yesterday's result does not apply today.
4. **Given** a phone-sized screen, **When** the home page loads, **Then** all edition cards are readable and tappable without horizontal scrolling.

---

### User Story 2 - Play the Autumn 2026 edition (Priority: P1)

A visitor opens "Match the Series — Autumn 2026" and plays exactly the existing Match the Series
game, but every series on the grid belongs to the Autumn 2026 season. The visible season in the
game title and all copy matches the season its puzzle is drawn from.

**Why this priority**: This is the renamed current-season game. It must continue to work exactly
as before while making its season explicit; any regression here removes the main game.

**Independent Test**: Open the Autumn 2026 edition and confirm all grid series belong to Autumn
2026 and the game's mechanics, timer, and reveal behave as the current Match the Series game
does.

**Acceptance Scenarios**:

1. **Given** a fresh Autumn 2026 puzzle, **When** the edition loads, **Then** its title names Autumn 2026 and every grid series belongs to Autumn 2026.
2. **Given** an in-progress Autumn 2026 game, **When** the player answers clues, **Then** correct answers turn the correct series tile green and wrong answers leave the game in progress exactly as the existing Match the Series mechanic requires.
3. **Given** the Autumn 2026 game ends, **When** the reveal is shown, **Then** every clue is paired with a series from Autumn 2026.
4. **Given** an Autumn 2026 game ended by time-out, **When** the visitor returns to the home page, **Then** only the Autumn 2026 edition is marked finished for the day.

---

### User Story 3 - Play the Spring 2026 edition (Priority: P2)

A visitor opens "Match the Series — Spring 2026" and plays the same game mechanics, but the grid
and every revealed series come from the Spring 2026 season. Its puzzle is independent of the
Autumn 2026 edition and has its own per-day identity and saved state.

**Why this priority**: The first added past-season edition proves that a season the visitor is no
longer in can still be offered as a complete, playable game.

**Independent Test**: Open the Spring 2026 edition and complete a game end to end; all series come
from Spring 2026 and saving/finishing state is isolated from the Autumn 2026 edition.

**Acceptance Scenarios**:

1. **Given** a fresh Spring 2026 puzzle, **When** the edition loads, **Then** its title names Spring 2026 and every grid series belongs to Spring 2026.
2. **Given** the player has a finished Autumn 2026 result today, **When** they load the Spring 2026 edition, **Then** the Spring edition starts as unfinished and does not reuse the Autumn result.
3. **Given** all grid series are found before the timer ends, **When** the game resolves, **Then** it is recorded as a win only for the Spring 2026 edition's local state.

---

### User Story 4 - Play the Summer 2026 edition (Priority: P3)

A visitor opens "Match the Series — Summer 2026" and plays the same game mechanics with all series
drawn from the Summer 2026 season, independently of the other two editions.

**Why this priority**: Completes the requested trio of editions. It shares the same generic
behavior as the other past-season edition and mainly needs its own identity and saved state.

**Independent Test**: Open the Summer 2026 edition and confirm all grid series belong to Summer
2026 and the game is playable end to end.

**Acceptance Scenarios**:

1. **Given** a fresh Summer 2026 puzzle, **When** the edition loads, **Then** its title names Summer 2026 and every grid series belongs to Summer 2026.
2. **Given** a finished result for any other edition, **When** the Summer 2026 edition loads, **Then** it is unaffected and does not inherit that result.

---

### User Story 5 - An edition with insufficient catalog coverage is unavailable by itself (Priority: P3)

Each edition's availability is judged against its own fixed season. If a season lacks enough
matchable series, that edition shows the existing unavailable state, while the other editions and
games continue to work.

**Why this priority**: Seasons differ in catalog depth. An unavailable season must not turn the
whole home page or other editions into failures.

**Independent Test**: Make one edition's fixed season lack the required matchable-series count and
confirm only that edition is unavailable while the other editions and non-match games remain
playable or independently evaluated.

**Acceptance Scenarios**:

1. **Given** a fixed season with fewer than the required number of matchable series, **When** the edition's coverage is probed, **Then** that edition's status is unavailable.
2. **Given** one edition is unavailable, **When** the home page loads, **Then** the other editions and games still render their own status and the page does not fail as a total failure.
3. **Given** a coverage probe fails for one edition, **When** the home page loads, **Then** only that edition shows the database-unavailable state and the others remain usable.

---

### Edge Cases

- **Edition identity is independent of the UTC date**: a fixed season never changes because the
  clock moved; only the daily puzzle for that edition changes per UTC day.
- **Stale saved state from the old unnamed game**: progress stored under the previous generic
  game key does not map to any edition and must not raise an error or block play; it is ignored
  and the visitor starts an edition fresh. Resetting all games also discards it.
- **Cross-edition isolation**: finishing, resetting, sharing, timing, and pausing one edition has
  no effect on any other edition or on More or Less or Groups.
- **Catalog season naming**: if the catalog stores the Autumn season as "fall", the UI consistently
  presents it as "Autumn" in both supported languages; this does not change which catalog rows
  are selected.
- **Day rollover mid-play**: an edition's game follows the existing per-game day-rollover behavior;
  the fixed season does not alter which UTC day's puzzle is served.
- **Independent probed status**: one edition's unavailable or error state does not propagate to
  other editions or games.
- **Locale and timezone independence**: availability, season selection, puzzle content, and the
  90-second limit are unaffected by viewer locale, timezone, or device.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The home page MUST list five games: More or Less, Groups, and three Match the
  Series editions named Autumn 2026, Spring 2026, and Summer 2026. Each has its own card,
  status, finished-today marker, and play link. The home page MUST present the games in a
  grid layout suited to the larger number of games, and the Autumn 2026 edition MUST appear
  before the Spring 2026 and Summer 2026 editions.
- **FR-002**: The previously unnamed "Match the Series" game MUST no longer be offered as a
  separate game. All references to a season-less Match the Series game are replaced by the three
  editions.
- **FR-003**: Each edition's display name and short summary MUST include its season and year in
  both supported languages, and MUST NOT use an ambiguous season-less name such as "Match the
  Series" alone.
- **FR-004**: Each edition MUST be a distinct game identity, independently addressable by the
  existing daily API, route, and storage mechanisms used for other games.
- **FR-005**: Each edition MUST generate its daily puzzle using only its fixed season and year,
  regardless of the current UTC date, the viewer's locale, or the viewer's timezone.
- **FR-006**: An edition MUST NOT substitute a different season when its fixed season lacks
  enough data; it MUST surface the existing unavailable state instead (see FR-011).
- **FR-007**: All other Match the Series mechanics MUST remain unchanged for every edition:
  three-by-three grid, eighteen clues, ninety-second timer, unlimited mistakes, skip control,
  wrong-answer feedback, win and time-out reveals, and client-side result storage.
- **FR-008**: Availability (ready, unavailable, error) MUST be probed and reported independently
  per edition, using that edition's fixed season.
- **FR-009**: Saved results, timer state, progress, reset, and share behavior MUST be scoped to
  the edition's game identity; no state may bleed between editions or other games.
- **FR-010**: Reset scoped to one edition MUST clear only that edition's saved state; reset-all
  MUST clear every edition's state plus the other games' state.
- **FR-011**: When an edition's fixed season lacks the required number of matchable series, that
  edition MUST show the existing unavailable state, and MUST NOT blank or fail the whole page.
- **FR-012**: When a coverage probe fails for one edition, that edition MUST show the existing
  database-unavailable state; the other editions and games MUST remain usable.
- **FR-013**: All user-facing strings introduced for the editions (names, summaries, help text)
  MUST exist in both Spanish and English from the first commit, referenced through the message
  catalog.
- **FR-014**: The internal catalog season commonly stored as "fall" MUST be presented to players
  as "Autumn" consistently in both languages. This labeling change applies to the editions and
  MUST NOT change selection rules.
- **FR-015**: Stale saved state stored under the old season-less game key MUST NOT cause an error
  or block play; it is ignored by the editions and removed by reset-all.
- **FR-016**: Daily puzzle identity MUST remain one per edition per UTC day, with deterministic
  generation from game identity, day key, and fixed season. The fixed season is an explicit input,
  not derived at request time from the catalog or the UTC date.
- **FR-017**: Non-match games (More or Less, Groups) and their behavior MUST be unchanged by
  this feature.
- **FR-018**: All new and renamed game routes MUST follow the existing per-game route pattern so
  each edition is directly openable.

### Key Entities

- **Match the Series Edition**: A game identity defined by a fixed season and year (Autumn 2026,
  Spring 2026, Summer 2026). It owns its own daily puzzle, availability status, route, and
  saved client-side state, but reuses the Match the Series mechanics.
- **Edition Puzzle**: The daily puzzle for one edition: a three-by-three grid and an eighteen-card
  clue deck drawn only from the edition's fixed season, uniquely identified by edition and UTC
  day. It persists server-side as a stored puzzle like all other games.
- **Edition Availability**: The ready/unavailable/error status for one edition, derived solely from
  catalog coverage for that edition's fixed season.
- **Edition Result**: The client-side win or time-out outcome for one edition on one UTC day,
  used by the home marker and share summary and cleared by reset.
- **Season Label**: The user-facing season name shown in edition titles and summaries (Autumn,
  Spring, Summer), independent of any internal catalog value such as "fall".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The home page lists five games on 100% of loads, with exactly three Match the
  Series editions whose names include season and year in the active language.
- **SC-002**: Every Match the Series edition is playable end to end, and 100% of grid series and
  revealed answers in a finished game belong to that edition's fixed season.
- **SC-003**: Saved results, timers, and progress are isolated across the three editions with 0
  observed cross-edition bleed in play, home markers, sharing, or reset.
- **SC-004**: Each edition's availability is probed independently; 100% of unavailable or
  error cases affect only the affected edition, and the page never becomes a total failure
  because of one edition.
- **SC-005**: 100% of new and renamed user-facing strings exist in both Spanish and English,
  with 0 missing or untranslated strings.
- **SC-006**: Stale saved state under the old generic game key produces 0 errors or blocked
  pages; an edition starts as unfinished when such stale state exists.
- **SC-007**: More or Less and Groups show 0 behavioral regressions in their existing checks.
- **SC-008**: For any single edition, a fixed season is observed unchanged across different UTC
  dates, viewer locales, and timezones, with 0 variation.

## Assumptions

- The three editions are fixed to 2026 seasons. There is no automatic rollover to future years;
  offering future seasons requires a new feature or amendment.
- The Autumn 2026 edition is the renamed continuation of the season the unnamed Match the Series
  game always covered. It reuses the existing season-selection logic for the current season but
  presents it as a fixed, named season.
- Existing Match the Series mechanics and timing (including the 90-second timer) apply unchanged
  to every edition; this feature does not alter gameplay rules.
- The catalog stores the Autumn season at least in part as "fall"; the UI presents "Autumn" while
  selection still matches catalog rows by their stored value.
- Stale client state under the old generic game key is not migrated to any edition; the editions
  start fresh and reset-all discards the stale state.
- Additional dependencies, schema changes, or accounts are not required; editions are new game
  identities plus client-side naming and saved-state scoping, consistent with the stateless v1
  design. User-facing copy is fully translated before release.
