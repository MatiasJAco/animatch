# Research: Replace the "same language" Groups Criterion

- **Feature**: specs/005-replace-same-language-group
- **Date**: 2026-10-07
- **Input**: `/speckit.plan` user directive — "In Groups, the criterion should never be same_language. Same source material is a valid criterion if the data is available."

The spec fixes the *why* (the language group is a hidden second "same anime" group whose shared
fact can never be observed) and picks the replacement fact (source material). The plan directive
adds two hard constraints: same_language must never appear again, and the source-material
criterion is valid only where the catalog data exists. Every decision below records what was
chosen, measured, or deferred.

## R-001 — Remove same_language outright, do not repair it

**Decision**: The `same_language` Groups criterion is removed entirely: it is never generated, never
part of a solution, never labelled, never in the criterion union, never in the contract reference
docs, and its i18n key is dropped from both locales.

**Rationale**: The pool is keyed by `(anime, language)`, so the four tiles are all from one anime
and the group is only solvable as "same anime" — while its label says "the same voice language", a
fact a character's name cannot reveal and which is effectively uniform (Japanese) across the
catalog. The directive is explicit: "the criterion should never be same_language." Partial fixes
do not survive this constraint.

**Alternatives considered**: (a) a cross-anime language group — rejected: voice roles are
overwhelmingly one language, so nearly every four-tile subset would match and the board would fail
the exactly-one-subset guarantee (spec FR-006) forever; (b) keeping the pool but re-labelling it —
rejected: that would lie about what the group really is; (c) showing language on tiles — rejected:
a uniform fact shown on tiles still does not make a criterion, and the directive says the criterion
must never appear.

## R-002 — Replacement fact: source material, data confirmed available

**Decision**: The source-material criterion (`anime.source`) replaces the language criterion, per
the directive. The criterion is never speculative: it is built only from anime whose `anime.source`
is populated and non-blank, and the read-only probe below confirms that data is always present in
the catalog, so there is no per-day shortage to design around.

| Source | Distinct characters | Distinct anime |
|--------|--------------------:|---------------:|
| Manga | 3558 | 149 |
| Light novel | 2097 | 86 |
| Web manga | 1002 | 61 |
| Original | 627 | 63 |
| Web novel | 498 | 50 |
| Game | 207 | 19 |
| Novel | 127 | 10 |
| Mixed media | 116 | 5 |
| Other | 109 | 14 |
| 4-koma manga / Visual novel / Picture book / Card game | < 4 distinct anime each | below bar |

718 of 7793 anime carry a non-blank `source`, spanning 13 distinct non-blank values, and 9 of them
clear the "≥ 4 distinct characters across ≥ 4 distinct anime" bar. Plenty of viable pool material
exists, so "if the data is available" (directive) is satisfied.

**Rationale**: Unlike language, `anime.source` is a property of a *title* a player can often know
from general anime familiarity (is it adapted from a manga, a light novel, or is it an original),
so the group can be reasoned about from the same knowledge the "same anime" and "same voice actor"
groups already rely on — it is not invisible and uniform.

## R-003 — "Anime source material" becomes a ninth allowed fact

**Decision**: Spec 001's exhaustive "Allowed facts" list is extended from eight facts to nine by
adding "Anime source material" (`anime.source`). This is a documentation reconciliation, recorded
and carried to tasks; it does NOT amend the constitution, which never enumerates catalog facts.

**Rationale**: The allowed-facts list lives in `specs/001-daily-anime-puzzles/spec.md` and is
mirrored in that feature's research fact table and the `server/catalog/queries.ts` header comment
("Only the eight allowed facts are read"). Principle I still holds: read-only catalog, no writes,
no new tables. The user's directive approves the new fact explicitly, so no `/speckit-constitution`
round is needed.

## R-004 — New pool query, shaped like "same season" not "same language"

**Decision**: A new catalog query returns source-material pools keyed by non-blank `source`, whose
candidate tiles span **distinct anime** (≥ 4 distinct characters and ≥ 4 distinct anime), mirroring
`fetchSameSeasonPool`'s distinct-anime rule (spec 001 FR-038). Blank `source` is never eligible,
exactly as blank `language` was.

**Rationale**: The old bug was that a language pool lived *inside one anime*, turning the group into
a hidden "same anime" group. Keying by source across different anime keeps the group
non-overlapping with `same_anime`, which is spec FR-003's hard requirement, and structurally reuses
the proven same_season pattern.

## R-005 — Tile and criterion model changes are server-side only

**Decision**: `GroupCandidateTile` gains a pinned `source` field; `GroupCriterion` swaps
`{ type: 'same_language'; animeId; language }` for `{ type: 'same_source'; source }`. The wire tile
(`GroupsTile`: `key`, `kind`, `name`) and the puzzle payload are **unchanged** — source never
reaches the browser before a reveal, exactly like season and language today. `holds()` gains a
`same_source` case; `same_language` cases are deleted.

**Rationale**: All four criteria are functions of pinned tile fields (spec 001 R-011), and criterion
disclosure stays on the hit / ending-miss paths only (spec 001 FR-034/FR-035). No payload, API, or
storage change, which keeps Constitution II (§ API/UI separation) trivially satisfied.

## R-006 — Generation swaps pools and adds bilingual labels

