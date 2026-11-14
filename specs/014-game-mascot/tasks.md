---
description: "Task list for Game Screen Mascot"
---

# Tasks: Game Screen Mascot

**Input**: Design documents from `specs/014-game-mascot/`

**Prerequisites**: [plan.md](./plan.md) (required), [spec.md](./spec.md) (required for user
stories), [research.md](./research.md), [data-model.md](./data-model.md),
[contracts/game-mascot.md](./contracts/game-mascot.md), [quickstart.md](./quickstart.md)

**Tests**: Included. The constitution (Principle VI) makes passing tests part of the definition of
done, and `plan.md` §Verification names the exact suite: **4 new Playwright tests in
`e2e/game-mascot.spec.ts` + 1 updated existing file (`e2e/home-artwork.spec.ts`, renamed test
hook only, no new test) = 5 feature tests, against the 15-test cap** (SC-018). Every test below
is one of those four new tests or that one updated file; adding another means consolidating one,
never appending. Tests assert rendered geometry and rendered behaviour only — never stylesheet
source text, CSS class-string contents, or markup snapshots (Principle VI).

**Organization**: Tasks are grouped by user story in priority order (US1 → US2 → US3 → US4). The
mascot becomes a screen-agnostic component in Setup, because US1, US2 and US3 all consume the
shared component, the shared size rule and the shared test hook; the mount point and the screen
inventory are Foundational, because every story's checks loop over the same screens and viewports.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: `[US1]` the mascot stays with the player, `[US2]` it is the same mascot, `[US3]` it
  never gets in the way, `[US4]` the games themselves are untouched
- Every task names an exact file path and cites the requirement, contract section or research
  decision it implements.

## Path Conventions

Single Nuxt 3 project at the repository root (plan.md §Project Structure). Browser code in `app/`,
served static files in `public/`, Vitest suite in `tests/`, Playwright suite in `e2e/`, feature
documents in `specs/014-game-mascot/`. `server/`, `migrations/`, `app/i18n/`, `public/artwork/` and
`artwork/` are **not** touched by this feature: there is no server change, no schema change, no
new copy and no new or re-encoded asset.

## Conventions that apply to every task

- **No new dependency.** `nuxt`, `pg`, `vitest` and `@playwright/test` are the only approved
  packages; the feature adds none and no build-time tool (FR-026, SC-014, Constitution VI).
- **No user-facing string.** The mascot carries no text, so `app/i18n/en.ts` and `app/i18n/es.ts`
  stay byte-identical to their pre-feature content (FR-025, SC-013, research R-010).
- **One asset, one size rule, one corner.** `/artwork/matchi-mascot.webp` is reused byte-for-byte;
  `--mascot-size` keeps its two bands and its 1024-pixel boundary; the anchor stays the viewport's
  bottom inline-end corner on every screen (FR-003, FR-006, FR-007, FR-008, FR-009, data-model.md
  §Mascot Presentation, §Size Rule).
- **Never mount the mascot in `app/app.vue`** and never inside a board component — the mount
  belongs to the game frame, outside every state branch (FR-002, FR-004, research R-001).
- **No essay-length comments** in source; rationale belongs in this feature's `research.md` and
  `contracts/game-mascot.md` (Constitution VI).
- **Never commit credentials.** `DATABASE_URL` comes from the environment only.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Make the mascot component screen-agnostic — one component, one size rule, one test
hook — shared unchanged by the home screen and the five game screens, with the home screen's
visitor-visible result unchanged (FR-005, SC-012).

- [X] T001 Rename `app/components/HomeMascot.vue` to `app/components/Mascot.vue` and rename its
      internal identifiers: the wrapper class `.home-mascot` becomes `.mascot`, the image class
      `.home-mascot__img` becomes `.mascot__img`, and the wrapper's test hook `data-home-mascot`
      becomes `data-mascot`. The image hook `data-mascot-image` is unchanged. Keep the component's
      behaviour exactly as it is: the `failed` flag, the `@error` handler that removes the `<img>`,
      the `onMounted` re-check for a failure that predates hydration, `aria-hidden="true"`,
      `alt=""`, `src="/artwork/matchi-mascot.webp"`, `width="640"`, `height="1137"`,
      `decoding="async"`, `draggable="false"`. The component's behaviour is
      `onFailure` = `remove-image` and `motion` = `none` (data-model.md §Mascot Presentation).
      This rename is internal and no visitor can see it (FR-005, SC-012, research R-002).
