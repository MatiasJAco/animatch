# Feature Specification: Centered Home Page Title

**Feature Branch**: `012-center-home-title`

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "Center the \"Animatch\" page title horizontally on the Home page."

## Overview

The home page opens with the product name "Animatch" and its tagline in the top-left corner of
the header, while the rest of the page is a centered column of game cards. The title therefore
sits off to one side of an otherwise balanced layout, and the first thing a visitor reads looks
misplaced rather than intentional.

This feature centers the "Animatch" title horizontally on the home page so the header reads as a
deliberate, symmetrical introduction to the game catalog. The title's horizontal midpoint coincides
with the horizontal midpoint of the home page's content area, and the tagline directly beneath it
stays centered on the same horizontal center line as the title so the two remain a single header
unit. The language control keeps its
place in the header; at widths where the content area has narrowed to the active locale's stacking
threshold, the control stacks onto a row of its own rather than overlapping the title, and the
header grows taller only by the amount that stacking requires.

This is a presentation-only change. It does not alter the title text, the games, the catalog, the
routes, the daily content, the saved results, or anything the visitor can do beyond the header's
appearance. It introduces no new user-facing text, no new data, and no new dependency.

## Vocabulary

| Term | Meaning |
|------|---------|
| Home page title | The page's main heading on the home page, showing the product name "Animatch" |
| Tagline | The short muted subtitle shown directly beneath the home page title, centered on the same horizontal center line as the title |
| Header block | The home page's title and tagline together, treated as one visual unit and centered as one unit |
| Content area | The home page's border box minus its horizontal padding — that is, the home page's content box. It is the one reference frame for the title's and the tagline's centering, for the language control's flush-right placement, and for the overflow checks |
| Centered | The element's horizontal midpoint coincides with the content area's horizontal midpoint |
| Language control | The header control that switches the interface between Spanish and English; it keeps its place at the content area's top-right and is stacked onto its own row when the content area narrows to the active locale's stacking threshold, including its safety margin |
| Stacked header | A header state in which the title block occupies one row and the language control occupies the row below it, used when the content area narrows to the active locale's stacking threshold, including its safety margin |
| Alignment tolerance | The maximum allowed distance between an element's horizontal midpoint and the content area's horizontal midpoint for the element to count as centered |

## Clarifications

### Session 2026-11-12

- Q: When the title is centered, how must the tagline line up with it? → A: The tagline's text is centered on the same horizontal center line as the title, so the two lines read as one composed header. The tagline is not left-aligned beneath the centered title.
- Q: Where must the language control sit once the title is centered? → A: The language control keeps its current place in the header, at the content area's top-right, and is stacked onto its own row below the title block only when sharing a row would make it overlap the title or the tagline (this trigger is refined by the locale threshold rule recorded below). It is not moved to any other corner.
- Q: May the home page header grow taller than it is today? → A: Yes, but only by the amount needed to place the centered title without overlapping the language control. The reset countdown and the game catalog move down by that same amount and by no more, and no other vertical change to the home page is permitted.
- Q: How must the centering be verified before the feature is accepted? → A: An automated viewport check measures the rendered title's and the content area's horizontal midpoints at each tested width in both languages and fails when they differ by more than the alignment tolerance. A visual-only review is not accepted as evidence.
- Q: When exactly may the language control be stacked onto its own row instead of sharing the title's row? → A: When the content area narrows to the active locale's measured stacking threshold, including the safety margin stated in Assumptions. Stacking at that threshold is permitted even where the title and the control could still share one row without overlapping on the platform the measurement was taken on, because the margin absorbs platform font-metric differences. The control still must not overlap the title or the tagline, and it still must not move to any other position.
- Q: What does "content area" refer to? → A: The home page's border box minus its horizontal padding — that is, the home page's content box. Every centering check, every flush-right check, and every overflow check uses that one reference frame.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The title sits in the middle of the page (Priority: P1)

A visitor opens the home page and sees the word "Animatch" sitting in the middle of the page
above the tagline, rather than tucked into the top-left corner. The title is the visual anchor of
the page: it is balanced against the catalog below it, and the header no longer looks like the
product name was forgotten on the side.

