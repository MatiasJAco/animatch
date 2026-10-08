# Implementation Plan: More or Less — Explain Every Loss

**Branch**: `004-more-less-loss-feedback` | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-more-less-loss-feedback/spec.md` plus user input: "In More or Less, when game over show the tile of the VA and the correct amount of roles in red so the user knows why he lost."

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

When a More or Less player answers a round incorrectly, the game must present a loss view that explains the loss on the same screen as the result: the round reached, the tile (image and name) of the voice actor whose hidden count ended the game framed with a red background, that true count emphasized in red, and the count it was compared against — the comparison itself is the explanation, so no separate "your answer"/"correct answer" sentence is shown. The explanation must survive a reload or return visit later the same UTC day, must be fully bilingual, and must never be confused with an error. The server already returns everything needed (`correct`, `given`, `counts`) on a miss; the person's identity is derived from the same day's stable puzzle payload, so no API or storage-independent server change is required. Implementation is client-only: a stored loss record in the existing day-result blob, one pure derivation helper, one explanation component rendered in the result view, the existing `--wrong` color token for the red emphasis, and the Spanish reveal-copy fix in the catalog.

## Technical Context

**Language/Version**: TypeScript (Nuxt 3 / Vue 3 project; `nuxt ^3.0.0`), Node server.

**Primary Dependencies**: Nuxt 3 (client + API), Vue 3, `pg` (server DB, untouched). **No new dependencies** — the plan reuses the existing `EntityImage`, `useLocalProgress`, `useLocale`, and the existing `--wrong` color token.

**Storage**: PostgreSQL (catalog + puzzle tables; **read-only for this feature, no schema change**). Client-side: existing single `localStorage` blob `animatch:v1:progress` (`{ v: 1, date, games }`) extended with an additive optional `loss` record on the `more_or_less` game state.

**Testing**: Vitest (`npm test` -> `vitest run`). Existing suite is unit/integration over pure logic (composables, i18n, server game modules) with no Vue component-mount harness; this feature follows suit by extracting a pure derivation helper. Feature test budget: cap of 15 tests; this plan adds ~4–6.

**Target Platform**: Standards-based web client (browser) + Node server API.

**Project Type**: Web application (full-stack Nuxt).

**Performance Goals**: The explanation appears together with the loss announcement — zero additional interactions; standard web expectations (no perceptible delay beyond the normal result transition).

**Constraints**:
- Bilingual (Spanish + English) user-facing strings in the message catalog from the first commit; no inlined copy (Constitution).
- No catalog writes/DDL; no new accounts, sessions, or server state; today's result stays client-held (Constitution I, IV).
- The failed round's data must not leak information for rounds beyond the failed one; the attempt pass 001's `MoreOrLessOutcome` unchanged, so disclosure limits hold.
- Tests must assert rendered behavior/data semantics, never stylesheet text, CSS class strings, or markup snapshots (Constitution VI).
- No new dependency may be introduced without owner approval (Constitution VI).

**Scale/Scope**: One game page, one new component, one pure util, one composable extension, one optional slot on `ResultPanel`, one i18n-key set × 2 locales, plus copy correction of an existing Spanish string. The win path and the other two games are unchanged.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I Read-Only Catalog | No writes, DDL, migrations, triggers, or constraints against catalog tables; no read/write of `import_state`/`import_runs`. | PASS — feature makes zero DB changes and only reads the day's puzzle via the existing API. |
| II API/UI Separation | Browser never touches Postgres; all data via server API; no credentials in UI. | PASS — client already obtains the puzzle via `/api/daily/more_or_less`; no new data path. |
| III One Deterministic Puzzle per UTC Day | UTC-only day key; same date -> same puzzle; no reshuffle/personalization; browser TZ never selects the puzzle. | PASS — the loss record is scoped by the existing UTC day blob; the failed-round person is derived from the day's deterministic puzzle payload. |
| IV Stateless v1 | No identity; today's result only, stored on the client under a game+day namespaced key; client not trusted for scoring; storage loss degrades to an empty-state game, never an error or blocked page. | PASS — loss record lives in the existing client blob; malformed/missing storage yields a playable empty state; a malformed loss record degrades to the plain result, never a blank screen. |
| V Fail Visible, Never Blank | Every failure renders a bilingual error state naming the failure with a retry; no blank board/spinner/silent failure; structured errors; server-side logging. | PASS — answer-submission failure already routes to the retry error path (unchanged); puzzle fetch failure uses the existing ErrorPanel; a recorded loss always renders at least the result text. |
| VI Lean Tests, Approved Dependencies Only | ≤15 tests for the feature; no new deps without named approval; tests assert observable behavior, never stylesheet/markup internals; no essay comments. | PASS — no new dependencies; ~4–6 new tests over pure logic and storage/i18n behavior; the red emphasis is verified manually in quickstart, not via CSS assertions. |

No violations; the Complexity Tracking table below is intentionally left empty.

## Project Structure

### Documentation (this feature)

```text
specs/004-more-less-loss-feedback/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output — decisions R-001..R-009
├── data-model.md        # Phase 1 output — loss record + derived view
├── quickstart.md        # Phase 1 output — manual validation guide
├── contracts/           # Phase 1 output — UI + storage contract
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
app/
├── components/
│   ├── MoreOrLessBoard.vue          # [EDIT] skip transient miss-reveal; miss → result view owns explanation
│   ├── MoreOrLessLossExplanation.vue# [NEW] loss explanation panel (tile + red count + answers + round)
│   ├── ResultPanel.vue              # [EDIT] accept optional slot rendered inside the card
│   └── EntityImage.vue              # reused unchanged (kind="person")
├── composables/
│   └── useLocalProgress.ts          # [EDIT] add optional `loss` field + markFinished extra-params
├── pages/
│   └── game/more-or-less.vue        # [EDIT] persist loss record; render explanation slot on lost
├── utils/
│   └── moreOrLessLoss.ts            # [NEW] pure helper: loss record + puzzle -> loss view
└── i18n/
    ├── en.ts                        # [EDIT] new more_or_less.* keys
    └── es.ts                        # [EDIT] new keys + fix "Tinha" -> "Tenía"

