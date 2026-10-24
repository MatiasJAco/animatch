# UI Contract: Home Game Catalog

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

This contract describes the observable home-page interface. The daily API payload is unchanged.

## 1. Catalog Structure

- The page renders exactly one catalog list for the current daily listing.
- The list contains exactly one card per `GAME_IDS` entry, in this order:
  1. `more_or_less`
  2. `match_the_series_autumn_2026`
  3. `match_the_series_spring_2026`
  4. `match_the_series_summer_2026`
  5. `groups`
- Each card root carries:
  - `data-game-card`
  - `data-game="<GameId>"`
  - `data-state="playable|finished|unavailable|error"`
- Card text is exposed with `data-card-name`, `data-card-summary`, and `data-card-state` when a
  state message exists.
- The card's visible name and summary come from the active locale's existing message keys.

## 2. Card States

| `data-state` | Root element | Link? | Focusable? | Hover change? | Visible state |
|--------------|--------------|-------|------------|---------------|----------------|
| `playable` | Anchor with the game's route as `href` | Yes | Yes | Yes | Name + summary |
| `finished` | Non-interactive article | No | No | No | Grey surface + "Finished today" |
| `unavailable` | Non-interactive article | No | No | No | Inert surface + unavailable message |
| `error` | Non-interactive article | No | No | No | Inert surface + database-unavailable message |

Rules:

- A card with a completed result for the current UTC day is `finished` regardless of its listing
  status.
- An errored game is `error`; an insufficient-content game is `unavailable`; otherwise a non-
  finished ready game is `playable`.
- `finished`, `unavailable`, and `error` cards have no `href`, no `role="link"`, and no click
  handler.
- No card contains a Play button or any nested button/link.

## 3. Uniform Geometry

At a given viewport, every `[data-game-card]` must have the same rendered width and height
(tolerance of 1 pixel for sub-pixel rounding).

| Viewport width | Columns | Card block size | Catalog max width |
|----------------|---------|-----------------|-------------------|
| `< 40rem` | 1 | `24rem` | `56rem` |
| `40rem – 59.99rem` | 2 | `25rem` | `56rem` |
| `>= 60rem` | 3 | `24rem` | `56rem` |

- Columns are equal `1fr` tracks; a short last row keeps the same column width.
- Each card contains, top to bottom: a 16:9 artwork frame capped at 45% of the card height, name,
  summary, and optional state row. The cap keeps the text area readable when a card is very wide or
  the visitor enlarges text.
- The state row is bottom-aligned so all cards share the same visual rhythm.
- Card content must remain inside the card at 200% root-font size; no text may overlap the artwork
  or neighbouring cards.
- The card block size is expressed in `rem`, so it scales with the visitor's text-size setting.

## 4. Interaction

### Playable card

- The whole card is the click/tap target, including artwork, name, summary, padding, and empty
  space.
- Clicking or tapping anywhere navigates to the card's game route.
- The pointer cursor changes to the platform's link cursor on pointer-capable devices.
- Hovering changes the surface colour, border, and/or shadow without changing the card's box.
- Keyboard focus is reachable in visual order, shows the global focus outline plus the accent
  emphasis, and Enter or Space activates the link.
- Middle-click and open-in-new-tab retain native anchor behavior.

### Inactive card

- Pointer hover produces no colour change and no pointer/link cursor.
- Clicking or tapping performs no navigation.
- The card is skipped by sequential keyboard focus.
- The state message is visible text, not colour alone.

## 5. Artwork Frame

- Every card renders a `GameArt` frame with `data-game-art`.
- The image uses `data-art-image`; the fallback uses `data-art-fallback`.
- The frame keeps a 16:9 ratio (capped at 45% of the card height) and the same position on every card.
- The image is decorative: `alt=""` and hidden from assistive technology.
- A missing or failed image swaps to the neutral fallback without changing the card's dimensions or
  the catalog layout.
- The artwork file and replacement rules are defined in
  [game-artwork.md](./game-artwork.md).

## 6. Accessibility

- A playable card is a link whose accessible name is derived from its visible name, summary, and
  state text. The visual artwork does not add a duplicate name.
- A finished card announces the game name, summary, and "Finished today" as static text.
- Unavailable and errored cards announce their explanatory message as static text.
- Focus order follows the visual order; inactive cards add no focus stops.
- Focus remains visible without relying on the hover colour.
- Text and state treatments meet at least 4.5:1 contrast in light and dark modes.
- Under `prefers-reduced-motion`, colour transitions are suppressed.

## 7. Responsive and Failure Behaviour

- From 320 to 1920 pixels wide, the document has no horizontal overflow and no card extends past
  the viewport edge.
- When the catalog is taller than the viewport, the document scrolls vertically as one surface; no
  card list or card body introduces an independent scroll region.
- At 1920x1080, the header, five cards, and countdown fit without vertical scrolling.
- A total listing failure keeps the existing page-level error panel with a retry action; it must
  not render an empty catalog.
- While loading, the page shows the existing loading message and never a "no games" state.
- Switching locale re-renders all card text and state messages without a page reload.

## 8. Existing Behaviour Preserved

- The daily API shape, route paths, game content, availability probing, puzzle identity, local
  result keys, sharing, and reset behavior are unchanged.
- The reset countdown and language control remain on the page.
- The development-only reset control remains development-only and must not cause overflow.
