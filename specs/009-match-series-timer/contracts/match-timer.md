# Contract: Match the Series Countdown & Ending Rule

**Feature**: [spec.md](../spec.md) | **Phase**: 1 — Design & Contracts | **Date**: 2026-10-10

## Interface scope

- **Client timing contract**: the pure helper API and the countdown behavior (pause/resume/persist).
- **UI contract**: where the countdown renders and how it is formatted.
- **Server game contract change**: a wrong answer no longer ends the game; the `wrongLimit` payload
  key is gone. The attempt endpoint's request/response shape is otherwise unchanged.
- **No database contract change**: `daily_puzzles` columns and the create-once path are untouched.

The on-demand reveal is specified separately in [expire-endpoint.md](./expire-endpoint.md).

---

## 1. Pure timing helper (`app/utils/matchTimer.ts`)

```ts
export const MATCH_TIME_LIMIT_MS = 90_000

// Whole seconds remaining, clamped to [0, MATCH_TIME_LIMIT_MS], zero-padded to two digits.
// Uses Math.ceil so a fresh game reads "90" and the value reaches "00" only at zero.
export function formatMatchClock(remainingMs: number): string

// Clamps a raw remaining value into [0, MATCH_TIME_LIMIT_MS]; non-finite -> 0.
export function clampRemaining(remainingMs: number): number

// Pure tick: subtracts an elapsed duration and clamps. Used by the composable and its tests.
export function advanceRemaining(remainingMs: number, elapsedMs: number): number
```

Contract rules:

1. **Two digits always**: `formatMatchClock(90_000) === '90'`, `formatMatchClock(9_000) === '09'`,
   `formatMatchClock(0) === '00'` (spec FR-014).
2. **Fixed limit**: the constant is the single source of the limit; nothing derives it from the
   player, locale, device, or timezone (spec FR-003).
3. **Clamp**: `clampRemaining` and `advanceRemaining` never return a value below 0 or above the limit
   (spec edge case "correct answer exactly as time reaches zero" — the win takes precedence and the
   clock is already floored).

---

## 2. Countdown behavior (`app/composables/useMatchTimer.ts`)

| Behavior | Rule |
|----------|------|
| Initial value | `timerRemainingMs` from the day's stored state, else `MATCH_TIME_LIMIT_MS` (spec FR-008) |
| Tick | ~1 Hz while the game is `in_progress` and `document.visibilityState === 'visible'` |
| Pause | On hidden: stop ticking and persist the current `timerRemainingMs` |
| Resume | On visible: continue from the persisted value; hidden time is never charged |
| Reload | Resume from the persisted `timerRemainingMs` — never restart at the limit, never drain while away |
| Zero | Fire the time-out once (guard flag) and stop ticking |
| Win | Stop ticking as soon as `status` becomes `won` |
| Persist | The remaining value is written with the rest of the day's state on every write (the store replaces the whole entry, so it must be carried forward) |

The composable holds no server state and makes exactly one network call, the reveal request at zero
(Constitution IV; [expire-endpoint.md](./expire-endpoint.md)).

---

## 3. UI contract (clue card)

The countdown renders inside the clue card in `app/components/MatchGrid.vue`:

- **Placement**: the clue card's last child, pushed to the **right edge** (e.g. `margin-left: auto`),
  so it sits to the right of the card's image and text without displacing them (spec FR-014).
- **Format**: a **circle** containing the two-digit value from `formatMatchClock` (spec FR-014; user
  requirement: "the countdown must appear inside the clue-card aligned to the right. The number of
  two digits can be inside a circle").
- **Label**: an accessible name from the message catalog (`match.timer`), localized, never a bare
  number with no context.
- **Removed**: the `Mistakes: {current}/{max}` bar no longer renders; `match.mistakes` is removed
  from both locales.
- **Finish states**: the badge shows the frozen remaining value on a win and `00` on a time-out;
  it never disappears and leaves a blank card.
- **Layout**: the badge must not introduce horizontal overflow at supported widths (≥1024 px),
  consistent with the existing viewport contract.

---

## 4. Server game contract change

In `server/game/matchTheSeries.ts`:

```ts
// REMOVED
// export const MATCH_WRONG_LIMIT = 3
// interface MatchTheSeriesPayloadData { ... wrongLimit: number }
// type MatchTheSeriesOutcomeMissEnded  (correctSeriesKey, answers, state:'lost')

// CHANGED
export function verifyMatchProgress(
  solution: MatchTheSeriesSolution,
  greenPairs: readonly MatchScoredPair[],
): { green: Set<string> }

export function resolveMatchOutcome(
  payload: MatchTheSeriesPayloadData,
  solution: MatchTheSeriesSolution,
  attempt: { clueKey: string; seriesKey: string },
  progress: { green: Set<string> },
): MatchTheSeriesOutcome   // hit | miss(in_progress) — never lost
```

Contract rules:

1. **A wrong answer never ends the game** (spec FR-001/FR-002): the `miss` branch always returns
   `state: 'in_progress'` and discloses nothing about the correct series.
2. **The win is unchanged**: `won` requires nine distinct green series; a `greenPairs` claim is
   accepted only when each pair matches the stored solution (Constitution IV).
3. **The payload no longer carries `wrongLimit`**; `server/generators/matchTheSeries.ts` stops writing
   it. Nothing else in the payload, or in `daily_puzzles`, changes.

---

## 5. Explicitly out of scope (validated as unchanged)

- Groups and More or Less game modules, generators, payloads, and the groups branch of `attempt.post.ts`.
- The catalog query layer and the read-only catalog.
- `daily_puzzles` schema, migrations, and the create-once path.
- The attempt request's `greenPairs` evidence (still required for a win) and its `hit` response.
- The share text template and the result panel; only the day result and its rendering change.
