# Bug Assessment: Match the Series mistake cap not enforced after a correct answer

- **Slug**: mts-mistake-count
- **Created**: 2026-10-06
- **Source**: pasted text
- **Verdict**: valid
- **Severity**: high

## Report (verbatim or summarized)

> While playing Match the Series, if the player makes 2 mistakes and then selects the correct
> answer, the game allows 2 more mistakes, as if the counter reset invisibly. The counter in the
> UI ends with something inconsistent like "mistakes 5/3", which is wrong. Only a limited number
> of mistakes is allowed independently of the user answering correctly in the middle.
>
> (Slug: `mts-mistake-count`)

## Symptom

The mistake count is not bounded by the game's limit. After the player answers a clue
correctly, earlier misses stop counting against the 3-mistake cap, so further wrong clicks are
allowed and the badge can exceed the maximum (e.g. "mistakes 5/3"). Expected: the 3-mistake
limit ends the game regardless of how many correct answers happen in between.

## Reproduction

1. Open a fresh Match the Series board (state cleared).
2. Click a wrong series for the clue on screen twice → badge reads "2/3".
3. Click the correct series → the card is answered (hit) and the board advances.
4. Click a wrong series twice more → both are accepted as non-ending misses; badge reads "4/3"
   (or up to "5/3" if the pattern is repeated with another hit).
5. The game never reports a loss from the two earlier misses — the server only ever saw the
   post-hit misses.

Collateral symptom (same root cause): once any miss has happened, correct answers can no longer
accumulate to a win server-side, so the board cannot be won after a mistake (see Root Cause).

[NEEDS CLARIFICATION: none — the desired rule is explicit in the report and matches the code's
`wrongLimit`/badge design.]

## Suspected Code Paths

- `app/pages/game/match-the-series.vue:120-131` — the hit branch builds a `setGameState` object
  that omits `missLog`. Because `setGameState` replaces the whole entry, the persisted miss
  evidence is silently dropped on every correct answer.
- `app/pages/game/match-the-series.vue:141-150` and `:161-169` — the lost and non-ending-miss
  branches omit `greenPairs`, so the persisted green evidence is dropped on every wrong click.
- `app/composables/useLocalProgress.ts:122-131` — `setGameState` assigns the entry wholesale
  (`current.value.games[game] = state`); fields omitted by the caller disappear from storage.
  This full-replace contract is the enabler; the callers other than Match the Series always
  carry the complete state (Groups and More or Less pages write full objects).
- `server/game/matchTheSeries.ts:148-172` (`verifyMatchProgress`) and `:196-215`
  (`resolveMatchOutcome`) — the server derives the miss count purely from the submitted
  `missLog.length` and the green set purely from submitted `greenPairs` (Constitution IV:
  device holds state, server re-derives from evidence). It is therefore correct itself; the
  evidence presented by the client is what gets truncated.
- `app/components/MatchGrid.vue:96` — renders `t('match.mistakes', { current: wrongClicks, max:
  puzzle.wrongLimit })` from the `wrongClicks` prop, which accumulates past the limit because the
  server never transitions to `lost`.

## Root Cause Hypothesis

`useLocalProgress.setGameState` performs a **full replacement** of the game entry, so every
caller must write the entire state object in one go. `match-the-series.vue` writes a partial
object in each of its three branches and each branch omits a field the *other* branch owns:

- the **hit** branch omits **`missLog`** → after a correct answer the stored miss evidence is
  wiped, so the next requests submit a shorter miss log and the server cannot reach
  `misses >= wrongLimit` (3). The client's `wrongClicks` badge keeps climbing (2 → 3 → 4 → …)
  because the server never returns `lost`. This is exactly the reported "counter reset / 5/3".
- the **miss / lost** branches omit **`greenPairs`** → after any wrong click, prior green
  evidence is wiped, so a later correct answer submits only its own pair and the server's green
  set never reaches `grid.series.length` (9); the game becomes unwinnable once a miss has
  occurred.

Both symptoms share one root in the store's replacement semantics plus the page's partial
state objects. Confidence: **high** — the flow is fully grounded in the read code; the server
side verifies evidence and is not at fault.

## Proposed Remediation

**Preferred**: make `match-the-series.vue` write the complete state on every update — add
`missLog: missLog.value` to the hit branch (line ~120) and `greenPairs: greenPairs.value` to the
miss-with-`in_progress` branch (line ~161) and the `lost` branch (line ~141). No field is ever
dropped by omission; the store's full-replace contract continues to hold. Small, single-page
change, no API or server impact. Optionally extract the state transition into a small pure
function (e.g. `nextMatchState(state, outcome, ...)` in `app/utils/`) so it can be unit-tested
without a browser.

**Alternative**: change `useLocalProgress.setGameState` to merge the given partial onto the
existing entry (`current.value.games[game] = { ...current.value.games[game], ...state }`).
Trade-offs: fixes the whole class of omission bugs at one point and matches how the Groups and
More or Less pages happen to write anyway; but it is a semantics change for every game (callers
can no longer clear a field by omitting it) and broadens the blast radius of the fix. The
`markFinished` and `useAttemptCount` callers already carry/spread full or harmless state, so no
regression is expected, but this alternative should be verified against all three games.

**Files likely to change**:
- `app/pages/game/match-the-series.vue`
- (alternative) `app/composables/useLocalProgress.ts`

**Tests to add or update**:
- Add a regression test asserting the evidence lists never shrink across a hit and across a
  miss: either extract `nextMatchState` and unit-test it (no new dependency), or extend
  `tests/local-progress.test.ts` to document/guard the full-carry contract.
- Optionally extend `tests/routes/attempt.post.test.ts` with a sequence showing the server
  reaches `lost` at 3 total misses when the miss log is carried through a hit — this documents
  the server invariant the client must feed.

## Risks & Considerations

- Minimal: the preferred fix touches one component and changes no API, schema, or server
  behavior.
- If the merge alternative is chosen, verify Groups/More or Less persistence still behaves
  (they write complete objects today, so no change expected) and that `resetGame` /
  `resetAllGames` are unaffected (they operate on the whole store, not per-field).
- No data migration, no performance impact, no security surface.

## Open Questions

- None blocking. Worth a human browser re-run of Reproduction step 5 (the "unwinnable after a
  miss" collateral) to confirm the second symptom end-to-end.