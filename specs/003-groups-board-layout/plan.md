# Implementation Plan: Groups Board Rows-Driven Layout

**Branch**: `003-groups-board-layout` | **Date**: 2026-10-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-groups-board-layout/spec.md`, refined by the
plan directive — "Keep the current game engine and tile model. Add a board presentation state for
found groups and the loss reveal. Do not change group-detection rules. Reuse existing tile
components; layout and color are presentation only."

## Summary

The Groups board gains a presentation state layered on existing data: every group the player
finds becomes a permanent horizontal **green row** with the group's bilingual characteristic
label at the left, and the tiles in it leave the selection area for good. On a loss the board
stays mounted (research R-002) and lays out **every** tile in its correct group — the rows the
player already found keep their green styling, and the groups they never found appear as **red
rows** with labels — so the loss is a reveal of the day's full solution, never a reset. The
engine, detection rules, API, storage, and tile model are untouched (directive): the client
already receives a `criterion`+`tileKeys` per hit and the full `groups` mapping on the ending
miss (FR-034/FR-035), and already persists `foundGroups`, so the feature only adds a pure row
derivation (`buildBoardRows` in `app/utils/groupsBoard.ts`, R-003) plus the row rendering in
`GroupsBoard.vue` and the finished-view wiring in `groups.vue`.

**Technical approach** (details in [research.md](./research.md)): presented state is derived, not
stored (R-001); the finished page keeps the board visible under `ResultPanel` (R-002); the row
classification is a pure, unit-tested function with no new dependency (R-003/R-009); found tiles
stay inert through the existing consumed set (R-004); rows order by discovery then disclosure
(R-005); color never the sole signal thanks to the existing bilingual criterion labels
(R-006/FR-008); the reveal is transient, persistence unchanged (R-007); feature 001's FR-034
"removed" wording is reconciled as a doc-only edit (R-010).

## Technical Context

**Language/Version**: TypeScript on Node 22 (Nuxt 3 runtime); Vue 3 SFCs for the client.

**Primary Dependencies**: unchanged from specs 001/002: `nuxt` ^3, `pg`, `vitest` (dev). **No new
dependency** — the row model is plain TypeScript and rendering reuses `GroupsBoard.vue` /
`EntityImage.vue` / existing message keys, so Principle VI's approval-by-name gate is not
triggered (R-012).

**Storage**: none new. PostgreSQL and `daily_puzzles` untouched. Client progress keeps the exact
`useLocalProgress` shape (`{ status, attempts, mistakes, found, foundGroups, missLog }`);
`foundGroups` is read to restore green rows on reload. The loss reveal is transient component
memory (R-007).

**Testing**: `vitest`; new tests in `tests/groups-board.test.ts` against the pure row model only
(cap: 15; ~6–8 planned). No component renderer — adding one would need an approved new
devDependency (R-003/R-009). No stylesheet-text, class-string, or markup-snapshot assertions
(Constitution VI). No network in tests.

**Target Platform**: evergreen browser, desktop or mobile. Server: Linux, Node 22.

**Project Type**: web application (SSR frontend and API in one Nuxt process).

**Performance Goals**: presentation-only; the board is a fixed 16 tiles, so row derivation is
O(16) and has no measurable impact (SC-001's "within one second" reflects render pacing, not
computation).

**Constraints**: detection rules and the engine are frozen (directive, R-001, R-011); API and
payloads byte-identical (contracts, R-010); bilingual labels from the existing catalog keys
(FR-008, R-008); found tiles inert (FR-003); found rows never restyle or reorder in the reveal
(FR-006); test cap and no-snapshot rule (Principle VI); no catalog access, no browser DB
(Principles I–II).

**Scale/Scope**: one pure client module (`app/utils/groupsBoard.ts`), one component
(`GroupsBoard.vue` rows rendering), one page wiring change (`groups.vue` finished view), optional
pair of i18n keys, one doc reconciliation edit in spec 001, ~6–8 tests, 9 manual checks. No
server, DB, contract, store-schema, or config changes.

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1 design. Against constitution v3.0.0.*

| Principle / rule | How the plan satisfies it |
|---|---|
| I. Read-Only Catalog Ownership | No catalog access of any kind; no queries, writes, DDL, or import tables. `GET /api/daily/groups` payload is reused as-is |
| II. API/UI Separation | Nothing new reaches the browser from the DB; the browser keeps talking only to `daily_puzzles`-backed API endpoints, unchanged |
| III. One Deterministic Puzzle per UTC Day | Server and stored puzzles are untouched; rows are derived client-side from the existing payload and disclose nothing beyond what the server already returns on hit/miss. No timezone input |
| IV. Stateless v1 | No accounts/sessions. Found rows persist through the existing client-side `foundGroups`; a cleared store degrades to an empty board via `buildBoardRows(tiles, [], null)`. The transient reveal adds no storage |
| V. Fail Visible, Never Blank | Presentation derives entirely from a successful puzzle fetch and existing outcomes; the existing ErrorPanel/loading/reset paths still govern. A stored-but-unfetchable day still shows the board's empty/lost state |
| VI. Lean Tests, Approved Dependencies Only | ~6–8 new tests ≤ the 15 cap; zero new packages (R-012); assertions target rendered semantics via the pure model, never stylesheet/class/markup snapshots (R-009); no essay comments |
| Naming and Originality | No new name, URL, or copied presentation; rows reuse the project's own tiles and copy |
| Bilingual UI | Row labels reuse `groups.criterion.*`; any new row-heading key lands in `es` and `en` together (R-008), and the i18n completeness test enforces it |
| Delivery Model | No install, no native build, no new toolchain; nothing about deployment artifacts changes |

**Complexity Tracking**: no violations, so nothing to justify.

## Project Structure

### Documentation (this feature)

```text
specs/003-groups-board-layout/
├── plan.md                 # This file
├── spec.md                 # Feature specification
├── research.md             # Phase 0: 12 decisions, engine-unchanged reconciliation
├── data-model.md           # Phase 1: derived presentation model, invariants, transitions
├── quickstart.md           # Phase 1: run commands, 9 manual checks
├── checklists/
│   └── requirements.md     # Spec quality checklist (all items pass)
└── contracts/
    └── openapi.yaml        # Groups endpoints, marked unchanged by this feature
