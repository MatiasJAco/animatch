# Phase 1 Data Model: Game Screen Mascot

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Summary

This feature introduces **no database table, column, migration, server payload, API route or
stored browser field**. It is a presentation-only extension of an asset and a rule that already
exist.

What it defines is a small set of **records** that describe the mascot's presentation and where
it is shown. All of them are static or derived at render time:

1. A **mascot presentation**: the settled way the mascot is rendered — one asset, one size rule,
   one corner, one failure behaviour — shared unchanged by the home screen and every game screen.
2. A **game screen**: one of the five playable screens, in any of its states, together with the
   content column the mascot must clear or be accepted over.
3. A **size rule**: the rule that fixes the mascot's rendered size from the viewport, with one
   value per viewport band and a boundary at 1024 pixels.
4. A **mascot render state**: the purely client-side, render-time decision about whether the
   decorative image is shown or has failed.

Nothing is persisted. The mascot is the same static file for every visitor, in every locale, on
every UTC day.

## Existing Inputs (unchanged)

| Input | Source | Fields used |
|-------|--------|-------------|
| Mascot asset | `public/artwork/matchi-mascot.webp` | The identical file, byte-for-byte, at 640x1137 with a transparent background and a size of at most 150 KB |
| Mascot component | `app/components/Mascot.vue` (renamed from `HomeMascot.vue`) | `failed` flag, `@error` handler, `onMounted` re-check, `aria-hidden`, `alt=""`, intrinsic `width`/`height` |
| Size rule | `app/assets/css/main.css` — `--mascot-size`, `--mascot-ratio` | The two band values and the 1024-pixel boundary, unchanged |
| Placement rule | `app/assets/css/main.css` — `.mascot` | `position: fixed`, `inset-block-end: 0`, `inset-inline-end: 0`, `pointer-events: none` |
| Game frame | `app/components/GameShell.vue` | The `game-shell` frame every game screen renders through; the single mount point for the mascot |
| Game identity | `server/game/ids.ts` | `GameId` union and `GAME_IDS` order — unchanged |
| Display copy | `app/i18n/en.ts`, `app/i18n/es.ts` | Unchanged; no new key |
| Daily puzzle | The existing `/api/daily/*` responses | Unchanged; the mascot does not depend on them |

No field above changes shape, no payload gains a field, and no key is added to either message
catalog.

## Entity: Mascot Presentation

The settled way the mascot is rendered. It is a **static record**: one instance, shared by the
home screen and every game screen.

| Field | Type | Rule |
|-------|------|------|
| `asset` | path | Exactly one file: `/artwork/matchi-mascot.webp`. No variant, no alternate pose, no per-screen artwork (FR-003, FR-027) |
| `intrinsicSize` | `{ width: 640, height: 1137 }` | Unchanged; carried on the `<img>` so the browser reserves the box before the file arrives (FR-021) |
| `anchor` | `'bottom-inline-end'` | The viewport corner the mascot is pinned to; identical on every screen (FR-008) |
| `positioning` | `'fixed'` | Out of the document flow: reserves no space, adds no overflow, never moves with the scroll (FR-011, FR-012) |
| `pointerEvents` | `'none'` | The mascot never intercepts pointer or touch input (FR-015) |
| `decoration` | `true` | `aria-hidden` wrapper, empty `alt`, no focus stop, no information of its own (FR-018, SC-008) |
| `motion` | `'none'` | A still image: no animation, no transition, no `prefers-reduced-motion` branch (FR-020) |
| `background` | `'none'` | The element paints no opaque rectangle against either display mode (FR-019) |
| `onFailure` | `'remove-image'` | The `<img>` is removed; nothing else changes and no fallback is requested (FR-022) |
| `screens` | `ScreenRef[]` | The screens that carry it: the home screen plus the five game screens (FR-001, FR-004) |

**Validation**

- `asset` resolves to exactly one file and that file is the same file the home screen used before
  this feature (FR-027, SC-011).
- `anchor` and `sizeRule` are **shared values**, not per-screen values: there is no second
  presentation for the game screens (FR-003, FR-007).
- `screens` contains no screen outside the home screen and the five game screens; the app's error
  page is not a game screen and carries no mascot (FR-004).

## Entity: Game Screen

One of the five playable screens, in any of its states.

| Field | Type | Rule |
|-------|------|------|
| `id` | `GameId` | `more_or_less`, `groups`, `match_the_series_spring_2026`, `match_the_series_summer_2026`, `match_the_series_autumn_2026` — the same five, none added, removed or renamed (FR-001, FR-023) |
| `route` | path | The existing route; unchanged (FR-023) |
| `frame` | `'game-shell'` | The shared frame the screen renders through, and therefore the screen's single mascot mount point |
| `column` | `{ maxWidth: '46rem' }` | The screen's own content column — the geometry the mascot must clear at 1024 pixels and wider, and be accepted over below it (FR-013, FR-014) |
| `states` | `State[]` | The states the screen can be in; the mascot is present in every one (FR-002) |

**Validation**

