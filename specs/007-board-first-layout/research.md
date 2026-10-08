# Phase 0 Research: Board-First Game Page Layout

All unknowns from the plan's Technical Context are resolved here. The feature is presentation-only on
an already-known stack (Nuxt 3 + Vue 3 + one global stylesheet), so no external technology research is
needed; the decisions below are the ones the implementation depends on.

## R-001 — One shared layout, without lifting game state

**Decision**: Add one component, `app/components/GameShell.vue`, that owns the page frame and the
header (title + Home/Reset on one aligned row) and renders the game body through its default slot.
The body's internal regions use a small shared CSS vocabulary — `.game-board`, `.game-actions`,
`.game-meta` — so all three games order the same content the same way. The primary buttons and the
status bar remain inside each board component.

**Rationale**: The buttons and status read board-local reactive state (Groups: `selection`,
`mistakes`; More or Less: `round`; Match: `wrongClicks`/`attempts` come from the page). Moving them
into the shell means lifting that state or threading it through slots, which changes component
ownership and risks the "do not change game rules / selection / scoring" constraint. A shared shell
plus shared region classes delivers the required single hierarchy with a layout-only diff.

**Alternatives considered**:
- *Full slot contract* (`board`/`actions`/`status`/`help` slots on the shell, pages compose everything):
  rejected — forces selection/round state up into the pages, a behavior-adjacent refactor.
- *Per-game one-off reorders*: rejected — the directive explicitly prefers a shared change and the
  three screens must not drift again.

## R-002 — DOM order and where the copy moves

**Decision**: Each board component renders its body in the fixed order **board → actions → meta**,
using the shared region classes. `footer.game-meta` groups the status bar and the instructional copy
in the order: status badge, page help line, board instruction line.

- Groups: grid → `Clear selection` / `Propose group` → `Mistakes: n/m` + `game.groups.help` +
  `groups.select_four`.
- More or Less: comparison → `More` / `Fewer` → `Round n of m` + `game.more_or_less.help` +
  `more_or_less.question`.
- Match the Series: clue + `Next` + 3x3 grid → `Mistakes: n/m · Attempts: n` + `game.match_the_series.help`.

The page-level help line currently sits in each page header (`app/pages/game/*.vue`); it moves into the
board's `game-meta` block and is removed from the header. All strings keep their existing message keys
and exact wording (spec FR-008), so both locales stay complete.

**Rationale**: The acceptance criteria name exactly these strings and this destination. Keeping the
status and instructions together in one `.game-meta` region makes the order testable and identical
across games. Transient feedback ("Group found", "That is not the series", "Correct!") is not status
bar or instruction copy; it stays adjacent to the board so it remains perceivable (spec edge case).

**Alternatives considered**: moving transient feedback into `.game-meta` too — rejected: it would push
immediate feedback below the fold, contradicting the edge-case that feedback must stay perceivable.

## R-003 — Unlock vertical scroll, keep horizontal hidden

**Decision**: Stop locking the document's vertical axis. `html`/`body`/`.app` allow vertical overflow
(no longer `height: 100%; overflow: hidden`), while horizontal overflow stays suppressed. The game
pages use the new `.game-shell` (not the locked `.page`), which is `min-height: 100dvh` and lays out as
a column: fixed header, a growing `.game-play` (board + actions), then `.game-meta` after it. Because
`.game-play` grows to fill the viewport, `.game-meta` falls below the fold and is reached by scrolling.

**Rationale**: Spec FR-007 makes a vertical page scroll acceptable; feature 006's locked shell
(html/body `overflow: hidden`) is what currently forces the board to share the viewport with the copy.
The home and error pages keep their current styling; with the global lock relaxed they simply stop
clipping if their content ever exceeds the viewport (no behavior change when it fits).

**Alternatives considered**: per-page scroll locking via JavaScript — rejected: complexity for no
value, and the directive allows the scroll.

## R-004 — Consistent header alignment

