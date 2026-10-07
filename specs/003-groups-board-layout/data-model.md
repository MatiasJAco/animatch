# Data Model: Groups Board Rows-Driven Layout

- **Feature**: specs/003-groups-board-layout
- **Date**: 2026-10-06

This feature is presentation-only; it introduces **no new tables, no new API fields, and no
change to existing persisted state**. The model below describes the derived board-presentation
state the client computes while rendering.

## 1. Derived presentation state

The board presentation is computed by a pure function `buildBoardRows` in `app/utils/groupsBoard.ts`
(see research R-003). It takes the day's puzzle tiles, the groups the player already found, and —
after a loss — the groups the server disclosed, and returns the rows layout plus the tiles that
remain selectable.

### `GroupRow` (entity)

| Field | Type | Meaning |
|-------|------|---------|
| `kind` | `'found' \| 'revealed'` | `found`: the player solved the group during play. `revealed`: the player lost and the group was disclosed at the end. |
| `criterion` | `GroupCriterion` | The shared characteristic, rendered as the row's left-hand label (type + supporting ids, unchanged from the server outcome). |
| `tileKeys` | `string[]` | Exactly the four tile keys of the group, in the order given by the source (found set / disclosure list). |

### `BoardPresentation` (entity)

| Field | Type | Meaning |
|-------|------|---------|
| `rows` | `GroupRow[]` | All groups to display, ordered: found rows in discovery order first, then (on a loss) the remaining rows in disclosure order (R-005). Exactly one row per group; every tile appears in exactly one row. |
| `selectable` | `string[]` | Tile keys still available for selection in the in-play area. Excludes every found tile; when the game has ended this is empty. |

### Invariants (validated wherever a test builds a presentation)

- One row per group: `rows.length` is `found.length` in play, and the board's group count (4)
  after a loss.
- Exactly-once membership: the union of all `tileKeys` equals the puzzle's tile keys on the loss
  layout; no key appears in two rows; found keys never reappear as selectable.
- Found rows never restyle or reorder when the loss layout appears (spec FR-006).
- Row count and labels are derived from existing data; they add no new server field.

## 2. Function contract

`buildBoardRows(tiles, found, revealed)`:

| Input | Shape | Source |
|-------|-------|--------|
| `tiles` | puzzle tiles (entity list) | `GET /api/daily/groups` payload, unchanged |
| `found` | `Array<{ keys: string[]; criterion: GroupCriterion }>` | `useLocalProgress` stored `foundGroups` |
| `revealed` | `Array<{ keys: string[]; criterion: GroupCriterion }> \| null` | server's ending-miss `groups` disclosure; `null` while the game is in play |

Returns a `BoardPresentation`. `revealed === null` → rows are exactly the found groups and
`selectable` is `tiles - foundKeys`. `revealed !== null` → rows are found groups, then every
remaining group from `revealed`, and `selectable` is empty.

## 3. Persisted state (unchanged)

`useLocalProgress` already stores the Groups entry as `{ status, attempts, mistakes, found,
foundGroups, missLog }`. This feature writes the same entry on every hit (the page's existing
`setGameState` call) and reads `foundGroups` on mount to restore the rows. The loss reveal is
**transient** (research R-007): it lives in component memory only for the finished board shown in
the ending session, and is not persisted.

## 4. State transitions (presentation only)

```
in play                     ──hit──▶  foundGroups grows; buildBoardRows(found) adds a green row
in play  ──ending miss──▶  finished (lost); buildBoardRows(found, revealed) shows green + red rows
in play  ─last group hit──> finished (won); buildBoardRows(found) shows four green rows
reload mid-game            ──▶  foundGroups restored; buildBoardRows(found) reproduces the rows
```

The engine's own state (`won`/`lost`/`in_progress`, mistake counting) is untouched. A discard of
stored progress still degrades to a playable empty board (Constitution IV), which
`buildBoardRows(tiles, [], null)` produces naturally.

## 5. No schema, API, or storage delta

| Surface | Change |
|---------|--------|
| PostgreSQL | none |
| `server/game/groups.ts` (engine, detection) | none |
| `server/api/daily/*` (contract) | none |
| `useLocalProgress` storage shape | none |
| i18n keys | existing `groups.game_over`, `groups.found`, `groups.criterion.*` reused; any new row-heading key added to both locales (R-008) |