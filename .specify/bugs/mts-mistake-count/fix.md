# Bug Fix: Match the Series mistake cap not enforced after a correct answer

- **Slug**: mts-mistake-count
- **Fixed**: 2026-10-06
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

The page's three `setGameState` branches each wrote a partial board, and since the store replaces
the entry wholesale, every transition silently dropped the field the other branches owned: hits
dropped `missLog` (letting the station re-derive a shorter miss count, so the game never lost
and the badge climbed past 3/3) and misses dropped `greenPairs` (making the board unwinnable
after any mistake). The state transition is now a single pure reducer that always mirrors the
existing full board back and carries both evidence lists on every path.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `app/utils/matchState.ts` | added | Pure `applyMatchAnswer(state, clues, outcome, answer)` and `nextUnansweredIndex(clues, answered, from)`; single point of truth for the transition, unit-testable without a browser |
| `app/pages/game/match-the-series.vue` | modified | Dropped the inline `nextUnansweredIndex` and the three hand-rolled branches; the whole `answer()` persistence is now one `applyMatchAnswer` call writing the complete state via `setGameState`; `skip()` calls the shared helper |
| `tests/match-state.test.ts` | added test | Regression tests for evidence-carry across hits/misses, the 3-miss cap with an interleaved hit, the 9-green win, attempt counting, and `nextUnansweredIndex` rotation/wrap |

## Diff Highlights

The hit branch previously wrote an object without `missLog`; the reducer writes a complete board:

```ts
const next = applyMatchAnswer(
  {
    status: gameState.value?.status ?? 'in_progress',
    attempts: attempts.value,
    greenSeries: greenSeries.value,
    answeredClues: answeredClues.value,
    clueIndex: clueIndex.value,
    wrongClicks: wrongClicks.value,
    greenPairs: greenPairs.value,
    missLog: missLog.value,
    endedAt: gameState.value?.endedAt,
  },
  puzzle.value.clues,
  outcome,
  { clueKey: clue.key, seriesKey },
)
progress.setGameState('match_the_series', next)
```

In `matchState.ts`, the hit branch carries `missLog` and the miss/lost branches carry
`greenPairs`, so no board field is ever omitted:

```ts
if (outcome.result === 'hit') {
  // ... green/won progression kept, and:
  missLog: state.missLog,
}
// miss branches:
greenPairs: state.greenPairs,
```

The lost-reveal (FR-027) is unaffected and still happens in the page before the single write.

## Tests Added or Updated

- `tests/match-state.test.ts::applyMatchAnswer carries the logged misses across a correct answer so the third miss still ends the game` — pins the reported bug: 2 misses → hit → third miss transitions to `lost` (pre-fix, `lost` was unreachable).
- `tests/match-state.test.ts::applyMatchAnswer keeps the green evidence when a reply misses` — pins the collateral bug: green pairs survive a miss, so a win stays provable.
- `tests/match-state.test.ts::applyMatchAnswer reaches won once nine distinct series are green` — 9-hit win keeps `greenPairs` length 9 and sets `endedAt`.
- `tests/match-state.test.ts::applyMatchAnswer counts attempts once per accepted answer` — hit and miss each increment `attempts` by exactly 1.
- `tests/match-state.test.ts::nextUnansweredIndex` — rotation, wrap-around, exhausted-subset, and empty-clues fallbacks.

## Local Verification

- `set -a; . ./.env; set +a; npx vitest run tests/match-state.test.ts` → 5 passed.
- `set -a; . ./.env; set +a; npm test` → 11 files, 31 tests passed.
- `npx nuxt build` → client, server, and Nitro builds green.

## Deviations from Assessment

- The preferred remediation asked for adding the two omitted fields in place; the pure-reducer
  extraction (the assessment's explicitly-optional step) was taken instead, so the fix is a
  single tested code path rather than three parallel fields. Scope stayed within the files the
  assessment listed. No server, API, or store-semantics changes.
- The `miss`/`lost` branches previously already carried `missLog`; the deficit was `greenPairs`
  (and, for the closing miss, `greenSeries`) — all now carried by the reducer.

## Follow-ups

- `specs/001-daily-anime-puzzles/quickstart.md` row 20 references the old inline
  `nextUnansweredIndex(clueIndex.value)` in the page; refresh that verification note to point at
  `app/utils/matchState.ts`.
- Optionally extend `tests/routes/attempt.post.test.ts` with a carried-missLog sequence proving
  the server reaches `lost` at 3 total misses across an interleaved hit (documents the invariant
  the client now feeds).
- Suggest a `__SPECKIT_COMMAND_BUG_TEST__ slug=mts-mistake-count` run / hand browser re-check of
  the "unwinnable after a miss" symptom (assessment Reproduction step 5).