**Decision**: `generateGroups` swaps the language pool for the source pool and builds the fourth
group from it; the full-subset uniqueness gate (`findValidGroups`, spec FR-006 / 001 FR-037) is
unchanged and still authoritative. i18n gains `groups.criterion.same_source` in both locales
(en: "the same source material", es: "el mismo material de origen"); `groups.criterion.same_language`
is removed from both locales.

**Rationale**: The generator already picks one pool per criterion and rejects ambiguous boards in a
deterministic retry loop; re-using that machinery is the smallest change. Bilingual copy is
mandated by the constitution and enforced by the existing i18n completeness test.

## R-007 — Availability: niche sources are viable, common ones are collision-prone

**Decision**: The criterion is always available to the generator because the catalog always carries
source-material data (R-002): the source pool is built only from non-blank `anime.source` values,
and no other criterion depends on per-day data being present or absent either. Generation keeps the
existing deterministic pipeline, its retry budget, and its generic `PUZZLE_UNAVAILABLE` outcome. The
implementer carries one knob — how the source pool is chosen inside the retry loop — with two
refinements that keep the playable-day share at the language-era baseline:

1. **Season cut.** The source, anime, and voice-actor pools drop currently-airing anime before any
   candidate is made (the catalog's `fetchCurrentSeasonSeries`). The airing season belongs only to
   the season group; a `same_source` tile from a currently-airing anime would otherwise make the
   board admit extra `same_season` subsets and fail the exactly-one-subset gate (96 of 114 fall-2026
   series carry a source, so this is common, not rare).
2. **Adaptive source choice.** The anime, season, and actor groups are drawn first; the source pool
   is the smallest-footprint pool whose golden source does not appear on any of those twelve tiles,
   whose tiles are collision-free against the already-picked keys, and none of whose tiles is voiced
   by the actor under test (which would make that subset ambiguous). Pools with the largest footprint
   (Manga / Light novel / Web manga) are used only when the smaller ones are ineligible.

A read-only availability probe is added to the quickstart so the before/after availability share
can be measured against today's baseline.

**Rationale**: The `same_source` criterion holds for *any* tile whose anime shares the golden
source. The three largest sources colour a large share of the catalog, so their golden groups
collide with the same_season / same_anime / same_voice_actor groups constantly and boards fail the
exactly-one-subset gate; the niche sources have far fewer co-residents. Footprint-first ordering
*alone* was measured to regress availability (state 2026-10): only ~86% of 50 consecutive days
cleared the gate, and `same_language`'s per-anime pinning had structurally suppressed the extra
`same_season` subsets the cross-anime source group introduces. The season cut and the
source-absent-from-the-other-tiles rule restore parity (all in-range days build; only days past the
catalog's season coverage hit the existing `PUZZLE_UNAVAILABLE`). There is no catalog-shortage
scenario: the only times a day is unavailable are the same generic cases every criterion already has
today — and the outcome is the existing `PUZZLE_UNAVAILABLE` day, never `same_language`.

## R-008 — No new dependency, no config, no scope creep

**Decision**: No `package.json` change, no vitest/config change, no new tooling. The other two
games, the API routes, the payload, and the storage shape are untouched. The only user-facing
surface is the new criterion label (R-006), plus the removal of the unused one.

**Rationale**: The change touches the catalog query layer, the generator, the criterion union, i18n,
tests, and reference docs — all existing code and files. Principle VI's approval-by-name gate is not
triggered because nothing is added.

## R-009 — Reconciliation edits (carried to `/speckit.tasks`)

**Decision**: Every place that names `same_language` or the eight facts is updated in the same
change: `server/game/groups.ts`, `server/generators/groups.ts`, `server/catalog/queries.ts`
(+header comment), `app/i18n/en.ts` and `app/i18n/es.ts`, `tests/groups-board.test.ts` (criterion
fixture), spec 001 `spec.md` (Allowed facts list, FR-032, Share clarifications), spec 001
`data-model.md` §6, spec 001 `research.md` fact table, spec 001 `contracts/openapi.yaml` (criterion
enum), and spec 003 `contracts/openapi.yaml` (lost-group example).

**Rationale**: Same discipline as feature 003's R-010: doc and comment updates must land with the
code so no reviewer faces a contract or spec that still promises a criterion the generator can
never emit.

## R-010 — Automated test shape (respecting the cap)

**Decision**: New tests (roughly 6) cover: the source pool query returns pools spanning ≥ 4 distinct
anime with blank sources excluded; `holds()` marks `same_source` from the tile's source and never by
anime or language; a generated board contains `same_source` and never `same_language`; the golden
source subset is the only source-matching subset on a valid board; the same day regenerates the same
board (deteminism); `groups.criterion.same_source` exists in both locales. The existing groups suites
(`puzzle.get`, `attempt.post`, `groups-board`) stay green with the fixture updated.

**Rationale**: Behaviour over trivia, no stylesheet/markup assertions, and well under the 15-test
cap (Constitution VI).

## R-011 — Scope boundaries

**Decision**: Out of scope: More or Less and Match the Series; the wire contract and payload;
`useLocalProgress` storage; the uniqueness gate's algorithm; the attempt/miss behaviour; the
`groups-board` rows presentation (feature 003, untouched). In scope: the criterion/pool swap, the
new allowed fact, i18n, tests, and the reconciliation edits listed in R-009.

**Rationale**: The directive names exactly one game (Groups) and one criterion. Anything else would
compound the availability and scope risk without serving the user's complaint.