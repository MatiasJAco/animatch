# Feature Specification: Game Screen Mascot

**Feature Branch**: `014-game-mascot`

**Created**: 2026-11-14

**Status**: Draft

**Input**: User description: "Show the mascot on the game screens too, exactly as it appears on the home page: the same mascot, at the same size and in the same corner at every viewport width."

## Overview

The home page gives the app its face: Matchi, the mascot, stands in the bottom inline-end corner of the viewport while the visitor browses the catalog. The moment the visitor opens a game, the character disappears — and the game screen, which is where the visitor actually spends their time, is the one place in the product with no personality at all.

This feature puts the mascot back on the game screens. The request is explicit about what "back" means: the same mascot, at the same size, in the same corner, at every viewport width. This is therefore not a redesign of the mascot. The home page already settled how the character looks, how big it is at each viewport width, which corner it occupies, and what happens when its file fails to load. This feature reuses that settled presentation unchanged and extends its coverage from the home screen to every game screen.

Because the size and the corner are fixed by the request, the feature inherits the home screen's trade-off with one addition: on narrow viewports, where a game's content column reaches the edge of the window, the mascot floats over the board's bottom inline-end corner exactly as it floats over the catalog's card column on the home page. The mascot never intercepts a click, never changes the board's layout, never adds a scrollbar, and never removes, hides or truncates text — "remove, hide or truncate" means changing the text or taking it out of the layout. What it may do is visually cover board content: tile artwork, labels, counts, the More/Fewer buttons and the status copy are all fair game, as long as every control beneath the mascot still answers clicks and taps and the player can scroll the content out from under it. That overlap is recorded as a known limitation rather than engineered away. At viewport widths of 1024 pixels and wider, where the game's content column is narrower than the home page's, the mascot stands entirely clear of the board.

This feature is presentation only. It adds no game, no route, no daily content, no saved state, and no text. It changes no rule of any game.

It also supersedes one requirement of the previous feature. Feature 013's FR-011 — "the mascot MUST appear on the home page only; game screens MUST keep their current presentation" — limited the mascot to the home screen; this feature replaces that limitation and leaves every other requirement of feature 013 in force, including the home page's own mascot contract, the mascot asset's budget, and the mascot's decorative, still, non-interfering behaviour. Feature 013's contract file, `specs/013-home-artwork/contracts/home-mascot.md`, is updated to point at this supersession. "Unchanged" throughout this spec means unchanged for the visitor: the home screen keeps the same rendered size, the same corner, the same behaviour and the same file, with 0 differences (SC-012). Sharing one mascot component between the home screen and the game screens, and renaming the mascot's markup, class names and test hooks, are internal changes that no visitor can see and do not count as a change.

## Vocabulary

| Term | Meaning |
|------|---------|
| Mascot | The Matchi character illustration, shown as a persistent decorative element anchored to the bottom inline-end corner of the viewport |
| Home screen | The catalog screen at `/`, where the visitor picks a game |
| Game screen | One of the five playable screens: More or Less, Groups, and the Spring 2026, Summer 2026 and Autumn 2026 editions of Match the Series |
| Mascot presentation | The already-settled way the mascot is rendered on the home screen: one asset, one size rule, one corner, one failure behaviour |
| Size rule | The rule that fixes the mascot's rendered size as a function of the viewport, set per viewport band |
| Viewport band | The width ranges at which the size rule differs. The boundary between them is at 1024 pixels and does not change in this feature |
| Content column | The centered column the screen's content is laid out in: wider on the home screen, narrower on the game screens |
| Clearance | The property that the mascot never blocks a control from responding and never traps the content it covers: every control beneath it still answers clicks and taps, and covered content can be scrolled out from under it |
| Visual cover | The mascot's image overlapping board content without changing that content: the content stays in the layout, unchanged, and remains reachable by scrolling |
| Known limitation | An outcome the project owner has accepted and that is recorded here rather than engineered away |