**Decision**: `GameShell`'s header is a single flex row (`display: flex; align-items: center;
justify-content: space-between; flex-wrap: wrap`) holding the title and the Home/Reset controls. The
same rule applies to all three games, so More or Less and Match match Groups. The title keeps its
existing `h1` sizing; when a very narrow width cannot fit both, the row wraps consistently for every
game (spec US3 scenario 4).

**Rationale**: The inconsistency is that Groups' header aligns the controls with the title while the
other two currently wrap the controls to a separate row. One shared header rule removes the drift.

**Alternatives considered**: fixing the two pages individually — rejected (per-game one-offs).

## R-005 — Give the freed height to the board

**Decision**: The board and its actions form a `.game-play` box whose height is one viewport minus a
small header/chrome allowance (`height: calc(100dvh - 4.5rem)`); the grid inside is `flex: 1 1 auto;
min-height: 0`, so it compresses into that box using feature 006's existing `minmax(0, 1fr)` rows and
aspect-ratio art. The status/how-to-play copy is a **sibling** `.game-meta` *after* `.game-play`, so it
does not compete for that height and falls below the fold. The board stays horizontally centered via
the shell's `max-width` + `margin: 0 auto`.

**Rationale**: This satisfies spec FR-005 / the refined SC-002: the height the copy used to reserve
above the board is now on the board's side of the fold, so the grid grows (measured at 1024x768:
Groups 524→641px, Match 473→696px, More-or-Less 453→641px, all taller than the displaced copy block).
The board must be height-capped: without a cap the shell's `min-height: 100dvh` grows with the board's
intrinsic height (aspect-ratio tiles are ~1000px at 736px width), nothing shrinks, and the action row
leaves the fold. The `4.5rem` allowance covers the header + shell padding + gap.

**Alternatives considered**:
- *Pure `minmax(0, 1fr)` with no cap* — rejected: the shell grows with content, so nothing shrinks and
  the actions fall below the fold.
- *Fixed larger tile sizes* — rejected: breaks fluid resize (feature 006) and introduces magic numbers.

**Note (analysis I2)**: an earlier draft of this decision claimed "no new sizing constants"; the
shipped design needs exactly one documented chrome allowance. It is a single layout constant for the
header region, not per-tile sizing, so it does not reintroduce fixed tile heights.

## R-006 — Verification: rewrite the feature-006 viewport gate

**Decision**: Update `e2e/viewport-fit.spec.ts` in place (no new tests; keep the 6-test count under the
15 cap). Replace the "no document scroll" predicate with the board-first contract:

1. **Horizontal no-scroll** everywhere (`scrollWidth === clientWidth`); vertical scroll is permitted
   on game screens.
2. **Board-first order**: the board region's bounding box sits above the `.game-meta` region's, and no
   status/instruction element precedes the board in the DOM.
3. **Header alignment**: the title's and the Home/Reset controls' vertical centers align (within a
   small tolerance) at the supported widths.
4. **Board above the fold**: the board's top is inside the viewport and its primary action buttons are
   reachable without scrolling.
5. **Board growth (refined SC-002)**: the board's rendered height at a fixed viewport is strictly
   greater than the height of the moved status/help block (a rendered-geometry proxy), it is
   horizontally centered within 2px of the page center, and it is not clipped.
6. **Error visibility (refined FR-009)**: in the attempt-error state the `ErrorPanel`'s top is inside
   the viewport (above the fold) and it is not inside `.game-meta`.
7. **Both locales** and the resize sweep keep passing on the new predicates.

`npm test` (Vitest) is unchanged and must stay green.

**Rationale**: Feature 006's gate asserted the opposite of what this feature requires
(`scrollHeight === clientHeight`), so it must change with the requirement rather than be deleted.
Assertions stay on rendered geometry and DOM order (Constitution VI — no stylesheet-text or
markup-snapshot assertions).

**Alternatives considered**: deleting the vertical assertions entirely — rejected: it would drop the
horizontal-overflow and finishing-state coverage the project relies on.

## R-007 — Errors and finished states stay reachable

**Decision**: Keep every `ErrorPanel` **above the fold and out of `.game-meta`**, so a failure and its
retry are visible without scrolling (refined FR-009). Placement differs by screen: Groups and More or
Less render it at the top of `.game-board`; Match the Series owns its attempt error on the page and
renders it immediately before the board body (still above the board and out of `.game-meta`). Keep the
result summary / loss explanation below the board (they may fall below the fold and be reached by
scrolling). No change to the error or result components' logic.

**Note (analysis I1)**: the contract and tasks originally implied the Match `ErrorPanel` lives inside
`.game-board`; in fact `MatchGrid` does not own `attemptError` — the page does, and it renders the
panel above the board. The rule that matters is "above the fold, not in `.game-meta`", which this
placement satisfies; see the updated failure rule in `contracts/game-shell.md`.

**Rationale**: Constitution V requires every failure path to render something readable and actionable;
spec FR-009 forbids burying the error. Finished-state content is explanatory and may sit below the fold
by the directive.

**Alternatives considered**: moving the error panel below the board for symmetry — rejected: it would
risk pushing a failure below the fold.

## R-008 — Relationship to feature 006

**Decision**: This feature deliberately supersedes feature 006's no-vertical-scroll rule for the three
game screens only. Horizontal no-scroll, the 60px resize sweep, both-locale coverage and the
401/768px-supported-size matrix from feature 006 all remain in force.

**Rationale**: The new directive ("a vertical scroll is acceptable") is a direct, intentional reversal
of one feature-006 acceptance criterion for these screens; recording it prevents the two specs from
being read as contradictory. Feature 006's quickstart/checklist already document a revision process.

**Alternatives considered**: keeping no-vertical-scroll and shrinking the board — rejected: it
contradicts the directive and would defeat US2/FR-005.
