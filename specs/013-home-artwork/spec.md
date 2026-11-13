# Feature Specification: Home Page Character Artwork

**Feature Branch**: `013-home-artwork`

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "Add character artwork to the home page: a mascot image that stays visible at the bottom of the viewport while scrolling vertically, and themed artwork for the seasonal Match the Series game cards."

## Overview

The home page is the only place a visitor can discover every game the app offers, and it is currently the least characterful screen in the product: five uniform cards carrying abstract, geometric artwork, with nothing on the page that says "this is Animatch" beyond the title.

This feature gives the home page the product's character. Two pieces of artwork arrive together:

1. **The mascot.** Matchi, the character supplied for this product, appears as a persistent element anchored to the bottom edge of the viewport. The visitor scrolls the catalog and the mascot stays with them at the bottom of the screen. It is decoration: it never covers a card's text, never swallows a click, and never adds a scrollbar.
2. **Themed seasonal card artwork.** The three Match the Series editions stop carrying abstract card art and start carrying artwork built from the seasonal scenes supplied for this feature: spring blossom, summer shore, autumn foliage. A visitor scanning the catalog can tell the three editions apart by their picture before they read a single word.

The artwork is never served to a visitor as a raw source file. Every delivered image is a processed derivative — resized to the size the page actually needs, framed to show the character and the season, compressed, and, for the mascot, freed from its flat background so it sits on the page in both light and dark display modes. The raw sources are committed to the repository, in the `artwork/sources/` directory that the app never serves, so that every shipped asset can be checked against the source it was derived from.

This feature is presentation only. It adds no game, no route, no daily content, and no saved state. The two games that are not Match the Series editions keep the artwork they already have.

## Vocabulary

| Term | Meaning |
|------|---------|
| Mascot | The Matchi character illustration shown as a persistent decorative element at the bottom of the home page's viewport |
| Seasonal edition | One of the three Match the Series games tied to a fixed 2026 season: Spring 2026, Summer 2026, Autumn 2026 |
| Seasonal scene | One supplied illustration of Matchi in a seasonal setting (spring blossom, summer shore, autumn foliage, winter night) used as the basis for seasonal card artwork |
| Themed card artwork | The processed image shown in the image band of one seasonal edition's home card |
| Source artwork | An original supplied image file. It is committed to the repository's artwork source directory and is the origin of exactly one processed asset; it is never sent to a visitor |
| Artwork source directory | The repository's `artwork/sources/` directory, which holds the committed source artwork. It sits outside the directory the app serves, so the sources are part of the project record but never reach a visitor's browser |
| Processed asset | A shipped image derived from a source artwork by resizing, cropping, compression, or background removal; never a byte-for-byte copy |
| Card image band | The fixed 16:9 image area at the top of every home game card |
| Card summary | The short text that tells the visitor what a game is, shown on its home card beneath the card's name and above the card's state text |
| Persistent element | Page furniture that stays in view at the bottom of the viewport while the page scrolls, without belonging to the scrolling content |
| Reserved asset | A processed image stored alongside the other assets but mapped to no game and shown on no card; the winter scene is the only one |
| Artwork set | The complete collection of images available to the app: one per game (five), the mascot, and the reserved winter asset — seven in all. The winter asset belongs to the set but is stored and mapped to no game, so it is never served to a visitor |

## Clarifications

### Session 2026-11-12