**Why this priority**: Centering the title is the entire request. Without it the feature delivers
nothing.

**Independent Test**: Open the home page at phone, tablet, laptop, and wide-desktop sizes and
compare the horizontal midpoint of the title with the horizontal midpoint of the page's content
area; the two must coincide within the alignment tolerance at every size.

**Acceptance Scenarios**:

1. **Given** a visitor opens the home page on any supported width, **When** the page finishes rendering, **Then** the "Animatch" title is horizontally centered in the page's content area.
2. **Given** the home page at a wide-desktop width, **When** the title is compared with the content area, **Then** the distance between the title's horizontal midpoint and the content area's horizontal midpoint is within the alignment tolerance.
3. **Given** the home page at a narrow phone width, **When** the title is compared with the content area, **Then** the title remains centered and does not shift toward either edge.
4. **Given** the page is resized from phone to wide-desktop width, **When** the title re-renders, **Then** it stays centered at every intermediate width.
5. **Given** the home page header, **When** the visitor reads it, **Then** there is exactly one main title and it says "Animatch".
6. **Given** the home page at any supported width or at 200% text zoom, **When** the title is rendered, **Then** it stays inside the visible page area and does not extend past the page's edges.
7. **Given** a visitor scrolls the home page, **When** the title is no longer the topmost element, **Then** the catalog and its scroll behavior are unchanged.
8. **Given** a home page header that must give the centered title a row of its own to avoid overlapping the language control, **When** the page renders, **Then** the header is taller only by the amount that placement requires, and the reset countdown and the catalog below it move down by that same amount and no more.

---

### User Story 2 - The tagline stays attached to the title (Priority: P1)

The tagline sits directly beneath the title and reads as its subtitle. The two are centered on the
same horizontal center line, so the header looks like one composed block rather than a title
floating above an unrelated sentence.

**Why this priority**: A centered title with a left-aligned tagline underneath looks broken and
undoes the benefit of the change. The two elements must move together.

**Independent Test**: Render the home page in Spanish and English and confirm that the tagline is
always the element immediately below the title, and that the title's and the tagline's horizontal
midpoints coincide at every tested width.

**Acceptance Scenarios**:

1. **Given** the home page is rendered, **When** the header is inspected, **Then** the tagline is the element immediately below the title and its horizontal midpoint coincides with the title's horizontal midpoint.
2. **Given** the interface is switched to Spanish, **When** the header re-renders, **Then** the longer Spanish tagline remains centered on the title's center line and is not clipped or truncated.
3. **Given** the interface is switched to English, **When** the header re-renders, **Then** the tagline remains centered on the title's center line and is not clipped or truncated.
4. **Given** either language, **When** the tagline is read, **Then** it says "Daily anime puzzles" in English and "Puzzles diarios de anime" in Spanish, unchanged by this feature.
5. **Given** the text is enlarged to 200%, **When** the header renders, **Then** the title and tagline remain centered on the same center line and the page does not scroll sideways.

---

### User Story 3 - The rest of the header still works (Priority: P2)

Centering the title does not cost the visitor anything else the header offers. The language
control stays on screen, stays clearly reachable, and stays usable with a keyboard or a pointer.
It keeps its place at the content area's top-right unless it is stacked onto its own row because
the content area has narrowed to the locale's stacking threshold. It never overlaps the title and
never pushes the title off center.

**Why this priority**: The language control is the only interactive element in the header. A
centered title that crowds it away would trade one defect for another.

**Independent Test**: Load the home page at every tested width, locate the language control, and
confirm it is fully visible, does not overlap the title or the tagline, can be operated with both a
pointer and the keyboard, and has left its place at the content area's top-right only where it was
stacked onto its own row because the content area had narrowed to the locale's stacking threshold.

**Acceptance Scenarios**:

