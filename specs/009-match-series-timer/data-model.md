# Data Model: Match the Series — Unlimited Mistakes Within a 90-Second Timer

**Feature**: [spec.md](./spec.md) | **Phase**: 1 — Design & Contracts | **Date**: 2026-10-10

## Scope of data change

**No database schema change and no new stored server field.** The change:
1. Drops the obsolete `wrongLimit` key from the stored Match payload JSON.
2. Removes the match `missLog` evidence and the `lost`-on-miss outcome from the match game module.
3. Adds two client-side fields to the day's progress entry and removes two unused ones.
4. Adds one stateless endpoint whose response is derived on demand (nothing stored).

---

## 1. Server: Match the Series puzzle payload (one key removed)

Stored in `daily_puzzles.payload.data` and served by `GET /api/daily/match_the_series`
(`server/game/matchTheSeries.ts`):

| Field | Type | Meaning |
|-------|------|---------|
| `game` | `'match_the_series'` | Game id |
| `date` | `string` | UTC day key |
| `season` | `{ season: string; year: number }` | The day's current season (unchanged) |
| `grid` | `{ rows: 3; cols: 3; series: MatchTheSeriesSeries[] }` | The nine series tiles (unchanged) |
| `clues` | `MatchTheSeriesClue[]` | The eighteen clue cards (unchanged) |
| ~~`wrongLimit`~~ | ~~`number`~~ | **Removed** — there is no mistake cap |

- **Invariant preserved**: no answer key is ever present in the payload (001 R-010). `greenPairs`
  verification and the win rule are unchanged.
- The stored `daily_puzzles.solution` shape is unchanged: `{ answers: Record<clueKey, seriesKey> }`.

## 2. Server: Match attempt outcome (a miss can no longer end the game)

`server/game/matchTheSeries.ts` resolves one clue/series attempt against the stored solution:

| Outcome | Fields | When |
|---------|--------|------|
| `hit` | `result:'hit'`, `clueKey`, `seriesKey`, `state: 'in_progress' \| 'won'` | The clicked series is correct; `state` is `won` once the derived green set covers all nine series |
| `miss` | `result:'miss'`, `clueKey`, `seriesKey`, `state:'in_progress'` | The clicked series is wrong — **always** in progress now |

- **Removed**: `MatchTheSeriesOutcomeMissEnded` (`correctSeriesKey`, `answers`, `state:'lost'`) — a
  wrong answer never ends the game (spec FR-001).
- **Removed inputs**: the match `missLog` evidence; `verifyMatchProgress` now takes only `greenPairs`
  and returns `{ green: Set<seriesKey> }`.
- **Preserved**: `greenPairs` must be genuine correct pairings or the attempt is rejected
  (`INVALID_ATTEMPT`), so a forged win is still impossible (Constitution IV).

## 3. Server: time-out reveal (derived, not stored)

`POST /api/daily/match_the_series/expire` loads the stored puzzle for the UTC day and returns:

```ts
interface MatchExpireResponse {
  result: 'expired'
  state: 'lost'
  answers: Record<string, string>   // threshold whole withheld mapping: clueKey -> seriesKey
}
```

- No request body, no storage, no session. The response is the same disclosure the old
  lost-on-third-miss response carried.
- Errors reuse the existing envelope: `PUZZLE_UNAVAILABLE` / `DATABASE_UNAVAILABLE` (and
  `UNKNOWN_GAME` is not reachable because the route is match-specific).

## 4. Client: the day's progress entry (`animatch:v1:progress`)

`LocalGameState` (`app/composables/useLocalProgress.ts`) for `match_the_series` becomes:

```ts
interface MatchLocalState {
  status: 'in_progress' | 'won' | 'lost'
  attempts: number
  greenSeries: string[]                 // tiles colored green and locked
  answeredClues: string[]               // cards answered correctly
  clueIndex: number                     // index of the card on screen
  greenPairs: Array<{ clueKey: string; seriesKey: string }>  // win evidence (unchanged)
  timerRemainingMs?: number             // NEW — remaining play time, pause-aware
  revealedAnswers?: Record<string, string>  // NEW — set when the game ends by time-out
  endedAt?: string
}
```

- **Added**: `timerRemainingMs` (spec FR-008) and `revealedAnswers` (spec US3/FR-007 so the reveal
  survives a reload, matching Groups' persisted `foundGroups`).
- **Removed**: `wrongClicks` (only fed the mistakes bar) and the match-shaped `missLog` (only fed the
  mistake cap). This resolves the duplicate `missLog` member currently declared for two games.
- **Unaffected**: Groups' `missLog: string[][]` and `foundGroups`.
- **Write hazard**: `setGameState` replaces the whole entry, so every match write (`applyMatchAnswer`
  and the page's `persist`) must carry `timerRemainingMs` and `revealedAnswers` forward, or a resume
  would reset the clock / lose the reveal.

### Validation rules

- `timerRemainingMs`, when present, is clamped to `[0, MATCH_TIME_LIMIT_MS]` on read and write.
- A stored entry for a **previous** UTC day is discarded as today (unchanged), so the timer only ever
  resumes within the same day.
- A malformed entry never blanks the game (existing `read()` degradation, Constitution V).
- A game already `won`/`lost` for the day is never reopened (spec FR-013).

## 5. Client: the countdown (in memory + persisted remaining)

| Aspect | Value |
|--------|-------|
| Limit | `MATCH_TIME_LIMIT_MS = 90_000` (fixed; spec FR-003) |
| Display | `formatMatchClock(remainingMs)` → two digits, `Math.ceil` to seconds, clamped `0..90`, zero-padded |
| Tick | ~1 Hz while the board is visible and the game is in progress |
| Pause | On `visibilitychange` to hidden: stop ticking, snapshot `timerRemainingMs` |
| Resume | On visible: continue from the snapshot |
| Zero | Trigger the time-out exactly once (call `/expire`, then store `lost` + `revealedAnswers`) |
| Win | Stop the countdown immediately (`status` becomes `won`) |

## Entities

- **Match the Series Game (in progress)**: the client-side board above minus the removed fields.
  Terminal states are `won` (nine green) and `lost` (time-out).
- **Countdown**: `MATCH_TIME_LIMIT_MS` decreasing in whole seconds, shown as a two-digit circular
  badge inside the clue card (spec FR-014).
- **Time Limit**: the fixed `90_000` ms constant; identical for all players, locales, devices, and
  timezones.
- **Day Result**: the device-stored `won` / `lost` outcome plus, on time-out, `revealedAnswers`.

## State transitions

| From | Trigger | To | Effect |
|------|---------|----|--------|
| fresh day | board first shown | in progress | `timerRemainingMs = 90_000`; tick starts while visible |
| in progress | correct answer (not last) | in progress | green tile locked, card retired, timer keeps counting |
| in progress | wrong answer (any number) | in progress | miss feedback only; **no** loss, **no** counter |
| in progress | ninth green tile | won | countdown stops; result + share |
| in progress | countdown reaches zero | lost | call `/expire`; store `lost` + `revealedAnswers`; reveal shown; home marks finished |
| in progress | tab hidden / shown | unchanged | tick pauses / resumes; `timerRemainingMs` snapshots and restores |
| in progress | reload | in progress | resume from stored `timerRemainingMs`, stored `clueIndex`, and green/answered lists |
| won / lost | reload | same | finished state and (on time-out) reveal restored; not reopened |
| any in-progress | day rolls over (00:00 UTC) | fresh day | previous entry discarded by the existing day scoping |
