# Feature Specification: Responsive Home Game Catalog

**Feature Branch**: `011-home-game-catalog`

**Created**: 2026-10-24

**Status**: Draft

**Input**: User description: "The user should see all the available games in the home page with a responsive, intuitive and clean. Currently the game cards in the home screen all have different sizes, this cant happen, everything should be harmonic, all the cards same size, like futbol11.com. Also the cards should have a small image representing each game. Your are free to create them, but make it easy to replace them in a future. Remove the play button, clicking directly on the card should have that functionality. When i hover over with my mouse the card should change color. If the card is not clickable because it was played already also should have a different color, maybe greyed."

## Overview

The home page is the only place a visitor can discover every game the app offers. It currently
shows the five games as generic cards in a fixed-width container, and that presentation was
designed when the list was shorter and only desktop and tablet widths were supported. With three
Match the Series editions plus More or Less and Groups, the page must now work as a catalog:
every offered game is present, all cards share one uniform size, each card carries a small
representative image, and the presentation adapts cleanly from a phone to a wide desktop without
clipping or horizontal scrolling.

The cards themselves become the controls. A playable card opens its game when clicked or tapped
anywhere on the card, with no separate Play button. A card that cannot be played is visually
inactive: a game already finished today is greyed and clearly marked, while unavailable or errored
games explain their state and offer no action. Hovering a playable card changes its colour so the
whole card reads as one interactive surface.

This feature is about discovery, presentation, and entry only. It does not change any game's
rules, daily content, availability logic, routes, or saved results. The uniform sizing and
full-card interaction are the only qualities taken from the referenced site; the visual design and
all artwork remain original to Animatch.

## Vocabulary

| Term | Meaning |
|------|---------|
| Offered game | A game that is part of the app's catalog and therefore always belongs on the home page, whether or not it is playable right now |
| Game card | The home-page unit that represents exactly one offered game and, when playable, acts as the link into it |
| Game artwork | The small, original image shown on a card to represent its game |
| Playable card | A card for a game whose status is ready and which has not been finished today |
| Finished card | A card for a game that has a completed result stored on this device for the current UTC day |
| Inactive card | A card that cannot be opened: finished today, unavailable, or in error |
| Uniform card size | Every game card in the catalog has exactly the same width and height at a given viewport |
| Finished today | A playable game for which this device has stored a completed result for the current UTC day |
| Unavailable | The game is offered but cannot be played today because there is not enough catalog content for it |
| Listing failure | The home page could not retrieve the set of games or their statuses |
| Stable order | A fixed catalog order that does not change between loads, languages, statuses, or days |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every offered game appears on the home page (Priority: P1)

A visitor opens the home page and immediately sees the complete catalog: More or Less, the three
Match the Series editions (Autumn 2026, Spring 2026, and Summer 2026), and Groups. Each game
appears exactly once, in the same order every time, and no game is hidden because it is finished,
temporarily unavailable, or otherwise in a special state.

**Why this priority**: Discovery is the feature. A game that is missing from the home page cannot
be played at all, and an inconsistent or duplicated list makes the catalog untrustworthy.

**Independent Test**: Load the home page with no stored data, with mixed finished results, and with
one game unavailable or failing; in every case the same five games appear exactly once in the
same order.

**Acceptance Scenarios**:

1. **Given** a fresh visitor, **When** the home page loads, **Then** five game cards are shown: More or Less, Match the Series — Autumn 2026, Match the Series — Spring 2026, Match the Series — Summer 2026, and Groups.
2. **Given** the visitor has finished the Autumn 2026 edition today, **When** the home page loads, **Then** all five games are still listed and only the Autumn 2026 card shows the finished marker.
3. **Given** one game is unavailable or its status could not be determined, **When** the home page loads, **Then** that game still has a card and the other four games remain visible.
4. **Given** the visitor reloads the page, switches language, or returns on the next UTC day, **When** the list renders, **Then** the five games keep the same relative order.
5. **Given** a listing failure, **When** the home page loads, **Then** the visitor sees a clear failure state with a retry action instead of an empty or partially built game list.
6. **Given** the listing is still loading, **When** the page is shown, **Then** it communicates that the catalog is loading and never presents an empty "no games" message in the meantime.

---

### User Story 2 - Every card has the same size and a representative image (Priority: P1)

A visitor looks down the catalog and sees a harmonious set of cards: every card is exactly the
same width and height, every card carries a small image that represents its game, and the image,
name, description, and state occupy the same positions on every card. The set stays uniform and
readable on a phone, tablet, laptop, and wide desktop.

