# Implementation Plan: Replace the "same language" Groups Criterion

**Branch**: `005-replace-same-language-group` | **Date**: 2026-10-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-replace-same-language-group/spec.md`, refined by
the plan directive — "In Groups, the criterion should never be same_language. Same source material
is a valid criterion if the data is available."

## Summary

Groups ships the same day's board with exactly four groups of four, but the "same voice language"
group is a latent bug: its pool is keyed by `(anime, language)`, so its four tiles all come from a
single anime and the group is only solvable as a copy of "the same anime" — while its label names
a fact a character name cannot reveal and that is virtually uniform (Japanese) across the catalog.
The directive removes the criterion outright. A read-only probe of the live catalog confirmed the
replacement the directive offers is viable: 618/7793 anime carry a non-blank `source`, and 9 sources
clear the "≥ 4 distinct characters across ≥ 4 distinct anime" bar (research R-002). The plan swaps
the language pool for a source-material pool shaped like *same season* (tiles from **different**
anime, so it is never a hidden same-anime group), adds `same_source` to the criterion union and
`groups.criterion.same_source` to both locales, keeps the wire payload byte-identical, and leaves
the existing deterministic generation and the `PUZZLE_UNAVAILABLE` day exactly as they are — which
is precisely the "if the data is available" guard the directive asks for.

**Technical approach** (details in [research.md](./research.md)): remove same_language everywhere
(R-001); use `anime.source` as the new fact (R-002), recorded as a ninth allowed fact in spec 001
(R-003); new `fetchSameSourcePools` keyed by non-blank source across distinct anime (R-004);
server-side criterion/tile model change only — `GroupsTile` and the payload never carry `source`
(R-005); generator swaps pools, i18n gains the label (R-006); niche sources are preferred so the
uniqueness gate keeps producing boards, with an availability probe and `PUZZLE_UNAVAILABLE` as the
fallback (R-007); no dependency or config change (R-008); reconciliation edits land with the code
(R-009); ~6 tests within the cap (R-010); scope confined to Groups (R-011).

## Technical Context

**Language/Version**: TypeScript on Node 22 (Nuxt 3 runtime); Vue 3 SFCs for the client.

**Primary Dependencies**: unchanged (`nuxt` ^3, `pg`, `vitest` dev). **No new dependency** — the
change adds a catalog query, a criterion case, i18n keys, tests, and doc edits; nothing new to
approve under Principle VI (R-008).

**Storage**: none new. The read-only `anime.source` column already exists in the catalog
(`docs/catalog-schema.sql`). `daily_puzzles` and `useLocalProgress` entries keep their exact
shapes; the `same_source` criterion object flows through the existing
`GroupsSolutionGroup` shape.

**Testing**: `vitest`; ~6 new tests on the source pool, the `holds` case, generated boards, and
determinism (cap: 15), plus the existing groups suites kept green after a fixture swap. No
stylesheet/class/markup assertions, no network in tests (Constitution VI).

**Target Platform**: evergreen browser, desktop or mobile. Server: Linux, Node 22.

**Project Type**: web application (SSR frontend and API in one Nuxt process).

**Performance Goals**: generation-time only; the added source pool is one indexed query and the
criterion is one field comparison, so per-day generation cost is unchanged in kind. Player-facing
perf is untouched (SC-001 "within one second" is render pacing, unchanged).

**Constraints**: same_language never generated nor labelled (directive, FR-001); the replacement
group spans different anime (FR-003) and is judged from the tile's own pinned fact (FR-005);
exactly-one-subset solvability on every board (FR-006); bilingual label, first release
(FR-007, Constitution); determinism and the existing unavailable day (FR-008, SC-006); wire
contract, payload, and storage byte-identical; test cap and no-snapshot rule (Principle VI);
read-only catalog with no new data (Principles I–II).

**Scale/Scope**: one catalog query (`fetchSameSourcePools`), one criterion case plus a pool swap in
the Groups generator and game module, the criterion union's `same_language` → `same_source` swap,
two i18n key changes, ~6 tests, and the reconciliation edits in R-009. No API, payload, storage,
config, or UI-component changes.

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1 design. Against constitution v3.0.0.*

| Principle / rule | How the plan satisfies it |
|---|---|
| I. Read-Only Catalog Ownership | Reads `anime.source` and `voice_roles` with SELECT only, exactly like the pools it replaces; no writes, DDL, triggers, or import tables. `anime.source` already exists (catalog-schema.sql), so no schema dependency is introduced |
| II. API/UI Separation | The browser keeps talking only to the existing `daily_puzzles`-backed endpoints; `source` never enters a puzzle payload or any client-visible data store |
| III. One Deterministic Puzzle per UTC Day | Generation stays seeded by the same UTC-day key with the same retry loop; the source pool is added to the existing deterministic read set. No timezone input; stored puzzles unchanged in shape |
| IV. Stateless v1 | No accounts/sessions; `foundGroups` keeps holding `GroupsSolutionGroup[]`, now sometimes carrying `same_source`. Cleared storage still degrades to a playable board |
| V. Fail Visible, Never Blank | Days the source pool cannot fill keep today's structured `PUZZLE_UNAVAILABLE` error and bilingual ErrorPanel with retry — no malformed or weakened board (FR-008) |
| VI. Lean Tests, Approved Dependencies Only | ~6 new tests ≤ the 15 cap; zero new packages (R-008); no stylesheet/class/snapshot assertions; behaviour-focused (R-010) |
| Bilingual UI | `groups.criterion.same_source` lands in `es` and `en` in the same change; `groups.criterion.same_language` is removed from both, enforced by the i18n completeness test |
| Naming and Originality | No new names, URLs, or copied presentation; the source label is the project's own copy |
| Delivery Model | No install, no native build, no new toolchain; deployment artifacts unchanged |
| Review discipline | All doc/contract references to `same_language` are reconciled in the same change (R-009), so no review faces a spec that promises a criterion the generator can never emit |

**Complexity Tracking**: no constitutional violations; the new allowed fact is a doc reconciliation,
not a constitution amendment (research R-003). Nothing to justify.

## Project Structure

### Documentation (this feature)

```text
specs/005-replace-same-language-group/
├── plan.md                 # This file
├── spec.md                 # Feature specification
├── research.md             # Phase 0: 11 decisions, catalog probe, availability baseline
├── data-model.md           # Phase 1: source criterion, tile fact, pool model, unchanged surfaces
├── quickstart.md           # Phase 1: run commands, availability probe, 8 manual checks
├── checklists/
│   └── requirements.md     # Spec quality checklist (all items pass)
└── contracts/
    └── openapi.yaml        # Groups endpoints; criterion enum now same_source, payload unchanged
