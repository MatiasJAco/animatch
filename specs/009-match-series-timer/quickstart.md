# Quickstart: Match the Series — Unlimited Mistakes Within a 90-Second Timer

**Feature**: [spec.md](./spec.md) | **Phase**: 1 — Validation Guide | **Date**: 2026-10-10

## Prerequisites

- Node ≥22.18 and dependencies installed (`npm install`).
- Dev server up: `npm run dev` with the app's `DATABASE_URL` configured (the day's puzzle is
  generated on first request). The catalog is the pre-existing, read-only data source.
- A modern browser; the countdown uses only `setInterval` and the Page Visibility API.
- For local iteration, the create-once rule applies: a `daily_puzzles` row already stored for the UTC
  day is served as-is. To force regeneration of only the app-owned puzzle row (never a catalog table):

  ```sql
  DELETE FROM daily_puzzles WHERE game = 'match_the_series' AND puzzle_date = '<the UTC day>';
  ```

## Automated checks

```bash
npm test
```

Expected: all tests pass, including the new/edited coverage:

- `tests/match-timer.test.ts` (NEW, pure): `formatMatchClock(90_000) === '90'`,
  `formatMatchClock(9_000) === '09'`, `formatMatchClock(0) === '00'`; clamp at zero and at the limit;
  `advanceRemaining` subtracts elapsed time and floors at zero.
- `tests/match-state.test.ts` (EDIT): a wrong answer always leaves the game `in_progress` (never
  `lost`); nine distinct green series still win; timer/reveal fields survive state writes.
- `tests/routes/expire.post.test.ts` (NEW, DB-gated): `POST /api/daily/match_the_series/expire`
  returns `{ result:'expired', state:'lost', answers }` with all 18 clue keys; the error envelope is
  reused when the day is unavailable.
- `tests/routes/attempt.post.test.ts` (EDIT): a match `miss` never returns `lost` and never discloses
  the correct series.
- `tests/routes/puzzle.get.test.ts` (EDIT): the match payload no longer contains `wrongLimit` (the
  Groups payload still contains its own `wrongLimit`).
- `tests/local-progress.test.ts` (EDIT): `timerRemainingMs` and `revealedAnswers` round-trip; the
  removed match fields are gone.

```bash
npx playwright test e2e/viewport-fit.spec.ts
```

Expected: the finished-board layout contract holds; the Match finished state is reached by seeding a
near-zero stored timer and mocking the `expire` response (so no real 90 s wait is needed).

## Manual validation

### 1. Unlimited mistakes, only the clock matters (US1)

1. Open **Match the Series**.
2. Click a wrong series many times (well past the old limit of three).
3. Confirm the game stays in progress, only shows wrong-answer feedback, and no green tile changes.

### 2. The countdown is visible, right-aligned, two digits in a circle (US2)

1. On a fresh board, confirm a **two-digit number inside a circle** sits **inside the clue card**,
   aligned to its **right** edge (e.g. `90`), and does not overlap the card's image or name.
2. Confirm it decreases once per second (`90 → 89 → … → 09 → 08`) and that correct/wrong answers and
   the `Next` skip do not reset it.
3. Resize to 1024, 1280, 1440, and 1920 px wide: the circle stays inside the card and there is no
   horizontal scroll.

### 3. Pause on hidden, resume on return, survive reload (US2)

1. With the clock running, switch to another browser tab (or minimize) for ~20 seconds.
2. Return: the remaining value is roughly where it was — the away time was not charged.
3. Reload the page mid-game: the remaining time, the green tiles, and the card on screen all resume
   (the clock does **not** restart at 90).

### 4. A win is unchanged (US1)

1. Find the correct series for all nine tiles before the clock reaches zero.
2. Confirm the game ends as a win and the countdown stops.

### 5. Time-out ends the game and reveals every series (US3)

To avoid waiting 90 seconds, seed a near-zero remaining time and reload:

```js
// In the browser console, then reload /game/match-the-series
const k = 'animatch:v1:progress'
const p = JSON.parse(localStorage.getItem(k))
p.games.match_the_series = {
  ...(p.games.match_the_series ?? { status: 'in_progress', attempts: 0, greenSeries: [], answeredClues: [], clueIndex: 0 }),
  status: 'in_progress',
  timerRemainingMs: 1500,
}
localStorage.setItem(k, JSON.stringify(p))
```

1. Reload and let the clock reach `00`.
2. Confirm the game ends, the page shows a **time's up** message, and every clue's correct series is
   revealed — the same reveal list the game used before.
3. Return home: the Match card is marked finished for the day. Reload the game: the reveal still shows
   (from `revealedAnswers`) and the day is not reopened. Use Reset to clear it.

### 6. Failure stays visible (Principle V)

1. With devtools offline (or by blocking `**/api/daily/match_the_series/expire`), let the clock hit
   zero: the bilingual error panel with a retry appears; the game is not marked lost without a reveal.
2. Restore the network and retry: the reveal appears.

### 7. Other games are untouched (regression guard)

1. Open **Groups** and **More or Less**: their boards, mistake caps, and endings are unchanged.

## Expected outcomes map

| Check | Evidence | Requirement it proves |
|-------|----------|-----------------------|
| §1 | wrong answers never end the game | FR-001, FR-002; SC-001 |
| §2.1–2.2 | two-digit circle inside the clue card, right-aligned; ticks down | FR-004, FR-014; SC-004 |
| §2.3 | no overflow at supported widths | FR-014 |
| §3 | pause/resume + reload resume | FR-008; SC-004 |
| §4 | win ends and stops the clock | FR-005; SC-003 |
| §5 | time-out ends, reveals, marks finished, survives reload | FR-006, FR-007, FR-013; SC-002, SC-006 |
| §6 | reveal failure shows the retryable error | FR-011; Constitution V |
| §7 | Groups / More or Less unchanged | FR-010; SC-007 |
| automated | en/es key parity after copy changes | FR-009; SC-005 |

## Out of scope (validated as unchanged)

- API payload keys other than the removed `wrongLimit`; the `daily_puzzles` schema; migrations.
- Groups and More or Less payloads, mistake caps, and endings.
- The share template and the result panel, beyond the day result they already read.
- Catalog queries and the read-only catalog.