- [X] T002 [P] Rename the mascot's selectors in `app/assets/css/main.css` — `.home-mascot` becomes
      `.mascot` and `.home-mascot__img` becomes `.mascot__img`, including the rule inside the
      `@media (min-width: 1024px)` block. Keep every declaration byte-identical:
      `position: fixed`, `inset-block-end: 0`, `inset-inline-end: 0`, `pointer-events: none`,
      `--mascot-ratio: 640 / 1137`, `--mascot-size: min(17vw, calc(17dvh * 640 / 1137))`,
      `inline-size: var(--mascot-size)`, `aspect-ratio: var(--mascot-ratio)`, and band 2's
      `--mascot-size: min(calc((100vw - 55rem) / 2 * 0.8), calc(53dvh * 640 / 1137))`. The band
      boundary stays at `1024px` and band 2 keeps the **home screen's** free-column term `55rem` —
      it MUST NOT be re-derived from the game screens' `46rem` column, which would make the mascot
      larger on the game screens (FR-006, FR-007, FR-009, research R-003). Update the block's
      leading comment so it no longer claims the mascot is home-only.
- [X] T003 Update `app/pages/index.vue` to render `<Mascot />` — it was `<HomeMascot />` — in
      exactly the same position inside `<main class="home">`, after the catalog block and before
      `</main>`. The home screen's DOM position, rendered size, corner, behaviour and file stay
      identical: 0 visitor-visible differences (FR-005, SC-012). Depends on T001 (the component
      must exist before the page mounts it) and T002 (the rule must carry the new class name);
      it is not independent of them and must not run in parallel with them.
- [X] T004 [P] Update `e2e/home-artwork.spec.ts` to the renamed test hook: replace all 12
      `[data-home-mascot]` selectors with `[data-mascot]` (the helper `mascotRect`, the three
      `expect(...).toBeVisible()` assertions, the three `document.querySelector` reads, the
      motion read, the removal in the layout comparison, and the failure-path assertions). The
      hook `data-mascot-image` is unchanged. **No test is added, removed or weakened**: the home
      screen's own contract — size, corner, clearance from card text, click-through, focus stop,
      motion, and the failure fallback — keeps its assertions exactly as they are (SC-012,
      contracts/game-mascot.md §10).
- [X] T005 [P] Confirm the mascot asset is untouched by this feature: `public/artwork/matchi-mascot.webp`
      is the same file as before — 640x1137 pixels, a transparent background, at most 150 KB, not
      re-encoded, re-cropped, re-derived or duplicated — and `tests/artwork-assets.test.ts` still
      asserts the asset's *properties*. The asset is `asset` = "Exactly one file:
      `/artwork/matchi-mascot.webp`. No variant, no alternate pose, no per-screen artwork"
      (data-model.md §Mascot Presentation).

      Two distinct checks, because they are different claims:
      - **Properties** — the existing `tests/artwork-assets.test.ts` already asserts the
        dimensions, the alpha channel and the size ceiling, and that the file is smaller than and
        not a copy of its source (`artwork/sources/matchi-board.png`). Change nothing unless that
        test fails.
      - **Byte-identity across this feature** — SC-011's "byte-for-byte the same file as before the
        feature" is **not** covered by that test, which compares the asset against the *source
        image*, not against the asset's own pre-feature revision. Check it with a diff of the
        asset against its pre-feature revision (`git diff --stat 18724b1 -- public/artwork/`), which
        must be empty. The feature does not touch the asset, so the check costs nothing (FR-027,
        SC-011).

**Checkpoint**: One mascot component, one size rule, one test hook — shared by every screen, with
the home screen's rendered result unchanged.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Fix the screen inventory, the scope boundary and the anchoring constraint that the
mount and every story's checks depend on. **No user story work can begin until this phase is
complete** — the tests of US1, US2 and US3 all loop over the same five screens and the same six
viewports.