1. **Given** the home page at any supported width, **When** the page renders, **Then** the language control is visible and fully within the visible page area, in its usual place at the content area's top-right unless it has been stacked onto its own row.
2. **Given** the home page at a narrow phone width where the title and the language control cannot share a row, **When** the header renders, **Then** the title remains centered, the language control is stacked onto its own row below the title block, and neither overlaps the other.
3. **Given** a keyboard-only visitor, **When** they tab through the header, **Then** the language control is reachable and operable, and its focus indicator is visible.
4. **Given** the visitor switches the language, **When** the header re-renders, **Then** the title remains centered and the whole page updates in the chosen language.
5. **Given** the visitor moves the pointer over the language control, **When** it is hovered or focused, **Then** the title's centering is unaffected.
6. **Given** the home page, **When** its headings are listed in reading order, **Then** the title is the first heading and no other main heading is introduced.

---

### User Story 4 - Nothing else on the page changes (Priority: P3)

The home page keeps everything else it had: the reset countdown, the catalog of five games in the
same order, the per-card states, the failure state with its retry, and the development-only reset
control. Playing a game, returning to the home page, and finding a saved result behave exactly as
before.

**Why this priority**: A cosmetic header change must not disturb anything a visitor or the app
depends on.

**Independent Test**: Play a game, finish it, return to the home page, and confirm the catalog,
its order, the countdown, and the finished marker are unchanged; then force the catalog to fail
and confirm the retryable failure state still appears.

**Acceptance Scenarios**:

1. **Given** the home page with a finished game saved for today, **When** the page loads, **Then** the same game card is marked finished and the catalog order is unchanged.
2. **Given** the catalog cannot be loaded, **When** the home page loads, **Then** the same readable failure state with a retry action appears.
3. **Given** the catalog is loading, **When** the page is shown, **Then** the same loading message appears and no empty catalog is shown.
4. **Given** the reset countdown is present, **When** the page renders, **Then** it still shows the same remaining time and rolls over as before.
5. **Given** the development build, **When** the home page loads, **Then** the development reset control remains available and absent from production builds.
6. **Given** the home page is open, **When** the visitor enters a game and comes back, **Then** the title is still centered and the catalog reflects the finished state.
7. **Given** the home page header is taller than before because the language control was stacked onto its own row, **When** the catalog and the countdown are inspected, **Then** the catalog still lists the same five games in the same order with the same card states and the countdown shows the same remaining time, with the only difference being that they sit lower by the header's added height.

---

### Edge Cases

