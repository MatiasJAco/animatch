# Research: Match the Series — Unlimited Mistakes Within a 90-Second Timer

**Feature**: [spec.md](./spec.md) | **Phase**: 0 — Outline & Research | **Date**: 2026-10-10

All unknowns are resolved from the codebase itself (the match game module, its generator, the shared
attempt route, the client progress store, and the existing loss/reveal flows). No project-external
research was required. Each decision records what was chosen, why, and the alternatives considered.

## R-001 — The time limit is a fixed 90-second constant

**Decision**: The limit is one exported constant, `MATCH_TIME_LIMIT_MS = 90_000`, in a pure helper
module (`app/utils/matchTimer.ts`). The same constant drives the initial display, the clamp, and the
time-out test, so the badge can never disagree with the ending rule.

**Rationale**: Spec FR-003 and the clarified answer fix a single value identical for every player.
One constant seeded from both the composable and its tests prevents drift (the pattern used by the
existing `MATCH_BOARD_SIZE` / `MATCH_CLUE_COUNT` constants in `server/game/matchTheSeries.ts`).

**Alternatives considered**:
- *A per-day value in 60–90 s* — rejected by the clarified answer (fixed 90 s) and it would add
  non-determinism to a value the UI must explain.
- *A hardcoded literal in the component* — rejected: two copies (component + test) invite drift.

## R-002 — Remove the mistake-cap machinery entirely

**Decision**: Delete the cap rather than leave it inert:

- Remove `MATCH_WRONG_LIMIT` and the `wrongLimit` field from `MatchTheSeriesPayloadData`; the
  generator stops writing it.
- Remove the `missLog` evidence from the match attempt (`parseMatchAttempt`, `verifyMatchProgress`)
  and the `MatchTheSeriesOutcomeMissEnded` variant. A wrong answer always resolves to
  `{ result: 'miss', state: 'in_progress' }`; `resolveMatchOutcome` no longer needs `progress.misses`.
- Keep the `greenPairs` evidence untouched: it is what proves the win (`verifyMatchProgress`
  returns the derived green set), so Constitution IV's "no forged win" property survives.

**Rationale**: The feature's premise is "mistakes no longer matter" (spec US1, FR-001/FR-002). A
payload field and an evidence list that no longer affect anything are dead code and a review smell
(Constitution, Governance: "Unjustified complexity MUST be removed"). `missLog` had exactly one
purpose — counting toward the cap — so removing the cap makes it disposable; `greenPairs` remains
load-bearing. Removing the second `missLog` meaning also resolves the duplicate `missLog` member
currently declared in `LocalGameState` (one shape for match, one for groups).

**Alternatives considered**:
- *Keep `wrongLimit` / `missLog` for backward compatibility* — rejected: keeps a misleading field
  and an unused evidence list, and the payload is internal (no external consumer), so there is no
  compatibility to preserve.
- *Keep `missLog` "just in case" for the reveal* — rejected: the reveal needs the **answer key**, not
  the visitor's misses; the answer key lives only in the stored solution.

## R-003 — The countdown is device-owned and pause-aware

**Decision**: A new composable, `useMatchTimer`, owns the countdown:

- It starts from the stored `timerRemainingMs` (or the full `MATCH_TIME_LIMIT_MS` for a fresh game).
- A ~1 Hz tick subtracts elapsed time and clamps at zero; the value is written back to the day's
  progress entry so a reload resumes it.
- On `visibilitychange`, a hidden document **pauses** the tick and snapshots the remaining value; a
  visible document resumes from that value. Time while hidden is never charged.
- When the value reaches zero, it triggers the time-out exactly once.

**Rationale**: Spec FR-008 and the clarified answer require pausing while the board is not visible
and preserving the remaining time across reloads. Because v1 is stateless (Constitution IV), the
clock must live on the device; persisting the remaining milliseconds in the existing progress entry
is the minimal place to keep it, and it already survives a reload the same way the board position
does (FR-043a). Recomputing from a fixed deadline only while visible avoids charging throttled
background time.

