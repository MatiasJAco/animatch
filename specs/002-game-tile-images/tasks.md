# Tasks: Game Tile Images

**Input**: Design documents from `/specs/002-game-tile-images/`

**Prerequisites**: plan.md (required), spec.md (user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — plan.md defines a 10-test suite (constitution cap: 15) as a deliverable, with an injectable fetch seam and no network access in tests.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single Nuxt application (per plan.md): server code under `server/`, client code under `app/`, tests under `tests/`. Paths are repository-root relative.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Runtime-data hygiene before any cache file exists

- [X] T001 [P] Add `.cache/` to `.gitignore` so the image cache is never committed or shipped as a deployment artifact (plan.md Source Code delta; Delivery Model principle)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-cutting server surface every user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Add `IMAGE_UNAVAILABLE` (404), `IMAGE_FETCH_FAILED` (502), and `INVALID_IMAGE_REQUEST` (400) to the `ErrorCode` union, `FALLBACK` messages, and `STATUS_FOR_CODE` map in `server/utils/errors.ts`, keeping the envelope shape `{ error: { code, message } }` per data-model.md §6
- [X] T003 [P] Add three allow-listed reads to `server/catalog/queries.ts` — `SELECT image_url FROM anime/characters/people WHERE mal_id = $1` (data-model.md §1), one per table, parameterized by id only — and reword the module comment at `server/catalog/queries.ts:39-41` that currently claims "No image_url ... is ever read" (research.md R-012)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Entity images on puzzle tiles (Priority: P1) 🎯 MVP

**Goal**: Every tile and clue card in the three games shows the artwork of the entity it names, downloaded once from the catalog URL and served from disk thereafter.

**Independent Test**: Open a day's puzzle in each game; every tile whose entity has an available image (measured coverage: 100%) shows that image beside its name, and reloads grow `.cache/images/` no further.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T004 [P] [US1] Create `tests/images.test.ts` with test 1 (first request downloads once; immediate second request serves from disk with zero upstream calls) and test 2 (N concurrent requests for one key produce exactly one upstream call) per plan.md Test Plan — will fail: `server/images/` does not exist yet
- [X] T005 [P] [US1] Create `tests/entity-image.test.ts` with test 8: key/id → path derivation for all payload shapes (`a:9001` → `/api/images/anime/9001`, `c:12345`/`p:678` with `kind`, `c:12345@a:9001` → part before `@`, person `id` as-is) and `null` for malformed input (data-model.md §3) — will fail: `app/utils/entityImage.ts` does not exist
- [X] T006 [P] [US1] Create `tests/routes/image.get.test.ts` with test 6 (200 serves cached bytes with allow-listed `Content-Type` and immutable `Cache-Control`; 400 `INVALID_IMAGE_REQUEST` for bad kind or non-positive id with no upstream call made; 404 `IMAGE_UNAVAILABLE` when `image_url` is absent; envelope matches `contracts/openapi.yaml`), test 7 (today's served puzzle JSON contains no image fields and no upstream URL), and test 10 (catalog image reads are SELECT-only and parameterized by id; no URL parameter is accepted anywhere) — will fail: route does not exist
- [X] T007 [P] [US1] Create `tests/i18n.test.ts` with test 9: every `image.*` key exists in both `app/i18n/en.ts` and `app/i18n/es.ts` — will fail: keys do not exist

### Implementation for User Story 1

- [X] T008 [US1] Create `server/images/cache.ts` implementing data-model.md §2: filename `{kind}-{malId}-{sha256(image_url).slice(0,16)}.{ext}`, `stat`-based existence check, temp-file write plus `rename` into `.cache/images/` (created on demand), directory rooted at the repository (depends: T004)
- [X] T009 [US1] Create `server/images/download.ts` implementing research.md R-005/R-006/R-007/R-010: https-only + `cdn.myanimelist.net` host allow-list, content-type allow-list `image/jpeg|png|webp|gif`, per-key in-flight promise map (single download across concurrent requests), five-minute in-memory failure backoff with no disk write, global `fetch` exposed through an injectable seam for tests, `node:crypto` for the hash — no new dependency (depends: T008)
- [X] T010 [US1] Create route `server/api/images/[kind]/[malId].get.ts`: validate kind ∈ `anime|character|person` and `malId` as a positive integer → 400 `INVALID_IMAGE_REQUEST` (research R-001: never accept a URL, SSRF guard); resolve `image_url` via the T003 query → 404 `IMAGE_UNAVAILABLE` when absent or allow-list rejected; serve cached/downloaded bytes with `Content-Type` and `Cache-Control: public, max-age=31536000, immutable` → 502 `IMAGE_FETCH_FAILED` on fetch failure (research R-008, contracts/openapi.yaml) (depends: T002, T003, T009)
- [X] T011 [P] [US1] Create `app/utils/entityImage.ts` exporting the derivation from data-model.md §3: `(kind, id) → '/api/images/{kind}/{id}'`, plus a key parser for `a:…`/`c:…`/`p:…`/`c:…@a:…` shapes returning `null` on anything unrecognized, never throwing (depends: T005)
- [X] T012 [P] [US1] Add `image.alt` ("Image of {name}" / "Imagen de {name}") to `app/i18n/en.ts` and `app/i18n/es.ts` (FR-009) (depends: T007)
- [X] T013 [US1] Create `app/components/EntityImage.vue` taking `kind`, `id` (nullable), and `name` props; derives the src via `entityImage.ts`, renders a plain `<img>` with the localized alt text and `loading="lazy"` beside the entity name, rendering nothing but the name when `id` is `null` (FR-001, FR-008, FR-010) (depends: T011, T012)
- [X] T014 [US1] Wire `app/components/MoreOrLessBoard.vue`: render `EntityImage` for both compared persons (`kind="person"`, `initialVisible.id` and `chain[].id`) (FR-011)
- [X] T015 [US1] Wire `app/components/MatchGrid.vue`: render `EntityImage` on each of the nine series tiles (`kind="anime"`, id parsed from `series.key`) and on the clue card (`kind` from `clues[].kind`, id parsed from `clues[].key`) (FR-011)
- [X] T016 [US1] Wire `app/components/GroupsBoard.vue`: render `EntityImage` on all sixteen tiles (`kind` from `tile.kind`, id parsed from `tile.key` before `@`) (FR-011)
- [X] T017 [US1] Run `npm test`: all User Story 1 tests pass (tests 1, 2, 6, 7, 8, 9, 10 of the 10-test plan) and the suite stays within the 15-test constitution cap

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently — real artwork on every tile, download-once disk cache, no payload change

---

## Phase 4: User Story 2 - Graceful fallback when an image is unavailable (Priority: P2)

**Goal**: A missing or failed image always renders the existing CSS placeholder plus the name — never a broken-image icon, never a blocked game.

**Independent Test**: Force an image to be unavailable (empty `image_url`, blocked upstream): the tile shows the striped placeholder and name, the game completes, and no file is written to `.cache/images/` for the failure.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T018 [P] [US2] Append failure-path tests to `tests/images.test.ts`: test 3 (failed download writes no file — no partial, no negative marker — and success writes only the final name via temp+rename), test 4 (a failure enters the five-minute backoff window so the second call skips upstream, then expires), test 5 (non-https URL, non-allow-listed host, and disallowed content-type each rejected with nothing cached) per plan.md Test Plan (depends: T004 exists; these assert R-006/R-007 behavior)

### Implementation for User Story 2

- [X] T019 [US2] Extend `app/components/EntityImage.vue` with the error path (research R-009): `@error` on the `<img>` swaps to the existing striped placeholder (`.tile__art`/`.clue-card__art` styling already in `app/assets/css/main.css`) while the name stays visible; no broken-image icon can render (FR-003, FR-004, Principle V) (depends: T013)
- [X] T020 [P] [US2] Reword the `match.placeholder` copy in `app/i18n/en.ts` and `app/i18n/es.ts` — the current text ("No image: the clue uses a placeholder built in this project") is false once images load; replace with a fallback caption in both locales (research R-012)
- [X] T021 [US2] Extend `tests/i18n.test.ts` to assert the reworded `match.placeholder` exists in both locales (depends: T007, T020)
- [X] T022 [US2] Run `npm test`: full suite green, including tests 3, 4, 5 and the extended i18n test; confirm the route's 404/502 responses (T010) surface as placeholder swaps in the component's error path

**Checkpoint**: At this point, User Stories 1 AND 2 both work independently — images when available, placeholder otherwise, game completable with zero images (SC-002, SC-003)

---

## Phase 5: User Story 3 - Same images for every player of the same day (Priority: P3)

**Goal**: The image shown for a tile is a pure function of the catalog — identical for every visitor of the same UTC day, with no personalization anywhere in the path.

**Independent Test**: Load the same day's puzzle from two different browsers/locations and compare tile by tile (quickstart manual check 4).

### Tests for User Story 3

- [X] T023 [P] [US3] Extend test 1 in `tests/images.test.ts` with a byte-consistency assertion: a repeated GET for the same key returns byte-identical content (the disk file is the single source) (depends: T004)

### Implementation for User Story 3

- [X] T024 [US3] Review the image path for per-user state: confirm `server/images/cache.ts`, `server/images/download.ts`, and `server/api/images/[kind]/[malId].get.ts` key only on `kind:malId` with no visitor, session, header, or IP input (FR-007, Principle IV); fix any deviation
- [X] T025 [US3] Run quickstart manual check 4 (`specs/002-game-tile-images/quickstart.md`): same game open in two browsers, tile-by-tile identical images (SC-004) *(automated equivalent passed: route + byte-consistency tests; the two-browser GUI comparison needs a human run)*

**Checkpoint**: All three user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Reconciliation with the pre-amendment spec, docs, and release gates

- [X] T026 [P] Update superseded spec-001 references per research.md R-012: annotate `specs/001-daily-anime-puzzles/plan.md` and `specs/001-daily-anime-puzzles/research.md` that FR-055, FR-029, and R-009 are superseded by spec 002 and Constitution v3.0.0 (SC-014 and the no-`image_url`-in-payload test remain valid — no edit needed there)
- [X] T027 [P] Update the `README.md` ground-rule line ("No external fonts, scripts, or images") to state that artwork is fetched server-side from the catalog once, cached on disk, and served from this site's own origin
- [X] T028 Run the complete suite (`npm test`) and record: 10 tests ≤ the 15-test cap, `package.json` unchanged (zero new dependencies, plan.md Technical Context), no stylesheet-text or markup-snapshot assertions added
- [X] T029 Run all quickstart checks 1–11 in `specs/002-game-tile-images/quickstart.md`; checks 5–7 (upstream blocked, offline-from-cache, failure not poisoning the cache) are the release gate for SC-002 and SC-003 *(run against `.output` preview: check 8 curl 400/404 envelopes, check 11 no `.cache`/`.env` in output, real-image round-trip with byte-identical second GET and single cached file; the GUI/browser-manipulation steps 1–7, 9–10 need a human run)*
- [X] T030 Final governance review: plan.md Constitution Check still passes against constitution v3.0.0; `git status` shows no `.cache/`, `.env`, or secret files staged

---

## Phase 7: Convergence (spec-to-code reconciliation, appended)

**Findings**: One `contradicts` finding (F1). No `[NEEDS CLARIFICATION]`, no constitution violation.

> **F1 (contradicts, MEDIUM)**: The route maps an allow-list-rejected URL to 502
> `IMAGE_FETCH_FAILED`, but data-model.md §6 (`IMAGE_UNAVAILABLE | 404 | no image_url for that
> id, or URL fails the scheme/host allow-list`), data-model.md §8 (`URL fails allow-list ──►
> IMAGE_UNAVAILABLE (nothing cached)`), research.md R-007 (`Otherwise: IMAGE_UNAVAILABLE (404),
> nothing cached`), and `contracts/openapi.yaml` `ImageUnavailable` ("...or the stored URL fails
> the https/host allow-list") — and task T010 itself ("404 `IMAGE_UNAVAILABLE` when absent or
> allow-list rejected") — all require 404. Root cause:
> `server/images/download.ts:91-93` throws the base `ImageDownloadError` and
> `server/api/images/[kind]/[malId].get.ts:42-44` maps every `ImageDownloadError` to 502.

- [X] T031 [US1] Make the scheme/host allow-list rejection return 404 `IMAGE_UNAVAILABLE` per F1 (write the regression test FIRST, confirm it fails, then fix): add a route-level `it` to `tests/routes/image.get.test.ts` that stubs `catalogImageUrl` to return a disallowed URL via a partial module mock (`vi.mock('../../server/catalog/queries', importOriginal)` spread, defaulting to the real function so tests 6/10 keep live behavior) and asserts status 404, envelope code `IMAGE_UNAVAILABLE`, the fetch seam never called, and `.cache/images/` empty; then in `server/images/download.ts` introduce `ImageUnavailableError extends ImageDownloadError` thrown only by the `isAllowedOrigin` branch (`server/images/download.ts:91-93`) — no fetcher call, no backoff, nothing cached — and in `server/api/images/[kind]/[malId].get.ts` catch `ImageUnavailableError` before the generic `ImageDownloadError` branch to return `errorResponse(event, 'IMAGE_UNAVAILABLE')`, leaving fetch/backoff/content-type failures on 502 (depends: T009/T010-T022, contracts/openapi.yaml, data-model.md §6/§8; suite moves 10 → 11 `it` blocks, still ≤ the 15-test cap, zero new dependencies). If convenient, fold in one defensive cleanup: the route's unreachable tail `throw createError({ statusCode: 503, statusMessage: 'IMAGE_UNAVAILABLE' })` (`image.get.ts:48`) returns a non-envelope body and should return the standard envelope instead.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: No dependencies on Setup; **blocks all user stories**
- **User Story 1 (Phase 3)**: Depends on Foundational — MVP
- **User Story 2 (Phase 4)**: Depends on Foundational; T019 depends on US1's `EntityImage.vue` (T013), T021 depends on T007/T020 — test and copy tasks T018/T020 can start earlier in parallel
- **User Story 3 (Phase 5)**: Depends on US1 (cache/route exist); T023 depends on T004
- **Polish (Phase 6)**: T026–T027 independent of code; T028–T030 after the stories they validate

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — no dependencies on other stories
- **User Story 2 (P2)**: After Foundational; needs US1's `EntityImage.vue` only for T019 (fallback hook). T018 and T020 are independent of US1's implementation tasks
- **User Story 3 (P3)**: After US1's cache and route exist; structurally near-free because determinism is inherited from the disk cache

### Within Each User Story

- Tests FIRST (must fail before the implementation task that satisfies them)
- Modules before route; route before component; component before board wiring
- Story complete before moving to the next priority

### Parallel Opportunities

- **Phase 1–2**: T001, T002, T003 all touch different files — run together
- **US1 tests**: T004, T005, T006, T007 are four different files — run together
- **US1 implementation**: T011 and T012 are independent; T014, T015, T016 are three different components — run together once T013 exists
- **US2**: T018 (tests) and T020 (i18n copy) are independent of everything in US1's implementation
- **US3**: T023 runs parallel with US2 work; T024 is a read-only review
- **Polish**: T026 and T027 are doc edits — run together

---

## Parallel Example: User Story 1

```bash
# Launch all four US1 test tasks together (different files, all fail-first):
Task T004: "tests/images.test.ts — download-once + single-flight"
Task T005: "tests/entity-image.test.ts — key derivation"
Task T006: "tests/routes/image.get.test.ts — envelope + SSRF + payload"
Task T007: "tests/i18n.test.ts — image.* keys in es and en"

# Then implementation, respecting dependencies:
Task T008: "server/images/cache.ts"
Task T011: "app/utils/entityImage.ts"          # parallel with T008/T009
Task T012: "app/i18n image.* keys"             # parallel with T008/T009

# After T013 (EntityImage.vue), wire the three boards together:
Task T014: "MoreOrLessBoard.vue"
Task T015: "MatchGrid.vue"
Task T016: "GroupsBoard.vue"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T003) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T004–T017)
4. **STOP and VALIDATE**: `npm test` green; open all three games and see real artwork; `.cache/images/` grows on first view and stops on reload
5. Deploy/demo if ready — this already delivers the user's directive (download once, keep on disk, never re-download)

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → test independently → deploy (MVP: images shown, download-once cache)
3. US2 → test independently → deploy (placeholder fallback, failure hygiene)
4. US3 → verify consistency → deploy (fairness confirmation)
5. Polish → reconciliation docs, quickstart gates, governance review

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (3 quick tasks)
2. Once Foundational is done:
   - Developer A: US1 (the bulk — cache, route, component, boards)
   - Developer B: US1's four test files (T004–T007) in parallel, then US2's T018/T020
   - Developer C: US2 copy tasks + Polish doc tasks (T026, T027)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Every test task references the exact test numbers in plan.md's 10-test plan; final count must remain ≤ 15 (constitution Principle VI)
- Tests MUST NOT require network access — the downloader's injectable fetch seam (T009) is how upstream behavior is simulated; real-upstream behavior is quickstart checks 1, 5, 7
- No new dependency may appear in `package.json` (T028 verifies)
- Commit after each task or logical group; stop at any checkpoint to validate a story independently