## Clarifications

### Session 2026-11-14

- Q: The request fixes the mascot's size and corner at every viewport width. On a narrow viewport a game's content column reaches the edge of the window, so a mascot pinned to that corner must overlap the board — the same way it overlaps the catalog's card column on the home page. Is that overlap acceptable, or must the mascot be shrunk, hidden, or given reserved space on game screens? → A: The overlap is accepted. The mascot keeps the home page's exact size and corner on every game screen at every viewport width; it is never resized, hidden, or given space to move the board. The overlap is confined to the board's bottom inline-end region, leaves every control operable, changes no layout, and is recorded as a known limitation of this feature. The reasoning: the request's whole point is that the mascot looks the same everywhere, and a mascot that changes size depending on the page is not the same mascot.
- Q: Which screens count as "the game screens"? → A: The five playable screens — More or Less, Groups, and the three Match the Series editions — in every state they can be in, including the loading state, the finished state and the puzzle-unavailable error state. The app's own error page is not a game screen and keeps its current presentation, as does the home screen's existing behaviour.
- Q: Does the mascot change the home screen in any way? → A: No. The home screen's mascot is untouched in asset, size, corner and behaviour. This feature only adds coverage.
- Q: Which board content may the mascot visually cover on a narrow viewport? → A: Any board content — tile artwork, labels, counts, the More/Fewer buttons and the status copy — as long as every control beneath the mascot still answers clicks and taps and the player can scroll the content out from under it. The overlap stays a recorded known limitation and is never resolved by changing the mascot's size or its corner.
- Q: In FR-014, what does "MUST NOT remove, hide or truncate any text" mean, and may the mascot cover the bottom status and help copy? → A: "Remove, hide or truncate" means changing the text or taking it out of the layout, not covering it. The mascot may visually cover the trailing edge of the bottom status and help copy, so FR-014 is reworded to say "visually cover" explicitly and to agree with the Overview.
- Q: Must "legible in both light and dark display modes" become a numeric contrast target? → A: No. FR-019 stays checkable as it is: the mascot shows no opaque background against the dark surface and stays the same drawing in both display modes. "Legible" is not turned into a numeric contrast target and no automated check asserts one.
- Q: How is the feature's behaviour proven against the constitution's cap of 15 tests? → A: Every outcome about the mascot's presence, size, corner, overlap and failure behaviour is proven automatically, with a few tests that loop over the screens, viewports and states so the feature stays inside the cap; the rest is covered by the existing game checks re-run with the mascot present.
- Q: What does "unchanged" mean for the home screen, and may the implementation share one mascot component across screens? → A: "Unchanged" means the visitor-visible result: identical rendered size, corner, behaviour and file on the home page (SC-012, 0 differences). The implementation may share one mascot component across screens and rename the mascot's markup, class names and test hooks, and feature 013's contract file `specs/013-home-artwork/contracts/home-mascot.md` is updated to point at this feature's supersession.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The character stays with the player through the whole game (Priority: P1)

A visitor opens More or Less from the catalog and Matchi is there, in the bottom inline-end corner of the screen, exactly where it was on the catalog page and exactly as big. They answer a round, they get it wrong, they play on, they reach the end of the game: the character is still in the corner, unmoved and unchanged. They scroll the game screen down to read the how-to-play copy and Matchi stays with them. They widen the window and Matchi re-anchors to the new corner.

**Why this priority**: This is the request itself. A mascot that appears on the catalog and then vanishes when the game starts is a mascot that is absent exactly where the visitor is looking.

**Independent Test**: Open each of the five game screens at the phone, tablet, laptop and wide-desktop sizes; at each size confirm Matchi is visible at the bottom inline-end corner of the viewport at the same size it has on the home screen at that size, that it stays in place while the page scrolls, and that it re-anchors when the window is resized.

**Acceptance Scenarios**:

1. **Given** a visitor opens any of the five game screens, **When** the screen renders, **Then** the mascot is visible at the bottom inline-end corner of the viewport, at the same size it has on the home screen at that viewport width.
2. **Given** the visitor scrolls the game screen, **When** the viewport is inspected, **Then** the mascot is still at the same place in the viewport, unchanged in size and position.
3. **Given** the window is resized while the game is open, **When** the screen re-renders, **Then** the mascot is still anchored to the bottom inline-end corner of the new viewport.
4. **Given** the game reaches its end and the result appears, **When** the result is displayed, **Then** the mascot is still present, at the same size and in the same corner.
5. **Given** the game's puzzle cannot be loaded, **When** the error state is displayed, **Then** the mascot is still present, at the same size and in the same corner.

---

### User Story 2 - It is the same mascot, not a lookalike (Priority: P1)

A visitor who knows the home page sees the same character on the game screen: the same drawing, the same proportions, the same size at the same window width, in the same corner. There is no second image file, no alternate pose, and no per-screen variant, so the character never looks like it changed shape between screens.

**Why this priority**: "The same mascot" is the requirement, not merely "a mascot". A second asset or a re-derived size would break the continuity the request is asking for.

**Independent Test**: Measure the mascot's rendered box on the home screen and on each of the five game screens at the same viewport width, and compare the image the browser loads in each case.

**Acceptance Scenarios**:

1. **Given** the home screen and a game screen open at the same viewport width, **When** the mascot is measured on each, **Then** both measure the same width and the same height, within one pixel.
2. **Given** the home screen and a game screen open at the same viewport width, **When** the mascot's image is inspected, **Then** both load the identical image file.
3. **Given** the home screen and a game screen open at the same viewport width, **When** the mascot's corners are measured, **Then** its inline-end edge and its block-end edge coincide with the viewport's on both screens, within one pixel.
4. **Given** a visitor switches language mid-game, **When** the screen updates, **Then** the mascot is unchanged, and no new text appears anywhere.

---

### User Story 3 - The mascot never gets in the way of playing (Priority: P2)

The mascot is decoration, and it behaves like it. A visitor taps the tile that sits under the character and the tile responds. The board is exactly where it was before the character arrived. The page never gains a sideways scrollbar. A keyboard-only visitor tabs through the game and never lands on the character. If the mascot's file fails to load, the game plays exactly as it did before — no broken-image icon, no empty corner, nothing to report.

**Why this priority**: A mascot that blocks a tile or shifts the board is worse than no mascot. The character earns its place on the game screen only by being harmless.

**Independent Test**: With the mascot on a game screen, tap every control that lies under it, tab through the screen, resize the window from 320 to 1920 pixels, and block the mascot's image request and reload.

**Acceptance Scenarios**:

1. **Given** a control lies beneath the mascot's region, **When** the visitor clicks or taps it, **Then** the control responds as it does without the mascot.
2. **Given** the game screen is open, **When** the window width changes from 320 to 1920 pixels, **Then** the page never shows a horizontal scrollbar and nothing extends past the window's horizontal edges.
3. **Given** a keyboard-only visitor tabs through the game screen, **When** they tab, **Then** the mascot takes no focus stop.
4. **Given** the mascot's image fails to load, **When** the game screen renders, **Then** the game is fully playable, no broken-image indicator appears, and no placeholder image is requested.
5. **Given** the game screen is open, **When** the board's geometry and the page's scroll behaviour are measured with and without the mascot, **Then** they are identical.
6. **Given** the mascot visually covers board content on a narrow viewport, **When** the visitor scrolls the screen, **Then** the covered content is scrolled out from under the mascot and every control there still answers clicks and taps.

---

### User Story 4 - The games themselves are untouched (Priority: P3)

Nothing about how the games work changes: the same five routes, the same daily puzzles, the same rules, the same scoring, the same saved results, the same sharing, the same reset. The board still sits first under the header, the board still grows the way it grew, and the header still lines up the way it did. The character is an addition to the screen, not a change to it.