- [X] T006 [P] Confirm the screen inventory: exactly five game screens, with no route added,
      removed or renamed (FR-001, FR-023). `more_or_less` → `/game/more-or-less` in
      `app/pages/game/more-or-less.vue`; `groups` → `/game/groups` in
      `app/pages/game/groups.vue`; `match_the_series_spring_2026` →
      `/game/match-the-series-spring-2026`, `match_the_series_summer_2026` →
      `/game/match-the-series-summer-2026` and `match_the_series_autumn_2026` →
      `/game/match-the-series-autumn-2026` in the three files under `app/pages/game/` that render
      `app/components/MatchTheSeriesGame.vue`. The five ids and their order come from
      `GAME_IDS` in `server/game/ids.ts` — read it, do not change it. As declared there the order
      is `more_or_less`, `match_the_series_autumn_2026`, `match_the_series_spring_2026`,
      `match_the_series_summer_2026`, `groups` — **not** the order in which they are listed above,
      which is the order of the pages. Any loop written "in GAME_IDS order" must use the declared
      order. Record the mapping; change nothing unless a route is missing or unexpected.
- [X] T007 [P] Confirm the scope boundary: `app/error.vue` renders neither `GameShell` nor the
      mascot, so the app's error page and any unknown route carry no mascot, and the home screen
      keeps its own `<Mascot />` inside `<main class="home">`. The mascot MUST NOT be mounted in
      `app/app.vue` — that would require a route allowlist and would move the home screen's mascot
      out of `.home`, changing the home screen's DOM (FR-004, FR-005, research R-001). Record the
      result; change nothing unless the boundary is broken.
- [X] T008 [P] Confirm the anchoring constraint in `app/assets/css/main.css`: the ancestors of the
      mount — `app/assets/css/main.css`'s `#__nuxt`, `.app` and `.game-shell` rules — carry no
      `container-type`, no `contain`, no `transform`, no `filter`, no `backdrop-filter` and no
      `will-change`, because any of them would establish a containing block for the mascot's
      `position: fixed` and move it off the viewport's bottom inline-end corner (FR-008, SC-002,
      research R-004, contracts/game-mascot.md §4). `.home` carries `container-type: inline-size`,
      which does **not** establish one in the browser this project tests — leave it alone, since
      FR-005 forbids changing what the home screen shows. Record the result; change nothing unless
      a containing block is found.

**Checkpoint**: The five screens, the scope boundary and the anchoring constraint are fixed, so
the mount and every story's check matrix are unambiguous.

---

## Phase 3: User Story 1 - The character stays with the player through the whole game (Priority: P1) 🎯 MVP

**Goal**: Matchi stands in the bottom inline-end corner of the viewport on all five game screens —
More or Less, Groups and the Spring, Summer and Autumn 2026 editions of Match the Series — in
every state the screen can be in: loading, playing, finished and puzzle-unavailable. It appears on
no other screen.

**Independent Test**: Open each of the five game screens at 320x640, 360x640, 768x1024, 1024x768,
1440x900 and 1920x1080, in each of the four states, and confirm the mascot is visible in the
corner at every combination; open an unknown route and confirm no mascot appears (spec US1).

### Tests for User Story 1 ⚠️ (write first; must FAIL before T010)

