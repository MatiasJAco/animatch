---
description: "Task list for Responsive Home Game Catalog"
---

# Tasks: Responsive Home Game Catalog

**Input**: Design documents from `/specs/011-home-game-catalog/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The project constitution makes passing tests part of the definition of done,
and plan.md/research.md specify eight feature tests (2 Vitest, 6 Playwright). Keep the suite at or
under 15 tests; never assert stylesheet source text, CSS class strings, or markup snapshots.

**Organization**: Tasks are grouped by user story in priority order (US1 → US5). US1 and US2 are
both P1; the recommended MVP is US1 + US2 together because uniform, image-bearing cards are the
headline requirement.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: `[US1]` complete catalog, `[US2]` uniform size and artwork, `[US3]` whole-card
  activation, `[US4]` inactive/finished cards, `[US5]` app-wide consistency
- Every task names an exact file path and references the relevant contract/spec section.

## Path Conventions

Single Nuxt project: `app/` (browser code), `public/` (static artwork), `tests/` (Vitest),
`e2e/` (Playwright). No `server/` or `migrations/` file is touched by this feature.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared visual tokens and the artwork replacement note that every later task relies on.

- [X] T001 [P] Add light and dark design tokens to `app/assets/css/main.css`: `--surface-hover` (light `#eef1ff`, dark `#262a3a`), `--surface-finished` (light `#e4e4e9`, dark `#26262b`), `--surface-inactive` (light `#ececf1`, dark `#23232b`), `--border-hover` (light `#2f4fd8`, dark `#8ba4ff`), `--border-inactive` (light `#d6d6de`, dark `#3a3a46`), `--game-card-block-size: 24rem`, and `--game-art-aspect: 16 / 9`. Keep existing token names unchanged (contracts/home-catalog-ui.md §3, §6).
- [X] T002 [P] Update `README.md`: add `public/games/` to the layout table and a short paragraph that each home card's artwork is a replaceable SVG named by the game's route slug, with `app/utils/gameArt.ts` as the one-line mapping to edit on rename (contracts/game-artwork.md §1, §3).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure data helpers, the reusable artwork frame, and the home page frame. These are
shared by every story; no user-facing card behavior is complete yet.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [X] T003 [P] Create `app/utils/gameArt.ts`: export `GAME_ART_PATHS: Record<GameId, string>` mapping `more_or_less → /games/more-or-less.svg`, `match_the_series_autumn_2026 → /games/match-the-series-autumn-2026.svg`, `match_the_series_spring_2026 → /games/match-the-series-spring-2026.svg`, `match_the_series_summer_2026 → /games/match-the-series-summer-2026.svg`, `groups → /games/groups.svg`; export `gameArtPath(game: GameId)`. Use a type-only `GameId` import so no server module enters the browser bundle (contracts/game-artwork.md §1, data-model.md).
- [X] T004 [P] Create `app/utils/gameCardState.ts`: export `GameCardTone = 'playable' | 'finished' | 'unavailable' | 'error'`, `GameCardPresentation { playable: boolean; tone: GameCardTone; messageKey: MessageKey | null }`, and `gameCardPresentation(status: GameStatus, state?: Pick<LocalGameState, 'status'>)`. Priority MUST be won/lost → `finished` (`home.finished_today`), then status `error` → `error` (`error.DATABASE_UNAVAILABLE`), then `unavailable` → `unavailable` (`error.PUZZLE_UNAVAILABLE`), otherwise `playable` with `null` (data-model.md, contracts/home-catalog-ui.md §2).
- [X] T005 Create `app/components/GameArt.vue`: props `game: GameId`; render a wrapper with `data-game-art`, an `<img>` with `data-art-image`, `:src="gameArtPath(game)"`, `alt=""`, `aria-hidden="true"`, `draggable="false"`; track a `failed` ref and reset it when `game` changes; on `@error` render a neutral `<span data-art-fallback aria-hidden="true">` with no text. The 16:9 frame size is owned by CSS. Depends on T003 (contracts/home-catalog-ui.md §5, contracts/game-artwork.md §4).
- [X] T006 Update `app/assets/css/main.css`: split the shared `.page, .home` block into separate rules. Keep `.page` unchanged. Give `.home` `flex: 1 0 auto`, `min-height: 100dvh`, `overflow: visible`, `width: 100%`, `max-width: 56rem`, centered, and the existing padding; keep horizontal overflow locked by the existing body rule. Also set `dir: { public: '../public' }` in `nuxt.config.ts` so the root `public/` directory is served while `srcDir` stays `app/`. The home catalog may scroll vertically as one document surface, while game screens keep their current frame (research.md R-006, contracts/home-catalog-ui.md §7).

