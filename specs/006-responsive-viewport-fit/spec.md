# Feature Specification: Responsive Viewport Fit

**Feature Branch**: `006-responsive-viewport-fit`

**Created**: 2026-10-08

**Status**: Draft

**Input**: User description: "Make the existing app responsive so all primary content fits the browser viewport without page-level scrolling. Users open the app on common desktop, laptop, and tablet widths and must see the full working surface without scrolling the document. The page itself must not scroll if possible. Content must reflow or scale so nothing is clipped, cut off, or only reachable by scrolling the window. Horizontal overflow is not allowed at any supported width. Out of scope: new features, visual redesign beyond what is required to fit, and mobile phone layouts below 768px unless already supported."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Full working surface visible at target sizes (Priority: P1)

A player opens the app in a browser window at any of the supported sizes (1920x1080, 1440x900, 1280x800, 1024x768) and immediately sees the entire screen for the page they are on — home, Match The Series, Groups, or More Or Less — without dragging or scrolling the document. The header, the board, and every control needed to play are on screen at once.

**Why this priority**: This is the core of the feature. If the page scrolls, the working surface is split and the player loses sight of the board or the controls mid-play.

**Independent Test**: Load each of the four screens at 1024x768 and 1920x1080; verify the document reports no vertical or horizontal scrollbar and that the primary play control (tile grid, comparison buttons, game list) plus its header are simultaneously visible.

**Acceptance Scenarios**:

1. **Given** the Groups screen is loaded, **When** the browser window is 1024x768, **Then** the document has no vertical scrollbar and no horizontal scrollbar, and the 4x4 grid, the Clear/Submit buttons, the mistake badge, and the page header are all visible without scrolling.
2. **Given** the Match The Series screen is loaded mid-play, **When** the browser window is 1440x900, **Then** the clue card, the 3x3 grid, the feedback line, and the header controls are all visible without scrolling and without any element clipped.
3. **Given** the More Or Less screen is loaded, **When** the browser window is 1280x800, **Then** the round badge, both comparison cards, and the More/Less buttons are all visible without scrolling.
4. **Given** the home screen is loaded, **When** the browser window is 1920x1080, **Then** the title, language control, countdown, and all game cards are visible without scrolling the document.

---

### User Story 2 - Smooth resizing between supported sizes (Priority: P2)

A player resizes the window (or maximizes/restores it) across the supported range and the layout reflows continuously: nothing gets clipped, no scrollbar appears at any intermediate width, and no control becomes unreachable.

**Why this priority**: Users do not land on the four canonical sizes exactly; the fit must hold at every width and height in between, not just at the checkpoints.

**Independent Test**: Drag-resize a window from 1920x1080 down to 1024x768 and back on each screen, sampling intermediate sizes; assert no page scrollbar and no element extending beyond the viewport at any sampled size.

**Acceptance Scenarios**:

1. **Given** any primary screen, **When** the window width is reduced gradually from 1920 to 1024, **Then** at no point does a horizontal or vertical page scrollbar appear.
2. **Given** any primary screen, **When** the window is resized to an intermediate size such as 1366x768, **Then** content reflows (wraps, scales, or stacks) and remains fully inside the viewport with nothing cut off at the edges.

---

### User Story 3 - Finished and expanded states still fit (Priority: P3)

When a game ends and additional content appears — the result panel, the loss explanation, the Groups revealed group rows, the Match loss reveal list — the screen still fits the viewport without introducing document scrolling.

**Why this priority**: The finished state is reached by every player every day; if it scrolls, the success criteria fail precisely when the player is reading their result.

**Independent Test**: Drive each game to a finished state (win and loss) at 1024x768; verify the document still has no scrollbars and that the result content is fully readable within the viewport.

**Acceptance Scenarios**:

1. **Given** the Groups game is finished and all four groups are revealed, **When** viewed at 1024x768, **Then** the result panel and the revealed group rows fit within the viewport with no document scrolling and no clipped text.
2. **Given** Match The Series ends in a loss with the pairing reveal list shown, **When** viewed at 1024x768, **Then** the reveal list and result panel are fully visible without scrolling the page.

---

### Edge Cases