**Why this priority**: The mascot is an enhancement. If it comes at the cost of a game's behaviour or layout contract, the trade is bad.

**Independent Test**: Run the existing game-screen checks for board-first order, header alignment, board growth, horizontal overflow, both locales and the finished states, with the mascot present.

**Acceptance Scenarios**:

1. **Given** the game screens, **When** the existing board-first and viewport-fit checks run with the mascot present, **Then** they pass unchanged.
2. **Given** the app's routes, **When** they are listed, **Then** the same routes exist as before, and no route is added, removed or renamed.
3. **Given** a visitor plays and finishes a game, **When** the result is saved, **Then** the saved result, the share output and the reset behaviour are identical to before.
4. **Given** the daily content rolls over at midnight UTC, **When** the new day's puzzle is served, **Then** the games behave exactly as they did before.

---

### Edge Cases

- **The window is narrower than the mascot**: the mascot scales down with the viewport, exactly as it does on the home screen, and stays entirely inside the window.
- **The game screen scrolls vertically**: the mascot does not move relative to the viewport.
- **The window is resized while the game is open and scrolled**: the mascot re-anchors to the bottom inline-end corner of the new viewport.
- **The visitor enlarges text to 200%**: the mascot's size is set by the viewport, not by the text, so it does not scale with the text; it stays inside the viewport and the page still shows no horizontal scrollbar. **Known limitation carried over from feature 013**: below roughly 1024 pixels the mascot overlaps text at this zoom, and that overlap is accepted.
- **A control lies under the mascot**: the control still responds; the mascot never intercepts the pointer or the touch.
- **The mascot visually covers board content on a narrow viewport**: any board content may be covered — tile artwork, labels, counts, the More/Fewer buttons and the status copy — as long as every control there still answers clicks and taps and the content is scrolled out from under the mascot.
- **The mascot's file is missing or fails to decode**: the game screen is unaffected and no broken-image indicator appears.
- **The mascot's file is slow to load**: the screen renders and behaves as if the mascot were absent, with no broken-image indicator and no visible layout shift.
- **The game ends and the result panel replaces the board**: the mascot stays in its corner, unchanged.
- **The game's puzzle cannot be loaded and the error state with its retry is shown**: the mascot stays in its corner and does not interfere with the retry.
- **The visitor switches language mid-game**: the mascot does not change, and no new text appears.
- **The page is in dark display mode**: the mascot shows no opaque background against the dark surface, and it is the same drawing in both display modes; no contrast ratio is specified or asserted.
- **The visitor prefers reduced motion**: the mascot behaves exactly as it does for every other visitor, because it never animates.
- **A future game is added to the app**: it carries the mascot by default, without a separate decision per game.
- **The UTC day rolls over**: the mascot does not change.
- **The home screen is open**: it is unchanged for the visitor — same mascot file, same rendered size, same corner, same behaviour, 0 differences.

## Requirements *(mandatory)*

### Functional Requirements

#### Mascot presence

- **FR-001**: Every game screen MUST display the mascot: More or Less, Groups, and each of the three Match the Series editions.
- **FR-002**: The mascot MUST be present on a game screen in every state the screen can be in, including the loading state, the playing state, the finished state and the puzzle-unavailable error state.
- **FR-003**: The game screens MUST show the same mascot as the home screen: the identical image file, with no variant, no alternate pose and no per-screen artwork.
- **FR-004**: The mascot MUST NOT appear on the app's error page, and MUST NOT appear on any screen other than the home screen and the five game screens.
- **FR-005**: The home screen MUST NOT change in any respect a visitor can see as a result of this feature: its mascot's rendered size, its corner, its behaviour and its file MUST be exactly as they are before this feature. The implementation MAY share a single mascot component between the home screen and the game screens, and MAY rename the mascot's markup, class names and test hooks, as long as the visitor-visible result on the home page is unchanged.

#### Size and placement