**Checkpoint**: Helpers, artwork component, tokens, and the home frame exist; `npm test` still passes.

---

## Phase 3: User Story 1 - Every offered game appears on the home page (Priority: P1) 🎯 MVP

**Goal**: The home page renders all five games exactly once in the fixed catalog order, including
games that are finished, unavailable, or errored, while preserving loading and total-failure states.

**Independent Test**: Load the home page with no stored data, then with one finished game; every
run shows exactly five `[data-game-card]` elements in the order More or Less, Autumn 2026, Spring
2026, Summer 2026, Groups, with one card per `data-game`.

### Tests for User Story 1

- [X] T007 [US1] Add the first test to `e2e/home-catalog.spec.ts`: load `/`, wait for `[data-game-card]`, assert exactly five cards and `data-game` values equal `GAME_IDS` order; seed `animatch:v1:progress` with one `won` result for today and assert all five remain, with only that card showing `data-state="finished"`. Use existing local-storage shape and UTC date (spec FR-001–FR-003, SC-001; contracts/home-catalog-ui.md §1–§2).

### Implementation for User Story 1

- [X] T008 [US1] Edit `app/pages/index.vue`: import `GAME_IDS`; derive `orderedGames` from `GAME_IDS` and the listing, emitting exactly one entry per id and never duplicating. If an id is missing from the payload, synthesize an `error` entry so the card still appears. Keep the existing `ErrorPanel` for a total listing failure, the loading message, `CountdownBadge`, `LanguageControl`, and `HomeResetControls`; add `data-home-catalog` to the list. Render `orderedGames` instead of `listing.games` (spec FR-001–FR-003, FR-031–FR-032; contracts/home-catalog-ui.md §1, §7).
- [X] T009 [US1] Edit `app/components/GameCard.vue`: derive `presentation` with `gameCardPresentation` and add `data-game-card`, `:data-game="game"`, and `:data-state="presentation.tone"` to the root; keep the current visual content and Play link for now so US1 remains independently usable. This gives the catalog and later tests a stable, non-stylesheet selector (contracts/home-catalog-ui.md §1).

**Checkpoint**: The catalog is complete and stably ordered; the first Playwright test passes.

---

## Phase 4: User Story 2 - Every card has the same size and a representative image (Priority: P1) 🎯 MVP

**Goal**: All five cards are exactly the same width and height at each breakpoint, each shows an
original 16:9 image in the same position, missing artwork falls back cleanly, and the catalog never
overflows horizontally.

**Independent Test**: Load the home page at 360x640, 768x1024, 1024x768, 1440x900, and 1920x1080;
assert all card boxes are equal, all five images load, the last row does not stretch, and 200% text
zoom keeps content inside the cards with no horizontal overflow.

### Tests and Assets for User Story 2

