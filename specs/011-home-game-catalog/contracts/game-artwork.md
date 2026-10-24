# Contract: Home Game Artwork

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

## 1. Location and Naming

One original image per game lives under `public/games/` and is served from the site origin.

| Game | File | Served path |
|------|------|-------------|
| More or Less | `public/games/more-or-less.svg` | `/games/more-or-less.svg` |
| Match the Series — Autumn 2026 | `public/games/match-the-series-autumn-2026.svg` | `/games/match-the-series-autumn-2026.svg` |
| Match the Series — Spring 2026 | `public/games/match-the-series-spring-2026.svg` | `/games/match-the-series-spring-2026.svg` |
| Match the Series — Summer 2026 | `public/games/match-the-series-summer-2026.svg` | `/games/match-the-series-summer-2026.svg` |
| Groups | `public/games/groups.svg` | `/games/groups.svg` |

The typed mapping in `app/utils/gameArt.ts` is the single source of truth. It must contain one
entry per `GameId`; a missing or duplicate mapping is a defect.

## 2. Image Requirements

- Format: SVG preferred. A raster replacement is acceptable only if it keeps the same path
  extension in the mapping and still fits the frame.
- Canvas: `viewBox="0 0 320 180"` (16:9). The important content sits within a safe area of at least
  16 pixels from every edge.
- Content: original, representative of the game, and free of text, logos, or third-party
  characters.
- Dependencies: self-contained; no external images, fonts, scripts, CSS imports, or network
  references.
- Size: target under 20 KB per file; total artwork budget under 100 KB.
- Theme: readable against the card's artwork background in both light and dark display modes; the
  image supplies its own background if needed.
- Accessibility: purely decorative. The image is rendered with `alt=""` and hidden from assistive
  technology; the card text carries the game name and state.
- Suggested visual language:
  - **More or Less**: two opposing quantities or a balance motif.
  - **Match the Series — Autumn 2026**: a grid/tile motif with an autumn cue.
  - **Match the Series — Spring 2026**: the same grid family with a spring cue.
  - **Match the Series — Summer 2026**: the same grid family with a summer cue.
  - **Groups**: four clustered sets of tiles.

## 3. Replacement Procedure

### Replace an existing game's image

1. Put the new image at the exact same path in `public/games/`.
2. Keep or update the 16:9 view box; `object-fit: contain` letterboxes a different ratio without
   changing the card size.
3. Reload the page and confirm the card's image changed and all five cards remain equal in size.
4. No component, CSS, mapping, or test change is required.

If a production cache serves the old file, rename the file and update the one-line mapping in
`app/utils/gameArt.ts`; the new path busts the cache.

### Add artwork for a future game

1. Add the game to `GameId` / `GAME_IDS` through the normal feature process.
2. Add its file under `public/games/` using the route slug.
3. Add the matching mapping entry in `app/utils/gameArt.ts`; TypeScript will require it.

## 4. Fallback Contract

- The frame is always present and keeps its 16:9 size.
- If the mapped file is missing, returns an error, or fails to decode, the component removes the
  image and renders a neutral patterned placeholder marked `data-art-fallback`.
- The fallback contains no text and no broken-image icon.
- The card's width, height, text positions, state, and interaction are unchanged by the fallback.

## 5. Verification

- A unit test asserts every `GameId` has one distinct path and that the file exists and is a
  non-empty SVG.
- A Playwright test forces one artwork request to fail and asserts the fallback appears while all
  card boxes remain equal and the page has no horizontal overflow.
- Manual review confirms all five images are visibly distinguishable at normal and 200% text size.

## 6. Originality and Licensing

- All five images are created for Animatch and committed with the feature.
- No image may be copied, traced, or downloaded from another puzzle site, including the site
  referenced in the feature request.
- Artwork must not include sensitive, offensive, or copyrighted third-party material.
