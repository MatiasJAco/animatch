# Data Model: Game Tile Images (Phase 1)

**Feature**: 002-game-tile-images | **Date**: 2026-10-06
**Related**: [spec.md](./spec.md), [research.md](./research.md), [plan.md](./plan.md)

## Overview

No new database tables, no changes to `daily_puzzles`, no changes to the read-only catalog.
The feature's state is: files on disk (the cache) and two small in-memory maps in the server
process.

## 1. Catalog fields read (read-only)

New allow-listed reads, all issued from `server/catalog/queries.ts` (Principle I):

| Entity | Table | New column read | Key |
|---|---|---|---|
| anime | `anime` | `image_url` | `mal_id` |
| character | `characters` | `image_url` | `mal_id` |
| person | `people` | `image_url` | `mal_id` |

Query shape per table: `SELECT image_url FROM <table> WHERE mal_id = $1` — parameterized,
ordered by nothing (single row), no other column. The existing module comment that "No
image_url ... is ever read" is reworded (research R-012).

## 2. Image cache (disk)

Directory: `.cache/images/` (gitignored, created on demand).

Filename:

```
{kind}-{malId}-{sha256(image_url)[0..16]}.{ext}
```

| Part | Values | Notes |
|---|---|---|
| `kind` | `anime` \| `character` \| `person` | matches the route param and table |
| `malId` | positive integer | catalog primary key |
| hash | first 16 hex chars of SHA-256 of the full upstream URL | URL change ⇒ new filename ⇒ fresh download (R-003) |
| `ext` | `jpg` \| `png` \| `webp` \| `gif` | derived from the validated upstream `Content-Type`, never from the URL (R-007) |

Write protocol: download to `.tmp-{kind}-{malId}-{random}` in the same directory, then
`rename` into place. Existence of the final filename is the only "already downloaded" tracker
(R-003); partial files are never readable as an image and are cleaned up on failure.

## 3. Client-side key derivation (no payload change)

Image paths are derived from data the payloads already carry (research R-002):

| Game | Payload element | Derivation | Result |
|---|---|---|---|
| Match the Series | `grid.series[].key` = `a:9001` | kind `anime`, id after `a:` | `/api/images/anime/9001` |
| Match the Series | `clues[].key` = `c:12345` / `p:678`, with `clues[].kind` | kind `character` / `person` | `/api/images/character/12345` |
| Groups | `tiles[].key` = `c:12345@a:9001`, with `tiles[].kind` | part before `@`, kind from `kind` | `/api/images/character/12345` |
| More or Less | `chain[].id`, `initialVisible.id` | kind `person`, id as-is | `/api/images/person/{id}` |

A malformed or unrecognized key yields `null`, and the tile renders its placeholder — the
derivation function never throws and never produces a request for an unknown entity type.

## 4. In-memory state (server process, not persisted)

| Map | Key | Value | Purpose |
|---|---|---|---|
| in-flight downloads | `kind:malId` | `Promise<Buffer>` | one upstream request per key across concurrent tile loads (R-005) |
| failure backoff | `kind:malId` | expiry timestamp | suppress upstream retries for 5 minutes after a fetch failure (R-006) |

Both are per-process and reset on restart; neither affects correctness — after a restart the
disk cache still serves every previously downloaded image without a network call.

## 5. Puzzle payloads and solutions: unchanged

`daily_puzzles.payload` and `daily_puzzles.solution` for all three games keep their exact
current shapes (`MoreOrLessPuzzleData`, `MatchTheSeriesPayloadData`, `GroupsPayloadData`).
No stored row becomes stale; FR-005 (puzzle identity independent of images) holds by
construction.

## 6. Error codes added to the envelope

Existing envelope shape (`{ error: { code, message } }`) gains three codes:

| Code | Status | When |
|---|---|---|
| `INVALID_IMAGE_REQUEST` | 400 | kind not in the allow-list, or `malId` not a positive integer |
| `IMAGE_UNAVAILABLE` | 404 | no `image_url` for that id, or URL fails the scheme/host allow-list |
| `IMAGE_FETCH_FAILED` | 502 | upstream download failed, timed out, or returned a disallowed content type (also returned during the 5-minute backoff window) |

`DATABASE_UNAVAILABLE` (503) is reused when the catalog lookup itself fails. All codes get
English fallback text in `server/utils/errors.ts` and existing bilingual behavior is untouched —
the browser never renders these envelopes: an `<img>` failure triggers the client-side
placeholder fallback (research R-009), so Principle V holds for players regardless.

## 7. State transitions (per image key)

```text
requested
  ├─ file exists on disk ───────────────► served (immutable cache headers)
  ├─ in flight ─────────────────────────► await shared download
  ├─ in backoff ────────────────────────► IMAGE_FETCH_FAILED (no upstream call)
  └─ otherwise
       ├─ URL fails allow-list ─────────► IMAGE_UNAVAILABLE (nothing cached)
       ├─ download ok, type ok ─────────► temp file ► rename ► served
       └─ download/type failure ────────► IMAGE_FETCH_FAILED, no file, backoff starts
```