- [X] T010 [P] [US2] Create the five original SVG assets: `public/games/more-or-less.svg`, `public/games/match-the-series-autumn-2026.svg`, `public/games/match-the-series-spring-2026.svg`, `public/games/match-the-series-summer-2026.svg`, and `public/games/groups.svg`. Each uses `viewBox="0 0 320 180"`, contains no `<text>`, external URL, font, or script, and is visually distinct: balance/quantity motif for More or Less; grid/leaf motifs for Autumn, Spring, and Summer; four clustered tile sets for Groups (contracts/game-artwork.md §2, §6).
- [X] T011 [P] [US2] Create `tests/game-art.test.ts`: for every `GAME_IDS` entry, assert `gameArtPath` is unique, starts with `/games/`, points to a file under `public/` that exists, is non-empty, starts with `<svg`, and contains no `<text`, `http://`, or `https://`. This is one Vitest test (contracts/game-artwork.md §1, §5).
- [X] T012 [US2] Add the uniform-geometry test to `e2e/home-catalog.spec.ts`: for each viewport 360x640, 768x1024, 1024x768, 1440x900, 1920x1080, set the size, reload `/`, wait for five cards and loaded `img[data-art-image]` (`naturalWidth > 0`), assert every card's bounding box has the same width and height within 1 px, assert the last row does not stretch, and assert `scrollWidth === clientWidth`. At 1920x1080 also assert `scrollHeight === clientHeight` (spec FR-004–FR-006, FR-021–FR-022, SC-002–SC-003, SC-017; contracts/home-catalog-ui.md §3, §7).
- [X] T013 [US2] Add the fallback-and-zoom test to `e2e/home-catalog.spec.ts`: intercept `**/games/groups.svg` with a 404, load `/`, wait for `[data-art-fallback]`, and assert the Groups card's box still matches the other cards. Then set `document.documentElement.style.fontSize = '32px'`, wait for layout, assert all cards remain equal, every card's `scrollHeight <= clientHeight + 1`, and `scrollWidth === clientWidth` (spec FR-008, FR-025, SC-003–SC-004, SC-014; contracts/game-artwork.md §4).

### Implementation for User Story 2

- [X] T014 [US2] Edit `app/components/GameCard.vue`: add `<GameArt :game="game" />` as the first child, wrap the existing name, summary, state text, and Play link in a card body, and change the name to an `h3` while keeping the current data attributes and interaction. The structure MUST be identical on every card: art frame, name, summary, optional state, optional Play link (contracts/home-catalog-ui.md §3; depends on T005, T009).
- [X] T015 [US2] Edit `app/assets/css/main.css`: turn `.game-list` into explicit 1/2/3-column grids (`< 40rem`: 1; `40rem–59.99rem`: 2, card block `25rem`; `>= 60rem`: 3, card block `24rem`); make each list item a flex child and each `.game-card` `inline-size: 100%`, `block-size: var(--game-card-block-size)`, `box-sizing: border-box`, flex column, with clipped rounded corners. Add a 16:9 `.game-art` frame (`aspect-ratio: var(--game-art-aspect)`, `object-fit: contain`), a flex body with padding/gaps, name/summary wrapping, and bottom-aligned state. Set `align-items: start` and equal `1fr` tracks so a two-card last row keeps the normal column width. Verify the five-card catalog still fits at 1920x1080 (spec FR-004–FR-009, FR-021–FR-024; contracts/home-catalog-ui.md §3; depends on T001, T006, T014).
- [X] T016 [P] [US2] Update `e2e/viewport-fit.spec.ts`: replace every `page.waitForSelector('.game-list .card')` with `page.waitForSelector('.game-list [data-game-card]')` (four occurrences). Keep `noDocumentScroll` at 1920x1080 and all existing board-first assertions unchanged; do not add stylesheet or snapshot assertions (contracts/home-catalog-ui.md §7; depends on T009).

**Checkpoint**: Cards are uniform, image-bearing, and responsive; the artwork and geometry tests pass.

---

## Phase 5: User Story 3 - Clicking anywhere on a playable card starts the game (Priority: P2)

**Goal**: A playable card is one link covering its entire surface, with a hover/focus colour change
and no Play button; inactive cards remain non-interactive.

**Independent Test**: Click the artwork, title, and a blank area of a playable card and confirm the
matching game opens each time; hover/focus changes the surface; no Play button exists anywhere;
Enter/Space works from the keyboard.

### Tests for User Story 3

- [X] T017 [US3] Add the whole-card activation test to `e2e/home-catalog.spec.ts`: pick the first `[data-state="playable"]`, click its `[data-game-art]`, assert the URL is `/game/<data-game with underscores replaced by hyphens>`, go back, click near the bottom-right non-text area, assert the same URL, assert no `.button` or Play text exists inside any card, focus the card link and press Enter, and assert navigation. This is one Playwright test (spec FR-010–FR-013, SC-007, SC-010; contracts/home-catalog-ui.md §4).

