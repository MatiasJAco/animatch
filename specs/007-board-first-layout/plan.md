# Implementation Plan: Board-First Game Page Layout

**Branch**: `007-board-first-layout` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-board-first-layout/spec.md`

## Summary

Give the three game screens (Groups, More or Less, Match the Series) one shared visual hierarchy in
which the board is the first thing under the header and all status/instructional copy moves below the
primary controls. The approach is presentation-only: one shared layout component (`GameShell.vue`)
supplies the header and page frame, a small set of shared CSS region classes
(`.game-board` / `.game-actions` / `.game-meta`) fixes the DOM order `header → board → actions →
status/help`, and the global stylesheet stops locking the document's vertical axis so the freed
height goes to the board and the secondary copy is reachable by a normal page scroll (horizontal
overflow stays forbidden). The board is height-capped to one viewport minus the header chrome
(`calc(100dvh - 4.5rem)`, research R-005) so its action row stays above the fold — the only new layout
constant. Game logic, selection, scoring, storage and reset behavior are untouched; the existing
Playwright viewport gate is rewritten to assert the new contract (horizontal no-scroll, board-first
order, aligned headers, board above the fold, board growth, error panel above the fold) instead of "no
document scroll at all".

## Technical Context

**Language/Version**: TypeScript 5.x, Vue 3.5 single-file components, Nuxt 3.21 (SSR + client hydration)

**Primary Dependencies**: Nuxt 3 + Vue 3 (no UI/CSS framework); `pg` on the server only. No dependency
is added by this feature (Constitution VI).

**Storage**: N/A — no persistence change. Client progress in `localStorage`
(`animatch:v1:progress`) is untouched.

**Testing**: Vitest 5 (`tests/`, unit/integration) and Playwright 1.59 (`e2e/viewport-fit.spec.ts`,
owner-approved dev-only, feature 006). No stylesheet-text or markup-snapshot assertions
(Constitution VI); the viewport gate asserts rendered geometry and DOM order.

**Target Platform**: modern desktop/laptop browsers at widths ≥768px (feature 006 supported floor).

**Project Type**: web application (Nuxt app directory + Nitro server routes).

**Performance Goals**: none beyond layout; no new runtime work, requests, or assets.

**Constraints**: presentation-only; no change to game rules, selection, scoring, stored state or reset;
vertical page scroll allowed, horizontal overflow forbidden; the board must remain above the fold and
centered.

**Scale/Scope**: 3 game pages, 3 board components, 1 new layout component, 1 global stylesheet,
1 e2e spec update, 0 server/migration/i18n changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
|-----------|------|--------|
| I. Read-Only Catalog Ownership | No catalog reads/writes or DDL change; no `daily_puzzles` change | PASS — no server or DB contact touched |
| II. API/UI Separation | No DB driver/credential/query reachable from the browser | PASS — client-only template/CSS change |
| III. One Deterministic Puzzle per UTC Day | No time, day-key, or generation change | PASS — untouched |
| IV. Stateless v1 | No identity, session, or new server storage | PASS — untouched |
| V. Fail Visible, Never Blank | Error/loading states stay visible and actionable (spec FR-009) | PASS — error panel and retry stay in the flow and must be reachable; verified by the gate |
| VI. Lean Tests, Approved Dependencies | Tests ≤15; no new dependency; no stylesheet-text/markup assertions; lean comments | PASS — 6 existing viewport tests are rewritten, none added; no dependency; assertions use geometry/order |

**No violations.** Complexity Tracking is intentionally empty.

Post-Design re-check (after Phase 1): unchanged — the design adds one component and CSS only. PASS.

## Project Structure

### Documentation (this feature)

```text
specs/007-board-first-layout/
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0 output (/speckit.plan)
├── data-model.md        # Phase 1 output (/speckit.plan)
├── quickstart.md        # Phase 1 output (/speckit.plan)
├── contracts/
│   └── game-shell.md    # Phase 1 output — the DOM/layout contract the gate checks
└── checklists/
    └── requirements.md  # Spec quality checklist (/speckit.specify)
```

`tasks.md` is produced later by `/speckit.tasks` (not by this command).

### Source Code (repository root)

```text
app/
├── components/
│   ├── GameShell.vue            # NEW — shared frame: aligned header + ordered body regions
│   ├── GameHeaderControls.vue   # unchanged; placed in the shell's header
│   ├── GroupsBoard.vue          # EDIT — reorder to board → actions (Clear/Propose) → meta
│   ├── MoreOrLessBoard.vue      # EDIT — reorder to board (comparison) → actions (More/Fewer) → meta
│   ├── MatchGrid.vue            # EDIT — reorder to board (clue + grid) → meta
│   ├── ResultPanel.vue          # unchanged (rendered below the board by the pages)
│   └── MoreOrLessLossExplanation.vue  # unchanged
├── pages/game/
│   ├── groups.vue               # EDIT — use GameShell; drop the header help line
│   ├── more-or-less.vue         # EDIT — use GameShell; drop the header help line
│   └── match-the-series.vue     # EDIT — use GameShell; drop the header help line
└── assets/css/main.css          # EDIT — .game-shell/.game-header/.game-play/.game-meta; unlock
                                 #        vertical scroll; keep horizontal hidden

e2e/
└── viewport-fit.spec.ts         # EDIT — new predicates: horizontal no-scroll, board-first order,
                                 #        header alignment, board above the fold, board growth

tests/                           # unchanged (buildBoardRows, progress, i18n, etc. still pass)
```

**Structure Decision**: single Nuxt project. The change is confined to `app/components`,
`app/pages/game`, the one global stylesheet, and the existing e2e spec. No server, migration, i18n, or
composable file is touched.

### Shared-shell design (what "one hierarchy" means)

`GameShell.vue` owns the page frame and the header, and enforces the header rule once:

```text
GameShell (main.game-shell)
├── header.game-header      → h1 title + <slot name="header-actions"> (GameHeaderControls)
└── <slot />                → the board component's two roots:
    ├── div.game-play         height = 100dvh − header chrome (R-005)
    │   ├── section.game-board    grid / comparison / clue+grid
    │   └── div.game-actions      primary buttons (owned by the board component — see R-001)
    └── footer.game-meta      status bar + how-to-play copy (sibling of .game-play; below the fold)
```

The primary buttons and the status bar stay inside each board component because they read and mutate
board-local state (selection, round, mistakes). Lifting them into the shell would move game state and
risk the "do not change game rules" constraint (Constitution: layout only). The shared shell fixes
the header; the shared `.game-*` region classes fix the order and spacing for all three boards.
See [research.md](./research.md) R-001/R-002 for the alternatives weighed.

## Complexity Tracking

No Constitution Check violations; no complexity to justify.