- Q: Should the mascot ever animate, or is it a still image for every visitor? → A: The mascot is a still image and never animates, for any visitor; a visitor whose system requests reduced motion sees exactly the same mascot as every other visitor.
- Q: Does the home page reserve layout space for the mascot, or does the mascot float over the content? → A: The mascot floats over the page and the layout reserves no space for it. The mascot is placed so that it never covers card text, and its presence changes neither the catalog's width nor the page's need to scroll.
- Q: What size and dimension budget applies to each shipped artwork asset, and to the home page's artwork in total? → A: Set an explicit ceiling per asset class and for the page as a whole. The project owner revised the numbers: each seasonal card image at most 90 KB at 800x450 pixels; the mascot at most 150 KB, 640 pixels wide, with transparency; and at most 450 KB of artwork downloaded for the home page in total (the three seasonal images, the mascot, and the two unchanged illustrations).
- Q: Where do the source artwork files live — inside the repository or outside it? → A: The source artwork files are committed to the repository, in the `artwork/sources/` directory at the repository root alongside the processed assets, so that the automated check can compare each shipped asset directly against its source. FR-022 and SC-011 were rewritten to require the source artwork to be committed, and to make each shipped asset comparable against its source; FR-021 stays in force.
- Q: Does each shipped asset consist of one file, or a modern file plus a fallback file? → A: Each shipped asset is a single file in a format the supported browsers render directly. The one-file-per-game replacement contract (FR-018, FR-032, SC-014) is unchanged, and no asset depends on a second fallback file.
- Q: The mascot's height is described as proportional to the composition of its source, but the shipped mascot is derived from the trimmed character, not from the source canvas — which is it? → A: The mascot asset is 640 pixels wide, and its height is proportional to the trimmed composition of its source — the character alone, once the flat background has been removed — not to the source canvas. The shipped mascot asset therefore measures 640x1137 pixels, derived from a 1152x1712 source canvas (FR-024, SC-012).
- Q: Does the artwork set include the reserved winter asset? → A: Yes. The artwork set is seven images in all: one per game (five), the mascot, and the reserved winter asset, which is stored and mapped to no game and is served to no visitor (Vocabulary, Key Entities).
- Q: Should the spec call a card's description a "description" or a "summary"? → A: "summary" everywhere it appears, matching the code, the plan, the contract, the data model, and the card's summary hook. A "Card summary" entry is added to the Vocabulary (FR-002, SC-002).
- Q: What must hold when the visitor enlarges text to 200%? → A: A measurable outcome rather than a claim that the mascot scales: the mascot's size is set by the viewport, so it does not scale with the text. At 200% text zoom the mascot remains entirely inside the viewport, the home page still shows no horizontal scrollbar, and all five cards remain the same size (SC-022). The project owner accepted on 2026-11-13 that below roughly 1024 pixels the mascot overlaps card text at this zoom: a wrapped card-summary line reaches the corner the mascot occupies, and no single size token is both wide enough to be legible at 320 pixels and narrow enough to clear the text at 480 pixels. The overlap is accepted for this rare condition and is recorded as a known limitation, not a defect to be engineered away.
- Q: Who runs the 10-visitor recognition study behind SC-019, and where is it recorded? → A: It is a manual study run by the project owner before release, following the recognition-study step in the feature quickstart, and its result is recorded in that quickstart. It is not part of the automated test suite, and no automated test asserts it (SC-019).

### Session 2026-11-13

- Q: The seasonal card artwork is framed too tightly — the assets show only the character's head, with the chin cut off at the bottom edge. What framing should the seasonal artwork use? → A: The project owner reviewed the seasonal card artwork and asked for more of the character and more of the background, choosing a **waist-up framing with a blurred backdrop in the lateral margins**, keeping the face large and prominent. The seasonal images are therefore composed rather than merely cropped: the character is shown from the crown of the head down to the waist at its own scale — never stretched, and never with the chin cut off — and the area outside that framing carries a softened continuation of the same scene, so the season's defining features stay visible around and beside the figure. This satisfies FR-015 as it now reads, and SC-008 with it: the character's face is complete in every seasonal artwork and the season's defining background features remain visible. The decision is recorded in `plan.md` §Design Approach, in `research.md` R-004, in `contracts/artwork-assets.md` §4, and in `tasks.md` T006.
- Q: The mascot should be 30 % bigger. → A: The project owner asked on 2026-11-13 for a 30 % larger mascot, and each viewport band takes the largest token its band allows. **Band 2 (1024px and wider)** becomes `min(calc((100vw - 55rem) / 2 * 0.8), calc(53dvh * 640 / 1137))` — the mascot fills 80 % of the free column to the right of the centered catalog, capped at 53 % of the viewport height. The measured box is 194x345 at 1366x655, 224x398 at 1440x900 and 322x572 at 1920x1080: the mascot is 78 % of the column at 1366px and 1440px and 61 % at 1920px, where the height ceiling binds. The margin term is `55rem` rather than the catalog's own `56rem` because the catalog's inner list measures 872px, so `56rem` under-counted the free column by 8px on each side; the mascot never touches the catalog at any width. **FR-005's height ceiling was raised from 30 % to 55 %** on the same date, because the mascot is a tall figure (a 640x1137 bitmap, an aspect ratio of 1:1.78) and the 30 % ceiling was geometrically incompatible with the size the owner asked for. **Band 1 (320px – 1023px)** becomes `min(17vw, calc(17dvh * 640 / 1137))` — +6 % of the measured box — because **band 1 is capped by the clearance check, not by the +30 % request**: its token is the largest value for which the automated geometry check finds no intersection with any card name, summary, or state text, and `18` fails at 768x1024, where the mascot would cover the card name and the summary text. FR-005 is unchanged and still holds: the widest measured box is 17.0 % of the viewport width and the tallest is 29.0 % of the viewport height, so neither the 35 % width ceiling nor the 30 % height ceiling is crossed. The decision is recorded in `plan.md` §The mascot, in `research.md` R-009, in `contracts/home-mascot.md` §3 and §5, in `data-model.md` §Home Mascot, and in `tasks.md` T012.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A mascot keeps the visitor company while they browse (Priority: P1)

