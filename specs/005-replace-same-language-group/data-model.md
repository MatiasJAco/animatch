# Data Model: Replace the "same language" Groups Criterion

- **Feature**: specs/005-replace-same-language-group
- **Date**: 2026-10-07

This feature swaps one Groups criterion for another. It adds **no tables, no API fields, and no
change to the wire payload or persisted state**. The model below describes the criterion, the
tile fact, and the pool the generator draws from.

## 1. Criterion model (server-side only)

### `GroupCriterion` (entity)

The union of criterion types a group can be labelled with. The `same_language` variant is deleted
and `same_source` is added (research R-005):

```ts
type GroupCriterion =
  | { type: 'same_anime';       animeId: number }
  | { type: 'same_season';      season: string; year: number }
  | { type: 'same_source';      source: string }        // replaces same_language
  | { type: 'same_voice_actor'; personId: number }
```

The criterion is a function of the pinned tile fields only (spec 001 R-011): a tile satisfies
`same_source` when the tile's own `source` equals the criterion's `source`.

### `GroupCandidateTile` (entity)

The server-side candidate row. Gains the `source` field that the new criterion is judged on.

| Field | Type | Meaning |
|-------|------|---------|
| `kind` | `'character'` | Unchanged — all four Groups criteria use character tiles. |
| `id` | `number` | `characters.mal_id` of the tile's label. |
| `name` | `string` | Display label only (the part the player ever sees). |
| `animeId` | `number` | Pins the anime; keeps same_anime and same_season well defined. |
| `language` | `string` | Retained on the row, no longer grouping. |
| `source` | `string` | **New.** `anime.source` of the tile's anime; the fact the new criterion is judged on. |
| `voiceActorId` | `number` | Pins the voice actor; keeps same_voice_actor well defined. |

### `GroupsTile` (wire entity, unchanged)

`{ key, kind, name }` — exactly as today. `source` exists only server-side on the candidate tile
and never appears in a puzzle payload; it is disclosed only through the group's criterion on a hit
or the ending miss, the same disclosure rule as season and language today.

## 2. Source-material pools

`fetchSameSourcePools` groups candidates by non-blank `anime.source` across **distinct anime**
(research R-004), mirroring the same_season shape:

| Property | Value | Why |
|----------|-------|-----|
| Grouping key | `btrim(anime.source)` | The shared fact; blank `source` is never eligible (mirrors the blank-language rule it replaces). |
| Eligible pool | ≥ 4 distinct characters | Feeds a four-tile group, de-duplicated by character/actor/language like the other pools. |
| Distinct anime | ≥ 4 distinct `anime_mal_id` | Spec FR-003: the group can never collapse into a hidden "same anime" group. |
| Ordering | deterministic (primary-key ordering) | Keeps day-to-day generation reproducible (Principle III). |

Each candidate row pins `animeId` and the new `source`, so `holds()` can judge the criterion without
any extra lookup.

## 3. Generation invariants (unchanged)

- One candidate group per criterion type, picked deterministically (same seeded PRNG and retry loop
  as today). The language pool is replaced by the source pool (research R-006).
- Sixteen tiles, no repeated key, no repeated display label (spec 001 FR-037).
- Full-subset uniqueness gate (spec FR-006 / 001 FR-037): across the 16 tiles exactly one subset
  satisfies each of the four criteria, and those four subsets are the intended groups. This is the
  gate that made same_language's redundancy the bug in the first place and is what keeps `same_source`
  honest.
- Determinism: the same UTC day with the same catalog state regenerates the same board; days no
  source can fill keep the existing `PUZZLE_UNAVAILABLE` outcome (Principle III).

## 4. Wire and storage surfaces (no change)

| Surface | Change |
|---------|--------|
| PostgreSQL | none — read-only `anime.source` column, already present |
| `GET /api/daily/groups` payload | none — tiles remain `{ key, kind, name }`, no `source` |
| Attempt hit / ending-miss shapes | none — the criterion inside a solution is the only disclosure, as today |
| `useLocalProgress` storage | none — `foundGroups` keeps the exact `GroupsSolutionGroup` shape; a `same_source` criterion object flows through untouched |
| i18n | `groups.criterion.same_source` added in `es` and `en`; `groups.criterion.same_language` removed from both |

## 5. State transitions (none)

The game has no new states. A hit discloses `{ type: 'same_source', source: 'Web novel' }` instead
of the old language object; a lost board discloses the same. The client renders the label through
the existing `criterionLabel` mapping, which reads the message catalog by `criterion.type` —
no component change.