- **320-pixel-wide window**: the title stays centered even though very little horizontal room exists; the language control remains fully visible and never overlaps the title.
- **Title and language control cannot share a row**: the language control is stacked onto its own row below the title block, the title stays centered, and the header grows taller only by the height that stacking requires.
- **Content area between the measured requirement and the locale's threshold**: the language control is stacked onto its own row even though the title and the control would still fit on one row on the platform the measurement was taken on; the safety margin exists so that a platform with wider font metrics cannot cause an overlap, and the header grows taller only by the height that stacking requires.
- **Content area past one locale's threshold but not the other's**: the control keeps the title's row in the language whose threshold it has not reached, and moves to a row of its own in the language it has, so the two languages differ at the same width.
- **Title wider than the content area**: the title wraps or shrinks to fit inside the content area rather than overflowing past the page edges.
- **Tagline longer than the title (Spanish)**: the tagline stays centered on the title's center line and the pair keeps its centered appearance.
- **200% text zoom**: the title and tagline stay centered on the same center line, the title stays centered, and the page gains no horizontal scrolling.
- **Viewport resized while the page is open**: the title re-centers at the new width without a reload.
- **Language switched while the page is open**: the title and tagline re-render in the new language and the title re-centers.
- **Font loading or fallback**: the title's centering is unaffected by late font swaps.
- **Page content taller than the window**: vertical scrolling is unaffected, and the title is centered within the content area rather than the scrollable content.
- **Printing or reduced-motion preferences**: the title's centered appearance does not depend on motion or hover effects.
- **Assistive technology**: the title is still announced as the home page's main heading, and centering does not change the reading order.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The home page's main title MUST be horizontally centered in the page's content area, such that the title's horizontal midpoint coincides with the content area's horizontal midpoint within the alignment tolerance.
- **FR-002**: The home page MUST contain exactly one main title, and that title MUST be the element named "Animatch".
- **FR-003**: The title MUST be centered at every supported viewport width, including 320, 360, 600, 768, 1024, 1440, and 1920 pixels, and at any width between them.
- **FR-004**: The title MUST remain centered when the page is resized while it is open, and after the interface language is switched, without requiring a reload.
- **FR-005**: The tagline MUST remain directly beneath the title and MUST be centered on the same horizontal center line as the title, so the header block reads as a single unit.
- **FR-006**: The title and tagline MUST NOT overflow the content area or extend past the visible page edges at any supported width or at 200% text zoom.
- **FR-007**: The language control MUST remain visible, fully inside the visible page area, and MUST NOT overlap the title or the tagline at any supported width. It MUST keep its place in the header at the content area's top-right, and MAY be stacked onto its own row below the title block when the content area narrows to the active locale's measured stacking threshold, including the safety margin stated in Assumptions; it MUST NOT be moved to any other position.
- **FR-008**: The language control MUST remain reachable and operable with a pointer and with the keyboard, and its focus indicator MUST remain visible.
- **FR-009**: The title MUST remain the first heading of the home page in reading order, and centering MUST NOT change the order or the meaning of the header's contents.
- **FR-010**: The title text MUST remain exactly "Animatch" in both Spanish and English, and the feature MUST NOT introduce any new user-facing string.
- **FR-011**: The home page MUST retain the reset countdown, the five-game catalog in its current order, the per-card states, the loading message, the retryable failure state, and the development-only reset control.
- **FR-012**: The home page MUST NOT scroll horizontally at any window width from 320 to 1920 pixels, in either language, including at 200% text zoom.
- **FR-013**: The feature MUST NOT change any game's rules, daily content, availability rules, routes, saved results, or sharing behavior.
- **FR-014**: The feature MUST NOT add a runtime or development dependency, and MUST NOT introduce any data storage, network request, or server-side change.
- **FR-015**: The feature MUST NOT copy branding, layout, or visual structure from another puzzle site, and MUST NOT alter the app's existing visual language, typography, or spacing.
- **FR-016**: The header MUST grow taller only by the amount required to place the centered title without overlapping the language control. The reset countdown and the game catalog MAY move down by that same amount and by no more, and no other vertical change to the home page is permitted.

### Key Entities

