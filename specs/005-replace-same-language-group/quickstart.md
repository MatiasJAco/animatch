# Quickstart: Replace the "same language" Groups Criterion

- **Feature**: specs/005-replace-same-language-group
- **Date**: 2026-10-07
- **Spec**: [spec.md](./spec.md) · **Data model**: [data-model.md](./data-model.md) ·
  **Contract**: [contracts/openapi.yaml](./contracts/openapi.yaml) ·
  **Research**: [research.md](./research.md) (decisions R-001…R-011)

This guide proves the feature works end to end — that Groups boards never use the language
criterion again, and that the source-material group only exists where the catalog data supports it.
Implementation details live in `tasks.md` (from `/speckit.tasks`).

## Prerequisites

- Node 22+ and a PostgreSQL reachable at `DATABASE_URL` (for game-store reads/writes).
- `.env` with `DATABASE_URL` — gitignored, never committed (Constitution II).
- The day's catalog data already imported by the owning system, including `anime.source`
  (Constitution I).

## Setup

```sh
set -a; . ./.env; set +a          # load DATABASE_URL for the DB-backed tests
npm install                       # no new dependency is added by this feature
npm test                          # automated suite (includes the new source-pool tests)
npx nuxt build                    # production build sanity check
npx nuxt dev                      # play the game locally for the manual checks
```

## Availability probe (read-only, before vs after)

Source-material data is always present in the catalog (research R-002), so the probe below simply
confirms the pool scopes and provides a before/after snapshot of the sources with enough characters
to fill a group. Generation keeps today's generic `PUZZLE_UNAVAILABLE` behaviour for the same cases
any criterion already has, never as a source-data shortfall (research R-007). Run these read-only
probes against the catalog:

```sh
set -a; . ./.env; set +a

# Anime with a usable non-blank source, by source (must match research R-002's snapshot)
psql "$DATABASE_URL" -Atc "
SELECT btrim(a.source) AS src, COUNT(DISTINCT r.character_mal_id) AS chars,
       COUNT(DISTINCT r.anime_mal_id) AS anime
FROM voice_roles r
JOIN anime a ON a.mal_id = r.anime_mal_id
WHERE btrim(a.source) <> '' AND btrim(r.language) <> ''
GROUP BY src HAVING COUNT(DISTINCT r.anime_mal_id) >= 4
ORDER BY chars DESC;"
```

Record the number of usable sources before the change (baseline) and after; availability must not
regress (spec SC-006).

## Automated checks

| Check | Command | Proves |
|-------|---------|--------|
| Source pool query | `npm test` (`tests/…groups-source*.test.ts`) | pools keyed by non-blank source span ≥ 4 distinct anime; blank sources excluded — FR-003, FR-005 |
| Criterion judgement | same suite `holds()` case | a tile joins the source group by its own `source`, never by anime or language — FR-002, FR-005 |
| Generated boards | generator tests | boards contain `same_source` and never `same_language`; exactly one source subset per board — FR-001, FR-006 |
| Determinism | generator tests | same UTC day + same catalog ⇒ identical board (Principle III) |
| Existing suite | `tests/routes/puzzle.get.test.ts`, `tests/routes/attempt.post.test.ts`, `tests/groups-board.test.ts` | hit/miss/lost shapes and consumed-key rejection unchanged; fixture updated off `same_language` |
| i18n completeness | existing i18n test | `groups.criterion.same_source` present in both `es` and `en`; `same_language` gone from both |

## Manual checks (browser, `npx nuxt dev` → Groups)

1. **Never the language group (FR-001, SC-001)** — play (or lose) several days' worth of boards by
   resetting progress with the dev-only Reset button. In every reveal, the four criteria are "the
   same anime", "the same season", "the same source material", and "the same voice actor".
   "The same voice language" never appears.

2. **Source group is real, not a hidden anime group (FR-003, SC-003)** — reveal a board: the group
   labelled "the same source material" shows four characters whose series are visibly different
   titles, and the label matches a fact they share (e.g. all adapted from a light novel).

3. **Source group is solvable by the label (FR-004)** — before losing, a player can name the common
   fact of the source group from the character names alone, as with "the same anime" and "the same
   voice actor".

4. **Bilingual label (FR-007, SC-005)** — switch Español/English: the source-material group's
   label reads correctly in both languages, and the removed language label is gone from both.

5. **Four groups of four (FR-002, SC-002)** — every reveal shows exactly four groups of four, one
   per criterion, each tile exactly once.

6. **Unavailable day behaves as before (FR-008, SC-006)** — source material is always present in
   the catalog, so the source group never bounces between available and not. On the rare day the
   same generic conditions that affect any criterion apply (a pool comes up short or no board clears
   the uniqueness gate), opening Groups shows the same clear unavailable state today's empty season
   shows; nothing on the board is weakened or ambiguous, and the language criterion is never used as
   a fallback (directive, R-007).

7. **Determinism (FR-008)** — re-issue the same UTC day's board twice (regenerate/delete the stored
   row) and confirm the identical board is served, including the same source group.

8. **No scope creep (R-011)** — More or Less and Match the Series are unchanged; Groups tiles,
   mistake count, overlap hint, and the green/red rows layout from feature 003 all behave as before.
   The only copy difference is the new criterion label.

## Expected outcome

All automated suites pass and manual checks 1–8 hold, establishing SC-001 through SC-006. The
feature succeeds if a player never sees a voice-language group again, and the replacement group is
fair (identifiable from what the tiles show) and only present when the catalog data supports it.