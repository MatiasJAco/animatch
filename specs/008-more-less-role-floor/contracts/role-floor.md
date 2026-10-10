# Contract: More or Less Role-Count Floor

**Feature**: [spec.md](../spec.md) | **Phase**: 1 — Design & Contracts | **Date**: 2026-10-10

## Interface scope

- **HTTP API**: **unchanged shape.** The daily puzzle endpoint and payload are defined in
  `specs/001-daily-anime-puzzles/contracts/openapi.yaml` (`GET /daily/{game}`). This feature adds no
  endpoint, request, or response field. It adds a **content invariant** on the existing More or Less
  payload (§2) and **reuses** the existing error envelope for a thin qualified pool (§3).
- **Server generator contract**: the pure qualification predicate and the pool it produces (§1).
- **No client contract change**: the rendered UI, stored day result, share summary, and loss
  explanation are untouched.

---

## 1. Server generator contract

`server/generators/moreOrLess.ts` exposes:

```ts
export const MIN_ROLE_COUNT_EXCLUSIVE = 80

// Pure; true iff the actor is eligible for More or Less.
export function isQualifiedRoleCount(roleCount: number): boolean
// -> roleCount > MIN_ROLE_COUNT_EXCLUSIVE

// Pure; keeps only eligible candidates.
export function filterQualifiedCandidates(
  candidates: readonly RoleCountCandidate[],
): RoleCountCandidate[]

// Single selection gate: filters its input through the floor, then assembles the chain.
// Returns null when the qualified pool cannot supply an unambiguous chain.
export function buildChain(
  candidates: readonly RoleCountCandidate[],
  prng: () => number,
): RoleCountCandidate[] | null
```

Contract rules:

1. **Exclusive floor**: `isQualifiedRoleCount(80) === false`, `isQualifiedRoleCount(81) === true`
   (spec FR-001). The constant is the single source of the boundary.
2. **No bypass**: `buildChain` filters its input through `filterQualifiedCandidates` before selecting,
   so every actor in a returned chain satisfies the floor regardless of the caller (spec
   FR-002/FR-010). `generateMoreOrLess` passes the raw `fetchPeopleRoleCounts()` list unchanged.
3. **Determinism**: filtering uses no randomness and no day seed; for a fixed UTC day and catalog state
   the returned chain is stable (spec FR-007, Constitution III).
4. **Unchanged assembly**: `buildChain`'s distinct-adjacent-count rule, `contentSignature`, the 30-day
   novelty retries, and `PuzzleUnavailableError` are unchanged.

---

## 2. Content invariant on the existing daily puzzle payload

For `game = more_or_less`, the served payload
(`MoreOrLessPuzzleData` in `server/game/moreOrLess.ts:9-21`) MUST satisfy:

| Field | Invariant |
|-------|-----------|
| `initialVisible.roleCount` | `> 80` — the one count the client is shown |
| `chain[i].id` for each hidden actor | the actor's career role count is `> 80` (recorded in the withheld solution) |
| `rounds` | `10` (unchanged) |
| `chain.length` | `11` (unchanged) |

The solution (`MoreOrLessSolution.roleCounts`) records the same counts that were compared, so the
disclosed `initialVisible.roleCount` and the withheld hidden counts are the values the floor admitted
(spec FR-004). **No payload key, type, or ordering changes.**

Example (illustrative; values depend on the day's catalog):

```json
{
  "game": "more_or_less",
  "date": "2026-10-10",
  "rounds": 10,
  "initialVisible": { "id": 1234, "name": "…", "roleCount": 214 },
  "chain": [ { "id": 2345, "name": "…" }, "… 10 more …" ]
}
```

Note the payload still discloses exactly one role count (the visible actor's); hidden counts are
withheld per 001 FR-016a. The invariant does not add disclosure.

---

## 3. Insufficient qualified pool → existing error envelope (reused)

When the pool of actors with `roleCount > 80` is too small to build an unambiguous twelve-actor chain,
`buildChain` returns `null` and generation throws `PuzzleUnavailableError`; the route responds with the
existing envelope and status:

```json
{ "error": { "code": "PUZZLE_UNAVAILABLE", "message": "No puzzle is available for today." } }
```

| Aspect | Value |
|--------|-------|
| Code | `PUZZLE_UNAVAILABLE` (existing; `server/utils/errors.ts:5-24`) |
| HTTP status | `503` (existing; `server/utils/errors.ts:36`) |
| Client behavior | existing bilingual error panel with a retry control (Constitution V) |
| Stored rows | none — the create-once path inserts only on success |

Contract rules:

1. The floor MUST NOT be lowered, skipped, or bypassed to avoid this response (spec FR-005).
2. No below-floor actor may appear in any successful response or any error path (spec FR-010).
3. No new error code or user-facing copy is introduced.

---

## 4. Explicitly out of scope (validated as unchanged)

- Groups and Match the Series generators and payloads.
- The attempt endpoint and `MoreOrLessOutcome`.
- `fetchPeopleRoleCounts` and the catalog query layer.
- The `daily_puzzles` schema, the create-once path, and migrations.
- Client storage (`animatch:v1:progress`), share text, and the loss explanation.