- A tile, name, or group criterion label with unusually long text (in Spanish or English) — must wrap inside its container, never widen the page or overlap neighbours.
- A game state with everything on screen at once: feedback message + error panel + board + result panel. The stack must compress, not overflow.
- A transient error state (API failure panel with retry) shown above the board — must fit alongside the board without pushing it out of the viewport.
- Viewport heights shorter than the canonical ones at the same width (e.g., 1024x600 laptop browser with chrome/toolbars) — content should compress further or the smallest supported height applies; document the supported floor.
- Browser text scaling / zoom at 100% at the supported sizes must still fit; zoom levels other than 100% are out of scope.
- Widths below 768px are out of scope (existing behavior there is unchanged, not a regression target).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: At 1920x1080, 1440x900, 1280x800, and 1024x768, the document MUST NOT scroll vertically or horizontally on any primary screen (home, Match The Series, Groups, More Or Less), in any of their normal play, loading, error, or finished states.
- **FR-002**: No horizontal overflow MUST occur at any window width at or above 768px: no element's rendered edge may extend beyond the viewport width.
- **FR-003**: Every primary control (game tiles, Clear/Submit, More/Less, Next, home link, language control, retry action in error states) and every primary content region (headers, boards, result panels, countdown) MUST be visible — not clipped and not reachable only by scrolling the document — at all supported sizes.
- **FR-004**: When content does not fit at a given size, it MUST compress or reflow (scale down, wrap, tighten spacing, or restack) so that it remains inside the viewport; content MUST NOT be pushed out of the page or overlapped.
- **FR-005**: Resizing the window to any intermediate size between 1024x768 and 1920x1080 MUST NOT introduce a page scrollbar or clipped content at any point during the resize.
- **FR-006**: Text content in both supported languages (Spanish and English) MUST wrap within its container without causing horizontal overflow; longer translations must not fit worse than shorter ones.
- **FR-007**: The feature MUST NOT change gameplay rules, data, copy meaning, or the set of available controls; only layout and sizing behavior may change.
- **FR-008**: Error and loading states MUST obey the same no-scroll, no-clip rules as normal play (failure feedback stays visible alongside the board).
- **FR-009**: Layouts below 768px width MUST NOT regress relative to their current behavior; supporting them further is out of scope.

### Key Entities

No new data entities. This feature concerns presentation of existing content only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At 1920x1080, 1440x900, 1280x800, and 1024x768, 100% of primary screens in 100% of their states (loading, playing, error, finished) show zero document scrollbars in both axes.
- **SC-002**: During an automated resize sweep from 1920x1080 to 1024x768 in 60px increments, 0 of the sampled sizes produce a document scrollbar or a clipped element on any primary screen.
- **SC-003**: 100% of primary controls are clickable/hittable at every supported size without the player scrolling the document first.
- **SC-004**: A player can complete a full round of each of the three games at 1024x768 with zero document scroll events.
- **SC-005**: Both locales render at all supported sizes with no horizontal overflow and no truncated strings.

## Assumptions

- "Primary content" means the header/chrome plus the main working area of each screen (home game list; Match clue card, feedback, 3x3 grid, Next; Groups mistake badge, group rows, 4x4 grid, Clear/Submit; More Or Less comparison cards and More/Less buttons) plus the result panel when a game is finished.
- "Supported sizes" are the four named viewport sizes and everything between them at width ≥ 768px. The supported height floor is 768px; shorter viewports (e.g., 1024x600) are best-effort, not a gate.
- Compression may reduce whitespace, tighten gaps, and scale tile/art sizes modestly as long as text stays legible and touch/click targets remain usable; a full visual redesign is out of scope.
- If some secondary/transient content genuinely cannot fit at the smallest supported size, it may be prioritized below primary controls, but primary controls and the main board must never require document scrolling.
- Browser zoom other than 100% and text-size overrides beyond standard browser scaling are out of scope.
- No new runtime dependencies may be introduced for this feature; verification uses existing tooling and browser observation.
- Automated verification of "no scrolling" and "no clipping" must assert observable rendering behavior (scroll position, element visibility within the viewport), not stylesheet source text, per project test rules; the feature's test count must stay within the project cap of 15 tests.