- [X] T009 [US1] Create `e2e/game-mascot.spec.ts` with **test 1** — "the mascot is present on
      every game screen in every state" (contracts/game-mascot.md §10, item 1). Loop over the
      five routes (`/game/more-or-less`, `/game/groups`, `/game/match-the-series-spring-2026`,
      `/game/match-the-series-summer-2026`, `/game/match-the-series-autumn-2026`) and the four
      states, and assert `[data-mascot]` is present and visible in every combination
      (FR-001, FR-002, SC-003). Reach each state deterministically, never by racing or timing:
      **playing** is the default render; **loading** is the daily payload resolved as `null`
      (the page's own `v-else-if="pending || !puzzle"` branch); **finished** is the device's own
      progress store seeded under `animatch:v1:progress` with
      `{ v: 1, date: <the UTC day>, games: { <game id>: { status: 'won', attempts: 1 } } }`;
      **error** is the daily request failed with the structured body
      `{"error":{"code":"DATABASE_UNAVAILABLE"}}` that the app already handles.

      **The non-default states MUST be reached through a client-side navigation.** All five game
      screens load the daily payload with `await useFetch`, so on a cold `page.goto()` the request
      is issued by the Nitro SSR process, not by the browser: `page.route()` never fires, Nuxt
      transfers the SSR payload, and `useFetch` does not re-request on hydration. A test that
      installs the route and then calls `page.goto()` would silently exercise the *playing* state
      in every iteration and pass without ever reaching loading or error. Use the project's own
      working precedent (`e2e/home-header.spec.ts:864-888`): `page.goto()` the game route first to
      prime a full SSR load, wait for the board to render, then install the scoped interception,
      then navigate **client-side** into the route from the home page's catalog link
      (`page.locator('a[href="/"]').first().click()` or the game's own card link). Scope each
      interception to that game's own daily URL (`**/api/daily/more_or_less`,
      `**/api/daily/groups`, `**/api/daily/match_the_series_*`) — never a bare `**/api/daily`,
      which would also break the home page's own listing fetch and the navigation used to reach
      the route. Unroute after each state. Assert that the state was actually reached before
      asserting the mascot: the loading branch must show the loading copy with no board, and the
      error branch must show the `section[role="alert"]` error panel.

      Assert that an unknown route renders no `[data-mascot]` (FR-004). Assert rendered presence
      only — no stylesheet text, no class-string contents, no markup snapshots. **Write this test
      first and confirm it FAILS** — with no mount, the game screens carry no mascot — before T010
      lands.

### Implementation for User Story 1

- [X] T010 [US1] Mount `<Mascot />` in `app/components/GameShell.vue` as a **sibling of the
      shell's slot, after the slot content**:

      ```text
      <main class="game-shell">
        <header class="game-header">…</header>
        <slot />
        <Mascot />
      </main>
      ```

      The mascot sits outside every `v-if` / `v-else` branch of the slot — the loading copy, the
      `ErrorPanel` with its retry, the `ResultPanel` and the board are all branches of the same
      slot — so it is present in every state **by construction**, and any future game built on
      the shell inherits it with no per-game decision (FR-002, SC-003, research R-001, R-012).
      Do not mount it inside a board component (the boards are replaced by the result panel in the
      finished state) and do not mount it in `app/app.vue`. Depends on T009 (the test exists and
      fails), T001 (the component) and T002 (the rule).
- [X] T011 [US1] Run `npm run test:viewport -- e2e/game-mascot.spec.ts` and confirm test 1 passes:
      the mascot is visible on all five game screens in all four states, and absent from an unknown
      route (FR-001, FR-002, FR-004, SC-003).

**Checkpoint**: User Story 1 is fully functional and testable on its own — the character is present
on every game screen in every state.

---

## Phase 4: User Story 2 - It is the same mascot, not a lookalike (Priority: P1)

**Goal**: The game screens show the same drawing as the home screen — the identical image file,
the same rendered width and height within one pixel at every viewport width, and the same
viewport corner. There is no second asset, no alternate pose and no per-screen variant.

**Independent Test**: Measure the mascot's rendered box on the home screen and on each of the five
game screens at the same viewport width, and compare the image the browser loads in each case
(spec US2).

### Tests for User Story 2

US2 is a verification phase: the shared component and the shared size rule already exist, so this
test passes on creation. Its value is that it **must fail** if a second size rule, a per-screen
variant or a different asset is introduced.

- [X] T012 [P] [US2] Append **test 2** to `e2e/game-mascot.spec.ts` — the file T009 created: edit
      that file, do not create a second one — "the same size, the same corner and the same file on
      every screen" (contracts/game-mascot.md §10, item 2). Loop over the six viewports (320x640,
      360x640, 768x1024, 1024x768, 1440x900, 1920x1080) and the six screens (the home screen plus
      the five game screens): measure the home screen's mascot box once per viewport and compare
      each game screen's box — the width and the height within 1 pixel of the home screen's; the
      inline-end edge within 1 pixel of the viewport's width and the block-end edge within 1 pixel
      of the viewport's height; and the loaded image URL identical on all six screens
      (FR-003, FR-006, FR-008, SC-001, SC-002). Assert also that at 1024 pixels and wider the
      mascot overlaps the game screen's content column (`.game-shell`, `max-width: 46rem`) by 0
      pixels (FR-013, SC-005). Assert rendered geometry only.
