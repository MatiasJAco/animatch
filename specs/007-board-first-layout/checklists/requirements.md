# Specification Quality Checklist: Board-First Game Page Layout

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-08
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Validation run 2026-10-08: all items pass on first iteration; no [NEEDS CLARIFICATION] markers were needed.
- **Deliberate relaxation of feature 006**: the directive states "a vertical scroll is acceptable", so this feature supersedes feature 006's no-vertical-scroll rule for the three game screens. Horizontal no-scroll is retained (FR-007). Recorded in Assumptions and called out for planning.
- Scope bounded to the three game play screens (Groups, More or Less, Match the Series) at supported widths ≥768px; the home screen and error page are out of scope (Assumptions).
- The feature is presentation-only: no copy, gameplay, scoring, stored data, API, or dependency change (FR-008).
- Cross-cutting gates to honour in the plan: bilingual completeness for every moved string (SC-005, Constitution Bilingual UI), error/loading states remain visible and actionable (FR-009, Constitution V), and test volume stays within the project cap (Constitution VI).

## Implementation verification (2026-10-08)

- **Shared shell**: new `app/components/GameShell.vue` (header + body) plus the
  `.game-shell` / `.game-header` / `.game-play` / `.game-board` / `.game-actions` / `.game-meta`
  vocabulary in `app/assets/css/main.css`; the three games render the same `board → actions → meta`
  order. `app/pages/game/*.vue` use `GameShell`; the header help line moved to `.game-meta`.
- **US1** — board-first order confirmed on all three screens: the board region precedes the action
  row and the `.game-meta` copy, with the status bar and how-to-play text below the actions.
- **US2** — board growth at 1024x768 (before → after): Groups 524→641px, Match 473→696px,
  More-or-Less 453→641px; the copy falls below the fold and `scrollWidth === clientWidth` (no
  horizontal overflow) in every state.
- **US3** — title and Home/Reset render on one row with vertical centers within ≤2px at all four
  supported widths (1920x1080, 1440x900, 1280x800, 1024x768) on all three games.
- **Gates**: `npm test` 48/48; `npm run test:viewport` 6/6 (horizontal no-scroll across screens and
  states, board-first + header alignment + growth, resize sweep, finished states, both locales).
  Spanish and English both render with no horizontal overflow.
- **Constitution review**: presentation-only — Principles I–IV untouched (no catalog, DB, API, UTC,
  or storage change); Principle V — the `ErrorPanel` and its retry stay above the fold and outside
  `.game-meta`, now asserted by the gate (refined FR-009, task T005); Principle VI — 6 viewport tests ≤15, no dependency added, assertions
  use rendered geometry and DOM order only (no stylesheet text or markup snapshots), comments lean.
  Bilingual UI: no key or wording changed; both locales exercised end to end.

## Spec refinement (2026-10-08, post-`/speckit.analyze`)

Applied the spec-level findings from the analysis (see `spec.md`):

- **SC-002** reworded to be measurable without a before/after baseline: the play area must render
  taller than the status/instruction block it displaced, stay horizontally centered within 2px, and
  not clip (closes analysis finding U1).
- **FR-009** strengthened to require the error panel and retry be **visible without scrolling** and
  kept out of the below-the-fold copy region, with a matching US1 acceptance scenario 5 (closes C1 at
  the spec level).
- **Assumptions** now define "centered" as horizontal centering and state the error-panel placement
  rule (closes A1).

All 16 checklist items still pass. Plan/tasks-level findings (I1 Match error-panel wording, I2 the
`calc(100dvh - 4.5rem)` chrome allowance in research R-005, I3 contract DOM wording) are out of scope
for this spec refinement — address them via `/speckit.plan` or a direct edit to `tasks.md` /
`contracts/game-shell.md`.