### Implementation for User Story 3

- [X] T018 [US3] Rewrite the root of `app/components/GameCard.vue`: when `presentation.playable` is true render a `NuxtLink`/anchor with `:to="to"` and the full card content inside; otherwise render a non-focusable `article` with the same content. Remove the Play link and every nested button/link. Keep `data-game-card`, `data-game`, `data-state`; add a `game-card--<tone>` class. The anchor's accessible name comes from the visible name, summary, and state; do not add an `aria-label` that hides that content (contracts/home-catalog-ui.md §2, §4, §6; depends on T004, T014).
- [X] T019 [US3] Edit `app/assets/css/main.css`: add `cursor: pointer` and a `:hover`/`:focus-visible` accent surface, border, and shadow for playable cards, using the T001 tokens; apply hover only inside `@media (hover: hover) and (pointer: fine)`; add an active/pressed treatment; ensure the focus outline remains visible and the card's box does not move or resize. Inactive cards keep `cursor: default`, no hover change, and no pointer affordance. Existing reduced-motion rules suppress transitions (spec FR-011–FR-013, FR-028; contracts/home-catalog-ui.md §4, §6; depends on T018, T015).
- [X] T020 [P] [US3] Remove the obsolete `home.play` key from both `app/i18n/en.ts` and `app/i18n/es.ts`; confirm no reference remains in `app/` or tests (research.md R-008; depends on T018).

**Checkpoint**: The card itself is the action; hover, focus, pointer, and keyboard work; the Play button is gone.

---

## Phase 6: User Story 4 - Inactive cards are unmistakable and never clickable (Priority: P2)

**Goal**: Finished cards are greyed and marked, unavailable/error cards explain their state, and
none of them hover, navigate, or receive keyboard focus; the state is isolated per game and tied to
the current UTC day.

**Independent Test**: Seed a finished result, make one card unavailable, and force another into
error; confirm only playable cards respond, finished is grey, and each inactive card shows the
correct message without affecting the others.

### Tests for User Story 4

- [X] T021 [P] [US4] Create `tests/game-card-state.test.ts`: one Vitest test covering ready with no result → `playable`; ready with `won` and with `lost` → `finished` + `home.finished_today`; ready with no result and status `unavailable` → `unavailable` + `error.PUZZLE_UNAVAILABLE`; status `error` → `error` + `error.DATABASE_UNAVAILABLE`; and finished taking priority over a later error status. Assert `playable` is false for all non-playable tones (data-model.md, contracts/home-catalog-ui.md §2).
- [X] T022 [US4] Add the hover/inactive-state test to `e2e/home-catalog.spec.ts`: record a playable card's computed `backgroundColor` and `cursor`, hover it, and assert the background changed and the cursor is a link pointer. Seed `animatch:v1:progress` with `groups` as `won` for today, reload, locate `[data-game="groups"]`, assert `data-state="finished"`, its background differs from the playable card, hover it and assert the background does not change, assert it has no `href`, click it and assert the URL did not change, and assert it is absent from the page's link roles/focus order. This is one Playwright test (spec FR-014–FR-020, SC-008–SC-011; contracts/home-catalog-ui.md §2, §4).

### Implementation for User Story 4

- [X] T023 [US4] Edit `app/components/GameCard.vue`: drive the root `game-card--<tone>` class and `data-state` from `presentation`; render the state paragraph from `presentation.messageKey` with `data-card-state` (badge for finished, feedback styling for unavailable/error); keep the game name and summary visible in every state; ensure the Play/link root exists only when `presentation.playable` is true (spec FR-014–FR-020; contracts/home-catalog-ui.md §2; depends on T018).
- [X] T024 [US4] Edit `app/assets/css/main.css`: add `.game-card--finished` grey/muted surface and border, `.game-card--unavailable` and `.game-card--error` inert surface, muted artwork (`filter: grayscale(1)` and reduced contrast without lowering text contrast), bottom-aligned state text, and `cursor: default`/no hover for all inactive tones. Verify the finished badge and error text keep at least 4.5:1 contrast in light and dark modes. Add dark-mode overrides for any new tone that T001 did not cover (spec FR-014–FR-019, FR-027–FR-029; contracts/home-catalog-ui.md §2, §6; depends on T019, T023).

