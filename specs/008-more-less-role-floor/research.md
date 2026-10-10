# Research: More or Less — Voice Actors With Over 80 Roles

**Feature**: [spec.md](./spec.md) | **Phase**: 0 — Outline & Research | **Date**: 2026-10-10

All unknowns were resolved from the codebase itself (the existing More or Less generator, its catalog
query, the shared error path, and the test layout). No project-external research was required. Each
decision records what was chosen, why, and the alternatives considered.

## R-001 — Threshold semantics: strictly greater than 80

**Decision**: The floor is a **strict** comparison: an actor qualifies only when their career role count
is **greater than 80** (81 or more). An actor with exactly 80 roles is excluded. The floor is a single
exported constant, `MIN_ROLE_COUNT_EXCLUSIVE = 80`, plus a predicate `isQualifiedRoleCount(count)` so the
generator and its tests share one definition and cannot drift.

**Rationale**: The clarified requirement is "over 80 voice roles", and the feature spec's FR-001 fixes
the boundary as exclusive (81 qualifies, 80 does not). Using one named constant and one predicate keeps
the boundary testable at exactly 80/81 and avoids magic numbers in the generator
(`server/generators/moreOrLess.ts`).

**Alternatives considered**:
- *Inclusive `>= 80`* — rejected: contradicts the clarified requirement and the updated spec.
- *Unguarded literal `> 80` at the call site* — rejected: two copies (code + test) would invite drift
  and hide the boundary.

## R-002 — Where the floor is applied

**Decision**: Enforce the floor **inside `buildChain`** — the single function that selects More or Less
actors — by filtering its input through the shared helper before the existing shuffle/assembly:

```ts
// generateMoreOrLess (unchanged call site)
const chain = buildChain(await fetchPeopleRoleCounts(), prng)

// buildChain (edited)
const qualified = filterQualifiedCandidates(candidates)   // keeps roleCount > MIN_ROLE_COUNT_EXCLUSIVE (80)
const ordered = shuffle(qualified, prng).filter(...)      // rest unchanged
```

`generateMoreOrLess`, `contentSignature`, the novelty retries, and `PuzzleUnavailableError` are left
unchanged.