- **FR-006**: The mascot's size on a game screen MUST be identical to its size on the home screen at the same viewport width: the rendered box's width and its height MUST each match within one pixel.
- **FR-007**: The game screens MUST use the home screen's size rule unchanged. There MUST NOT be a second size rule for the game screens, and the size rule MUST NOT be re-derived from a game screen's own content width.
- **FR-008**: The mascot MUST be anchored to the same corner of the viewport on every screen: its inline-end edge and its block-end edge MUST coincide with the viewport's, within one pixel.
- **FR-009**: The size rule's boundary between viewport bands, at 1024 pixels, MUST remain unchanged.
- **FR-010**: The mascot MUST remain entirely inside the viewport at every supported width, and MUST NOT occupy more than 35% of the viewport's width or 55% of its height.
- **FR-011**: The mascot MUST NOT move relative to the viewport while the visitor scrolls a game screen, and MUST re-anchor to the new viewport when the window is resized.
- **FR-012**: The mascot MUST float over the screen and MUST NOT reserve layout space.

#### Non-interference with play

- **FR-013**: At viewport widths of 1024 pixels and wider, the mascot MUST NOT overlap the game screen's content column at all, because the game screen's column is narrower than the home screen's at those widths.
- **FR-014**: At viewport widths below 1024 pixels, the mascot MAY visually cover the board's bottom inline-end region, exactly as it overlaps the catalog's card column on the home page. It MAY visually cover any board content there — tile artwork, labels, counts, the More/Fewer buttons and the status copy — provided that every tile, button and link beneath it still answers clicks and taps, and provided the covered content can be scrolled out from under the mascot. The mascot MUST NOT change the board's layout, MUST NOT add a scrollbar, and MUST NOT remove, hide or truncate any text; "remove, hide or truncate" means changing the text or taking it out of the layout, not covering it. The overlap is recorded as a known limitation and MUST NOT be resolved by changing the mascot's size or its corner.
- **FR-015**: The mascot MUST NOT intercept pointer or touch input. Every tile, button, link and control beneath the mascot's region MUST remain clickable and tappable, and the content beneath the mascot MUST be able to be scrolled out from under it.
- **FR-016**: The mascot MUST NOT produce a horizontal scrollbar at any window width from 320 to 1920 pixels, and MUST NOT extend beyond the window's horizontal edges.
- **FR-017**: The mascot's presence MUST NOT change the game screens' board geometry, header geometry, action positions, or scroll behaviour by any measurable amount.

#### Accessibility and behaviour

- **FR-018**: The mascot MUST be decorative: it MUST convey no information that is not otherwise available as text, MUST be ignored by assistive technology, and MUST NOT introduce a new focusable element or tab stop.
- **FR-019**: The mascot MUST show no opaque background against the dark surface, and the same drawing MUST be presented in both light and dark display modes. "Legible" is not a numeric contrast target: no contrast ratio is specified for the mascot, and no automated check asserts one.
- **FR-020**: The mascot MUST be a still image and MUST NOT animate, at any time, for any visitor; in particular it MUST NOT animate while the visitor's system requests reduced motion.
- **FR-021**: The mascot MUST NOT cause visible layout shift when it loads.
- **FR-022**: If the mascot image fails to load on a game screen, the game MUST remain fully playable and MUST NOT display a broken-image indicator or request a fallback image.

#### Compatibility and quality

- **FR-023**: The feature MUST NOT add, remove, or rename games; change game routes; alter daily content, availability rules, or puzzle generation; or change scoring, saved results, sharing, or reset behaviour.
- **FR-024**: The feature MUST NOT change the game screens' existing layout contract: the board-first order, the board's growth behaviour, the header's alignment, the finished-state layout and the horizontal-overflow guarantee MUST all hold unchanged.
- **FR-025**: The feature MUST NOT introduce user-facing text. Any user-facing string that is introduced MUST exist in both Spanish and English through the message catalog.
- **FR-026**: The feature MUST NOT add a dependency to the app's runtime or test toolchain.
- **FR-027**: The mascot asset MUST remain the same file with the same dimensions and the same size budget; it MUST NOT be re-encoded, re-cropped, re-derived or duplicated by this feature.
- **FR-028**: The mascot MUST NOT vary with the visitor's locale, timezone, or the current UTC day.
- **FR-029**: The feature MUST comply with the project's constitution, including its bilingual-UI, fail-visible, lean-test and delivery-model constraints.