**Checkpoint**: Finished, unavailable, and error cards are visually and behaviorally inert; only playable cards are links.

---

## Phase 7: User Story 5 - The catalog stays consistent with the rest of the app (Priority: P3)

**Goal**: The new catalog keeps the countdown, language switching, loading/failure states,
development reset, responsive frame, and light/dark legibility.

**Independent Test**: Switch languages with the catalog open and verify every card updates without
a reload; at 1920x1080 confirm the header, five cards, countdown, and development reset fit with no
vertical scroll; at 320 pixels confirm no horizontal overflow.

### Tests for User Story 5

- [X] T025 [US5] Add the consistency test to `e2e/home-catalog.spec.ts`: set an in-page marker, click the English language control and assert card names/summaries change without a reload (marker still present), switch back to Spanish and assert the Spanish name returns; at 1920x1080 assert `scrollHeight === clientHeight` with the header, five cards, countdown, and `.home-reset-controls` visible; at 320 pixels assert `scrollWidth === clientWidth`. This is one Playwright test (spec FR-026–FR-033, SC-005, SC-013, SC-017; contracts/home-catalog-ui.md §7–§8).

### Implementation for User Story 5

- [X] T026 [US5] Edit `app/pages/index.vue`: keep the `h2` section heading, `LanguageControl`, `CountdownBadge`, `HomeResetControls`, loading paragraph, and `ErrorPanel` around the new `[data-home-catalog]` list; ensure the `h1` remains the page title and card names are `h3` for a coherent heading order; ensure a total failure still replaces the list with the retry panel and a missing listing entry still yields an error card (spec FR-030–FR-033; contracts/home-catalog-ui.md §1, §7; depends on T008, T018).
- [X] T027 [US5] Edit `app/assets/css/main.css`: finalize home spacing at phone/tablet/desktop, wrap `.lang-switch` and `.home-reset-controls` without horizontal overflow, add any dark-mode surface/state refinements, and ensure the countdown/heading do not collide with the catalog. Confirm 320 px and 200% text zoom remain free of horizontal overflow (spec FR-021–FR-027, FR-030–FR-033; contracts/home-catalog-ui.md §3, §6–§7; depends on T024).

**Checkpoint**: All five user stories are independently satisfied and the home page is consistent
with the rest of the app.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validate the whole feature, remove dead code, and confirm the constitution gates.

- [X] T028 Run `npm test` from the repository root; fix any failures in `tests/game-art.test.ts` or `tests/game-card-state.test.ts` and confirm the suite adds no real credentials/network dependency.
- [X] T029 Run `npm run test:viewport` with `DATABASE_URL` configured; fix failures in `e2e/home-catalog.spec.ts` or `e2e/viewport-fit.spec.ts`, including the 1920x1080 home no-scroll check.
- [X] T030 [P] Walk through `specs/011-home-game-catalog/quickstart.md` manually: both locales, light/dark, 200% text, keyboard/screen-reader semantics, finished/unavailable/error states, and artwork replacement/fallback. Record any issue and fix it before completion.
- [X] T031 [P] Remove dead home-card CSS from `app/assets/css/main.css` (old `.card` home spacing/`.card + .card` assumptions, obsolete Play sizing) without deleting `.card` rules used by `ErrorPanel`/result panels; confirm no `home.play` reference remains.
- [X] T032 [P] Confirm the feature stayed in scope: `git diff --stat` shows no `server/`, `migrations/`, package, or lockfile change; the feature test count is 8 (≤15); no external asset, font, or script was added; `app/utils/gameArt.ts` maps all five `GAME_IDS`; and the spec/plan/contracts/README references agree.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; T001 and T002 are parallel.
- **Foundational (Phase 2)**: Depends on Setup; T003, T004, T005 are parallel, T006 depends on T001.
  Blocks every user story.