- [X] T013 [US2] Verify the shared size rule in `app/assets/css/main.css`: there is exactly one
      `--mascot-size` rule, with two bands, the boundary at `1024px`, the ratio `640 / 1137`, and
      the ceilings `{ width: 0.35, height: 0.55 }` (data-model.md §Size Rule). Band 2 must keep
      the home page's free-column term `55rem` and must **not** be re-derived from the game
      screens' `46rem` column; there must be no second size rule for the game screens and no rule
      derived from a screen's own content width (FR-006, FR-007, FR-009, research R-003,
      contracts/game-mascot.md §5). Change nothing unless the check fails.
- [X] T014 [US2] Run `npm run test:viewport -- e2e/game-mascot.spec.ts` and confirm test 2 passes:
      30 size comparisons across the six viewports and the six screens, 0 differences within the
      1-pixel tolerance, 0 edge offsets, one identical image file (SC-001, SC-002).

**Checkpoint**: User Stories 1 AND 2 work independently — the mascot is on every game screen, and
it is provably the same mascot at the same size in the same corner.

---

## Phase 5: User Story 3 - The mascot never gets in the way of playing (Priority: P2)

**Goal**: The mascot is decoration and behaves like it: every control beneath it still answers
clicks and taps, the board and the header are exactly where they were, the page never gains a
horizontal scrollbar, the mascot takes no tab stop and never animates, and a failed image leaves
the game fully playable.

**Independent Test**: With the mascot on a game screen, tap every control that lies under it, tab
through the screen, resize the window from 320 to 1920 pixels, and block the mascot's image request
and reload (spec US3).

### Tests for User Story 3

US3's tests are verification gates against the shipped behaviour: they pass on creation and must
fail if the non-interference declarations or the failure handling are removed.

- [X] T015 [P] [US3] Append **test 3** to `e2e/game-mascot.spec.ts` — edit the file T009 created,
      never a second one — "the mascot never gets in the way of playing"
      (contracts/game-mascot.md §10, item 3). Loop over the five routes and assert: a resize sweep
      from 320 to 1920 pixels produces no horizontal scrollbar and nothing extends past the
      window's horizontal edges (FR-016, SC-004); the board geometry (`.game-board`), the header
      geometry (`.game-header`) and the page's scroll metrics measured with the mascot present and
      with `[data-mascot]` removed are identical (FR-012, FR-017, SC-007); every control whose
      rectangle intersects the mascot's rectangle still answers a click, and the covered content
      scrolls out from under the mascot (FR-014, FR-015, SC-006); the mascot holds no focusable
      element and takes no tab stop (FR-018, SC-008); and neither the wrapper nor the image
      animates or transitions (FR-020, SC-009).
- [X] T016 [P] [US3] Append **test 4** to `e2e/game-mascot.spec.ts` — the same file as T015, so
      apply it after T015, never concurrently — "a failed mascot leaves the game playable"
      (contracts/game-mascot.md §10, item 4). Loop over the five routes with the request for
      `/artwork/matchi-mascot.webp` aborted: the board still renders and still answers a click,
      `[data-mascot-image]` is removed, no broken-image indicator appears anywhere on the page, and
      no fallback image is requested (FR-022, SC-010). The failure is silent by design — the
      mascot carries no information, so there is nothing to report and nothing to retry
      (contracts/game-mascot.md §8).
- [X] T017 [US3] Verify the non-interference declarations in `app/assets/css/main.css` and
      `app/components/Mascot.vue`: `pointer-events: none` on the wrapper, `position: fixed` with
      `inset-block-end: 0` and `inset-inline-end: 0`, no `animation` and no `transition` anywhere,
      no background on the mascot element itself, `aria-hidden="true"` on the wrapper and an empty
      `alt` on the image (data-model.md §Mascot Presentation: `pointerEvents` = `none`,
      `positioning` = `fixed`, `motion` = `none`, `background` = `none`, `decoration` = `true`).
      Change nothing unless a check fails (FR-015, FR-018, FR-019, FR-020).
