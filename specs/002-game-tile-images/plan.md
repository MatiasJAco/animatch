# Implementation Plan: Game Tile Images

**Branch**: `feat/image-management` | **Date**: 2026-10-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-game-tile-images/spec.md`

## Summary

Every puzzle tile and clue card shows the artwork of the entity it names — the anime series,
character, or voice actor — and the artwork is downloaded from the catalog's `image_url` on
first use, kept on disk, and never downloaded again while the file exists. Delivery is
first-party: the browser asks this site's own `/api/images/{kind}/{malId}` route, the server
resolves the upstream URL from the read-only catalog, enforces a scheme/host allow-list,
downloads once per key (concurrent requests share one download), writes atomically, and serves
the cached bytes with immutable cache headers. The puzzle payload is untouched: image paths are
derived on the client from entity keys the payloads already carry, so stored `daily_puzzles`
rows stay valid, puzzle identity is independent of images (FR-005), and every failure path
falls back to the existing CSS placeholder with bilingual alt text — never a broken icon, never
a blocked game.

**Technical approach** (details in [research.md](./research.md)): file existence plus a URL
hash in the filename is the download tracker (R-003); a per-key in-flight promise map and
temp-file-plus-rename give single-flight, atomic caching (R-005); `https` +
`cdn.myanimelist.net` + content-type allow-lists neutralize SSRF and wrong-type responses
(R-007); a five-minute in-memory failure backoff with no disk write keeps outages
self-healing (R-006).

The user's directive in this session — download from the database URL, keep on disk, track
after first download, never re-download an existing file — is the R-003/R-005 core of this
plan.

## Technical Context

**Language/Version**: TypeScript on Node.js 22 (Nuxt 3 runtime); Node 22 provides global
`fetch`

**Primary Dependencies**: unchanged from spec 001: `nuxt` ^3, `pg`, `vitest` (dev). **No new
dependency** — `node:fs/promises`, `node:crypto`, and global `fetch` are built-ins, so
Principle VI's approval-by-name gate is not triggered (R-010).

**Storage**: PostgreSQL read-only catalog gains reads of one existing column per table
(`anime.image_url`, `characters.image_url`, `people.image_url`). No new tables, no migration,
no change to `daily_puzzles`. New state: files under `.cache/images/` (gitignored runtime
data) and two in-process maps.

**Testing**: `vitest`, 10 new tests (cap: 15), no network access in tests — the downloader
takes an injectable fetch seam; real-upstream behavior is covered by quickstart manual checks
1, 5, 7.

**Target Platform**: Linux or macOS server, Node 22. Evergreen browser, phone or desktop.
Browser requests only this site's origin (spec 001 SC-014 stays true).

**Project Type**: Web application (SSR frontend and API in one process)

**Performance Goals**: Tiles and controls render without waiting for images (FR-010, SC-005:
usable within 2 seconds on typical connections). First view of an entity triggers one upstream
download; every later view is a disk read. Today's boards reference at most ~45 distinct
entities (2 + 9 + 18 + 16), so the per-day cache footprint is roughly 45 files.

**Constraints**: Read-only catalog — `SELECT image_url` only, allow-listed columns, one module
(Principle I). Browser never sees the DB or the upstream URL (Principle II). Puzzle bytes
unchanged, images add no answer, no personalization (Principles III, IV, FR-005, FR-007).
Every image failure renders the placeholder (Principle V, FR-003). No new package
(Principle VI). Constitution v3.0.0 authorizes third-party artwork; no `Wordle` token, no
Futbol11 copying. Bilingual alt/caption strings via the message catalog. Deployment artifacts
exclude `.cache/` and `.env`.

**Scale/Scope**: One new GET route, one shared client component, three boards wired to it,
three new catalog reads, three new error codes, 10 tests, 11 manual checks. No payload change,
no migration, no home-page changes (spec Assumptions).

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1 design. Against constitution v3.0.0.*

| Principle / rule | How the plan satisfies it |
|---|---|
| I. Read-Only Catalog Ownership | Three new hand-written `SELECT image_url ... WHERE mal_id = $1` queries, all inside `server/catalog/queries.ts`, the single review point. No writes, no DDL, no import tables. Cache files are app-owned runtime data, not catalog state |
| II. API/UI Separation | The browser holds no DB access and no upstream URL — it only requests `/api/images/...` on its own origin. `DATABASE_URL` stays server-side; `.env` stays gitignored |
| III. One Deterministic Puzzle per UTC Day | Payloads and solutions are byte-for-byte unchanged (data-model §5); images are presentation derived from stored keys and cannot alter which puzzle is served (FR-005). No timezone input anywhere in the feature |
| IV. Stateless v1 | No accounts, no sessions, no player state added. The disk cache is an asset memo keyed by catalog data, not by player, and is identical for every visitor (FR-007) |
| V. Fail Visible, Never Blank | `<img>` failure swaps to the existing CSS placeholder with bilingual alt (R-009); the route returns the standard envelope with stable codes; quickstart checks 6–7 prove no broken icon and a completable game (FR-003, FR-004) |
| VI. Lean Tests, Approved Dependencies Only | 10 tests ≤ the 15 cap; zero new packages (Node built-ins only, R-010); no stylesheet-text or markup-snapshot assertions; no essay comments |
| Naming and Originality | v3.0.0 removed the originality/licensing constraint, authorizing catalog artwork (spec Assumptions). Remaining rules hold: no `Wordle` token, nothing copied from Futbol11; alt/caption copy is the project's own |
| Bilingual UI | New `image.*` message keys exist in `es` and `en` from the first commit; an i18n completeness test enforces it (FR-009) |
| Delivery Model | `.cache/` is gitignored runtime data and excluded from `.output`; no native build, no new toolchain for the player |

**Complexity Tracking**: no violations, so nothing to justify.

## Project Structure

### Documentation (this feature)

```text
specs/002-game-tile-images/
├── plan.md                 # This file
├── spec.md                 # Feature specification
├── research.md             # Phase 0: 12 decisions, catalog measurements, spec-001 reconciliation
├── data-model.md           # Phase 1: cache layout, key derivation, in-memory state, error codes
├── quickstart.md           # Phase 1: run commands, 11 manual checks
├── checklists/
│   └── requirements.md     # Spec quality checklist (all items pass)
└── contracts/
    └── openapi.yaml        # The image route and its envelope codes