**Why this priority**: The unequal, text-driven cards are the specific defect reported. A catalog
where one card is taller or wider than another looks broken even when every game is present.

**Independent Test**: Load the home page in both languages at phone, tablet, laptop, and
wide-desktop sizes and measure every card: all five have identical width and height, every card
shows its artwork, and no text or image overflows its card.

**Acceptance Scenarios**:

1. **Given** the home page has loaded, **When** the visitor compares the five cards, **Then** all five have exactly the same width and height at that viewport.
2. **Given** any supported viewport, **When** the catalog renders, **Then** every card shows a small game image in the same position and at the same size relative to the card.
3. **Given** a game's artwork cannot be found or fails to load, **When** its card renders, **Then** a neutral placeholder keeps the card's size and layout unchanged.
4. **Given** the English or Spanish catalog, **When** the cards render, **Then** no name, description, or state text escapes its card or changes that card's dimensions relative to the others.
5. **Given** a wide desktop screen, **When** the catalog renders, **Then** the cards stay centered at a comfortable reading width instead of stretching across the whole window.
6. **Given** text is enlarged to 200%, **When** the catalog renders, **Then** the cards remain readable, keep equal dimensions, and the page does not scroll horizontally.

---

### User Story 3 - Clicking anywhere on a playable card starts the game (Priority: P2)

A visitor sees a playable game and clicks or taps anywhere on its card — image, title, description,
or empty space — and that game opens. There is no separate Play button. Hovering the card with a
mouse changes its colour, and the same visual emphasis appears when the card receives keyboard
focus, so the whole card reads as one interactive surface.

**Why this priority**: Removing the button and making the card itself the target is the requested
interaction model. It removes a small target and makes the catalog quicker to use.

**Independent Test**: Click and tap different areas of a playable card and confirm the correct game
always opens; hover and focus the card and confirm its surface colour changes; confirm no Play
button exists.

**Acceptance Scenarios**:

1. **Given** a playable card, **When** the visitor clicks its image, name, description, or empty area, **Then** the corresponding game opens.
2. **Given** a playable card, **When** the pointer hovers over any part of it, **Then** the card's surface colour changes and the pointer indicates that the card is clickable.
3. **Given** a playable card, **When** it receives keyboard focus, **Then** it shows a clearly visible focus treatment and pressing Enter or Space opens the game.
4. **Given** any card, **When** it is rendered, **Then** no separate Play button or other redundant per-card action is present.
5. **Given** a touch device without hover, **When** the visitor taps the card, **Then** the game opens without requiring a hover state first.

---

### User Story 4 - Inactive cards are unmistakable and never clickable (Priority: P2)

A visitor has already finished a game today, or a game is unavailable or failing. Its card stays in
the catalog but no longer invites interaction: a finished card is greyed and marked finished today,
and no card that cannot be opened responds to hover or clicks. Unavailable and errored cards show
their own explanation instead of pretending to be playable.

**Why this priority**: The catalog must not offer false affordances. Clicking a card that cannot
open anything is confusing, and a finished game must be visibly distinguished from a playable one.

**Independent Test**: Finish one game, make another unavailable, and force a third into error;
confirm the finished card is greyed and inert, each inactive card explains its state, and only the
remaining playable cards respond to hover and clicks.

**Acceptance Scenarios**:

1. **Given** a game was finished today, **When** the home page loads, **Then** its card is greyed, carries the finished-today marker, does not change colour on hover, and does not navigate when clicked.
2. **Given** a game is unavailable, **When** the home page loads, **Then** its card is visually inactive, explains that it is unavailable today, and does not navigate.
3. **Given** a game's status is in error, **When** the home page loads, **Then** its card is visually inactive, states that it could not be loaded, and does not navigate while the remaining games stay usable.
4. **Given** a finished game today, **When** the visitor returns to the home page after playing, **Then** the card is already greyed and marked without a manual reload.
5. **Given** a previous UTC day's saved result, **When** the home page loads, **Then** the card is not greyed, not marked finished, and remains playable.
6. **Given** a keyboard user, **When** they tab through the catalog, **Then** only playable cards receive focus and inactive cards are skipped.

---

### User Story 5 - The catalog stays consistent with the rest of the app (Priority: P3)

The home page keeps the daily context and controls visitors already rely on: the reset countdown,
the language control, and the development-only reset tool. Switching language updates the whole
catalog immediately, and light and dark display modes remain legible.

**Why this priority**: The catalog should feel like the same product as the game screens. Losing
the countdown or language control, or leaving text unreadable in one display mode, would make the
new layout feel like a separate page.