```

### Source Code (repository root)

Delta against the current tree — new files marked `+`, changed files `~`:

```text
~ app/
│  ├── utils/
│  │   └── groupsBoard.ts                  +    # buildBoardRows: pure rows + selectable derive
│  ├── components/
│  │   ├── GroupsBoard.vue                 ~    # render found rows (green) + reveal rows (red);
│  │   │                                        #    selectable tiles keep the existing grid
│  │   └── (EntityImage, ResultPanel unchanged, reused)
│  ├── pages/game/groups.vue               ~    # keep board mounted after finish; pass revealed
│  ├── i18n/
│  │   ├── en.ts                           ~    # + optional row-heading keys (both locales)
│  │   └── es.ts                           ~    # + same optional keys
│  └── composables/useLocalProgress.ts     (unchanged — storage shape and setGameState are kept)
~ server/                                  (entirely unchanged — engine, routes, games, catalog)
~ tests/
│  ├── groups-board.test.ts                +    # row model: classification, ordering, exhaustiveness
│  └── (existing suites stay green: groups route cases, i18n)
~ specs/001-daily-anime-puzzles/
│  ├── spec.md                             ~    # FR-034 wording: "removed" → "rearranged as a green row"
│  └── quickstart.md                       ~    # T047 row wording aligned (R-010, doc-only)
```

**Structure Decision**: single Nuxt application, unchanged. The pure row derivation sits in
`app/utils/groupsBoard.ts` (mirroring the `matchState.ts` precedent) so the classification is
unit-testable without mounting; `GroupsBoard.vue` owns only the render mapping from rows to green
and red layouts, reusing the existing tile content; `groups.vue` keeps the board mounted in the
finished state so the loss reveal is actually visible (R-002).

## Design Artifacts

| Artifact | Contents |
|----------|----------|
| [research.md](./research.md) | 12 decisions: presentation-only derivation, finished-board stays mounted, pure row model vs renderer, tile reuse, ordering, color-never-sole-signal, transient reveal, i18n, test shape, spec-001 reconciliation, scope, zero config |
| [data-model.md](./data-model.md) | `GroupRow` / `BoardPresentation` entities, `buildBoardRows` contract, exactly-once and no-restyle invariants, unchanged persisted shape, presentation-only transitions |
| [contracts/openapi.yaml](./contracts/openapi.yaml) | Groups GET/attempt reference marked unchanged; hit/lost examples annotated for the client's green/red row mapping |
| [quickstart.md](./quickstart.md) | Setup plus 9 manual checks tied to FRs/SCs, engine-unchanged and scope-boundary notes |

## Key Design Points

**Why nothing server-side changes.** A hit already returns `criterion` + `tileKeys` and the ending
miss already returns the full `groups` list; the client already persists `foundGroups`. The rows
are a pure re-layout of bytes the app already has, so "do not change group-detection rules" is a
design property, not a promise (R-001).

**Why a pure `buildBoardRows`.** The durable, testable part of a presentation feature is the
*classification* — which four keys are one group, found vs revealed, ordering, and which keys stay
selectable. Pure TypeScript can assert all of that with zero new dependencies, unlike a mounted
component (R-003, R-009).

**Why the finished board stays mounted.** Today the page swaps the board for `ResultPanel` on
finish, so the existing reveal markup is dead code. The feature explicitly wants the loss layout
on the board, so the finished view renders the board in reveal mode under the existing result
card instead of replacing it (R-002).

**Why the reveal is transient.** US3's persistence story is about in-progress found rows, which
`foundGroups` already restores. Persisting revealed rows would need a new day-keyed storage field
for something the description never asks to survive a reload (R-007). Kept out of scope.

**Why the label is part of the row.** Green vs red is decoration; the characteristic label is
already bilingual and already the project's i18n (Constitution Bilingual). Putting it on the left
of every row keeps color from ever being the only signal (FR-008, SC-005).

## Test Plan (~6–8 tests, within the 15-test cap)

| # | Proves |
|---|--------|
| 1 | `buildBoardRows(tiles, found, null)` returns exactly the found groups as `found` rows, in discovery order |
| 2 | Each found row's `tileKeys` match the submitted group; found keys are absent from `selectable` (FR-001, FR-003) |
| 3 | `buildBoardRows(tiles, found, revealed)` on a loss returns one row per group (4), found rows first and still `found`, the rest `revealed`, in disclosure order (FR-004–FR-006, R-005) |
| 4 | The union of all row tileKeys equals the 16 tile keys — every tile exactly once (FR-006, SC-002) |
| 5 | `selectable` is empty once revealed; a clear-store input (`[], null`) yields all tiles selectable (Constitution IV) |
| 6 | Reload-restore input: re-running the model with stored `foundGroups` reproduces identical rows (FR-007, SC-004) |
| 7 | The reveal input `null` vs disclosed never reorders or restyles prior found rows (R-005) |
| 8 | (if a row-heading key is added) i18n completeness: the new key present in `es` and `en` |

No component mounting, no browser test, no network (R-009). SC-001/SC-003/SC-005 and the visual
half are verified by quickstart manual checks 1–7; the engine-unchanged claim by manual check 8
and the untouched groups route tests.

## Reconciliation with spec 001 (carried to `/speckit.tasks`)

Feature 001's FR-034 says a correct proposal "MUST remove those tiles from the board"; this
feature replaces that with "arrange them into a permanent green row". The reconciliation is doc
-only: update the FR-034 wording and the T047 quickstart row in `specs/001-daily-anime-puzzles/`
in the same change. The server contract, the stored payload, and every existing test are
unaffected (research R-010).

## Next Steps

1. Run `/speckit.tasks` to derive the implementation task list. Plan-level choices to carry
   there: `buildBoardRows(tiles, found, revealed)` lives in `app/utils/groupsBoard.ts` with the
   `GroupCriterion`-carrying row shape; `GroupsBoard.vue` renders rows above the selectable grid
   and reuses `EntityImage` per tile; `groups.vue` passes the loss `groups` into the finished
   board instead of swapping it out.
2. After implementation, run `npm test` and `npx nuxt build`, then quickstart manual checks 1–8
   (item 9 documents the out-of-scope boundary).
3. Spec 003 has no `[NEEDS CLARIFICATION]` markers and its checklist is fully passing;
   `/speckit.clarify` is optional before tasks.