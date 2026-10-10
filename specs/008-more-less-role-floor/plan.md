# Implementation Plan: More or Less — Voice Actors With Over 80 Roles

**Branch**: `008-more-less-role-floor` | **Date**: 2026-10-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-more-less-role-floor/spec.md`

## Summary

Restrict the More or Less candidate pool so that every voice actor the game selects has a career role
count strictly greater than 80 (i.e. 81 or more). The change is confined to the server-side generator:
we add one named constant (`MIN_ROLE_COUNT_EXCLUSIVE = 80`) and one pure qualification helper
(`filterQualifiedCandidates`), and enforce the floor **inside `buildChain`** — the single function that
selects More or Less actors — so no caller can present a below-floor actor. No database change, no API
shape change, no client change. Everything else — the ten-round chain, the adjacent-count-differs rule,
the 30-day novelty check, the deterministic per-UTC-day seed, and the existing `PUZZLE_UNAVAILABLE`
error path — is reused unchanged. When fewer than the required qualified actors exist, `buildChain`
returns `null` and the existing `PuzzleUnavailableError` flow serves the bilingual retry state
(Constitution V), so the floor is never silently lowered.

## Technical Context

**Language/Version**: TypeScript 5.x on Node ≥22.18; Nitro server routes + Vue 3 islands (Nuxt 3.21)

**Primary Dependencies**: Nuxt 3 + Vue 3; `pg` on the server only. No dependency is added
(Constitution VI).

**Storage**: PostgreSQL. Reads only the pre-existing read-only catalog (`voice_roles`, `people`,
joined for role counts). The app-owned `daily_puzzles` table is read/written through the existing
create-once path; no schema, column, or index change.

**Testing**: Vitest 5 (`tests/`, unit + DB-gated integration). New coverage is a pure-logic test over
the qualification helper and the floor invariant; DB-gated generation tests extend existing cases.
No stylesheet-text or markup-snapshot assertions (Constitution VI).

**Target Platform**: server-side puzzle generation (Nitro). The web client is unaffected.

**Project Type**: web application (Nuxt `app/` client + `server/` Nitro routes).

**Performance Goals**: none beyond current behavior. The candidate list is smaller, so generation work
does not increase.

**Constraints**: floor is a fixed constant and is exclusive (`> 80`, so 81 qualifies and 80 does not);
no catalog writes; no catalog schema change; no change to the puzzle payload or attempt response; the
per-UTC-day determinism and 30-day novelty rules must be preserved; no new user-facing copy.

**Scale/Scope**: 1 generator module edited (1 exported constant + 1 pure helper + 1 call site), 1 new
pure unit test file (or focused additions to the existing generation test), ~0 client/route/i18n/
migration changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Read-Only Catalog Ownership | No catalog writes/DDL; no `import_state`/`import_runs`; no `daily_puzzles` schema change | PASS — change only filters rows already returned by the existing read-only role-count query; catalog untouched |
| II. API/UI Separation | No DB driver/credential/query reachable from the browser | PASS — change is entirely inside the server generator; client untouched |
| III. One Deterministic Puzzle per UTC Day | Day key stays UTC; stored puzzle stable; generation deterministic | PASS — the floor is a constant filter that does not consume randomness or the day seed; same day + same catalog → same qualified pool → same chain |
| IV. Stateless v1 | No identity, session, or new server storage | PASS — untouched |
| V. Fail Visible, Never Blank | Failures render a bilingual, retryable state | PASS — an insufficient qualified pool hits the existing `PuzzleUnavailableError` → `PUZZLE_UNAVAILABLE` envelope, already rendered by the client error panel with retry |
| VI. Lean Tests, Approved Dependencies | Tests ≤15; no new dependency; no stylesheet/markup assertions; lean comments | PASS — no dependency added; a small pure test plus guarded additions stay well under the cap; assertions are on values, not markup |

**No violations.** Complexity Tracking is intentionally empty.

Post-Design re-check (after Phase 1): unchanged — the design edits one server module and its tests.
PASS.

## Project Structure

### Documentation (this feature)

```text
specs/008-more-less-role-floor/
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0 output (/speckit.plan)
├── data-model.md        # Phase 1 output (/speckit.plan)
├── quickstart.md        # Phase 1 output (/speckit.plan)
├── contracts/
│   └── role-floor.md    # Phase 1 output — the content invariant on the existing puzzle contract
└── checklists/
    └── requirements.md  # Spec quality checklist (/speckit.specify)
```

`tasks.md` is produced later by `/speckit.tasks` (not by this command).

### Source Code (repository root)

```text
server/
├── generators/
│   └── moreOrLess.ts        # EDIT — add MIN_ROLE_COUNT_EXCLUSIVE = 80 and a pure
│                            #        qualification helper; enforce it inside buildChain
│                            #        (the single selection gate). contentSignature, novelty
│                            #        retries and PuzzleUnavailableError are reused unchanged.
└── catalog/
    └── queries.ts           # unchanged — fetchPeopleRoleCounts keeps returning the full
                             #             role-count list; the game rule stays in the game module

tests/
└── more-less-role-floor.test.ts   # NEW — pure unit test: boundary (80 excluded, 81 included),
                                   #        mixed pool filtered, buildChain never selects < floor
```

**Structure Decision**: single Nuxt project. The feature is one surgical edit to the More or Less
generator plus a focused test. No client (`app/`), route, i18n, catalog-query, migration, or
`daily_puzzles` code is modified.

### Where the floor is applied (and why there)

`buildChain` (`server/generators/moreOrLess.ts`) is the single function that selects More or Less
actors, so the floor is enforced there, through the shared helper, before the shuffle/assembly step:

```text
buildChain(candidates, prng):
  const qualified = filterQualifiedCandidates(candidates)   // roleCount > MIN_ROLE_COUNT_EXCLUSIVE (80)
  const ordered   = shuffle(qualified, prng).filter(... > 0 && distinct-from-previous ...)
  ...
```

`generateMoreOrLess` keeps calling `buildChain(await fetchPeopleRoleCounts(), prng)` unchanged. Putting
the gate inside the assembly function guarantees FR-010 (no path can select a below-floor actor) even
if a future caller passes an unfiltered list. Keeping the existing "distinct adjacent counts" and
novelty logic intact means the only behavioral change is *which actors are eligible*, not *how a chain
is assembled* — the smallest change that satisfies the spec. See [research.md](./research.md)
R-002/R-003 for the alternatives (SQL `HAVING`, filtering at the call site, a `buildChain` parameter)
and why they were rejected.

## Complexity Tracking

No Constitution Check violations; no complexity to justify.