```

### Source Code (repository root)

Delta against the current tree — new files marked `+`, changed files `~`:

```text
~ .gitignore                                   # + .cache/
~ server/
│  ├── api/images/[kind]/[malId].get.ts   +    # GET, validate, resolve, cache, serve
│  ├── images/
│  │   ├── cache.ts                        +    # filename scheme, stat, atomic write
│  │   └── download.ts                     +    # allow-lists, single-flight, backoff, fetch seam
│  ├── catalog/queries.ts                  ~    # + 3 image_url reads; module comment reworded
│  ├── utils/errors.ts                     ~    # + IMAGE_UNAVAILABLE, IMAGE_FETCH_FAILED,
│  │                                            #   INVALID_IMAGE_REQUEST codes + statuses
│  └── (puzzle routes, generators, db/ untouched)
~ app/
│  ├── components/
│  │   ├── EntityImage.vue                 +    # img + alt + error -> placeholder fallback
│  │   ├── MoreOrLessBoard.vue             ~    # render EntityImage for both sides
│  │   ├── MatchGrid.vue                   ~    # series tiles + clue card render EntityImage
│  │   └── GroupsBoard.vue                 ~    # 16 tiles render EntityImage
│  ├── utils/entityImage.ts                +    # key/id -> image path, null on unknown shape
│  └── i18n/
│     ├── en.ts                             ~    # + image.* keys; reword match.placeholder
│     └── es.ts                             ~    # same keys in Spanish
~ tests/
│  ├── images.test.ts                       +    # cache: download-once, single-flight, atomicity,
│  │                                            #   allow-lists, backoff, no-partial-file
│  ├── entity-image.test.ts                 +    # key derivation across the three payload shapes
│  ├── i18n.test.ts                         +    # image.* keys present in both locales
│  └── routes/image.get.test.ts             +    # route: 200/400/404/502 envelope, SSRF guard
~ docs/catalog-schema.sql                    # existing, read-only reference (image_url already listed)
```

**Structure Decision**: single Nuxt application, unchanged. The image route lives under
`server/api/`, the download/cache logic under a new `server/images/` module so the network and
filesystem surface is reviewable in one place, and all catalog reads stay in
`server/catalog/queries.ts` so Principle I keeps exactly one review point. The browser gains a
single shared `EntityImage.vue` used by all three boards, so the placeholder-fallback rule
(PRINCIPLE V) is implemented once instead of three times.

## Design Artifacts

| Artifact | Contents |
|----------|----------|
| [research.md](./research.md) | 12 decisions: first-party route vs hotlink, client-side key derivation vs payload change, disk-existence tracking vs DB manifest, cache location, single-flight atomic download vs prefetch, failure backoff, host/content-type allow-lists, immutable caching, progressive fallback, zero dependencies, measured 100% coverage, spec-001 reconciliation table |
| [data-model.md](./data-model.md) | Catalog columns read, cache filename scheme and write protocol, per-game key derivation table, in-memory maps, unchanged payloads, three new error codes, per-key state transitions |
| [contracts/openapi.yaml](./contracts/openapi.yaml) | `GET /api/images/{kind}/{malId}` with 200/400/404/502/503, content-type enum, envelope schema |
| [quickstart.md](./quickstart.md) | Setup plus 11 manual checks tied to FRs and SCs, cache-state expectations |

## Key Design Points

**Why the payload never mentions images.** Keys like `a:9001` and `c:12345@a:9001` already
carry kind and id, so the client derives `/api/images/anime/9001` itself. Stored rows keep
their exact shape, FR-005 holds by construction, and no row ever needs regeneration (R-002).
This also keeps spec 001's test "served payload contains no `image_url`" green.

**Why file existence is the tracker.** The user's rule is "if it already exists, don't try to
download again." A `stat` on `{kind}-{id}-{urlhash}.jpg` answers that in one call, needs no
table, and self-invalidates when upstream changes the URL because the hash changes (R-003).

**Why download-on-demand beats prefetch.** Generation runs inside the create-once transaction;
network I/O there would couple puzzle creation to CDN availability. Lazily fetching on first
view keeps generation pure and still ends with the same permanent disk cache (R-005).

**Why failures write nothing.** A poisoned failure file would outlive the outage. The failure
lives in memory for five minutes — long enough to stop hammering a dead upstream during a
single browsing session, short enough to self-heal without operator action (R-006).

**Why an allow-list instead of trusting the catalog.** The route fetches a URL the database
chose; if a catalog row were ever poisoned, an open fetcher becomes an SSRF gadget. Requiring
`https://cdn.myanimelist.net/` matches 100% of measured rows and costs nothing (R-007).