**Independent Test**: Switch languages with the catalog open, verify every card updates without a
reload, and inspect the page in light and dark modes with text enlarged.

**Acceptance Scenarios**:

1. **Given** the home page is open in English, **When** the visitor switches to Spanish, **Then** every game name, description, state message, and accessible label updates immediately without a page reload.
2. **Given** either supported language, **When** the page renders at any supported width, **Then** no translated string is missing, truncated, or replaced by a fallback.
3. **Given** light or dark display mode, **When** the page renders, **Then** card surfaces, text, state messages, hover, and focus treatments keep readable contrast and remain distinguishable.
4. **Given** the development build, **When** the home page loads, **Then** the development reset control remains available and does not crowd or overflow the catalog at narrow widths.

---

### Edge Cases

- **One game left in the last row**: the remaining cards keep the same dimensions as the cards above; no card stretches to fill the empty slot.
- **Mixed states**: finished, unavailable, errored, and playable cards coexist; each shows only its own state and the playable ones remain interactive.
- **All games unavailable or failing**: the page presents a coherent catalog with per-card explanations; it does not blank out or show a contradictory empty state.
- **Listing failure**: a single page-level failure message with a retry action replaces the list; retrying restores the full catalog.
- **Loading**: the page communicates loading and never flashes an empty catalog.
- **Card artwork missing, renamed, or broken**: the card shows a neutral placeholder with identical dimensions; the catalog never collapses or shows a broken-image icon.
- **Card artwork replaced later**: swapping the file for a game changes the card image without changing the card markup, behavior, or layout.
- **Unusually shaped replacement artwork**: the image is fitted inside its fixed area without changing the card's size or pushing text out.
- **Long translated names and descriptions**: text wraps inside the uniform card; no card grows relative to another and no text overlaps the image or state.
- **Very narrow phone**: cards stack in one column and remain tappable; the page scrolls vertically to every card.
- **Very short landscape window**: the last card is reachable by scrolling and is not trapped behind fixed chrome.
- **Text zoom and large fonts**: cards grow their content area uniformly; the page never gains a horizontal scrollbar.
- **Touch with no hover**: a tap opens the game directly; no hover state is required.
- **Hover on a finished card**: no colour change occurs and the pointer does not suggest a link.
- **Keyboard focus on an inactive card**: inactive cards are not focusable and cannot be activated.
- **Assistive technology**: the artwork is decorative, the game name is the link's accessible name, and the finished or unavailable state is announced as text.
- **Reduced motion preference**: hover and focus colour changes do not animate when motion is reduced.
- **Day rollover while the page is open**: the next reload reflects the new day's markers and countdown; yesterday's finished markers are not shown as today's.
- **Adding a future game**: the catalog accommodates an additional card and its artwork without a structural redesign.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The home page MUST display every offered game as its own card, exactly once: More or Less, Match the Series — Autumn 2026, Match the Series — Spring 2026, Match the Series — Summer 2026, and Groups.
- **FR-002**: The catalog MUST use a stable order with the three Match the Series editions adjacent and in the order Autumn 2026, Spring 2026, Summer 2026; More or Less and Groups MUST each appear once. The order MUST NOT change between loads, languages, statuses, finished states, or UTC days.
- **FR-003**: A game's card MUST remain present when the game is finished today, unavailable, or in error; playability MUST NOT determine whether the game is listed.
- **FR-004**: Every card at a given viewport MUST have exactly the same width and height as every other card in the catalog, including cards in a different row.
- **FR-005**: Every card MUST use the same internal layout: game artwork, name, description, and state in the same positions, with the artwork occupying the same proportional area on every card.
- **FR-006**: Every card MUST show a small, original image that represents its game. The artwork MUST be shipped with the app and MUST NOT depend on an external host.
- **FR-007**: Game artwork MUST use one stable location and naming convention per game, so replacing an image later requires only replacing that game's file and no change to card markup or behavior.
- **FR-008**: If a game's artwork is missing or fails to load, the card MUST show a neutral placeholder of the same size and MUST NOT show a broken-image indicator or change the card layout.
- **FR-009**: Each card MUST show the game's display name, its one-sentence description, its artwork, and its current state.
- **FR-010**: A playable card MUST be a single activation target for its game, operable by clicking or tapping anywhere on the card; there MUST be no separate Play button.
- **FR-011**: A playable card MUST present a visible hover colour change on devices with a pointer, and the pointer MUST indicate that the card is clickable.
- **FR-012**: A playable card MUST receive keyboard focus in visual order, MUST show a clearly visible focus treatment equivalent to the hover emphasis, and MUST open the game on Enter or Space.
- **FR-013**: The full card MUST be at least 44 by 44 pixels at every supported viewport.
- **FR-014**: A finished card MUST be greyed or otherwise visibly muted, MUST show the finished-today marker, MUST NOT change colour on hover, and MUST NOT navigate when clicked or tapped.
- **FR-015**: An unavailable card MUST be visually inactive, MUST explain that the game is unavailable today, and MUST NOT navigate.
- **FR-016**: An errored card MUST be visually inactive, MUST state that the game could not be loaded, and MUST NOT navigate; other games MUST remain usable.
- **FR-017**: Inactive cards MUST NOT receive keyboard focus and MUST NOT be announced as links.
- **FR-018**: Each card's state MUST be independent: finishing, failing, or marking one game MUST NOT change another game's card.
- **FR-019**: A card MUST show the finished-today marker when, and only when, this device holds a completed result for that game on the current UTC day.
- **FR-020**: After returning from a completed game, the home page MUST reflect the new finished state without requiring a manual reload.
- **FR-021**: The catalog MUST reflow responsively: one column at narrow phone widths, two or more aligned columns at tablet and desktop widths, and a centered, bounded content width on very wide screens.
- **FR-022**: At every window width from 320 to 1920 pixels, the home page MUST NOT scroll horizontally, and no card, artwork, text, control, or decoration may extend beyond the window's horizontal edges.
- **FR-023**: Vertical page scrolling MUST be permitted on the home page when the catalog does not fit; every card MUST be reachable by vertical scrolling, and the catalog MUST NOT be split into independently scrolling regions.
- **FR-024**: Names, descriptions, and state messages MUST wrap inside their card rather than being clipped or overflowing; no text may escape the uniform card frame.
- **FR-025**: At 200% text zoom, all catalog content MUST remain readable, cards MUST keep equal dimensions, and the page MUST continue to avoid horizontal scrolling.
- **FR-026**: All catalog strings (names, descriptions, state messages, accessible labels) MUST exist in both Spanish and English and MUST display without missing or fallback text.
- **FR-027**: The catalog MUST remain legible in light and dark display modes, with normal text meeting a contrast ratio of at least 4.5:1 against its background and hover, focus, finished, unavailable, and error states remaining distinguishable.
- **FR-028**: Hover and focus emphasis MUST NOT rely on colour alone; the focus treatment MUST be visible independently of the colour change, and motion MUST respect the visitor's reduced-motion preference.
- **FR-029**: The artwork MUST be decorative for assistive technology, while the card's game name and state MUST be announced as text.
- **FR-030**: The home page MUST retain the reset countdown and the language control; switching language MUST update every user-facing catalog string immediately without a full page reload.
- **FR-031**: While the listing is loading, the page MUST communicate that state and MUST NOT briefly present an empty "no games" message.
- **FR-032**: If the listing as a whole fails, the page MUST show a clear failure message and a retry action; retrying MUST attempt to load the full catalog again.
- **FR-033**: The development-only reset control MUST remain available in development builds and MUST NOT cause overflow or overlap at narrow widths; it MUST remain absent from production builds.
- **FR-034**: The feature MUST NOT add, remove, or rename games, change game routes, alter daily content or availability rules, modify gameplay, or change saved results and sharing behavior.
- **FR-035**: The catalog layout MUST accommodate one additional future game and its artwork using the same card pattern without a structural redesign.
- **FR-036**: The feature MUST NOT introduce external fonts, scripts, or hotlinked images, and MUST NOT copy branding, copy, layout, or assets from another puzzle site.
- **FR-037**: The feature MUST NOT add a new runtime or development dependency.

