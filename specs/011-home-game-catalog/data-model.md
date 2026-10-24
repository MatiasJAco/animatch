# Phase 1 Data Model: Responsive Home Game Catalog

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Summary

This feature introduces no database table, column, migration, server payload, or stored browser
field. It adds two presentation-only structures:

1. A derived catalog entry that joins the existing daily listing with its game artwork and
   presentation order.
2. A derived card presentation that turns the listing status plus today's device result into one
   of four mutually exclusive visual states.

Everything is computed at render time from existing data.

## Existing Inputs (unchanged)

| Input | Source | Fields used |
|-------|--------|-------------|
| Daily listing | Existing `/api/daily` response | `date`, `games[].game`, `games[].status` |
| Game identity | `server/game/ids.ts` | `GameId` union and `GAME_IDS` order |
| Display copy | `app/i18n/en.ts`, `app/i18n/es.ts` | `game.<id>`, `game.<id>.summary`, `home.finished_today`, `error.PUZZLE_UNAVAILABLE`, `error.DATABASE_UNAVAILABLE` |
| Device result | `useLocalProgress()` | `status` (`won` / `lost`) for the current UTC day |
| Artwork map | New `app/utils/gameArt.ts` | `GameId` → static path under `public/games/` |

No field above changes shape. The feature only reads it.

## Entity: Game Catalog Entry

One card's complete presentation input.

| Field | Type | Source | Rule |
|-------|------|--------|------|
| `game` | `GameId` | Daily listing | Must be one of the five current game identities |
| `name` | string | `t('game.<id>')` | Active locale; never empty |
| `summary` | string | `t('game.<id>.summary')` | Active locale; never empty |
| `artworkPath` | string | `gameArtPath(game)` | Stable, unique per game, starts with `/games/` |
| `status` | `'ready' \| 'unavailable' \| 'error'` | Daily listing | Existing status union |
| `localResult` | `LocalGameState \| undefined` | Device progress | Only used to derive `won` / `lost` |
| `target` | string | Existing route convention | `/game/<game-with-hyphens>` |
| `order` | integer | `GAME_IDS` index | Stable: More or Less, Autumn, Spring, Summer, Groups |

**Validation**

- Exactly one entry per `GAME_IDS` entry, in `GAME_IDS` order.
- `artworkPath` values are unique and each resolves to an existing file.
- `name`, `summary`, and `target` are non-empty; `target` follows the existing route pattern.
- No entry is removed or reordered because of its status or result.

## Entity: Game Artwork

A replaceable static image associated with one game.

| Field | Type | Rule |
|-------|------|------|
| `game` | `GameId` | Exactly one artwork per game |
| `path` | string | `/games/<route-slug>.svg` |
| `viewBox` | string | `0 0 320 180` (16:9) |
| `decorative` | boolean | Always `true`; the card text carries meaning |
| `fallback` | neutral placeholder | Rendered when the file is missing or fails |

**Validation**

- The map covers every `GameId`; TypeScript's exhaustive `Record` makes a missing key a compile
  error.
- Each path is unique and its file exists under `public/`.
- The SVG contains no text, external image, font, or script reference.
- Replacing a file at the same path requires no code change; a filename change requires one map
  edit.

## Entity: Card Presentation

A pure derivation used by the card component and unit tests.

| Field | Type | Rule |
|-------|------|------|
| `playable` | boolean | `true` only when status is `ready` and the local result is not `won` or `lost` |
| `tone` | `'playable' \| 'finished' \| 'unavailable' \| 'error'` | Exactly one value |
| `messageKey` | `MessageKey \| null` | `home.finished_today` for finished, `error.PUZZLE_UNAVAILABLE` for unavailable, `error.DATABASE_UNAVAILABLE` for error, `null` for playable |

**Priority**

```text
local result won/lost  → finished
status error           → error
status unavailable     → unavailable
status ready           → playable
```

A finished result wins even if the later status probe reports an error or unavailable, because the
player has already completed that game for today.

## State Transitions

| Current state | Trigger | Next state | Home-page effect |
|---------------|---------|------------|------------------|
| Loading | Listing succeeds | Per-game status | Cards render |
| Loading | Listing fails | Listing failure | Page-level error with retry; no empty catalog |
| Playable | Player finishes the game and returns | Finished | Greyed card, marker shown, no link or hover |
| Playable | Status probe reports insufficient content | Unavailable | Inert card, unavailable message |
| Playable | Status probe fails | Error | Inert card, database-unavailable message |
| Finished / unavailable / error | UTC day changes and page reloads | Recomputed from new listing and empty day result | Card can become playable again |
| Any | Reset (development) clears the game result | Recomputed | Finished card returns to playable without a server effect |

## Relationships

```text
GAME_IDS (1) ──< Game Catalog Entry (1 per game)
Game Catalog Entry (1) ── (1) Game Artwork
Daily listing (1) ──< Game Catalog Entry (1 per listing entry)
Device result (0..1 per game/day) ──> Card Presentation
```

## Non-Goals

- No new persistence, server response, API route, database access, or schema.
- No cross-device or server-side result.
- No per-game settings, favorites, sorting, or filtering.
- No changes to game rules, puzzle content, availability thresholds, or routes.
