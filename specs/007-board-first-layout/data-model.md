# Phase 1 Data Model: Board-First Game Page Layout

## Data entities

**None.** This feature is presentation-only. There is no change to:

- the SQL catalog or `daily_puzzles` (no server or migration file is touched);
- the API payloads or routes;
- the client progress record in `localStorage` (`animatch:v1:progress`) — status, attempts, mistakes,
  `foundGroups`, `missLog`, round, `greenSeries`, `greenPairs`, etc. keep their exact shape;
- any i18n key (every string keeps its key and wording in both locales).

## UI structural model (documentation, not persisted state)

The only "model" this feature defines is the layout hierarchy, which the contract
([contracts/game-shell.md](./contracts/game-shell.md)) turns into testable rules.

| Region | Element | Owns | Content (in order) |
|--------|---------|------|--------------------|
| Header | `header.game-header` (in `GameShell`) | title text prop | `h1` title, then header-actions slot (`GameHeaderControls`: Home, Reset) |
| Play box | `div.game-play` (board component root) | the board component | the viewport-filling box holding the board and the action row |
| Board | `section.game-board` (inside `.game-play`) | the board component | Groups: 4x4 grid + found/revealed rows · More or Less: comparison · Match: clue + 3x3 grid. Also hosts the `ErrorPanel` for Groups and More or Less. |
| Actions | `div.game-actions` (inside `.game-play`) | the board component | Groups: Clear selection / Propose group · More or Less: More / Fewer · Match: (no submit; `Next` sits with the clue). Absent on a finished board. |
| Meta | `footer.game-meta` (sibling of `.game-play`) | the board component | status badge, then page help line, then board instruction line; falls below the fold |

### State ownership (unchanged)

| State | Lives in | Consumed by |
|-------|----------|-------------|
| Groups `selection`, `found`, `missLog`, `mistakes`, `attempts` | `GroupsBoard.vue` | board, actions, status |
| Groups finished/status snapshot | `useLocalProgress` (page) | page, result summary |
| More or Less `round`, `given`, `lastOutcome` | `MoreOrLessBoard.vue` | board, actions, status |
| More or Less loss record | `useLocalProgress` (page) | loss explanation |
| Match `clueIndex`, `greenSeries`, `wrongClicks`, `attempts` | `useLocalProgress` (page) | board, status, result |
| Error codes for retry | each screen | `ErrorPanel` (stays in the board region) |

No state moves between components; the region classes only change where existing markup is rendered.

## Validation rules derived from requirements

- **Order** (FR-001..FR-004): in document order the board precedes `.game-actions`, which precedes
  `.game-meta`; no status/instruction element precedes the board.
- **Header** (FR-006): the title and the Home/Reset controls share one row at supported widths and
  their vertical centers align.
- **Scroll** (FR-007): horizontal overflow is zero at supported widths; vertical overflow is allowed
  and reaches every `.game-meta` string.
- **Size** (FR-005, refined SC-002): the board renders strictly taller than `.game-meta`, is
  horizontally centered within 2px of the page center, and is not clipped at the viewport edges.
- **Content** (FR-008): every string present before the change is still present (same key, same
  wording) in both locales.
- **Failure** (refined FR-009): the error panel and its retry render above the fold and outside
  `.game-meta`; Groups and More or Less place it in `.game-board`, Match the Series renders its
  page-owned error immediately before the board body.

## State transitions

None. No new state machine, lifecycle, or persistence is introduced.