A visitor opens the home page and sees Matchi anchored at the bottom of the screen. They scroll down through the catalog to find a game, and Matchi is still there at the bottom of the viewport when they stop. Matchi never sits on top of a card's name, summary, or state, and never swallows a click: a visitor who taps a card right where Matchi is still opens that game. On a phone, Matchi shrinks to fit; on a wide screen, Matchi stands beside the catalog rather than on it.

**Why this priority**: The mascot is the headline of the request and the main reason to look at the home page. Without it the feature delivers only card art.

**Independent Test**: Load the home page, scroll to the top, the middle, and the bottom, and at each of the phone, tablet, laptop, and wide-desktop sizes confirm Matchi is fully visible at the bottom of the viewport, that no card text is covered, and that a click on the card nearest Matchi still opens the game.

**Acceptance Scenarios**:

1. **Given** the home page is at its top, **When** the viewport is inspected, **Then** the mascot is visible at the bottom edge of the viewport, entirely inside it.
2. **Given** the visitor has scrolled to the middle or the end of the catalog, **When** the viewport is inspected, **Then** the mascot is still visible at the bottom edge of the viewport in the same position.
3. **Given** the mascot is drawn over the region of a card, **When** the visitor clicks that card, **Then** the game opens and the click is not swallowed by the mascot.
4. **Given** a phone-width viewport, **When** the page renders, **Then** the mascot is scaled to fit within the viewport and remains entirely visible.
5. **Given** any supported viewport, **When** the page renders, **Then** no card's name, summary, or state text is covered by the mascot.
6. **Given** a viewport whose width is smaller than the mascot's natural width, **When** the page renders, **Then** the home page shows no horizontal scrollbar.
7. **Given** the home page is on screen, **When** it is watched for several seconds at any supported viewport, **Then** the mascot does not move, resize, or animate.
8. **Given** the home page has loaded, **When** the catalog is measured with the mascot present, **Then** the catalog's width and the page's vertical scroll behaviour are the same as they are without the mascot.

---

### User Story 2 - Seasonal editions are recognizable by their artwork (Priority: P1)

A visitor looks at the catalog and immediately sees that the three Match the Series cards are different from one another and from the other two games: Spring 2026 shows blossoms, Summer 2026 shows a bright shore, Autumn 2026 shows red autumn woods. Each picture fills the card's image area without stretching or squashing, and the three cards remain exactly the same size as each other and as the other two cards.

**Why this priority**: The three editions are otherwise near-identical on the page. Distinct artwork is what lets a visitor tell them apart at a glance, which is the entire point of themed card art.

**Independent Test**: Load the home page and review the five cards: each seasonal card shows artwork that unmistakably matches its own season, the three seasonal images are different from one another, and all five cards measure the same width and height.

**Acceptance Scenarios**:

1. **Given** the home page has loaded, **When** the visitor views the Spring 2026 card, **Then** its artwork shows a spring blossom scene with the character in it.
2. **Given** the home page has loaded, **When** the visitor views the Summer 2026 card, **Then** its artwork shows a bright summer shore scene with the character in it.
3. **Given** the home page has loaded, **When** the visitor views the Autumn 2026 card, **Then** its artwork shows an autumn foliage scene with the character in it.
4. **Given** the home page has loaded, **When** the visitor compares the five cards, **Then** the three seasonal images are visibly different from one another and from the More or Less and Groups images.
5. **Given** the home page has loaded, **When** the visitor compares the five cards, **Then** all five have identical width and height.
6. **Given** any seasonal card, **When** its artwork is inspected, **Then** the character's face is visible and the image is not stretched or squashed.

---

### User Story 3 - The shipped artwork is processed and light (Priority: P2)