```

### Source Code (repository root)

Delta against the current tree — new files marked `+`, changed files `~`:

```text
~ server/catalog/queries.ts                # + fetchSameSourcePools; GroupCandidateTile.source;
#                                          #   fetchSameLanguagePools deleted; header comment
#                                          #   "eight allowed facts" -> nine (incl. source)
~ server/game/groups.ts                    # GroupCriterion: same_language -> same_source
~ server/generators/groups.ts              # pool fetch swap (language -> source); holds() gains
#                                          #   the same_source case; language case removed
~ app/i18n/en.ts                           # + groups.criterion.same_source; - same_language
~ app/i18n/es.ts                           # + groups.criterion.same_source; - same_language
~ tests/groups-board.test.ts               # fixture: same_language -> same_source
+ tests/groups-source.test.ts              # ~6 tests: pool shape, holds(), generated boards,
#                                          #   determinism  (implementer may choose the file name)
~ specs/001-daily-anime-puzzles/
│  ├── spec.md                             # Allowed facts list: + "Anime source material";
│  │                                      #   FR-032 wording, share clarifications
│  ├── data-model.md                       # §6 Groups: tile fact + criteria + pool table
│  ├── research.md                         # fact table (voice language row, eight facts note)
│  └── contracts/openapi.yaml              # criterion enum: same_language -> same_source
~ specs/003-groups-board-layout/
│  └── contracts/openapi.yaml              # lost-group example: same_language -> same_source
```

**Structure Decision**: single Nuxt application, unchanged. The new pool query lives beside its
siblings in `server/catalog/queries.ts` (Principle I: the catalog module owns every catalog read);
the criterion swap is confined to `server/game/groups.ts` + `server/generators/groups.ts`; the label
is a message-catalog key so both locales stay complete. No client components, pages, or composables
change — the existing `criterionLabel` mapping renders the new type from the catalog automatically.

## Design Artifacts

| Artifact | Contents |
|----------|----------|
| [research.md](./research.md) | 11 decisions: remove-vs-repair, replacement fact + live catalog snapshot, ninth allowed fact, pool shape (distinct anime), server-side model only, generator swap + i18n, availability handling, zero dependency, reconciliation list, test shape, scope |
| [data-model.md](./data-model.md) | `GroupCriterion` with `same_source`, `GroupCandidateTile.source`, source-pool invariants, unchanged wire/storage surfaces, no new transitions |
| [contracts/openapi.yaml](./contracts/openapi.yaml) | Groups GET/attempt reference; criterion enum now `[same_anime, same_season, same_source, same_voice_actor]`; lost example discloses the source group; payload unchanged |
| [quickstart.md](./quickstart.md) | Setup plus the read-only availability probe and 8 manual checks tied to FRs/SCs |

## Key Design Points

**Why remove rather than repair same_language.** The group is only solvable as a second "same
anime" group — its four tiles come from one anime — and the "voice language" label names a fact the
tiles cannot reveal and that is uniform across the catalog. A cross-anime language group would fail
the exactly-one-subset gate on almost every board. The directive says never same_language, so the
removal is total (R-001).

**Why source material is built like same season, not like the old language pool.** Keying the pool
by source across **distinct anime** makes the group reason about a title-bound fact a player can
know, and guarantees it can never collapse into a hidden same-anime group (FR-003). This reuses the
proven same_season shape (R-004).

**Why nothing on the wire changes.** `GroupsTile` stays `{ key, kind, name }`; `source` lives only
on the server-side candidate row and is disclosed only through the group's criterion on a hit or
ending miss — the same disclosure rule as season and language today. That keeps Constitution II
trivial and means the client needs no component change (R-005, data-model §4).

**Why the "if the data is available" guard needs no special fallback.** The generator already has a
deterministic retry loop and a `PUZZLE_UNAVAILABLE` day for pools too thin to fill a valid board.
A day the source pool cannot fill behaves exactly like today; nothing is weakened or ambiguously
generated. The availability probe in the quickstart measures before/after so SC-006 is checkable
(R-007).

**Why niche sources are preferred.** `same_source` holds for any tile sharing the golden source.
The three largest sources colour large parts of the catalog and collide with the other groups'
tiles; the niche sources clear the uniqueness gate reliably. The implementer orders candidate pools
smallest-first inside the existing retry budget, plus two availability refinements that keep the
playable-day share at the language-era baseline (R-007): the airing season is reserved for the
season group alone (the source/anime/actor pools drop currently-airing anime), and the day's golden
source must not appear on the other twelve tiles. The availability probe in the quickstart measures
before/after so SC-006 is checkable.

## Test Plan (~6 tests, within the 15-test cap)

| # | Proves |
|---|--------|
| 1 | `fetchSameSourcePools` returns pools keyed by non-blank source, each with ≥ 4 distinct characters over ≥ 4 distinct anime, deterministically ordered (FR-003, FR-005) |
| 2 | blank sources and pools under the distinct-anime bar are excluded (FR-005, R-004) |
| 3 | `holds()` accepts a tile by its own pinned `source` and rejects tiles of other sources regardless of shared anime or language (FR-005, FR-002) |
| 4 | a generated board's four criteria are `same_anime`, `same_season`, `same_source`, `same_voice_actor` — `same_language` never appears (FR-001, SC-001) |
| 5 | the exact-one-subset gate holds on a produced board: the source subset is the only source-matching subset, board is not ambiguous (FR-006) |
| 6 | re-running generation for the same UTC day with the same catalog state reproduces the identical board, including the source group (FR-008, SC-006, Principle III) |

Existing suites (`groups-board` row model with the swapped fixture, `puzzle.get`, `attempt.post`)
stay green and are not counted against this feature's cap. The on-screen half — bilingual label,
group fairness, unavailable day — is covered by quickstart manual checks 1–8.

## Reconciliation with spec 001 (carried to `/speckit.tasks`)

Feature 001 documents Groups as sharing "same anime, same season, same language, or same voice
actor" and lists voice language among the eight allowed facts and the criterion enum. This feature
replaces those references with the source-material fact, exactly as feature 003 reconciled FR-034:
- `spec.md` — Allowed facts list gains "Anime source material"; FR-032 wording becomes "the same
  anime, the same season, the same source material, or the same voice actor".
- `data-model.md` §6 and `research.md` fact table — tile fact/criteria/pool table updated.
- `contracts/openapi.yaml` — GroupsOutcome criterion enum updated.
All doc edits land in the same change as the code; the server contract and stored payload are
byte-identical either way (research R-009).

## Next Steps

1. Run `/speckit.tasks` to derive the implementation task list. Plan-level choices to carry there:
   `fetchSameSourcePools` in `server/catalog/queries.ts`; `same_source` replaces `same_language` in
   `server/game/groups.ts` and `server/generators/groups.ts`; i18n keys `groups.criterion.same_source`
   (en: "the same source material", es: "el mismo material de origen"); candidate source pools
   attempted smallest-footprint-first within the existing retry budget; all R-009 reconciliation
   edits in the same change.
2. After implementation, run `npm test` and `npx nuxt build`, then the quickstart availability
   probe and manual checks 1–8.
3. Spec 005 has no `[NEEDS CLARIFICATION]` markers and its checklist is fully passing;
   `/speckit.clarify` is optional before tasks.