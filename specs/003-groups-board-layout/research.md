# Research: Groups Board Rows-Driven Layout

- **Feature**: specs/003-groups-board-layout
- **Date**: 2026-10-06
- **Input**: `/speckit.plan` user directive — "Keep the current game engine and tile model. Add a
  board presentation state for found groups and the loss reveal. Do not change group-detection
  rules. Reuse existing tile components; layout and color are presentation only."

The plan was given an explicit guardrail, so the research questions resolve around *how* to add
presentation state without touching the engine. Every decision below records what was chosen and
why.

## R-001 — Presentation state vs. engine change

**Decision**: The board presentation is derived state, computed in the client from data the
server and the device already produce. No server code changes.

**Rationale**: The Groups engine (`server/game/groups.ts`) already returns a `criterion` and
`tileKeys` on a hit and the full `groups` mapping on the ending miss (FR-034/FR-035), and the
device already persists `foundGroups`. Detecting "which four tiles are the same group" is the
server's job and is unchanged (directive: "do not change group-detection rules"). The only new
thing this feature adds is the rows layout that paints over that existing state.

**Alternatives considered**: (a) asking the server to emit a pre-grouped row array or a new field
— rejected: would change the contract, regenerate stored payloads, and alter the detection
surface for zero behavioral gain; (b) deriving rows inside the component only — rejected: an
untested, non-pure function glued to `<template>` markup would violate the feature's own
governance and the constitution's no-markup-assertion rule.

## R-002 — Where the finished-view board fits

**Decision**: The Groups page keeps the board mounted when the game finishes and renders it in a
reveal presentation under the existing result banner. Found rows keep their green styling;
groups the player never found appear as red rows.