Every image the app serves is a processed derivative of the supplied source: sized for the place it appears, framed to show the character and the season, and compressed for the web. The raw source files are kept in the repository so that every shipped asset can be checked against the source it came from, but they are never sent to a visitor, and the mascot no longer sits on a flat rectangular background.

**Why this priority**: Shipping raw sources would put multi-hundred-kilobyte originals in front of every visitor and would put uncropped, white-backed art on a page that supports a dark display mode. Processing is what makes the artwork usable rather than merely present.

**Independent Test**: Compare every shipped image against the source it derives from — the sources are in the repository, so the comparison is direct: each shipped asset is smaller than its source, re-encoded, cropped or resized as needed, none is byte-for-byte identical to a source, and the mascot has no rectangular background.

**Acceptance Scenarios**:

1. **Given** the shipped artwork set and the committed source artwork, **When** each shipped file is compared with the source it derives from, **Then** no shipped file is byte-for-byte identical to its source, and every shipped file is smaller than its source.
2. **Given** the mascot on the home page, **When** the page is shown in dark display mode, **Then** the mascot appears without a light rectangular block around it.
3. **Given** the shipped artwork set, **When** the file sizes and dimensions are measured, **Then** every seasonal card image is 800x450 pixels and no larger than 90 KB, and the mascot image measures 640x1137 pixels, keeps a transparent background, and is no larger than 150 KB.
4. **Given** the home page, **When** the visitor loads it, **Then** the total artwork downloaded for the page — the three seasonal images, the mascot, and the two unchanged illustrations — is no larger than 450 KB.

---

### User Story 4 - Artwork failures never break the home page (Priority: P2)

If the mascot or a seasonal image cannot be loaded, the home page stays completely usable: the missing picture leaves a neutral gap or the standard placeholder, no broken-image icon appears, and every card keeps its size and its link.

**Why this priority**: The constitution promises that a failure path never renders a blank or broken page. Artwork is an enhancement, and a visitor who cannot load one image must still be able to pick and play a game.

**Independent Test**: Force the mascot file and one seasonal file to fail, reload the home page, and confirm the catalog is complete, card sizes are unchanged, no broken-image indicator appears, and every playable card still opens its game.

**Acceptance Scenarios**:

1. **Given** the mascot image fails to load, **When** the home page renders, **Then** the catalog is complete and usable and no broken-image indicator appears.
2. **Given** one seasonal card image fails to load, **When** the home page renders, **Then** that card shows the standard neutral placeholder at the same size as its siblings and the other four cards are unaffected.
3. **Given** any artwork failure, **When** the visitor clicks a playable card, **Then** the game opens normally.

---

### User Story 5 - The catalog's existing guarantees survive (Priority: P3)

The new artwork changes nothing else: the same five games in the same order, the same uniform cards, no horizontal scrollbar at any width, the whole catalog still fits on a 1920x1080 screen, the same keyboard and screen-reader behavior, and the More or Less and Groups cards keep their current artwork.

**Why this priority**: The mascot and the new card art sit on top of a catalog that already meets a set of hard guarantees. Losing any of them would make the home page worse than it is today.

**Independent Test**: Run the existing home-page checks for catalog completeness, uniform card size, overflow, hover and focus behavior, locale switching, and artwork replacement, with the mascot and the new seasonal art in place.

**Acceptance Scenarios**:

1. **Given** the home page has loaded, **When** the visitor lists the games, **Then** the same five games appear exactly once in the same order as before.
2. **Given** any supported viewport, **When** the page renders, **Then** the home page shows no horizontal scrollbar and no element extends past the window's horizontal edges.
3. **Given** a 1920x1080 viewport, **When** the page renders, **Then** the whole catalog fits without vertical scrolling.
4. **Given** the visitor switches language, **When** the page updates, **Then** the artwork is unchanged and no new text appears.
5. **Given** a keyboard-only visitor, **When** they tab through the home page, **Then** the mascot adds no new focus stop.
6. **Given** the More or Less and Groups cards, **When** they render, **Then** their artwork is unchanged from before this feature.

---

### Edge Cases

