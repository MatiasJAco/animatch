# Implementation Plan: Responsive Viewport Fit (No Page Scroll)

**Branch**: `006-responsive-viewport-fit` (checked out branch: `feat/ui-responsive-adjustment`) |
**Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-responsive-viewport-fit/spec.md`, refined by the
plan directive — "Keep the current stack. Viewport-locked shell: html/body and the app root at
height 100dvh, overflow hidden; only intentional inner regions may scroll (default: none); fluid
flex/grid layout in relative units between 1024px and 1920px; no fixed pixel heights that force
document overflow; verify in the browser at 1920x1080, 1440x900, 1280x800, 1024x768 that
`document.scrollingElement.scrollHeight === clientHeight` and `scrollWidth === clientWidth`."

## Summary

The app gets a viewport-locked shell: `html`, `body`, and the `div.app` root are `height: 100dvh`
with `overflow: hidden` (a `100vh` fallback first for engines without `dvh`), so the document can
never scroll in either axis — the success criteria's "zero page scrollbars" becomes structural
rather than incidental. Every page root (`main.page`, `main.home`, `error.vue`) becomes a flex
column child of that shell with `min-height: 0`, and all sizing moves to relative units: gaps and
padding compress with `clamp()` across 1024–1920px, tile art stops being purely width-driven and
is bounded by the height that is actually left (cover-cropping via the existing `object-fit: cover`
rather than clipping content), grids take `minmax(0, 1fr)` rows inside a definite height, and the
two structural spacing bugs (stack gaps double-counting element margins) are collapsed.

The hard constraint is vertical, not horizontal: at 1024x768 the width-driven 3/4 tile art makes
Match's 3x3 grid ~1,000px tall and Groups' 4x4 grid ~1,016px tall, and worst-case states (Match
loss session with the 18-entry reveal list, Groups loss with four revealed rows) run 1,100–2,760px
against a 768px budget (research R-008). The plan therefore works in three ordered stages:
compress first (research R-002), measure with the browser gate the directive mandates (R-004), and
only if a state still overflows, grant a narrowly scoped inner-scroll exception to a *secondary*
region from an approved list — never the header, board, or primary controls (R-003). Nothing is
clipped: the verification contract checks both the scroll predicates and that every primary region's
bounding box lies inside the viewport.

**Technical approach** (details in [research.md](./research.md)): locked shell via `100dvh` +
`overflow: hidden` on `html`/`body`/`.app` (R-001); height-aware compression with relative units
and no fixed px heights (R-002); inner scroll default none with a measurement-gated exception rule
(R-003); verification by a Playwright viewport suite asserting the directive's predicates plus
bounding-box visibility (R-004); change confined to the single global stylesheet, `app.vue`, and
page roots (R-005); `@playwright/test` named here for owner approval with a manual fallback (R-006);
~6 viewport tests within the 15-test cap (R-007); no data, API, copy, or gameplay change (R-009).

## Technical Context

**Language/Version**: TypeScript on Node 22.18+ (Nuxt 3 runtime); Vue 3 SFCs; one global CSS file.

**Primary Dependencies**: unchanged (`nuxt` ^3, `pg`, `vitest` dev). **One new dev-only dependency,
owner-approved in writing 2026-10-08: `@playwright/test`** — viewport checks only, per Principle
VI's named-approval procedure (research R-006). No other dependency may be added by this feature.
The verification suite is limited to the four target viewports, the 60px resize sweep, both
locales, and the bounding-box anti-clip assertions (contract §3).

**Storage**: N/A — no data, payload, or persisted-state change (data-model.md).

**Testing**: existing `vitest` suite stays green; new browser viewport suite (`~6` tests, cap 15)
asserting rendered DOM metrics only — never stylesheet text or markup snapshots (Principle VI).

**Target Platform**: evergreen desktop/tablet browsers at ≥1024x768 and ≥768px width; `100dvh`
requires Chrome/Edge 108+, Firefox 101+, Safari 15.4+ — a `100vh` declaration precedes it as
fallback (R-001). Server: Linux, Node 22.

**Project Type**: web application (SSR frontend + API in one Nuxt process); layout-only change.

**Performance Goals**: no page scrollbar at any sampled width between 1024 and 1920 during live
resize; no layout jank from fixed-pixel overflow; rendering cost unchanged (same DOM, CSS only).

**Constraints**: zero document scroll at the four target viewports (FR-001, SC-001); zero
horizontal overflow at any width ≥768px (FR-002); primary controls and regions never reachable
only by document scrolling (FR-003); compress/reflow instead of overflowing (FR-004); error and
loading states obey the same rules (FR-008); no gameplay/copy change (FR-007); no fixed px heights
that force document overflow (directive); inner scroll only where the spec allows and measurement
proves compression insufficient (directive + spec Assumptions); ≤15 feature tests, no stylesheet
source assertions (Principle VI).

**Scale/Scope**: 4 screens + `error.vue`, one stylesheet (~508 lines), ~14 region roots that must
inherit the shell; no server, API, i18n, or storage change; ~6 new tests.

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1 design. Against constitution v3.0.0.*

| Principle / rule | How the plan satisfies it |
|---|---|
| I. Read-Only Catalog Ownership | Layout-only change: no SQL, no migrations, no catalog or import-table access of any kind |
| II. API/UI Separation | No data access added; the shell is pure presentation; no credentials or drivers in the browser |
| III. One Deterministic Puzzle per UTC Day | Untouched — no time, day-key, generation, or payload code is modified |
| IV. Stateless v1 | No accounts/sessions; `useLocalProgress` storage shapes unchanged; cleared storage still degrades to a playable, fitting page |
| V. Fail Visible, Never Blank | FR-008 is a gate on this feature: ErrorPanel, loading states, and `error.vue` must fit inside the locked shell un-clipped with their retry action visible; `overflow: hidden` must never be the reason a failure message is invisible — verification includes error states (quickstart) |
| VI. Lean Tests, Approved Dependencies Only | `~6` new viewport tests ≤ the 15 cap; assertions target rendered scroll/geometry metrics only, never stylesheet or markup text; the single new package `@playwright/test` is named in this plan and installs only after owner approval in writing (R-006); no essay comments |
| Bilingual UI | No new or changed strings; layout is verified in both locales because Spanish strings are longer and must wrap without overflow (spec FR-006, SC-005) |
| Naming and Originality | No new URLs, names, or copy; no `Wordle` token; presentation structure stays the project's own |
| Delivery Model | Playwright is dev-only verification tooling, never shipped; the player still needs nothing but a browser; `100dvh`+fallback keeps the app standards-based with no proprietary runtime |
| Review discipline | Spec, plan, contract, and tasks reference the same viewport matrix and the same inner-scroll policy, so no review meets a contract the implementation does not enforce |

**Complexity Tracking**: no constitutional violations. The one dependency (`@playwright/test`,
dev-only) was named in this plan and **approved by the owner in writing on 2026-10-08**, satisfying
Principle VI's procedure; the manual fallback in R-006 no longer applies. The approval is scoped:
viewport checks only — four viewports, 60px resize sweep, both locales, bounding-box anti-clip
assertions — and no other dependency is permitted.

**Phase 1 re-check (post-design)**: passed. The design adds no data/API/i18n surface (data-model
§1–§4), confines the change to one stylesheet + dev-only verification files (plan structure), keeps
failure states in the P1 pinned tier (data-model §1, Constitution V), and holds the test budget at
~6 of 15 with rendered-metric assertions only (research R-007). The inner-scroll exceptions
(research R-003) are spec-sanctioned secondary regions, not a principle exception — no amendment
required.

## Project Structure

### Documentation (this feature)

```text
specs/006-responsive-viewport-fit/
├── plan.md                 # This file
├── spec.md                 # Feature specification
├── research.md             # Phase 0: decisions R-001…R-009 + worst-case vertical budget
├── data-model.md           # Phase 1: no data change; rendered-state matrix + region priority tiers
├── quickstart.md           # Phase 1: setup, automated + manual verification, SC mapping
├── checklists/
│   └── requirements.md     # Spec quality checklist (all items pass)
└── contracts/
    └── viewport-fit.md     # Shell contract, inner-scroll policy, verification predicates
