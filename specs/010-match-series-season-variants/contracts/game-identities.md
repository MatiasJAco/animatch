# Contract: Game Identities & Season Mapping

**Feature**: [spec.md](../spec.md) | **Phase**: 1 — Design & Contracts | **Date**: 2026-10-13

## Interface scope

- **Game identity contract**: the exact set of game identifiers the daily API accepts and the
  fixed season each edition uses.
- **No database contract change**: `daily_puzzles` columns and the create-once path are untouched.
- **No catalog contract change**: catalog reads stay read-only.

---

## 1. Game identity set

The accepted game identities become exactly:

```text
more_or_less
groups
match_the_series_autumn_2026
match_the_series_spring_2026
match_the_series_summer_2026
```

`match_the_series` (season-less) is removed. `isGameId` accepts the five identities above and
rejects everything else, including the removed identity.

## 2. Fixed season mapping

| Game identity | Catalog (year, season) | Display season |
|---------------|------------------------|----------------|
| match_the_series_autumn_2026 | (2026, fall) | Autumn 2026 |
| match_the_series_spring_2026 | (2026, spring) | Spring 2026 |
| match_the_series_summer_2026 | (2026, summer) | Summer 2026 |

Rules:
1. Only edition identities have a fixed season; More or Less and Groups keep their existing
   season rules.
2. The season/year is a constant of the identity, never derived from the UTC date, catalog state,
   client input, locale, or timezone.
3. The display season is user-facing only; selection matches the catalog value exactly as the
   current game does (case/whitespace trimmed).

## 3. Route contract

| Game identity | Route |
|---------------|-------|
| match_the_series_autumn_2026 | `/game/match-the-series-autumn-2026` |
| match_the_series_spring_2026 | `/game/match-the-series-spring-2026` |
| match_the_series_summer_2026 | `/game/match-the-series-summer-2026` |

Routes follow the existing `/<game-id with dashes>` rule used by `GameCard`; no new routing
convention is introduced.

## 4. Home listing contract

`GET /api/daily` returns `games` in this order:

1. `more_or_less`
2. `match_the_series_autumn_2026` (current season first)
3. `match_the_series_spring_2026`
4. `match_the_series_summer_2026`
5. `groups`

Each entry keeps the existing shape `{ game, status, code? }`. Status is probed independently per
entry: one edition's `unavailable` or `error` does not change another entry.

## 5. Puzzle payload contract (match editions)

Unchanged from the current Match the Series payload except the identity:

```jsonc
{
  "game": "match_the_series_autumn_2026",
  "date": "2026-10-13",
  "season": { "season": "fall", "year": 2026 },
  "grid": { "rows": 3, "cols": 3, "series": [/* 9 */] },
  "clues": [/* 18 */]
}
```

Rules:
1. `season` always equals the edition's fixed mapping, on every UTC day.
2. `game` always equals the edition identity.
3. The solution is never sent; the existing attempt/expire contracts are reused unchanged for each
   edition under `/api/daily/<edition>/attempt` and `/api/daily/<edition>/expire`.