**Rationale**: Today `groups.vue` swaps the board for `ResultPanel` the moment a game ends, so the
board's existing "reveal" markup is never actually seen on the live page. The feature demand is
explicit that the loss layout is shown on the board ("rearrange every tile into its correct
groups"). Keeping the finished board visible under the existing `ResultPanel` is the minimal
presentation change that satisfies US2 without touching the result/share flow.

**Alternatives considered**: (a) putting the reveal in `ResultPanel` — rejected: a full-board
layout is not a "result card", and the directive says the board's presentation state changes;
(b) a one-way flow where the reveal replaces the result row — rejected: removes the share control
and the "finished" navigation, which belongs to feature 001's game flow.

## R-003 — A pure row model for testability

**Decision**: Extract a pure function in `app/utils/groupsBoard.ts` —
`buildBoardRows(tiles, found, revealed)` — that returns an ordered, complete list of group rows
plus the list of still-selectable tiles.

**Rationale**: The feature is presentation-only, so the testable unit is the *classification*
(which four keys belong together, which are found vs revealed, which order) — exactly the kind of
pure logic the codebase already unit-tests (cf. `app/utils/matchState.ts` from the
mts-mistake-count fix). Asserting the model keeps the suite within the constitution's cap with no
browser, no new devDependency, and no markup/snapshot assertions.

**Alternatives considered**: (a) mounting `GroupsBoard.vue` with a renderer — rejected (directive
and Principle VI: `@vue/test-utils` + jsdom are new packages that would need explicit by-name
approval, and the plan names none); (b) asserting computed class strings — rejected (constitution
VI forbids stylesheet/class/snapshot text assertions); (c) asserting `visibleTiles` from the
component — impossible without mounting.

## R-004 — Tile consumption, selection, and rendering reuse

**Decision**: Found-row tiles are excluded from the selection area exactly as today (the `consumed`
set built from `foundGroups`), and each tile inside a row reuses the existing tile rendering
(`EntityImage` + name label). No tile model, no entity-key derivation, and no component contract
changes.

**Rationale**: The directive requires reusing existing tile components and leaving the tile model
alone. The rows are a new *container* for the same tiles; interaction rules (found tiles are
inert, proposals always need exactly four unclaimed tiles) are engine/store behavior and stay as
they are.

## R-005 — Row ordering

**Decision**: Found rows appear in the order the player discovered them; on a loss the remaining
rows appear in the order the server discloses them, after the found rows. The in-play board shows
only found rows (ordered by discovery); the loss layout shows all four rows.

**Rationale**: The spec's Assumptions section sets exactly this default, and the server already
discloses the full list in a deterministic order. No sorting is imposed by the feature
description; ordering must be stable so a reload restores the identical layout (SC-004).

## R-006 — Color is never the only signal

**Decision**: Each row carries its bilingual characteristic label on the left (existing
`groups.criterion.*` message keys), so a found/green row and a revealed/red row are identifiable
by text even without color. Green marks "you found it", red marks "this was revealed at the end".

**Rationale**: FR-008 and SC-005 in the spec; the accessibility rule for the project — color is
decoration on top of a textual identity, and the row labels already exist in both locales (no new
translation surface beyond optionally a heading, see R-008).

## R-007 — Persistence and the transient reveal

**Decision**: Persistence is unchanged — `foundGroups` continues to be written by
`useLocalProgress` on every hit, so a reload mid-game restores the same green rows (spec US3).
The loss reveal is **transient**: it is presented while the finished board is on screen in the
session that ended; it is not added to storage.

**Rationale**: The spec's persistence story (US3) is explicitly about in-progress boards and
found rows, which existing storage already covers. The full-contract stores only today's result
and would need a new, day-keyed field to retain a reveal across reloads; the feature description
does not ask for that ("already-found groups should remain visible" refers to within the loss
view). Keeping the reveal transient is the smaller, spec-faithful scope. This is recorded as a
scope boundary in the plan and quickstart.

**Alternatives considered**: persisting the revealed rows — bigger storage change, no spec
requirement, rejected for scope discipline.

## R-008 — Copy and i18n

**Decision**: Reuse the existing `groups.game_over`, `groups.found`, and `groups.criterion.*`
keys. If the board adds group-row headings (e.g. a label distinguishing "your groups"/"the
groups"), new keys are added to `es` and `en` in the same change, enforced by the existing i18n
completeness test.

**Rationale**: Bilingual rule — every user-facing string exists in both locales from the first
commit that introduces it. Most copy already exists because the criterion label has been shown on
found tiles since feature 001.

## R-009 — Automated test shape (respecting the cap)

**Decision**: New unit tests in `tests/groups-board.test.ts` target the pure row model only:
- rows group the four keys of a found group together and classify them (found vs revealed);
- the loss layout contains exactly one row per group with every tile exactly once;
- found rows are ordered by discovery; revealed rows follow in disclosure order;
- found keys are excluded from the selectable list; the reveal adds no selectable tiles;
- the reload-restore input (stored `foundGroups`) reproduces the same rows.

Roughly 6–8 tests — comfortably inside the 15-test cap; no new dependencies; the on-screen,
color/row visual half is covered by quickstart manual checks because no approved renderer exists.

**Alternatives considered**: a DOM/component spec — requires an unapproved new devDependency
(R-003), rejected under Principle VI and the plan directive.

## R-010 — Reconciliation with feature 001

**Decision**: Feature 001's FR-034 currently says a correct proposal "MUST remove those tiles
from the board". This feature replaces that behavior: the tiles stay as a green row. The
reconciliation is **documentation-layer only**: `specs/001-daily-anime-puzzles/spec.md` FR-034 and
its quickstart row (T047) get a note that the tiles are rearranged into a permanent row rather
than removed; the server contract (hit still returns `criterion` + `tileKeys`) and the server
behavior are unchanged.

**Rationale**: No automated test asserts the visual departure of tiles (there is no mounted
component test), and the API/contract is byte-identical, so the change cannot regress a suite —
but leaving FR-034 to say "removed" would contradict the new observable behavior and trip the
constitution's "reviewers MUST refuse contradictions" gate at review time.

## R-011 — Scope boundaries

**Decision**: Out of scope for this feature: the More or Less and Match the Series games;
`useLocalProgress` storage schema; the server game engine and API; the notes/attempt-count
behavior; animations. In scope: `GroupsBoard.vue` row rendering, the pure row model, the Groups
page finished-view wiring, i18n (only if new keys are needed), reconciliation docs, and the new
tests.

## R-012 — No dependency or config changes

**Decision**: No package.json changes, no vitest config changes, no new tooling. The row model is
pure TypeScript; the rows are rendered with existing components and existing message keys
(optionally two new message keys in both locales).

**Rationale**: Directive ("presentation only") plus Principle VI. Configuration surface is frozen
for this feature.