### Key Entities

- **Mascot Presentation**: The settled way the mascot is rendered — one asset, one size rule, one corner, one failure behaviour — shared unchanged by the home screen and every game screen. It carries the viewport bands it is sized by and the corner it is anchored to.
- **Game Screen**: One of the five playable screens, in any of its states. It carries the content column the mascot must clear or be accepted over.
- **Size Rule**: The rule that fixes the mascot's rendered size from the viewport, with one value per viewport band and a boundary at 1024 pixels.
- **Known Limitation**: The narrow-viewport visual cover of the board's bottom inline-end region by the mascot, accepted by the project owner on 2026-11-14 and recorded here, with the properties it must never break: no layout change, no swallowed click, no scrollbar, no removed, hidden or truncated text, and no covered content trapped under the mascot.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At every tested viewport (320x640, 360x640, 768x1024, 1024x768, 1440x900, 1920x1080), the mascot's rendered width and height on each of the five game screens match the mascot's rendered width and height on the home screen within 1 pixel: 0 differences across 30 comparisons.
- **SC-002**: At every tested viewport, the mascot's inline-end edge and block-end edge coincide with the viewport's edges on all six screens within 1 pixel: 0 offsets.
- **SC-003**: 5 of 5 game screens display the mascot in every state they can be in (loading, playing, finished, error): 0 game screens missing it.
- **SC-004**: 0 horizontal scrollbars appear on any of the five game screens at window widths from 320 to 1920 pixels, with the mascot present.
- **SC-005**: At viewport widths of 1024 pixels and wider, the mascot overlaps the game screen's content column by 0 pixels.
- **SC-006**: 100% of the tiles, buttons and links that lie beneath the mascot's region remain operable: 0 clicks and 0 taps are swallowed.
- **SC-007**: The mascot's presence changes the game screens' board geometry, header geometry and scroll behaviour by 0 pixels and 0 scroll units.
- **SC-008**: The mascot introduces 0 new focusable elements (0 additional tab stops) and 0 information conveyed only through the image.
- **SC-009**: The mascot performs 0 animations and 0 motion effects for 100% of visitors, including 100% of visitors whose system requests reduced motion.
- **SC-010**: With the mascot's file failing to load, all five game screens remain fully playable, 0 broken-image indicators appear, and 0 requests for a fallback image are made.
- **SC-011**: The mascot asset is unchanged by the feature: 640x1137 pixels, a transparent background, no larger than 150 KB, and byte-for-byte the same file as before the feature.
- **SC-012**: The home screen's mascot is unchanged for the visitor: its rendered size, its corner, its behaviour and its file on the home page are identical before and after the feature, with 0 differences. Sharing one mascot component across screens, or renaming the mascot's markup, class names or test hooks, is not a difference.
- **SC-013**: 0 new user-facing strings are introduced, so both languages stay complete with 0 missing or fallback strings.
- **SC-014**: The feature adds 0 dependencies to the app's runtime or test toolchain.
- **SC-015**: Existing game behaviour, routes, daily content, availability, scoring, saved results and sharing show 0 regressions, and the existing board-first and viewport-fit checks pass with the mascot present.
- **SC-016**: The mascot's overlap with a game screen's bottom inline-end region below 1024 pixels is recorded as a known limitation in the feature's contract, together with the properties it must never break: it changes no layout, swallows no click, adds no scrollbar, and removes, hides or truncates no text. It MAY visually cover board content there, with 0 controls that stop answering clicks and taps and 0 covered items left trapped under the mascot.
- **SC-017**: In both light and dark display modes the mascot shows 0 opaque backgrounds against the surface and presents the same drawing in both modes, with 0 differences between the two; no contrast ratio is specified or asserted.
- **SC-018**: 100% of the outcomes stated about the mascot's presence, size, corner, overlap and failure behaviour are asserted by automated checks, the feature's own automated suite stays at or under 15 tests by looping over the screens, viewports and states rather than adding one check per combination, and the remaining behaviour is covered by the existing game checks re-run with the mascot present.

