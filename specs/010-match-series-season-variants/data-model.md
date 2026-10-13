# Data Model: Match the Series Seasonal Editions (Autumn, Spring, Summer 2026)

## Overview

This feature adds no new tables and no changes to the catalog schema. The only data
changes are (1) new game identities flowing through the existing `daily_puzzles`
table, and (2) fixed season constants associated with those identities.

## Owned tables

### daily_puzzles (existing, unchanged)

| Column | Use for this feature |
|--------|----------------------|
| game (text) | One of the three new edition identities |
| puzzle_date (date, UTC) | One puzzle per edition per UTC day |
| payload (jsonb) | Reuses the existing Match the Series payload, including `season: { season, year }` set to the edition's fixed season |
| solution (jsonb) | Reuses existing answer-key format |

Constraints reused as-is:
- Unique key `(game, puzzle_date)`: one puzzle per edition per day.
- Create-once semantics on concurrent first requests.

No migration is required: `game` has no enum constraint.

## Fixed season mapping (new, code constant)

Each edition identity maps to one fixed catalog season:

| Game identity | Display season | Catalog season value | Year |
|---------------|----------------|----------------------|------|
| match_the_series_autumn_2026 | Autumn | fall | 2026 |
| match_the_series_spring_2026 | Spring | spring | 2026 |
| match_the_series_summer_2026 | Summer | summer | 2026 |

This mapping is the only source of truth for an edition's season. It is not stored
in any table and is not derived at request time.

## Catalog reads (unchanged tables)

Reads use the existing read-only catalog tables, identical to the current Match the
Series game:
- `anime_seasons` (year, season)
- `anime`
- `voice_roles`
- `people`
- `characters`

No write, DDL, index, or constraint change is made to any catalog table or to
`import_state` / `import_runs`.

## Client-side state (unchanged shape)

`localStorage` key `animatch:v1:progress` keeps its existing shape. The only change
is the set of valid `GameId` keys:
- The three new edition identities are valid.
- The removed `match_the_series` key is ignored on read and cleaned during sanitize.
- Results, timer state, reveal data, green pairs, and attempts are scoped by game identity,
  so one edition's saved game never affects another.

## Derived availability

`Edition Availability` is not persisted. It is computed on the home page request by
probing catalog coverage for the edition's fixed season (matchable series count >= 16
equivalent board threshold), with ready / unavailable / error states reused from the
existing listing.

## Entities

- **Match the Series Edition**: game identity + fixed season/year + existing Match
  mechanics.
- **Edition Puzzle**: one daily puzzle row per edition per UTC day.
- **Edition Availability**: transient ready/unavailable/error status.
- **Edition Result**: client-side win or time-out outcome for one edition.
- **Season Label**: user-facing display name (Autumn/Spring/Summer).