- **The viewport is shorter than the mascot**: the mascot scales to fit the viewport instead of being clipped off the bottom.
- **The visitor enlarges text to 200%**: the mascot's size is set by the viewport, not by the text size, so it does not scale with the text. The mascot remains entirely inside the viewport, the page still shows no horizontal scrollbar, and all five cards remain the same size. **Known limitation (accepted 2026-11-13)**: below roughly 1024 pixels the mascot overlaps card text at this zoom, because a wrapped card-summary line reaches the corner it occupies and no single size token satisfies both ends of the range.
- **The window is resized while the page is scrolled**: the mascot stays anchored to the bottom edge of the new viewport.
- **The page is shorter than the viewport** (wide desktop, no scrolling): the mascot is still visible and nothing scrolls.
- **The visitor scrolls by touch, wheel, or keyboard**: the mascot does not move relative to the viewport.
- **A card sits exactly under the mascot's region on a narrow screen**: the card's text stays readable and the card stays tappable.
- **The mascot image is slow to load**: the page renders and behaves as if the mascot were absent, with no broken-image icon and no visible layout shift.
- **The page is in dark display mode**: the background-free mascot stays visible against the dark surface.
- **A seasonal card image is missing**: the card shows the standard neutral placeholder at identical dimensions and the catalog never collapses.
- **A seasonal image is replaced with one of a different aspect ratio**: the image is fitted into the band, not stretched, and the card's size does not change.
- **A seasonal image is replaced with one whose crop cuts off the character's face**: the card still renders correctly; the composition of a replacement is a review-time judgement, not a runtime failure.
- **The winter scene has no edition**: the winter artwork is never displayed on any card.
- **A processed asset is within its size budget but still larger than its source**: the budget is a ceiling, not a target — the asset is re-processed until it is smaller than its source, and the artwork check fails until it is. The mascot's 150 KB ceiling is larger than its own source file, so this rule is the binding one for the mascot.
- **A source file is missing from the artwork source directory**: the shipped asset derived from it has nothing to be checked against, so the artwork check fails and that asset is not shipped until its source is committed.
- **The visitor switches language**: the artwork does not change; only the card's text changes.
- **The UTC day rolls over**: the artwork does not change.
- **A future seasonal edition is added**: it can be given artwork through the same per-game replacement contract without disturbing the existing cards.
- **The daily listing fails**: the error panel and its retry action remain, and the mascot does not interfere with them.
- **The visitor prefers reduced motion**: the mascot behaves exactly as it does for every other visitor, because it never animates.
- **The visitor prints the page or copies its text**: the mascot adds no duplicate card content.

## Requirements *(mandatory)*

### Functional Requirements

#### Mascot

- **FR-001**: The home page MUST display the mascot anchored to the bottom edge of the viewport, so that it remains entirely visible at every scroll position of the home page. The mascot MUST float over the page and the layout MUST NOT reserve space for it; the mascot's presence MUST NOT change the catalog's width, nor make the page scroll where it otherwise would not.
- **FR-002**: The mascot MUST NOT cover any game card's name, summary, or state text at any supported viewport.
- **FR-003**: The mascot MUST NOT intercept pointer or touch input; any control, link, or card that lies beneath the mascot's region MUST remain clickable and tappable.
- **FR-004**: The mascot MUST NOT produce a horizontal scrollbar at any window width from 320 to 1920 pixels, and MUST NOT extend beyond the window's horizontal edges.
- **FR-005**: The mascot MUST scale down on narrow viewports so that it stays entirely visible, and MUST NOT occupy more than 35% of the viewport's width or 55% of its height at any supported size. The height ceiling was raised from 30% to 55% on 2026-11-13: the mascot is a tall figure (a 640x1137 bitmap, an aspect ratio of 1:1.78), so filling the free column to the right of the catalog — the size the owner asked for — necessarily takes more height than width, and the 30% ceiling and the owner's requested size were geometrically incompatible. The 35% width ceiling is unchanged and is never approached: the widest measured box is 17.4% of the viewport width.
- **FR-006**: The mascot MUST be decorative: it MUST convey no information that is not also available as text, MUST be ignored by assistive technology, and MUST NOT introduce a new focusable element or tab stop.
- **FR-007**: The mascot MUST be legible in both light and dark display modes; it MUST NOT appear as a light rectangular block against a dark page.
- **FR-008**: If the mascot image fails to load, the home page MUST remain fully usable and MUST NOT display a broken-image indicator.
- **FR-009**: The mascot MUST be a still image and MUST NOT animate, at any time, for any visitor; in particular it MUST NOT animate while the visitor's system requests reduced motion.
- **FR-010**: The mascot MUST NOT cause visible layout shift when it loads.
- **FR-011**: The mascot MUST appear on the home page only; game screens MUST keep their current presentation.

#### Seasonal card artwork