## Assumptions

- **The mascot's presentation is already settled.** The home screen's contract from feature 013 — the asset, the size rule and its viewport bands, the corner, the decorative role, the still-image rule, the failure behaviour — is reused unchanged. This feature extends coverage and does not redesign presentation.
- **The size and the corner are fixed by the request.** "At the same size and in the same corner at every viewport width" is read as: one size rule, shared with the home screen, and the same anchor on every screen. The size rule is not re-derived from a game screen's own content width, so the mascot is not larger on a game screen than on the home screen even though a game screen leaves more free space beside its column.
- **The narrow-viewport overlap is accepted.** Below 1024 pixels the mascot floats over the board's bottom inline-end region, as it floats over the card column on the home page. Any board content may be visually covered there — tile artwork, labels, counts, the More/Fewer buttons and the status copy — as long as every control beneath the mascot still answers clicks and taps and the content can be scrolled out from under it. The project's owner accepted this on 2026-11-14 as a documented limitation for this condition, not a defect to be engineered away, because the request's premise is that the mascot looks the same everywhere. The overlap is bounded by FR-014's properties.
- **"Unchanged" means unchanged for the visitor.** The home screen keeps its mascot's rendered size, its corner, its behaviour and its file, with 0 differences (SC-012). The implementation may share a single mascot component between the home screen and the game screens, and may rename the mascot's markup, class names and test hooks, because those are internal and no visitor can see them. Feature 013's contract file, `specs/013-home-artwork/contracts/home-mascot.md`, is updated to point at this feature's supersession of FR-011.
- **Every outcome is proven automatically, within the test cap.** The mascot's presence, size, corner, overlap and failure behaviour are each asserted by an automated check. The checks loop over the screens, viewports and states rather than adding one check per combination, so the feature's own suite stays within the constitution's cap of 15 tests; the rest of the feature's behaviour is covered by the existing game checks re-run with the mascot present.
- **"Game screens" means the five playable screens** — More or Less, Groups, and the Spring 2026, Summer 2026 and Autumn 2026 editions of Match the Series — in every state. The app's own error page is not a game screen.
- **The mascot is decorative.** It conveys no information, is ignored by assistive technology, and adds no focus stop. This is unchanged from feature 013.
- **The mascot is a still image.** It never animates, so a visitor whose system requests reduced motion sees the same screen as every other visitor.
- **The mascot asset is reused as it is.** The file, its dimensions, its transparency and its size budget are unchanged; no second file and no fallback file are introduced.
- **The game screens' layout contract is untouched.** The board-first order, the board's growth behaviour, the header's alignment, the finished-state layout and the horizontal-overflow guarantee all hold, as feature 013 required for the home screen.
- **The 200% text-zoom limitation of feature 013 carries over unchanged.** The mascot's size is set by the viewport rather than the text, so at 200% zoom below roughly 1024 pixels it overlaps text. That limitation was accepted on 2026-11-13 and is not reopened here.
- **No new user-facing copy is needed.** The mascot carries no text, so both message catalogs stay complete as they are.
- **Constitution v3.0.0 governs this feature.** Its read-only catalog, API/UI separation, deterministic-daily-puzzle, stateless, fail-visible and lean-test principles, and its bilingual-UI and delivery-model constraints, remain in force. The feature adds no dependency, no table, no route and no text.