- [X] T018 [US3] Verify the accepted narrow-viewport cover and its bounds in `e2e/game-mascot.spec.ts`
      against the boards rendered by `app/components/MoreOrLessBoard.vue` and
      `app/components/GroupsBoard.vue`. Below 1024 pixels the game screen's column (`.game-shell`,
      `max-width: 46rem`) reaches the window's edge, so the mascot floats over the board's bottom
      inline-end region — the `condition` = `viewportWidth < 1024px` limitation (data-model.md
      §Known Limitation). It `mayCover` `['tile artwork', 'labels', 'counts', 'action buttons',
      'status copy']`, and it must never break `['layout change', 'swallowed click', 'scrollbar',
      'removed, hidden or truncated text', 'content trapped under the mascot']`.

      **This task adds NO new test.** Its assertions already live inside test 3 (T015), which
      asserts that every control under the mascot still answers a click and that the covered
      content scrolls out from under it. T018 is the manual reading of those assertions against
      the two boards: scroll the board under the mascot and confirm that every covered control
      still answers clicks and taps, that nothing is removed, hidden or truncated from the
      layout, and that the covered content scrolls out from under it. **Record the outcome as the
      accepted known limitation** — do NOT resize, move or hide the mascot in
      `app/assets/css/main.css` to remove the overlap (FR-014, FR-015, FR-016, SC-016,
      research R-008).
- [X] T019 [US3] Run `npm run test:viewport -- e2e/game-mascot.spec.ts` and confirm tests 3 and 4
      pass: 0 horizontal scrollbars from 320 to 1920 pixels, 0 measurable change to the board, the
      header or the scroll behaviour, 0 swallowed clicks, 0 focus stops, 0 animations, and a failed
      mascot leaving all five screens playable (SC-004, SC-006, SC-007, SC-008, SC-009, SC-010).

**Checkpoint**: User Stories 1, 2 AND 3 work independently — the mascot is present, identical and
harmless.

---

## Phase 6: User Story 4 - The games themselves are untouched (Priority: P3)

**Goal**: Nothing about how the games work changes: the same five routes, the same daily puzzles,
the same rules, the same scoring, the same saved results, the same sharing and the same reset.
The board still sits first under the header, the board still grows the way it grew, and the
header still lines up the way it did.

**Independent Test**: Run the existing game-screen checks for board-first order, header alignment,
board growth, horizontal overflow, both locales and the finished states, with the mascot present
(spec US4).

- [X] T020 [US4] Run `npm test` and confirm every Vitest suite still passes unchanged with the
      mascot present, including `tests/artwork-assets.test.ts`, which already asserts the mascot
      asset's own contract — 640x1137 pixels, a transparent background, at most 150 KB (FR-023,
      FR-027, SC-011, SC-015).
- [X] T021 [US4] Run `npm run test:viewport -- e2e/viewport-fit.spec.ts` and confirm the existing
      board-first suite still passes **unchanged** — the board-first order, the header alignment,
      the board's growth, the horizontal-overflow guarantee, both locales and the finished states
      (FR-024, SC-015, SC-018). This file needs no edit: the mascot is fixed-position and
      pointer-transparent, so it disturbs none of those measurements.
- [X] T022 [US4] Run `npm run test:viewport -- e2e/home-artwork.spec.ts` and confirm the home
      screen's own mascot contract still passes with the renamed hook: the same rendered size, the
      same corner, the same clearance from card text, the same click-through, the same focus stop,
      the same motion behaviour and the same failure fallback — 0 differences from before the
      feature (FR-005, SC-012).
- [X] T023 [US4] Confirm the feature changed no route, no copy and no data: `app/i18n/en.ts` and
      `app/i18n/es.ts` are byte-identical to their pre-feature content — 0 new user-facing
      strings, so both catalogs stay complete (FR-025, SC-013); the five game routes and
      `GAME_IDS` in `server/game/ids.ts` are unchanged (FR-023); and no file under `server/` or
      `migrations/` and no API payload changed (Constitution I, IV). Diff the tree against the
      pre-feature revision and report the file list.