**Why the placeholder stays.** Coverage is 100% today, but Principle V and FR-003 require a
visible, non-blank failure path for every fetch that can still fail tomorrow. The existing CSS
art is reused rather than replaced, so `EntityImage` is a strict superset of current behavior
(R-009).

## Test Plan (10 tests, within the 15-test cap)

| # | Test file | Proves |
|---|-----------|--------|
| 1 | images.test.ts | first request downloads once; an immediate second request serves from disk with zero upstream calls | R-003, R-005, user directive, SC-001 support |
| 2 | images.test.ts | N concurrent requests for one key produce exactly one upstream call and all receive bytes | R-005 |
| 3 | images.test.ts | failed download writes no file (no partial, no negative marker); success writes only the final name via temp+rename | R-005, R-006, SC-002 |
| 4 | images.test.ts | a failure enters the backoff window (second call skips upstream) and expires | R-006 |
| 5 | images.test.ts | non-https URL, non-allow-listed host, and disallowed content type are each rejected with nothing cached | R-007, SC-003 |
| 6 | routes/image.get.test.ts | 200 for a cached image; 400 `INVALID_IMAGE_REQUEST` for bad kind/id (SSRF guard: no request is made); 404 `IMAGE_UNAVAILABLE` for a missing URL; envelope shape matches the contract | FR-002, R-001, R-007, contracts |
| 7 | routes/image.get.test.ts | served puzzle JSON is unchanged by the feature — no image fields, no upstream URLs | FR-005, FR-007 |
| 8 | entity-image.test.ts | key/id → path derivation for all three payload shapes, and `null` (placeholder, no request) for malformed input | FR-001, FR-011, FR-003 |
| 9 | i18n.test.ts | every new `image.*` key exists in both `es` and `en`, and `match.placeholder` was reworded in both | FR-009 |
| 10 | routes/image.get.test.ts | catalog image reads are SELECT-only and parameterized by id; no URL parameter is accepted anywhere | Principle I, R-001 |

No browser end-to-end. No network in tests (injectable fetch seam). SC-002, SC-003, SC-004,
SC-005, and SC-006 are verified by quickstart manual checks 1–9, 11 — the interactive and
upstream-dependent halves, which the constitution's no-network test rule keeps out of the
suite. Spec 001's read-only SQL test continues to cover generation; test 10 extends the same
claim to the new image reads.

## Reconciliation with spec 001 (carried to `/speckit.tasks`)

Constitution v3.0.0 superseded the no-images stance; implementation must update, in the same
change: the `server/catalog/queries.ts` module comment, the `match.placeholder` copy in both
locales, and the spec-001 plan/research references (FR-055, FR-029, R-009) noted in research
R-012. SC-014 stays true and needs no edit; the payload test (spec 001 test 3 and
`puzzle.get.test.ts:132`) stays green. No stored rows are affected.

## Next Steps

1. Run `/speckit.tasks` to derive the implementation task list. Plan-level choices to carry
   there: the downloader exposes an injectable `fetch` (test seam, no mocking library); the
   five-minute backoff is a constant next to the cache module; `EntityImage.vue` takes
   `kind`, `id` (or `null`), and `name` props and owns both the `<img>` and the fallback.
2. After implementation, run quickstart checks 1–11; checks 5–7 need a reachable upstream and
   a deliberate block, so they are the release gate for SC-002/SC-003.
3. Spec 002 has no `[NEEDS CLARIFICATION]` markers and its checklist is fully passing;
   `/speckit.clarify` is optional before tasks.