- **FR-012**: Each of the three seasonal editions MUST display themed artwork in its card image band.
- **FR-013**: Each seasonal edition's artwork MUST depict its own season: Spring 2026 a blossom scene, Summer 2026 a bright shore, Autumn 2026 autumn foliage.
- **FR-014**: The three seasonal artworks MUST be visually distinct from one another and from the artwork of the non-seasonal games.
- **FR-015**: Seasonal artwork MUST fill the card image band without distortion; the character and the season's defining background features MUST remain visible and MUST NOT be cropped out. The framing MUST show the character from the crown of the head down to at least the waist — the face MUST be complete and MUST NOT be cut off at the bottom edge — and the season's defining features MUST remain visible around and beside the character, either directly or in a softened continuation of the same scene.
- **FR-016**: Seasonal artwork MUST NOT change the card's width or height, and all five cards MUST remain identical in size at every supported viewport.
- **FR-017**: The More or Less and Groups games MUST keep their current artwork; this feature MUST NOT change the artwork of any non-seasonal game.
- **FR-018**: Each game's artwork MUST remain replaceable by replacing a single file at a stable location, with no change to card markup, layout, or behavior, and MUST NOT depend on a second fallback file for the same asset.
- **FR-019**: If a seasonal artwork file is missing or fails to load, the card MUST show the existing neutral placeholder at the same size, with no broken-image indicator.
- **FR-020**: The winter scene supplied for this feature MUST be processed and stored alongside the other seasonal assets, so that a future winter edition can be given artwork without re-sourcing it; the winter artwork MUST NOT be displayed on any card by this feature, MUST NOT be downloaded by the home page, and MUST NOT be counted against the home page's artwork budget.

#### Asset processing

- **FR-021**: Every image shipped for this feature MUST be a processed derivative of the supplied source artwork; no shipped image may be a byte-for-byte copy of a source file, and every shipped asset MUST be smaller in bytes than the source it derives from.
- **FR-022**: The source artwork files MUST be committed to the repository, in the `artwork/sources/` directory at the repository root, which the app does not serve, alongside the processed assets; the sources are part of the project record and MUST NOT be reachable by a visitor's browser. Every processed asset MUST have exactly one source, identified by name, so that each shipped asset can be compared directly against the source it derives from.
- **FR-023**: The mascot asset MUST have its flat background removed so it can be composited over the page in both display modes.
- **FR-024**: Each processed seasonal asset MUST be 800x450 pixels and MUST NOT exceed 90 KB. The mascot asset MUST be 640 pixels wide, with its height proportional to the trimmed composition of its source — the character alone, once the flat background has been removed — so that the shipped mascot asset measures 640x1137 pixels; it MUST keep a transparent background and MUST NOT exceed 150 KB.
- **FR-025**: Each processed asset MUST consist of a single file in a format that the supported browsers render directly; the asset MUST NOT depend on a second fallback file, and MUST NOT rely on a format that only some supported browsers render.
- **FR-026**: The total artwork downloaded when loading the home page MUST NOT exceed 450 KB, counting the three seasonal card images, the mascot, and the two unchanged non-seasonal illustrations.
- **FR-027**: The processed assets MUST remain visually faithful to their source scenes: the same character, the same palette, and no alteration beyond resizing, cropping, compositing regions of the same source, compression, and background removal.

#### Compatibility and quality

- **FR-028**: The feature MUST NOT add, remove, or rename games; change game routes; alter daily content, availability rules, or puzzle generation; or change saved results, sharing, or reset behavior.
- **FR-029**: The feature MUST NOT introduce user-facing text. Any user-facing string that is introduced MUST exist in both Spanish and English through the message catalog.
- **FR-030**: All artwork MUST be served by the app itself; the feature MUST NOT hotlink images or load fonts, scripts, or styles from an external host.
- **FR-031**: The home page MUST keep its existing guarantees: five cards in a stable order, no horizontal scrolling at any supported width, the catalog fully visible without vertical scrolling at 1920x1080, and the reset countdown and language control in place.
- **FR-032**: The guarantee that each game has exactly one distinct, self-contained artwork file MUST continue to hold for all five games, and MUST be verifiable for both vector and raster artwork.
- **FR-033**: The feature MUST NOT add a dependency to the app's runtime or test toolchain. Any tooling used to produce the artwork MUST be named in the feature's plan and approved by name before use.
- **FR-034**: The mascot and the seasonal artwork MUST NOT vary with the visitor's locale, timezone, or the current UTC day.
- **FR-035**: The feature MUST comply with the project's constitution, including its bilingual-UI, fail-visible, lean-test, and delivery-model constraints.