**Rationale**: `buildChain` is the only code that decides which actors enter a chain
(`server/generators/moreOrLess.ts:30-56`), so gating it there makes FR-010 ("no path can present a
below-floor actor") a property of the selection function itself, not a convention callers must follow.
The helper keeps the policy one line and directly unit-testable, so `buildChain` can be tested with a
synthetic pool containing 80/79 counts and prove the invariant without a database.

**Alternatives considered**:
- *Filter in `generateMoreOrLess` before calling `buildChain`* — rejected: it leaves `buildChain` able
  to select below-floor actors when handed an unfiltered list, so the guarantee depends on caller
  discipline rather than the selection function.
- *SQL `HAVING COUNT(*) > 80` in `fetchPeopleRoleCounts`* — rejected: it pushes a game rule into the
  shared catalog layer and makes the boundary awkward to unit-test without a database; the count query
  is intentionally game-agnostic ("the More or Less generator walks the whole list",
  `server/catalog/queries.ts:47-49`).
- *Add a `floor` parameter to `buildChain`* — rejected: the boundary is a fixed product constant, not a
  per-call option; a parameter invites callers to pass a different value and weaken the guarantee.
- *Post-filter the assembled chain* — rejected: it could shrink the chain below the required length
  after the fact and would silently produce a short board instead of failing visibly.

## R-003 — Exact boundary behavior (80 vs 81) and reuse of the "count > 0" guard

**Decision**: The qualification predicate excludes 80 and includes 81. `buildChain`'s existing
`candidate.roleCount > 0` guard is left in place as harmless defense-in-depth; it can never admit a
below-floor actor because the input is already qualified.

**Rationale**: Satisfies spec acceptance scenario 4 and the edge case "actor exactly at the
threshold". Leaving the `> 0` guard untouched keeps the diff minimal and preserves the existing
behavior for the zero-count case without adding a second, conflicting rule.

**Alternatives considered**:
- *Remove the `> 0` guard* — rejected: unnecessary churn; the guard is subsumed by the floor but
  removing it changes code the feature does not need to touch.

## R-004 — Insufficient qualified pool

**Decision**: No new error handling. When the qualified pool cannot supply an unambiguous chain,
`buildChain` returns `null`, `generateMoreOrLess` throws `PuzzleUnavailableError` with code
`PUZZLE_UNAVAILABLE`, which `getOrCreatePuzzleFor` maps to `GeneratorError('PUZZLE_UNAVAILABLE')`
(`server/game/puzzleService.ts:39-49`) and the daily route turns into the standard error envelope
(`server/api/daily/[game].get.ts:19-21`). The client already renders this code as its bilingual,
retryable error panel.

**Rationale**: Reuses the exact fail-visible path the spec requires (FR-005, Constitution V) and
guarantees the floor is never silently relaxed as a fallback — there is no code path that lowers the
threshold. The existing message ("not enough catalog coverage for an unambiguous chain") remains
accurate; no new copy is introduced, so FR/SC on translation are satisfied by construction.

**Alternatives considered**:
- *Lower the floor/configurable fallback when the pool is thin* — rejected: directly violates the
  feature's "never less than 80" intent and the spec's insufficient-pool requirement.
- *New error code* — rejected: the existing `PUZZLE_UNAVAILABLE` already means "no puzzle available
  today" and is already localized and retryable.

## R-005 — Determinism and the 30-day novelty rule

**Decision**: The floor consumes no randomness and does not read the day seed. Filtering the candidate
list before `buildChain` therefore preserves FR-006/FR-007: for a fixed UTC day and catalog state, the
qualified pool and the resulting chain are identical on every request, and the existing novelty
retry loop still runs `MAX_NOVELTY_RETRIES` times against the last 30 days' signatures.

**Rationale**: The only input that changes is the size/content of the candidate array; the seeded PRNG
(`createPrngFromSeed(daySeed)`) and the novelty signature computation are untouched
(`server/generators/moreOrLess.ts:94-107`).

**Alternatives considered**:
- *Re-seed by day with the floor folded into the seed* — rejected: unnecessary and would make the
  change harder to reason about; the floor is a deterministic filter, not a randomization input.

## R-006 — No persistence, API, or client change

**Decision**: None. The puzzle payload shape (`initialVisible` + `chain`) and the solution shape
(`answers` + `roleCounts`) are unchanged; the served `initialVisible.roleCount` is still the only count
disclosed (FR-016a), and it now necessarily exceeds 80. The attempt response, `daily_puzzles` table,
migrations, and all client code are untouched.

**Rationale**: The floor changes only which people enter the existing pipeline. Keeping the stored
puzzle and served payload shapes frozen avoids touching the existing contract tests
(`tests/routes/puzzle.get.test.ts`, `tests/routes/attempt.post.test.ts`) and keeps the change
server-only.

**Alternatives considered**:
- *Expose the floor or eligibility in the API* — rejected: no user-facing need, and it would broaden
  the payload contract for nothing.

## R-007 — Test strategy within the 15-test cap

**Decision**: Add one focused pure-logic test file, `tests/more-less-role-floor.test.ts`:

1. `isQualifiedRoleCount` boundary: 80 → `false`, 81 → `true`, 79 → `false`.
2. `filterQualifiedCandidates` drops below-floor candidates and keeps 81+ from a mixed list.
3. `buildChain` over a synthetic pool containing 80/79 counts never returns an actor with a count
   `<= 80` (the FR-010 "no bypass path" invariant), while still returning a valid twelve-actor chain
   when enough qualified candidates exist.

The DB-gated generation/payload tests in `tests/routes/puzzle.get.test.ts` and
`tests/generation.test.ts` continue to pass unchanged (they assert shape, not specific actors). Total
new `it` blocks stay well under the feature's 15-test cap (Constitution VI).

**Rationale**: The generator is pure and exported (`buildChain`), so the boundary and the invariant can
be tested without a database, matching the project's existing low-mock, logic-first style
(`tests/groups-source.test.ts`, `tests/more-less-loss.test.ts`). No new dependency or component
harness is introduced.

**Alternatives considered**:
- *Only DB-backed assertions on generated puzzles* — rejected: the boundary at exactly 80/81 is far
  cheaper and more reliable to assert against a synthetic list than to hope the live catalog contains a
  person with exactly 80 roles.
- *A separate integration test that queries the catalog for a sub-floor actor* — rejected: couples the
  test to catalog data that can change and risks flakiness.
