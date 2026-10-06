# Bug Verification: Match the Series mistake cap not enforced after a correct answer

- **Slug**: mts-mistake-count
- **Tested**: 2026-10-06
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: partial
- **Disposition**: closed by user decision — automated reproduction and regression suites pass; the unwritten browser re-run is not blocking (see Recommendation)

## Summary

The original symptom is gone at the exact code path the page now invokes: the automated
reproduction (2 misses → correct answer → third miss ends the game) passes against
`applyMatchAnswer`, and the server route tests prove the carried evidence the client now feeds
reaches `lost` at 3 total misses and `won` at 9 greens. The only unexercised check is the
assessment's literal 5-step browser reproduction — no browser is available in this environment —
so the result is `partial` rather than fully `verified`.

## Checks Performed

| Check | Command / Action | Result | Notes |
|-------|------------------|--------|-------|
| Reproduction (post-fix, automated) | `npx vitest run tests/match-state.test.ts` | pass | 5/5. Test 1 is the exact reported sequence and asserts the third miss after an interleaved hit produces `lost`; test 2 pins the collateral "green evidence survives a miss" symptom |
| Reproduction (manual, browser steps 1–5) | assessment Reproduction §steps 1–5 | not-run | No browser available in this environment; cannot open a fresh board and click cards |
| Server evidence contract | `npx vitest run tests/routes/attempt.post.test.ts` | pass | 4/4 (DB-backed). Match the Series cases prove carried `missLog` reaches `lost` on the third miss and carried `greenPairs` reaches `won` only at 9 distinct greens |
| Regression suite | `npm test` | pass | 11 files, 31 tests passed |
| Build / type-check | `npx nuxt build` | pass | Client, server, and Nitro builds green |

## Output Excerpts

- `tests/match-state.test.ts` → `1 passed (1) · 5 tests · 5 passed`
- `tests/routes/attempt.post.test.ts` → `4 passed` (includes `keeps non-ending match misses silent and discloses the pairing only on the third` and `wins only when all nine grid series are green`)
- `npm test` → `Test Files 11 passed (11) · Tests 31 passed (31)`
- `npx nuxt build` → `✨ Build complete!`

## Residual Risks

- The literal UI reproduction (opening a fresh board, clicking wrong/correct/wrong in a browser,
  watching the badge and the win path) was not exercised; confirmation would need a human or a
  browser-enabled test harness (Playwright/e2e) that this environment does not have.
- The regression test drives the extracted reducer that the page now uses exclusively; it does
  not mount the `.vue` page itself, so the remaining gap is page plumbing only (thin: one
  `applyMatchAnswer` call mirroring the store fields, asserted only by reading the page source).

## Recommendation

Close the bug. The reported "mistakes 5/3 … cap not enforced" path is verified at the exact code
path the page calls, the collateral unwinnable-after-a-miss path is verified, and no regressions
were found. If a browser run is desired before closing, re-run assessment Reproduction steps 1–5
(or a board where a miss precedes the winning hits) to confirm end-to-end rendering; failure
there would warrant re-running `__SPECKIT_COMMAND_BUG_ASSESS__` with that evidence.