```

### Source Code (repository root)

Delta against the current tree — new files marked `+`, changed files `~`. All style lives in one
global sheet (no `<style>` blocks exist in any `.vue`), which bounds the blast radius:

```text
~ app/assets/css/main.css          # shell rules (html/body/.app 100dvh + overflow hidden);
#                                  #   .page/.home become flex columns with min-height:0;
#                                  #   clamp() spacing, height-bounded tile art, minmax(0,1fr)
#                                  #   grid rows, 2-column reveal list, compressed group rows;
#                                  #   remove the body overflow-x:clip band-aid (R-001)
~ app/app.vue                      # no template change; `.app` gains its shell rules in CSS
#                                  #   (currently a class with no rule anywhere)
~ app/error.vue                    # inherits the locked .page shell (verify, likely no edit)
~ app/pages/index.vue              # root already `main.home` — inherits shell; edit only if a
~ app/pages/game/match-the-series.vue   root class/wrapper must change (expected: no)
~ app/pages/game/groups.vue
~ app/pages/game/more-or-less.vue  # body wrappers gain `.page-body` so the board fills height
~ app/components/MatchGrid.vue     # clue card + Next share one row; the redundant
#                                  #   "Current-season series" heading is dropped
~ app/components/MoreOrLessBoard.vue  # `.more-board` fills the height; answer buttons styled
~ app/components/GroupsBoard.vue   # no change: existing `.stack` / grid roots already fit
+ playwright.config.ts             # dev-only: testDir e2e/, chromium project only, 4 viewports (R-006)
+ e2e/viewport-fit.spec.ts         # 6 tests: scroll predicates per viewport, bounding-box
#                                  #   anti-clip, 60px resize sweep, finished states, both locales
~ package.json                     # + devDependency @playwright/test (pinned 1.59.0, see below),
#                                  #   + script "test:viewport"
```

**Dependency pin**: `@playwright/test` is pinned to **1.59.0**. Versions 1.61–1.64 ship an ESM
loader that returns a null `source` on Node 22.18+ (`ERR_INVALID_RETURN_PROPERTY_VALUE`) and
cannot start a run on this runtime; 1.59.0 is the newest release that boots. Scope and approval
are unchanged (viewport checks only, dev-only).

**Page-root verification (T007)**: `app/app.vue` (`div.app`), `app/error.vue` (`main.page`), and
the four page roots (`main.home`, three `main.page`) inherit the shell with **zero template
edits**; the shell lives entirely in `app/assets/css/main.css`.

**Design-feedback revision (2026-10-08)**: after the owner's review, `object-fit` is `contain`
(artwork is never cropped), the art keeps its 3:4 ratio and scales down instead of being squashed,
Match puts Next beside the clue and drops the "Current-season series" heading, and More-or-Less
fills its spare height. The template edits above are confined to Match/More-or-Less presentation;
no data, API, i18n-key, or gameplay change.

Not touched: `server/`, `migrations/`, `app/i18n/`, `app/composables/`, `nuxt.config.ts`
(viewport meta already correct), existing `tests/**` (no layout assertions exist to break).

**Structure Decision**: single web application, layout-only delta. The shell lives in the existing
global stylesheet plus the app root; verification adds one dev-only Playwright config and one spec
file outside the vitest include pattern (`tests/**/*.test.ts`) so the two runners never collide.