- **US1 (Phase 3)**: Depends on Foundational; T007 test first, then T008 and T009.
- **US2 (Phase 4)**: Depends on US1; T010 and T011 can run in parallel with T014/T015 only after
  T009; T012/T013/T014/T015/T016 are sequenced around the shared card and test file.
- **US3 (Phase 5)**: Depends on US2; T017 test first, then T018, T019, and T020.
- **US4 (Phase 6)**: Depends on US3; T021 and T022 tests first, then T023 and T024.
- **US5 (Phase 7)**: Depends on US4; T025 test first, then T026 and T027.
- **Polish (Phase 8)**: Depends on all stories; T028 and T029 run after implementation, T030–T032
  can run together after T029.

### User Story Dependencies

- **US1 (P1)**: No story dependency after Foundational; delivers a complete, ordered catalog.
- **US2 (P1)**: Depends on US1 for the card markup/data attributes; adds uniform size and artwork.
- **US3 (P2)**: Depends on US2 for the final card structure; turns the card into the action.
- **US4 (P2)**: Depends on US3 for the link/article root; adds inactive visual and focus behavior.
- **US5 (P3)**: Depends on US4; verifies locale, controls, dark mode, and the 1920/320 layouts.

The shared `GameCard.vue`, `main.css`, and `e2e/home-catalog.spec.ts` mean the stories are
deliberately sequential. Do not run two tasks that edit the same file concurrently.

### Within Each User Story

- Write the story's test first when the task list marks it first; confirm it fails for the intended
  reason, then implement.
- Implement the card structure before its CSS; implement the state helper before the state UI.
- Run the story's focused test before moving to the next priority.
- Stop at each checkpoint to validate independently.

---

## Parallel Example: Foundational

```bash
# T003, T004 and T005 touch different files and can be built together:
Task: "Create app/utils/gameArt.ts"
Task: "Create app/utils/gameCardState.ts"
Task: "Create app/components/GameArt.vue"
```

## Parallel Example: User Story 2

```bash
# After T009, these touch separate files:
Task: "Create the five SVGs in public/games/"
Task: "Create tests/game-art.test.ts"
Task: "Update e2e/viewport-fit.spec.ts home selectors"
```

## Parallel Example: Polish

```bash
Task: "Manually run quickstart.md"
Task: "Remove dead home-card CSS from app/assets/css/main.css"
Task: "Verify scope, dependencies, artwork map, and test count"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1 (tokens, README) and Phase 2 (helpers, artwork component, home frame).
2. Complete Phase 3 (US1): all five games appear in stable order.
3. Complete Phase 4 (US2): all cards are identical in size and show original artwork.
4. **STOP and VALIDATE**: run `npm test`, the first three Playwright tests, and the quickstart's
   completeness/uniformity/artwork sections.
5. This is the requested MVP: a clean, responsive, uniform, image-bearing catalog. Deploy/demo if
   ready.

### Incremental Delivery

1. Foundational → helpers and frame ready.
2. US1 → complete catalog.
3. US2 → uniform size + artwork (MVP).
4. US3 → full-card interaction and hover.
5. US4 → finished/unavailable/error treatment.
6. US5 → locale, controls, dark mode, and final layout consistency.
7. Polish → full suite + manual verification.

Each step leaves the catalog usable; US3 removes the temporary Play link only after the card
itself can open the game.

### Parallel Team Strategy

With more than one developer, only the genuinely separate files are parallel (artwork assets, unit
tests, README); the card component, stylesheet, and Playwright file are single-writer surfaces by
design. Split work by file ownership rather than by story to avoid merge conflicts.

---

## Notes

- `[P]` tasks touch different files and have no incomplete dependency.
- The feature test count is 8 (2 Vitest + 6 Playwright), below the 15-test cap.
- Tests use `[data-game-card]`, `data-state`, and computed styles/geometry; never stylesheet source,
  CSS class strings, or snapshots.
- Do not add a dependency, external font, hotlinked image, database change, or new API route.
- Commit after each task or logical group, and stop at each checkpoint for independent validation.