### Key Entities

- **Mascot Asset**: The processed, background-free illustration of Matchi shown persistently at the bottom of the home viewport. It carries a stable location, a decorative display role, size limits, and a defined behaviour when it fails to load.
- **Themed Card Artwork**: The processed seasonal image bound to one seasonal edition. It carries its season, the source scene it derives from, a stable location, the replacement contract, and the placeholder fallback.
- **Source Artwork**: A supplied original image that is the origin of exactly one processed asset. It is committed to the repository's `artwork/sources/` directory, is never served to a visitor, and is never referenced by the app at runtime; it exists so that every shipped asset can be checked against the source it derives from.
- **Artwork Set**: The complete collection of images available to the app — seven in all: one per game (five), the mascot, and the reserved winter asset, which is stored and mapped to no game — holding the per-game distinctness and self-containment guarantee.
- **Home Catalog**: The five catalog entries shown on the home page. It is unchanged by this feature except that three entries now reference themed seasonal artwork.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The mascot is entirely visible and inside the viewport in 100% of checks across the scroll positions (top, middle, bottom) and the viewports (360x640, 768x1024, 1024x768, 1440x900, 1920x1080).
- **SC-002**: 0 game cards have their name, summary, or state text covered by the mascot at any tested viewport.
- **SC-003**: 100% of playable cards open their game when clicked at a point lying under the mascot's region; 0 clicks are swallowed.
- **SC-004**: 0 horizontal scrollbars appear on the home page at window widths from 320 to 1920 pixels, with the mascot present.
- **SC-005**: The mascot occupies no more than 35% of the viewport width and no more than 55% of the viewport height at every tested viewport.
- **SC-006**: The mascot introduces 0 new focusable elements (0 additional tab stops) and 0 information conveyed only through the image.
- **SC-007**: 100% of the three seasonal cards display artwork that a reviewer identifies as the correct season, with 0 mismatches, and the three images are visually distinct from one another and from the two non-seasonal cards.
- **SC-008**: The character's face, framed from the crown of the head down to at least the waist with nothing cut off at the bottom edge, and the season's defining background features are visible in 100% of the seasonal card artworks, with 0 stretched, squashed, or face-cropped images.
- **SC-009**: All five cards have identical width and height at every tested viewport, with 0 pixels of difference between any two cards.
- **SC-010**: 0 shipped images are byte-for-byte identical to a source artwork file, and 100% of shipped assets are smaller than the source they derive from, as reported by an automated check that compares each shipped asset directly against its source in the repository.
- **SC-011**: The source artwork files are present in the repository's `artwork/sources/` directory: 5 source files are committed and 0 are missing, and 0 source files are reachable by a visitor's browser.
- **SC-012**: Each seasonal card image measures 800x450 pixels and weighs no more than 90 KB, the mascot image measures 640x1137 pixels with a transparent background and weighs no more than 150 KB, and the total artwork downloaded for the home page weighs no more than 450 KB.
- **SC-013**: The mascot image fails to load → the home page remains fully usable, 0 broken-image indicators appear, and all five cards still render with artwork or placeholder.
- **SC-014**: The existing artwork guarantee holds for all five games: each has exactly one distinct, self-contained file that exists, with 0 external references and 0 assets that depend on a second fallback file.
- **SC-015**: The home page still fits within a 1920x1080 viewport without vertical scrolling.
- **SC-016**: 0 new user-facing strings are introduced, so both languages stay complete with 0 missing or fallback strings.
- **SC-017**: The feature adds 0 dependencies to the app's runtime or test toolchain.
- **SC-018**: Existing game behavior, routes, daily content, availability, saved results, and sharing show 0 regressions.
- **SC-019**: In a first-use check with 10 visitors, at least 8 identify the correct seasonal edition from its card artwork alone in under 5 seconds. The study is run manually by the project owner before release, following the recognition-study step in the feature quickstart, and its result is recorded in that quickstart; it is not part of the automated test suite, and no automated test asserts it.
- **SC-020**: The mascot performs 0 animations and 0 motion effects for 100% of visitors, including 100% of visitors whose system requests reduced motion.
- **SC-021**: The mascot changes the catalog's rendered width by 0 pixels and the home page's vertical scroll behaviour by 0 at every tested viewport; the catalog still fits a 1920x1080 viewport without vertical scrolling with the mascot present.
- **SC-022**: At 200% browser text zoom, the mascot remains entirely inside the viewport, the home page still shows no horizontal scrollbar, and all five cards remain identical to one another in width and height. The mascot's size is set by the viewport, not by the text size, so it does not scale with the text. **Known limitation, accepted by the project owner on 2026-11-13**: at 200% text zoom the mascot overlaps card text at viewports narrower than about 1024 pixels, because a wrapped card-summary line reaches the corner the mascot occupies and no single size token is both wide enough to be legible at 320 pixels and narrow enough to clear the text at 480 pixels. The overlap is accepted for this rare condition; at the default text size no card text is covered at any tested viewport.

