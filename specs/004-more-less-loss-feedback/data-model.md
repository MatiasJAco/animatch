# Data Model: More or Less — Explain Every Loss

**Feature**: [spec.md](spec.md) | **Phase**: 1 — Design & Contracts | **Date**: 2026-10-07

## Scope of data change

**No database change.** The feature is client-only. It adds one optional field to the existing browser-held day-result record and reads the existing daily puzzle payload. This document covers:

1. The persisted **loss record** (client-side storage schema v1, additive).
2. The derived **loss view** (pure function of the loss record + the day's puzzle).
3. The unchanged server **attempt outcome** used as the source of the counts.

---

## 1. Persisted loss record (client-side)

### Storage context (unchanged)

- Single `localStorage` key: `animatch:v1:progress`.
- Payload: `{ v: 1, date: 'YYYY-MM-DD' (UTC), games: { [gameId]: LocalGameState } }`.
- Date-scoped: on `load()`, a stored blob for a previous UTC day is discarded (`clear()` then fresh empty state); a missing/malformed blob yields a fresh empty state (game playable from scratch). See `app/composables/useLocalProgress.ts:55-107`.
- `GameId` values include `more_or_less`, `groups`, `match_the_series`.

### New field

On the `more_or_less` entry of `games`:

| Field | Type | Meaning |
|-------|------|---------|
| `loss` | `MoreOrLessLossRecord` (optional) | Present when and only when today's More or Less result is a loss. |

```ts
interface MoreOrLessLossRecord {
  round: number          // 0-based index of the failed round (0..9)
  given: 'more' | 'less' // the answer the player chose
  correct: 'more' | 'less' // the correct answer for that round
  hidden: number         // the hidden person's true role count (the "correct amount", shown in red)
  visible: number        // the count the hidden count was compared against
}
```

### Validation rules (client, on read)

- `loss` is **optional**: absence is valid (e.g. old blobs, wins, in-progress games).
- If present, it MUST be an object with:
  - `round`: integer within `[0, 9]` (ROUNDS = 10),
  - `given`, `correct`: one of `'more' | 'less'`,
  - `hidden`, `visible`: finite numbers.
- A `loss` that fails validation is **dropped** (the game still shows its `lost` status, attempts, and share text; it never turns into an error or blank screen).
- The version marker stays `v: 1` — the addition is additive/backward compatible.

### Lifecycle

- **Written**: when a More or Less attempt returns `state: 'lost'`, the page persists `status: 'lost'`, `attempts`, `endedAt`, and `loss` in one write.
- **Read**: on load, the record rides along with the existing day-result blob for the same UTC day.
- **Expired**: discarded automatically when the stored blob's `date` no longer equals the UTC day.
- **Cleared**: `clear()`/`resetAllGames` removes it with the rest of the day's result; game returns to a playable empty state.
- Never sent to the server, never readable by the API (Principle II holds; the value is UI-local).

---

## 2. Derived loss view (pure function)

```ts
interface MoreOrLessLossView {
  round: number            // 0-based failed round index
  totalRounds: number      // from puzzle.rounds (10)
  given: 'more' | 'less'
  correct: 'more' | 'less'
  hidden: number           // recorded hidden count
  visible: number          // recorded visible count
  personId: number | null  // failed-round person, for the tile image
  personName: string       // failed-round person name; '' when unknown
  visibleId: number | null // the person the hidden count was compared against
  visibleName: string      // that person's name; '' when unknown
}
```

### Derivation rule (mirrors the server)

Given the day's puzzle payload (`game`, `date`, `rounds`, `chain`, `initialVisible`):

- `ordered = [puzzle.initialVisible, ...puzzle.chain]`
- failed-round person = `ordered[loss.round + 1]`
- `personId` = that entry's `id`, `personName` = its `name`.
- compared person = `ordered[loss.round]`; `visibleId`/`visibleName` come from that entry.

This is the same rule the server uses to resolve the attempt outcome (`server/game/moreOrLess.ts:67-68`: `hidden = ordered[round + 1]`, `visible = ordered[round]`).

### Degradation

- If `loss.round` is out of range, or `ordered[loss.round + 1]` is undefined: `personId = null`, `personName = ''`. If `ordered[loss.round]` is undefined, the same applies to `visibleId`/`visibleName`. The view still carries `hidden`/`visible`/`given`/`correct`/`round`/`totalRounds`, so the explanation renders counts without the tiles (spec: never blank).

### Constraints on the view

- Only data for the failed round is exposed: the two counts, the answers, the failed round index. No other rounds' counts or the rest of the chain (FR-009, and the 001 spec's single-disclosure rule).

---

## 3. Source of truth: server attempt outcome (unchanged)

The counts and answers shown in the loss view come from the **attempt response** captured when the player answered wrong:

```ts
interface MoreOrLessOutcome {
  result: 'hit' | 'miss'
  round: number
  correct: 'more' | 'less'
  given: 'more' | 'less'
  counts: { hidden: number; visible: number }
  state: 'in_progress' | 'won' | 'lost'
}
```

(`server/game/moreOrLess.ts:26-34`.) On a miss, the page persists `round`, `given`, `correct`, `counts.hidden`, `counts.visible` into the loss record. On a hit, nothing extra is persisted (existing in-progress persistence is unchanged).

---

## State transitions

| Transition | Trigger | Stored effect |
|------------|---------|---------------|
| `in_progress -> lost` | One wrong answer on any round | `status: 'lost'`, `attempts`, `endedAt`, `loss` written atomically |
| `lost -> (reload/revisit same UTC day)` | Page load; blob date == today | Loss record read back; explanation derived from today's puzzle |
| `lost -> (next UTC day)` | Blob date != today | Blob discarded; new day playable empty |
| `lost -> (storage cleared/malformed loss)` | `clear()`/read failure | Playable empty state, or `lost` result with explanation degraded (no tile) |
| `in_progress -> won` | Correct answer on round 10 | `status: 'won'`; no `loss` field |

## Entities

- **Day Result (client-held)**: today's outcome for one game, including the optional `loss` record — see [spec.md](spec.md) Key Entities.
- **Loss Record**: `MoreOrLessLossRecord` above.
- **Loss View**: `MoreOrLessLossView` above — the render-ready shape consumed by the explanation component.
- **Attempt Outcome**: server-returned correctness + counts for a single round (unchanged contract).