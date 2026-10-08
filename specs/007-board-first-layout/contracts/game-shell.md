# Contract: Shared Game Shell (UI)

This is the interface the three game screens expose to the player and to the viewport gate. It is a UI
contract (DOM order + rendered geometry), not a network API. Every rule is observable in the rendered
page, so the gate asserts it without reading stylesheet text or markup snapshots.

## Component API — `GameShell.vue`

| Prop | Type | Required | Meaning |
|------|------|----------|---------|
| `title` | `string` | yes | The game title rendered as the page `h1`. |

| Slot | Direction | Rendered |
|------|-----------|----------|
| `header-actions` | parent → shell | Inside `header.game-header`, on the same row as the title (Home/Reset). |
| default | parent → shell | The game body — the board component's two roots, `div.game-play` then `footer.game-meta`. |

The shell renders exactly:

```text
main.game-shell
├── header.game-header
│   ├── h1                       (title prop)
│   └── <slot name="header-actions">
└── <slot>                       (game body: the board component's two roots)
    ├── div.game-play            (viewport-filling box; board + actions)
    │   ├── section.game-board
    │   └── div.game-actions     (optional)
    └── footer.game-meta         (status + how-to-play copy, sibling of .game-play)
```

## Required DOM order (all three games)

The board component renders two sibling roots inside the shell: a `.game-play` box holding the play
area and its actions, then the `.game-meta` copy. In document order:

1. `div.game-play` — the box sized to one viewport minus the header chrome.
   1. `section.game-board` — the play area (first content region after the header).
   2. `div.game-actions` — the primary action buttons directly under the board; absent on a finished
      board and for Match the Series (no submit button).
2. `footer.game-meta` — status bar, then instructional/how-to-play copy. It is a **sibling** of
   `.game-play`, so it does not compete for the board's height and falls below the fold.

No status bar or instructional copy node may appear before `section.game-board`.

### Per-game content

| Game | `.game-board` | `.game-actions` | `.game-meta` (in order) |
|------|---------------|-----------------|--------------------------|
| Groups | 4x4 grid + found/revealed rows | Clear selection, Propose group | `groups.mistakes`, `game.groups.help`, `groups.select_four` |
| More or Less | comparison | More, Fewer | `more_or_less.round`, `game.more_or_less.help`, `more_or_less.question` |
| Match the Series | clue + `Next` + 3x3 grid | (none) | `match.mistakes` + `result.attempts`, `game.match_the_series.help` |

## Header rule

- The title and the `header-actions` (`GameHeaderControls`) share one row at supported widths
  (≥768px).
- The vertical center of the title and the vertical center of the controls differ by no more than a
  small tolerance (the gate uses ≤2px), i.e. they are aligned.
- When a width cannot fit both, the row wraps; wrapping behaves the same for every game.

## Scroll rule

- Horizontal: `document.scrollingElement.scrollWidth === clientWidth` at supported widths. No
  horizontal page scroll.
- Vertical: page scroll is allowed on the game screens. The board and its action row are above the
  fold; the `.game-meta` copy may be below the fold and is reached by scrolling.
- Size (refined SC-002): the board MUST render strictly taller than `.game-meta`, MUST be horizontally
  centered within 2px of the page center, and MUST NOT be clipped at the viewport edges. The board is
  height-capped to one viewport minus the header chrome so its action row stays above the fold.

## Failure rule

- An `ErrorPanel` (with its retry action when the error is retryable) renders **above the fold and
  outside `.game-meta`**, so it is visible without scrolling. Groups and More or Less place it at the
  top of `.game-board`; Match the Series renders its page-owned attempt error immediately before the
  board body (its `MatchGrid` does not receive the error — it is page state).

## Non-goals / invariants

- No change to game rules, selection, scoring, reset, storage, API, or i18n keys/strings.
- No new dependency; styling stays in the single global stylesheet plus the components.
- The home screen and the error page are outside this contract.