**Checkpoint**: All four stories are independently functional, and every pre-existing guarantee
still holds.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, dependency hygiene, and the full validation pass.

- [X] T024 [P] Update `README.md`: the layout table's `public/artwork/` row ("The Matchi mascot
      shown on the home page") and the "Home game artwork" section, which says the mascot "floats
      over the home page", must now state that the same mascot floats over the home screen and the
      five game screens at the same size and in the same corner, and must link
      `specs/014-game-mascot/contracts/game-mascot.md`. Add the known limitation accepted by the
      project owner on 2026-11-14: below 1024 pixels the mascot may visually cover the board's
      bottom inline-end region — tile artwork, labels, counts, the More/Fewer buttons and the
      status copy — as long as no control beneath it stops answering clicks and taps, nothing is
      removed, hidden or truncated, no layout changes and no scrollbar appears (FR-014, SC-016).
- [X] T025 [P] Confirm the feature adds 0 dependencies: `package.json` is byte-identical to its
      pre-feature content — `dependencies` and `devDependencies` unchanged, no new script entry,
      no build-time tool added — and no npm package is imported under `app/`, `server/`, `tests/`
      or `e2e/` that was not already there (FR-026, SC-014, Constitution VI).
- [X] T026 [P] Confirm the feature 013 contract amendment is in place and consistent:
      `specs/013-home-artwork/contracts/home-mascot.md` carries the supersession notice for its
      FR-011 ("the mascot MUST appear on the home page only; game screens MUST keep their current
      presentation"), points at `specs/014-game-mascot/contracts/game-mascot.md`, and records that
      everything else in that contract stays in force with 0 differences on the home screen; its
      §8 "Renamed identifiers" table lists the rename performed in T001–T004 (research R-011,
      FR-005, SC-012). The amendment was written during this feature's planning phase and is
      already in the working tree — confirm it and change nothing unless a name in it does not
      match the code.
- [ ] T027 Run the manual validation pass from `specs/014-game-mascot/quickstart.md` §1–§9: the
      mascot on all five game screens at the top, middle and bottom of the scroll, in every state
      (§1, §3); the same size and corner on the home screen and on the game screens (§2); the
      narrow-viewport cover and the controls beneath it still answering (§5); both display modes
      and 200% text zoom (§6); a blocked mascot file leaving the game playable (§7); the home
      screen unchanged (§8); and a browser that is not Chromium (§9). Record the outcome in the
      guide. The 200% text-zoom overlap (accepted 2026-11-13, feature 013) and the narrow-viewport
      cover (accepted 2026-11-14, this feature) are **recorded outcomes, not failures**.

      **Partially done, in this run.** Every automated equivalent of §1, §2, §3, §4, §5, §7 and §8
      is covered by the four tests in `e2e/game-mascot.spec.ts` and by the unchanged
      `e2e/home-artwork.spec.ts`, and they pass. The two steps that need a human remain open:
      §6's operating-system display-mode switch, and §9's Firefox and Safari check — only
      Chromium is installed in this environment, and the Playwright configuration declares one
      project. The 200% text-zoom rendering was checked in Chromium: the mascot's box and its
      corner are identical on the home screen and on a game screen, and the rule is the same
      byte-identical rule as before this feature. The outcome was not written into
      `quickstart.md`, because that file is outside the file set this change is allowed to touch.
- [X] T028 Run the complete automated suite one final time — `npm test` and
      `npm run test:viewport` — and confirm the feature's test budget: 4 new Playwright tests in
      `e2e/game-mascot.spec.ts` plus 1 updated existing file (`e2e/home-artwork.spec.ts`, renamed
      test hook only, no new test) = 5, at or under the constitution's cap of 15 (SC-018,
      Constitution VI).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — T006 and T008 read the inventory and
  the stylesheet, and T007 checks the home screen's `<Mascot />` mount, which only exists after
  T003. The phase **BLOCKS all user stories**, because the mount point and every story's check
  matrix depend on the screen inventory, the scope boundary and the anchoring constraint.
- **User Stories (Phases 3–6)**: All depend on Foundational completion. They can then proceed in
  parallel or sequentially in priority order (P1 → P1 → P2 → P3).