- `id` matches an entry in `GAME_IDS`; no route is added, removed or renamed.
- `states` always includes `loading`, `playing`, `finished` and `error`; the mascot is rendered by
  the frame, outside every state branch, so presence does not depend on the branch.
- `column` is **not** an input to the size rule. The rule is viewport-based and shared; the
  column only records what the mascot is measured against (FR-007).

## Entity: Size Rule

The rule that fixes the mascot's rendered size from the viewport.

| Field | Type | Rule |
|-------|------|------|
| `token` | `'--mascot-size'` | The single custom property that carries the inline size (FR-006) |
| `bands` | `Band[]` | One value per viewport band; the values are unchanged from feature 013 (FR-007) |
| `boundary` | `1024px` | The single band boundary; unchanged (FR-009) |
| `ratio` | `'640 / 1137'` | The asset's own aspect ratio, preserved so the browser reserves the box (FR-021) |
| `ceilings` | `{ width: 0.35, height: 0.55 }` | The shares of the viewport the mascot may never exceed (FR-010) |

**Band records**

| Band | Applies at viewport widths | Value |
|------|---------------------------|-------|
| 1 — edge | 320px – 1023px | `min(17vw, calc(17dvh * 640 / 1137))` |
| 2 — margin | 1024px – 1920px | `min(calc((100vw - 55rem) / 2 * 0.8), calc(53dvh * 640 / 1137))` |

**Validation**

- Every band value is expressed in viewport units only (`vw`, `dvh`, `100vw`), so the rendered box
  is identical on every screen at a given viewport width (FR-006).
- Band 2's margin term is the **home screen's** free-column term (`55rem`). It is not re-derived
  from a game screen's column width, and no second rule exists for the game screens (FR-007).
- The resulting box is inside the ceilings at every tested viewport, and the box is fully inside
  the viewport (FR-010).

## Entity: Mascot Render State

The purely client-side, render-time decision about whether the decorative image is shown. It is
component-local state and is never persisted, never sent to the server and never read from
storage.

| Field | Type | Rule |
|-------|------|------|
| `failed` | boolean | `false` while the image is expected to load; `true` once it has failed (FR-022) |

**State transitions**

| From | Trigger | To | Effect |
|------|---------|----|--------|
| `failed = false` | The `<img>` fires `error` | `failed = true` | The `<img>` is removed from the tree. Nothing else on the screen changes (FR-022) |
| `failed = false` | `onMounted` finds the image `complete` with `naturalWidth === 0` | `failed = true` | The same removal, for a failure that happened before hydration attached the listener |
| `failed = true` | — | — | There is no recovery path: the mascot carries no information, so there is nothing to retry |

**Validation**

- The state is never serialised, never persisted and never sent anywhere (Principle IV).
- The transition produces no user-facing text, no error state and no layout change (FR-025,
  FR-021).

## Entity: Known Limitation

The narrow-viewport cover of the board's bottom inline-end region by the mascot, accepted by the
project owner on 2026-11-14 and recorded rather than engineered away.

| Field | Type | Rule |
|-------|------|------|
| `condition` | `viewportWidth < 1024px` | Below the size rule's band boundary the game screen's column reaches the window's edge, so the mascot overlaps the board's bottom inline-end region |
| `mayCover` | `['tile artwork', 'labels', 'counts', 'action buttons', 'status copy']` | Any board content in that region may be visually covered (FR-014) |
| `mustNever` | `['layout change', 'swallowed click', 'scrollbar', 'removed, hidden or truncated text', 'content trapped under the mascot']` | The properties that bound the limitation (FR-014, FR-015, FR-016, FR-017) |
| `resolution` | `'not engineered away'` | The overlap is not resolved by changing the mascot's size or its corner |

**Validation**

- The limitation is recorded in `contracts/game-mascot.md` and in this feature's `spec.md`
  (FR-014, SC-016).
- It applies only below 1024 pixels; at 1024 pixels and wider the mascot overlaps the game
  screen's content column by 0 pixels (FR-013, SC-005).

## Relationships

- A **Mascot Presentation** is shown on exactly one **Home Screen** and on each of the five
  **Game Screens** — one shared presentation, many screens, no per-screen variant (FR-003,
  FR-006).
- A **Game Screen** renders exactly one **Mascot Render State** at a time, and that state belongs
  to the shared presentation, not to the screen (FR-002, FR-022).
- A **Mascot Presentation** is sized by exactly one **Size Rule**, and the rule is not derived
  from any screen's column (FR-007).
- A **Known Limitation** qualifies the relationship between the presentation and the game screens
  below 1024 pixels; above that width the relationship is unconstrained by overlap (FR-013,
  FR-014).

## Non-Goals

- No new entity is persisted, and no existing entity gains a field.
- No second mascot asset, no second size rule, no per-screen variant (FR-003, FR-007, FR-027).
- No game data model of any kind: no puzzle, attempt, score, timer, progress or share record is
  touched (FR-023).
- No server-side model: the API, the daily payloads and the error bodies are unchanged.