app/assets/css/main.css              # [EDIT] reuse existing --wrong token for the count emphasis (no new tokens)
server/                              # NOT CHANGED — attempt outcome already returns correct/given/counts

tests/
├── more-less-loss.test.ts           # [NEW] derivation helper unit tests
├── local-progress.test.ts           # [EDIT] loss-record persistence / malformed-loss degradation tests
└── i18n.test.ts                     # [EDIT] new keys in both locales + typo fixed
```

**Structure Decision**: single Nuxt project; the change is confined to the `app/` client layer and tests, matching the existing file layout (`app/components`, `app/composables`, `app/utils`, `app/i18n`, `tests/`). No backend structure changes.

## Complexity Tracking

> Only filled if Constitution Check has violations that must be justified — none present, table omitted.

## Implementation Notes (handoff for Phase 2 tasks) *(reference only, not part of template)*

- Existing server contract stays: `MoreOrLessOutcome` already returns `result`, `round`, `correct`, `given`, `counts {hidden, visible}`, `state` on both hit and miss (see `server/game/moreOrLess.ts` and `specs/001-daily-anime-puzzles/contracts/openapi.yaml`). No server file, generator, route, or migration changes.
- Person derivation on the client mirrors the server rule: `ordered = [payload.initialVisible, ...payload.chain]`, hidden person for the failed round = `ordered[failedRoundIndex + 1]` (`server/game/moreOrLess.ts:67-68`).
- The board's current inline reveal block (`app/components/MoreOrLessBoard.vue:107-118`) is superseded for the miss case by the result view, satisfying FR-006 (explanation with no further interaction).
- Red emphasis uses the existing `--wrong` theme token (`app/assets/css/main.css:15`), consistent with the rest of the app and dark-mode safe; the count retains its text label so meaning never depends on color alone (FR-012).