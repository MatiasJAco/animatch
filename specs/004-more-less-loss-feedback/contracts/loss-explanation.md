# Contract: More or Less Loss Explanation

**Feature**: [spec.md](../spec.md) | **Phase**: 1 — Design & Contracts | **Date**: 2026-10-07

## Interface scope

- **HTTP API**: unchanged. The attempt endpoint and `MoreOrLessOutcome` are defined in `specs/001-daily-anime-puzzles/contracts/openapi.yaml` (`POST /daily/{game}/attempt`, examples `moreOrLessHit` / `moreOrLessMiss`). This feature adds no endpoint, request, or response field; the explanation is built from the already-served attempt outcome and puzzle payload.
- **Client-side storage schema**: extended additively (see below).
- **UI contract**: the loss view's rendered content, guarantees, and accessibility requirements.

---

## 1. Client storage schema (additive)

`LocalGameState` for `more_or_less` gains an optional field (version marker remains `v: 1`):

```ts
loss?: {
  round: number          // 0..9, failed round index
  given: 'more' | 'less'
  correct: 'more' | 'less'
  hidden: number         // hidden person's true count (red emphasis)
  visible: number        // comparison count
}
```

Contract rules:

1. **Absent is valid.** Old blobs, wins, and in-progress games omit `loss`.
2. **Validated on read.** `round` integer in `[0,9]`; `given`/`correct` in enum; `hidden`/`visible` finite numbers. Invalid -> field dropped, game keeps its `lost` status.
3. **Day-scoped.** Lives inside the existing date-scoped blob; a different UTC day discards it.
4. **Client-only.** Never sent to the server.

## 2. UI contract — loss explanation panel

Rendered inside the result view whenever the More or Less day result is a loss. Required content, in order:

| Order | Element | Source | Required |
|-------|---------|--------|----------|
| 1 | Loss/wrong heading (existing `result.lost`; the game-over cue) | day result | always |
| 2 | Round indicator "Round {current} of {total}" | derived view (`round + 1`, `totalRounds`) | always |
| 3 | The failed person's tile: `EntityImage kind="person"` (`id`, `name`) + person name, framed with the error red background (`.loss-explanation__tile`) | derived view (`personId`, `personName`) | always (red frame; placeholder tile when `personId` is null) |
| 4 | The failed person's true count emphasized in red, framed by the reveal sentence (`more_or_less.reveal`, detail in §3) | derived view (`hidden`) | always |
| 5 | The compared person's tile (`visibleId`/`visibleName`) with the compared count badge | derived view | when `visibleId != null` |
| 6 | Existing attempts + share block | day result | always |

### Guarantees

- **Single interaction**: everything above is visible with the loss announcement; no taps/clicks/scroll-to-new-view required (FR-006).
- **Persistent**: the panel is derived from the day result + day's puzzle and re-renders on reload/revisit for the same UTC day (FR-007).
- **Bounded disclosure**: only the failed round's counts and tiles; nothing for later rounds and no rest of the chain (FR-009).
- **Never blank**: if `personId` is null the panel still shows rows 1–4 and 6 (the red frame holds the placeholder tile and the true count is still labeled); if a loss record is unreadable the plain `result.lost` summary (rows 1, 6) still renders. An error or blank screen is never used for a recorded loss (FR-011, edge cases).

## 3. Red emphasis and accessibility

- The failed person's tile uses the application's existing `--wrong` color token (the same token powering `.feedback--wrong`), and the true count is rendered in that same red. This is the "red" the user asked for.
- The count is **never conveyed by color alone**: it is always accompanied by its label and the reveal sentence text (§2 row 4), so a no-color reading (and a screen reader) still gets the meaning (FR-012).
- Row order is the DOM/reading order; the tile image's alt text comes from the shared `image.alt` catalog entry, and every phrase is a message-catalog key present in both `en` and `es` (FR-008).

## 4. Server contract bounds (re-confirmed)

- The attempt response discloses counts only for the resolved round — still the sole disclosure path (001 spec `MoreOrLessOutcome`, `moreOrLessMiss` example). No change is made to it by this feature.