**Alternatives considered**:
- *Absolute deadline persisted at start* — rejected: a backgrounded tab (or device sleep) would burn
  the clock while hidden, contradicting the chosen pause behavior.
- *Reset to 90 s on every load* — rejected: a reload would grant unlimited time.
- *A server-side clock/session* — rejected outright by Constitution IV.

## R-004 — Time-out reveal needs a stateless server endpoint

**Decision**: Add `POST /api/daily/match_the_series/expire`, which loads the stored puzzle and
returns `{ result: 'expired', state: 'lost', answers }`. The client calls it once when the clock hits
zero (while still in progress) and, on success, stores `status: 'lost'` plus the revealed mapping.
Errors reuse the existing envelope (`PUZZLE_UNAVAILABLE` / `DATABASE_UNAVAILABLE`) and the existing
bilingual retry panel.

**Rationale**: The answer mapping is deliberately never sent in the daily payload (001 R-010, and
spec FR-027 a/b withhold it below the cap). A pure client reveal is therefore impossible: the client
has no way to know the correct series. The endpoint reuses the exact disclosure the old
lost-on-third-miss response already performed — a full mapping — so no new disclosure class is
introduced.

**Trade-off (documented, accepted)**: With no server-held state the server cannot verify that 90
seconds really elapsed, so a client could call the endpoint early to learn the day's answers. This is
within the v1 threat model: Constitution IV already states the client is not trusted for scoring and
the day result is client-owned, and the day's puzzle is a single shared board with no leaderboard or
server score to protect. The alternative — shipping the mapping to every client up front — is
strictly worse because it discloses the answers for the entire day to everyone.

**Alternatives considered**:
- *Include the answer mapping in the daily payload* — rejected: it leaks the solution on every load
  and undermines the evidence-based win verification for no benefit.
- *A signed/gated mapping in the payload* — rejected: it still reaches the client and cannot enforce
  elapsed time without server state, so it only adds complexity.
- *No reveal on time-out* — rejected: spec US3/FR-006 require the full reveal, matching the existing
  ending.
- *A `timeout` flag on the attempt endpoint* — rejected: the attempt contract is a scored
  clue/series answer; a body-less reveal is a different operation, so a dedicated route keeps both
  contracts clear.
- *A new static `server/api/daily/match_the_series/expire.post.ts` directory* — rejected after
  implementation probing: in Nitro's file router a static `match_the_series/` segment shadows the
  dynamic `[game].get.ts` route, so `GET /api/daily/match_the_series` returned 404. The route lives
  under the existing `[game]/` folder (`server/api/daily/[game]/expire.post.ts`) and rejects any
  other game, keeping the URL `POST /api/daily/match_the_series/expire` while leaving the dynamic
  GET route intact.

## R-005 — Countdown presentation: inside the clue card, right-aligned, two digits in a circle

