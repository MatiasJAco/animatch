# Quickstart: More or Less — Explain Every Loss

**Feature**: [spec.md](spec.md) | **Phase**: 1 — Validation Guide | **Date**: 2026-10-07

## Prerequisites

- Dev environment up: `npm run dev` with the app's `DATABASE_URL` configured (the daily puzzle is generated on first request).
- A clean browser profile (no stored `animatch:v1:progress` for today).
- Terminal in repo root for the automated checks.

## Automated checks

```bash
npm test
```

Expected: all tests pass, including the new coverage:

- **Loss derivation** (`tests/more-less-loss.test.ts`): `moreOrLessLossView` returns the failed-round person (id/name) for round N and the person it was compared against (`visibleId`/`visibleName`), both answer directions, correct uses of `ordered[round + 1]` and `ordered[round]`, and `null` tile fallbacks when the recorded round is out of range.
- **Storage** (`tests/local-progress.test.ts`): a `loss` record written on a lost game round-trips through reload; a previous day's record is discarded; a malformed `loss` is dropped while the game keeps its `lost` status; cleared storage degrades to a playable empty state.
- **i18n** (`tests/i18n.test.ts`): the `more_or_less.reveal` label exists in both locales with a `{count}` placeholder, keeps the shared `answer.*` labels, and the Spanish `more_or_less.reveal` no longer contains the `"Tinha"` typo.

## Manual validation

### 1. Loss is explained the moment it happens (US1)

1. Open **More or Less** and answer a round **wrong** (answer the opposite of evident). Tap the "wrong" More/Fewer button.
2. On the loss screen, confirm, with no extra clicks:
   - round indicator "Round N of 10",
   - the failed person's **tile** framed with a **red background** — the voice actor whose count ended the game,
   - that person's **true count in red** (the app's error red), alongside the count it was compared against, so the comparison proves the correct answer,
   - the inline result summary (attempts + share controls). The former "You lost" card heading was
     removed in feature 006's second design-feedback revision — see
     [specs/006-responsive-viewport-fit/checklists/requirements.md](../006-responsive-viewport-fit/checklists/requirements.md).
3. Repeat at the **first round** and at the **final round**; both render the same complete explanation.

### 2. Explanation survives a reload / revisit (US2)

1. After losing, **reload** the page and, separately, navigate Home → back into the game.
2. Confirm the same explanation (same counts, red-framed tile, red count) is shown from the stored day result — not a fresh playable board.
3. Let the UTC day roll over (or clear storage), reload: the game is a fresh **playable** puzzle; the old explanation is gone and there is no error or blank screen.

### 3. Unambiguous and accessible (US3)

1. Disable colors / use browser high-contrast: the count is still identifiable by its **label** and text, independent of the red.
2. With a screen reader active, land on the loss screen: heading, round, the failed person's name, the reveal sentence (true count), the compared person's name and count are announced in order.
3. Spanish locale: the whole explanation (including the fixed "Tenía {count} roles" reveal) renders in Spanish with no leftover English.

### 4. Errors are never a loss (FR-010)

1. Temporarily stop the API (or disrupt the network) and submit an answer: the board shows the **error state with retry**, the round is still playable, and no loss explanation/`lost` status appears.
2. `Use the existing ErrorPanel`: it names the failure and offers retry.

### 5. Other games and the win path are untouched

1. Play **Groups** and **Match the Series**: their results look exactly as before.
2. Win **More or Less** (or set the stored result to `won`): the result view shows the win summary and share; no loss panel, no red count.

## Expected outcomes map

| Check | Evidence | Original defect it closes |
|-------|----------|---------------------------|
| §1 | red-framed tile + red count + compared count on the loss screen | explanation unmounted with the board; correct answer never shown as text |
| §2 | explanation after reload same day | explanation lost on navigation |
| §3.2 | bilingual complete copy | Spanish reveal typo "Tinha" |
| §4 | retry error, no `lost` | error mistaken for a loss |
| §5.2 | win unaffected | — (regression guard) |

## Out of scope (validated as unchanged)

- Share snippet text for losses (no answer/explanation added to `share.template`).
- Server: attempt response, puzzle payload, generators, migrations — none modified.