- **Home Title**: The home page's main heading showing the product name "Animatch". It has a rendered horizontal position that must match the content area's horizontal midpoint.
- **Tagline**: The short muted subtitle beneath the home title, always paired with the title and always centered on the title's horizontal center line.
- **Header Block**: The title and tagline treated as one visual unit, centered as one unit, alongside the language control, occupying the top of the home page. It occupies one row, or two rows when the language control is stacked below it.
- **Content Area**: The home page's border box minus its horizontal padding — that is, the home page's content box; the reference frame for what "centered" means on this page and for the language control's flush-right placement.
- **Language Control**: The header's language switcher, which must remain visible, non-overlapping, and operable, and which keeps its place at the content area's top-right unless it is stacked onto its own row because the content area has narrowed to the locale's measured stacking threshold, including its safety margin.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At each of the tested widths (320, 360, 600, 768, 1024, 1440, and 1920 pixels), in both languages, an automated check measures the title's horizontal midpoint and the content area's horizontal midpoint, and the two match within the alignment tolerance, with 0 mismatches.
- **SC-002**: 100% of home-page loads show a horizontally centered title, with 0 loads showing the title aligned to a side edge.
- **SC-003**: The title's midpoint remains within the alignment tolerance at every width while the window is resized, with 0 widths where the title drifts.
- **SC-004**: The tagline is the element immediately below the title in 100% of renders, and its horizontal midpoint coincides with the title's horizontal midpoint in 100% of renders, in both languages.
- **SC-005**: The language control is fully visible and overlaps neither the title nor the tagline at 100% of tested widths, remains operable by pointer and by keyboard in 100% of checks, and has left its place at the content area's top-right in 0 renders other than the ones where it was stacked onto its own row because the content area had narrowed to the active locale's measured stacking threshold, including the safety margin stated in Assumptions.
- **SC-006**: The home page shows 0 horizontal scrollbars at window widths from 320 to 1920 pixels in both languages, and 0 horizontal scrollbars at 200% text zoom.
- **SC-007**: The title remains the first heading of the home page in reading order in 100% of renders, with 0 additional main headings introduced.
- **SC-008**: 0 new user-facing strings are introduced, the title reads exactly "Animatch" in both languages, and 0 translation gaps appear.
- **SC-009**: The catalog still lists exactly five games in the same order with 0 changes to card states, and the countdown, loading message, failure state with retry, and development reset control remain present with 0 regressions; the only permitted change to their placement is the downward shift allowed by FR-016.
- **SC-010**: Games, routes, daily content, availability rules, saved results, and sharing show 0 regressions; the existing automated checks for the home page continue to pass.
- **SC-011**: The feature adds 0 runtime dependencies, 0 development dependencies, and 0 new data storage or network requests.
- **SC-012**: In a first-use review with 10 visitors, at least 9 describe the home page header as visually balanced with the title in the middle, and none describe the title as stuck to one side.
- **SC-013**: The header is taller than it was before the feature by no more than the amount needed to place the centered title without overlapping the language control, and the reset countdown and the catalog move down by that same amount and no more, in 100% of renders.
- **SC-014**: The automated viewport check runs at all seven tested widths in both Spanish and English, fails on any difference larger than the alignment tolerance, and the feature ships with 0 such failures; a visual-only review is not accepted as evidence of centering.

## Assumptions

- **"Centered on the Home page" means centered against the page's own content area**, not merely centered inside the header's title column or against the browser window edge. The home page's content is already a centered column, so the title is centered over that same column.
- **Only the home page's title changes.** The product name appears on the home page only, so the game screens' headings and the error screen keep their current placement.
- **The tagline moves with the title.** The title and the tagline are one header unit, so both are centered together on the same horizontal center line. A centered title over a left-aligned tagline would read as broken and is not the intent.
- **The language control keeps its place.** It stays in the header at the content area's top-right and is stacked onto its own row below the title block when the content area narrows to the active locale's measured stacking threshold, including the safety margin below. It is not moved to a different corner.
- **The stacking threshold carries a safety margin over the measured requirement.** The content width the title block and the language control need in order to share one row was measured at 36.04 em for Spanish and 33.74 em for English, expressed in the content area's own font-size units. The thresholds the implementation applies add a margin over those measurements — 5.4% for Spanish (36.04 em → 38 em) and 3.7% for English (33.74 em → 35 em) — so that platform font-metric differences cannot cause an overlap. Stacking is therefore permitted from that threshold downwards, even where the title and the control would still fit on one row on the platform the measurement was taken on.
- **The header may grow taller, and only by what the change requires.** The reset countdown and the game catalog below it move down by that amount and no more; nothing else about the page's vertical layout changes.
- **The alignment tolerance is 2 pixels**, which is below what a visitor can perceive and above the rounding noise of fractional screen positions.
- **The centering is verified by an automated check, not by eye.** A viewport check measures the rendered title and content area at every tested width in both languages and fails when the midpoints differ by more than the alignment tolerance.
- **The title text is unchanged.** "Animatch" is the product name and reads the same in Spanish and English, so no message-catalog change is needed and no new translation is required.
- **The title keeps its heading role and position in the document.** Centering is a visual placement only; the title stays the first and main heading of the home page.
- **Supported viewport widths remain 320 to 1920 pixels**, matching the existing home-page expectations, and 200% text zoom remains a supported condition.
- **No existing behavior is being fixed by this feature.** Centering is a deliberate visual improvement, not a correction of broken behavior; the title is currently legible and usable, only off-center.
- The existing visual language (typography, spacing, rounded surfaces, and colors) is reused unchanged; only the title block's horizontal placement differs.