## Assumptions

- **The seasonal card art is composed, not merely cropped.** The character is framed from the crown of the head down to the waist and kept at its own scale, and the area outside that framing carries a blurred continuation of the same scene, so the season stays legible in the margins. The project owner chose this framing on 2026-11-13, after the first 16:9 crop proved too tight: it framed the character's head alone and cut the chin at the bottom edge.
- **The mascot character is Matchi**, matching the supplied artwork. The name is internal and is not shown to visitors; the mascot carries no text.
- **The mascot appears on the home page only.** Game screens, error pages, and shared result pages keep their current presentation.
- **The seasonal cards in scope are the three editions that exist today** — Spring 2026, Summer 2026, and Autumn 2026. This feature adds no new edition and introduces no fourth seasonal game.
- **The supplied winter scene is processed and stored with the rest of the seasonal asset set** so a future winter edition has artwork ready, but it is not displayed on any card here. It counts as one of the seven images in the artwork set and is mapped to no game; it is never downloaded by the home page and never counts against the home page's artwork budget.
- **The mascot is decorative.** It conveys no information, is hidden from assistive technology, and adds no focus stop.
- **The mascot is a still image.** It never animates, so a visitor whose system requests reduced motion sees the same page as every other visitor.
- **The mascot's proportions come from the trimmed character, not from the source canvas.** Its height is proportional to the composition left after the flat background is removed, so the shipped mascot asset measures 640x1137 pixels rather than a scaled copy of the 1152x1712 source canvas, and the mascot carries no dead space around it.
- **The mascot's size is set by the viewport, not by the visitor's text size.** Enlarging the text to 200% does not enlarge the mascot; what must hold at that zoom is the outcome stated in the edge case — the mascot stays inside the viewport and the page still does not scroll sideways. The project owner accepted on 2026-11-13 that below roughly 1024 pixels the mascot overlaps card text at 200% zoom, since no single size token can be both legible at 320 pixels and clear of the text at 480 pixels.
- **The recognition study behind SC-019 is a manual, owner-run check.** The project owner runs it before release, using the step in the feature quickstart, and records the result there. It is not part of the automated test suite, and nothing in the test suite asserts it.
- **Wide viewports leave free margin beside the centered catalog**, which is where the mascot naturally sits. On narrow viewports the mascot is scaled down. In both cases the layout reserves no space for the mascot: it floats over the page and is placed so that no card text is covered.
- **The home page keeps its current vertical-scroll behaviour**: it scrolls when its content exceeds the viewport, and it MUST NOT gain a scrollbar where it does not currently have one.
- **The existing per-game artwork replacement contract extends to raster artwork.** The guarantee that each game maps to one distinct, self-contained file that exists stays in force; only the way it is verified changes.
- **No new user-facing copy is needed.** The mascot and the seasonal art carry no text, so both message catalogs stay complete as they are.
- **Producing the artwork does not require a dependency in the app.** The tools that turn the supplied sources into processed assets are a build-time concern for the plan to name and for the project owner to approve.
- **The artwork is produced from the sources supplied for this feature** and is stored in the app's own static assets; no external host serves any of it. The source files themselves are committed to the repository's `artwork/sources/` directory, which the app never serves, so that every shipped asset can be checked against its source.
- **The size budgets are ceilings, not targets.** A shipped asset must also be smaller than the source it derives from, and that rule binds wherever the two conflict: the mascot's 150 KB ceiling is larger than its own source file, so the mascot must still come out smaller than that source.
- **Constitution v3.0.0 governs this feature.** It removed the constraint that forbade third-party imagery, which is what makes these supplied images usable, while the self-contained-delivery, bilingual-UI, fail-visible, and lean-test constraints remain in force.