### Key Entities

- **Game Catalog Entry**: One offered game as presented on the home page. It carries the game's identity, display name, one-sentence description, artwork reference, state, primary target route, and presentation order.
- **Game Artwork**: The original image associated with one game. It has a stable per-game location, a fixed display area on the card, decorative meaning, and a neutral fallback when unavailable.
- **Home Listing**: The set of catalog entries shown on one load, together with the current UTC day and each game's availability status.
- **Game Availability State**: The per-game condition shown on the card: ready, unavailable, or error. It never removes the game from the catalog.
- **Device Game Result**: The completed outcome stored on this device for one game on one UTC day; it determines whether that game's card is finished and inactive.
- **Catalog Order**: The fixed sequence in which games are presented; it is part of the catalog's identity and is independent of status, language, and day.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of home-page loads in every state (fresh, mixed, unavailable, and errored) show all five offered games exactly once, with 0 missing or duplicated games.
- **SC-002**: At each tested viewport, all five cards have identical width and height, with 0 pixels of difference between any two cards.
- **SC-003**: 100% of cards display game artwork, with 0 cards showing a broken-image indicator; all five current games use distinct images.
- **SC-004**: Replacing one game's artwork file changes that card's image with 0 changes to card markup, behavior, or layout.
- **SC-005**: At window widths from 320 to 1920 pixels, the home page shows 0 horizontal scrollbars and 0 elements extending past the window edges, in both languages.
- **SC-006**: At the tested phone, tablet, laptop, and wide-desktop sizes, every card is reachable and fully readable, with 0 clipped text or images.
- **SC-007**: 100% of playable cards open the correct game from a click or tap anywhere on the card; 0 separate Play buttons exist.
- **SC-008**: 100% of playable cards change surface colour on hover and show a clickable pointer; 100% of finished cards show no hover change and no clickable pointer.
- **SC-009**: 100% of finished cards are visibly greyed and marked finished today; 0 finished cards navigate when clicked.
- **SC-010**: 100% of keyboard-only checks reach and activate every playable card in visual order with visible focus, and inactive cards receive 0 focus stops.
- **SC-011**: The finished-today marker matches the stored result for that game and UTC day in 100% of tested combinations, with 0 cross-game or stale-day markers.
- **SC-012**: Per-card unavailable and error states affect only their own cards in 100% of cases; no single game problem hides or disables another game, and a total listing failure always presents a retry action.
- **SC-013**: 0 missing translations or fallback strings appear in either language, and 0 text elements are clipped at any supported width.
- **SC-014**: At 200% text zoom, the page shows 0 horizontal scrollbars and all catalog content remains readable with cards still equal in size.
- **SC-015**: Normal text and interactive states meet at least a 4.5:1 contrast ratio in both light and dark display modes, and focus remains visible without relying on colour alone.
- **SC-016**: Returning from a completed game updates that game's finished state on the first home-page render, with 0 manual refreshes required.
- **SC-017**: At 1920x1080, the page header, the full catalog of five cards, and the reset countdown are visible without vertical scrolling, in both languages.
- **SC-018**: In a first-use check with 10 visitors, at least 9 can locate and open a named game from the home page within 10 seconds without assistance.
- **SC-019**: Existing game behavior, routes, daily content, availability rules, saved results, and sharing show 0 regressions.

