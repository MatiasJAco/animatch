# Quickstart: More or Less — Voice Actors With Over 80 Roles

**Feature**: [spec.md](./spec.md) | **Phase**: 1 — Validation Guide | **Date**: 2026-10-10

## Prerequisites

- Dev environment up: `npm run dev` with the app's `DATABASE_URL` configured (the daily puzzle is
  generated on first request). The catalog (`people`, `voice_roles`) is the pre-existing, read-only
  data source.
- Node ≥22.18 and dependencies installed (`npm install`).
- A terminal in the repo root, and a read-only DB client (e.g. `psql`) if you want to inspect career
  role counts directly.
- For local validation, note the create-once rule: a `daily_puzzles` row already stored for the UTC day
  is served as-is. To regenerate under the new floor, delete **only the app-owned puzzle row** for that
  game and day (never a catalog table):

  ```sql
  DELETE FROM daily_puzzles WHERE game = 'more_or_less' AND puzzle_date = '<the UTC day>';
  ```

## Automated checks

```bash
npm test
```

Expected: all tests pass, including the new coverage in `tests/more-less-role-floor.test.ts`:

- **Boundary**: `isQualifiedRoleCount(80) === false`, `isQualifiedRoleCount(81) === true`,
  `isQualifiedRoleCount(79) === false`.
- **Filtering**: `filterQualifiedCandidates` drops every candidate with `roleCount <= 80` and keeps
  those with `roleCount > 80` from a mixed list.
- **No-bypass invariant**: `buildChain` over a synthetic pool that includes 79/80/81+ counts never
  returns an actor whose career role count is `<= 80`, while still returning a valid twelve-actor chain
  when enough qualified candidates exist.

The existing DB-gated route/generation tests (`tests/routes/puzzle.get.test.ts`,
`tests/routes/attempt.post.test.ts`, `tests/generation.test.ts`) continue to pass unchanged: the payload
and solution shapes are not altered.

## Manual validation

### 1. Every actor in a served puzzle exceeds 80 roles (US1)

1. Start the app and open **More or Less** (or request `GET /api/daily/more_or_less`).
2. Read the day's `daily_puzzles` payload and solution, and compute the career role count for each of
   the twelve actors (the `initialVisible` actor plus the eleven `chain` actors):

   ```sql
   SELECT vr.person_mal_id, COUNT(*) AS role_count
   FROM voice_roles vr
   WHERE vr.person_mal_id IN (<initialVisible.id>, <chain ids...>)
   GROUP BY vr.person_mal_id
   ORDER BY role_count;
   ```

3. Confirm every `role_count` is **greater than 80** (the smallest value shown is ≥ 81). Confirm the
   tile the client displays for the first actor (`initialVisible.roleCount`) matches that actor's count.
4. Play the rounds; confirm the game still runs exactly ten rounds and that no round presents equal
   hidden/visible counts.

### 2. The floor does not break the game (US2)

1. Load More or Less in two separate browsers/profiles on the same UTC day: the two boards are
   identical (determinism preserved).
2. Generate More or Less for several consecutive UTC days (delete each day's app-owned row between
   runs to force regeneration): every run produces a full ten-round board, and the setups differ across
   days.

### 3. A thin qualified pool fails visibly, never below the floor (US3)

1. The production catalog is expected to satisfy the floor, so this path is validated without mutating
   data: it is covered by the pure `buildChain` no-bypass test and by the existing
   `PUZZLE_UNAVAILABLE` route behavior (a `null` chain throws `PuzzleUnavailableError`, the route
   returns the `PUZZLE_UNAVAILABLE` envelope, and the client shows the bilingual error panel with
   retry).
2. Optional DB-gated check: point the app at a catalog where fewer than twelve actors exceed 80 roles
   and confirm `GET /api/daily/more_or_less` returns `503` with `error.code = "PUZZLE_UNAVAILABLE"`,
   that nothing is stored for the day, and that the client shows the retryable error state — never a
   short board and never a below-floor actor.

### 4. Other games are untouched (regression guard)

1. Open **Groups** and **Match the Series**: they load and play exactly as before; their actor selection
   is unchanged.

## Expected outcomes map

| Check | Evidence | Requirement it proves |
|-------|----------|-----------------------|
| §1.2–1.3 | all twelve actors have `role_count > 80`; 80 never appears | FR-001, FR-002, FR-004; SC-001, SC-005 |
| §1.4 | ten rounds, no equal-count round | FR-006; SC-002 |
| §2.1 | two visitors, identical board | FR-007; SC-003 |
| §2.2 | full board each day, distinct setups | FR-006; SC-006 |
| §3 | `PUZZLE_UNAVAILABLE` + retry, no downgrade, no below-floor actor | FR-005, FR-010; SC-004 |
| §4 | Groups / Match the Series unchanged | FR-008; SC-007 |

## Out of scope (validated as unchanged)

- API payload keys/types, attempt response, `daily_puzzles` schema, and migrations.
- Client storage, share summary, and the More or Less loss explanation.
- Bilingual copy: the feature adds no user-facing strings; the reused `PUZZLE_UNAVAILABLE` message is
  already present in both locales.
