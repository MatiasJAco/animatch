# Data Model: More or Less — Voice Actors With Over 80 Roles

**Feature**: [spec.md](./spec.md) | **Phase**: 1 — Design & Contracts | **Date**: 2026-10-10

## Scope of data change

**No database change and no API shape change.** The feature narrows which actors enter the existing
More or Less pipeline; it does not add, remove, or reshape any stored field. This document covers:

1. The existing **role-count candidate** shape and the new **qualification** rule applied to it.
2. The **qualified pool** derived from the candidate list.
3. The unchanged **More or Less puzzle payload / solution** carrying the floor as a content invariant.

---

## 1. Role-count candidate (existing shape, new rule)

Produced by `fetchPeopleRoleCounts()` (`server/catalog/queries.ts:50-65`), reshaped by the generator's
`RoleCountCandidate` (`server/generators/moreOrLess.ts:15-19`):

| Field | Type | Meaning |
|-------|------|---------|
| `id` | `number` | Person `mal_id` (catalog data reference, never shown in chrome) |
| `name` | `string` | Person display name |
| `roleCount` | `number` | Career role count: every `voice_roles` record attributed to the person, regardless of character, series, or language |

### Qualification rule (new)

An actor qualifies for More or Less when:

```text
isQualifiedRoleCount(roleCount)  ==  roleCount > MIN_ROLE_COUNT_EXCLUSIVE   // MIN_ROLE_COUNT_EXCLUSIVE = 80
```

- **Exclusive boundary**: `roleCount = 81` qualifies; `roleCount = 80` does not; `roleCount < 80` does
  not. (FR-001, spec edge case "actor exactly at the threshold".)
- This is a pure predicate over the existing count — no new field, no new query, no new table.

---

## 2. Qualified actor pool (derived, in-memory only)

```ts
interface RoleCountCandidate { id: number; name: string; roleCount: number }

// Derived: candidates.filter(isQualifiedRoleCount), computed inside buildChain.
type QualifiedActorPool = RoleCountCandidate[]   // every element has roleCount > 80
```

### Validation / invariants

- Every element of the pool has `roleCount > 80` (by construction; FR-001/FR-002).
- The pool is a **deterministic pure function** of the catalog's role counts and the constant floor; it
  consumes no randomness and no day seed (FR-007).
- The pool is computed fresh per generation attempt from the same catalog snapshot; it is never
  persisted.
- If the pool cannot supply an unambiguous twelve-actor chain, generation fails with
  `PUZZLE_UNAVAILABLE` and nothing is stored for that day (create-once path inserts only on success)
  (FR-005).

---

## 3. More or Less puzzle payload & solution (shape unchanged)

Stored in `daily_puzzles.payload` / `daily_puzzles.solution` and served as before
(`server/game/moreOrLess.ts:9-23`):

```ts
interface MoreOrLessPuzzleData {
  game: 'more_or_less'
  date: string                 // UTC day key
  rounds: number               // 10
  chain: PersonTile[]          // 11 hidden actors
  initialVisible: { id: number; name: string; roleCount: number }  // the only disclosed count
}

interface MoreOrLessSolution {
  answers: Array<'more' | 'less'>
  roleCounts: Record<string, number>   // every actor's true count (server-side only)
}
```

### Content invariant added by this feature

- `initialVisible.roleCount > 80`.
- Every `roleCounts[String(person.id)]` for the eleven `chain` actors and the `initialVisible` is
  `> 80`.
- The disclosed `initialVisible.roleCount` and the withheld solution counts are the **same** value the
  floor admitted (FR-004) — the floor is evaluated on the same count that is shown/compared.
- No shape, key, or type changes: existing consumers (routes, client, share, loss explanation) are
  unaffected.

---

## Entities

- **Voice Actor (Person)**: catalog person with a career role count — see [spec.md](./spec.md) Key
  Entities.
- **RoleCountCandidate**: the `{ id, name, roleCount }` record above.
- **Qualified Actor Pool**: `RoleCountCandidate[]` filtered by `roleCount > 80`; the only pool More or
  Less draws from.
- **More or Less Daily Puzzle**: the stored payload + solution above, now guarded by the floor
  invariant. Created once per game per UTC day by the unchanged create-once path
  (`server/db/puzzles.ts:82-105`).

## State transitions

Unchanged from the current game. The feature adds no new state:

| Transition | Trigger | Effect |
|------------|---------|--------|
| (none, generation) `catalog counts → qualified pool` | Puzzle generation for a UTC day | Pure filter by `> 80`; no persistence |
| `catalog → stored puzzle` | First request of the day | Unchanged create-once insert of a floor-compliant payload/solution |
| `catalog → PUZZLE_UNAVAILABLE` | Qualified pool too small for a valid chain | Unchanged error path; nothing stored |
| `stored puzzle → served` | Subsequent requests | Unchanged; the stored, floor-compliant puzzle is served to everyone |