- **Polish (Phase 7)**: Depends on the desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Foundational — no dependency on another story. It mounts the
  mascot and creates `e2e/game-mascot.spec.ts`.
- **User Story 2 (P1)**: Starts after Foundational — no dependency on another story. It verifies
  the shared presentation US1 exposes; its test is appended to the file US1 creates, so T012 must
  run after T009.
- **User Story 3 (P2)**: Starts after Foundational, and **edits the same file** as US1 and US2
  (`e2e/game-mascot.spec.ts`) — T015, T016 and T018 must be applied after T009 and T012, one after the
  other, not concurrently.
- **User Story 4 (P3)**: Starts after the stories it regresses against — it re-runs the existing
  suites with the mascot present.

### Within Each User Story

- Tests are written and confirmed to FAIL before their implementation where the behaviour does not
  exist yet (US1's presence test). US2's and US3's tests are verification gates: they pass on
  creation and must fail if the shared presentation, the non-interference declarations or the
  failure handling are broken.
- Core implementation before integration — the component and the stylesheet rule before the pages
  that mount them.
- The mount before the checks that assert it (US1: T009 → T010 → T011).
- Story complete before moving to the next priority.

### Parallel Opportunities

- Setup: T002 (the stylesheet rename) runs in parallel with T001 (the component rename);
  T004 (the existing e2e hook) runs in parallel with T003 (the home page mount); T005 (the asset
  check) is read-only and runs with any of them.
- Foundational: T006, T007 and T008 are independent read-only checks and run in parallel.
- US1: T009 (the test) is written before T010 (the mount) — they are deliberately sequential, not
  parallel.
- US2: T012 (the test append) runs in parallel with T013 (the size-rule verification).
- US3: T015 and T016 run in parallel with T017 and T018; T015, T016 and T018 touch the same file and
  are applied one after the other.
- Polish: T024 (README), T025 (dependencies) and T026 (the feature 013 contract) touch different
  files and run in parallel.
- Across stories, US1, US2 and US3 work on disjoint files except for the one shared spec file, so
  they can be worked on by different people once Foundational is done.

---

## Parallel Example: User Story 1

```bash
# Launch the checks that pin the shared presentation together (all read-only):
Task: "T006 [P] Confirm the screen inventory"
Task: "T007 [P] Confirm the scope boundary"
Task: "T008 [P] Confirm the anchoring constraint"
```

## Parallel Example: User Story 3

```bash
# Launch the two spec appends with the two source verifications:
Task: "T015 [P] [US3] Append test 3 to e2e/game-mascot.spec.ts"
Task: "T016 [P] [US3] Append test 4 to e2e/game-mascot.spec.ts"   # after T015 — same file
Task: "T017 [US3] Verify the non-interference declarations"
Task: "T018 [US3] Verify the accepted narrow-viewport cover and its bounds"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup — the shared component, rule and hook.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1 — the mascot on every game screen in every state.
4. **STOP and VALIDATE**: run `npm run test:viewport -- e2e/game-mascot.spec.ts` and confirm the
   presence test passes on its own.
5. Deploy/demo if ready.

### Incremental Delivery

1. Complete Setup + Foundational → the shared presentation and the placement constraints are
   fixed.
2. Add User Story 1 → test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → test independently → Deploy/Demo.
4. Add User Story 3 → test independently → Deploy/Demo.
5. Add User Story 4 → test independently → Deploy/Demo.
6. Each story adds value without breaking the previous ones.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together.
2. Once Foundational is done:
   - Developer A: User Story 1 — the mount and the presence test.
   - Developer B: User Story 2 — the identity test and the size-rule verification.
   - Developer C: User Story 3 — the non-interference and failure tests.
3. Stories complete and integrate independently; the three that touch
   `e2e/game-mascot.spec.ts` hand their appends over in story order.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps the task to a specific user story for traceability.
- Each user story is independently completable and testable.
- Verify tests fail before implementing, where the behaviour does not exist yet.
- Commit after each task or logical group — **the owner commits; this run creates no branch, no
  commit and no push.**
- Stop at any checkpoint to validate a story independently.
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence.