## Assumptions

- **"Available games" means all games the app offers, not only games that are playable at this moment.** Unavailable and errored games stay in the catalog with an explanation, because hiding them would make the list inconsistent and could conceal a temporarily broken game.
- **"Same size" means identical width and height for all five cards at any given viewport.** Card dimensions may change between breakpoints, but never between cards at the same breakpoint.
- The referenced site is used only as a general example of uniform card sizing and a clickable card surface. No branding, copy, layout, or artwork is copied from it, consistent with the project constitution.
- The catalog currently consists of More or Less, Groups, and the three fixed Match the Series editions. This feature does not introduce a new game.
- The catalog order is More or Less, Match the Series — Autumn 2026, Spring 2026, Summer 2026, then Groups, preserving the existing order while keeping the three editions adjacent. Status and finished state never reorder the list.
- The five game images are original, text-free artwork created and stored within this project. The initial images can be simple symbolic illustrations; their exact style is not contractual, but their per-game location is.
- A future replacement image may be supplied in the same file location; the card frame fits it without changing dimensions, and a neutral placeholder covers missing or failed images.
- Supporting phone widths from 320 pixels upward is in scope. Vertical scrolling on the home page is accepted when content exceeds the window, while horizontal scrolling remains forbidden.
- At 1920x1080, the full catalog fits without vertical scrolling, preserving the existing large-screen expectation.
- The existing visual language (typography, spacing tokens, rounded surfaces) is reused; the new work is the uniform card frame, interaction states, and game artwork.
- Finished markers continue to come only from results saved on this device for the current UTC day; no account, server-side history, or cross-device synchronization is introduced.
- The reset countdown remains display-only and UTC-based; this feature does not change rollover behavior or time handling.
- The development reset control remains a development-only tool and is out of scope for production visitors.
- The daily listing and game routes already provide all data needed for the catalog; this feature changes presentation and interaction, not the underlying daily content.
- No new runtime or development dependency is needed; the card layout, interaction states, and artwork are implemented with the existing stack.