**Decision**: The badge renders in `MatchGrid.vue` as the clue card's last child with `margin-left:
auto` (right-aligned) and a fixed-size circular style. The number is `formatMatchClock(remainingMs)`,
which rounds up to whole seconds, clamps to `[0, 90]`, and zero-pads to two digits. Tests target the
**pure formatting/clamping functions**, not the CSS or markup; the visual placement is validated
manually and by the existing geometry e2e harness (which asserts rectangles, not class strings).

**Rationale**: Spec FR-014 (added from the user's follow-up: "the countdown must appear inside the
clue-card aligned to the right. The number of two digits can be inside a circle"). Constitution VI
forbids stylesheet-text and markup-snapshot assertions, so the only automated proof of the *value*
behavior is the pure helper; the *placement* is a rendered-geometry property already covered by the
project's Playwright conventions (or manual quickstart steps).

**Alternatives considered**:
- *A separate `MatchTimer.vue` component* — rejected: the badge is a few nodes inside the clue card
  that `MatchGrid` already owns; a new component adds indirection without reuse.
- *Putting the countdown in the page header or the old mistakes bar* — rejected by the explicit
  placement requirement.

## R-006 — Client state shape and the "replace the whole entry" hazard

**Decision**: Extend `LocalGameState` with `timerRemainingMs?: number` and
`revealedAnswers?: Record<string, string>`; remove the match `wrongClicks` and the match-shaped
`missLog`. Because `useLocalProgress.setGameState` **replaces the whole entry**, `applyMatchAnswer`
and the page's `persist` must carry the timer and reveal fields forward on every write — the same
class of bug the existing comments already warn about for `greenPairs`/`missLog`.

**Rationale**: Spec FR-008 (resume) and FR-007 (finished marker + reveal after time-out) need these
fields to survive reloads. Groups already persists its reveal (`foundGroups`), so persisting
Match's `revealedAnswers` is parity, not a new pattern. Dropping the match `missLog`/`wrongClicks`
follows R-002.

**Alternatives considered**:
- *Reveal only in memory* — rejected: a reload after time-out would lose the reveal, a worse
  experience than the existing loss path and inconsistent with Groups.
- *A nested `timer` object* — rejected: flat optional fields match the existing store style and keep
  the round-trip test simple.

## R-007 — Bilingual copy

**Decision**: Update `game.match_the_series.summary` (both locales) to describe the timer instead of
"three mistakes"; add `match.timer` (the badge's accessible label) and `match.time_up` (the time-out
message); remove the now-unused `match.mistakes`. The existing `match.game_over` / `match.reveal.title`
copy is reused for the reveal heading.

**Rationale**: Constitution (Bilingual UI) requires every user-facing string in both `es` and `en`
from the first commit, and the i18n parity test compares the two key sets. The summary currently says
"Three mistakes end the game" (`app/i18n/en.ts:16`, `app/i18n/es.ts:16`), which would be false after
this change.

**Alternatives considered**:
- *Keep `match.mistakes` and the summary* — rejected: both would contradict the shipped behavior and
  the summary is surfaced on the home card.

## R-008 — Test strategy within the 15-test cap

**Decision**: Keep coverage pure-first and additive:

1. `tests/match-timer.test.ts` (NEW, pure): two-digit formatting (`90`→`90`, `9`→`09`, `0`→`00`),
   clamp at zero and at the limit, and that one tick advances remaining time by the elapsed amount.
2. `tests/match-state.test.ts` (EDIT): a wrong answer always yields `in_progress`, never `lost`; a
   win still needs nine distinct green series; timer/reveal fields are carried through writes.
3. `tests/routes/expire.post.test.ts` (NEW, DB-gated): the endpoint returns `state: 'lost'` and the
   full 18-key mapping for the stored puzzle; unknown-day/unavailable reuse the error envelope.
4. Edits: `routes/attempt.post.test.ts` (a match miss never ends the game), `routes/puzzle.get.test.ts`
   (payload has no `wrongLimit`), `local-progress.test.ts` (timer fields round-trip; removed fields
   gone), and the geometry e2e reaches Match's finished state via a near-zero stored timer.

**Rationale**: The timing core is pure and exported, so its boundary cases are cheap and reliable to
assert without a DOM or database; the endpoint is a small DB-gated contract check. No stylesheet-text
or markup-snapshot assertions are used (Constitution VI), and the total stays well under the feature's
15-test cap.

**Alternatives considered**:
- *DOM tests of the badge placement/value* — rejected: violates the no-markup-snapshot rule and is
  brittle; the value logic is already pure-tested and placement is a geometry property.
- *Playwright-only timer coverage* — rejected: waiting on a real 90 s clock is slow and flaky; the
  near-zero stored timer keeps the single e2e affordance focused on the finished-board contract.
