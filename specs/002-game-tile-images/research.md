# Research: Game Tile Images (Phase 0)

**Feature**: 002-game-tile-images | **Date**: 2026-10-06
**Related**: [spec.md](./spec.md), [plan.md](./plan.md)

**Grounding facts** (measured against the live catalog on 2026-10-06):

- `image_url` coverage is complete: anime 7,793/7,793, people 5,335/5,335,
  characters 23,916/23,916.
- Every one of the 37,044 URLs is `https://cdn.myanimelist.net/...` and ends in `.jpg`.
- The stored puzzle payloads already carry entity identity in their keys:
  Match series `a:9001`, clue `c:12345` / `p:678`, Groups tile `c:12345@a:9001`,
  More or Less `PersonTile.id` is the person id.

## Decisions

### R-001: Images are served by a first-party route, never hotlinked

The browser requests `/api/images/{kind}/{malId}` on this site's own origin. The server resolves
the upstream URL from the catalog, downloads the bytes, caches them, and serves them.

- Rejected: embedding the upstream `cdn.myanimelist.net` URL in the puzzle payload and letting
  the browser fetch it (hotlinking). Every viewer would re-download from the CDN, the user's
  disk-cache requirement would be bypassed, and it violates SC-014 of spec 001, which stays true
  under this design: the page never requests an image from any host but its own.
- Rejected: a generic proxy that takes a URL as a query parameter — that is a server-side
  request forgery primitive (R-007 addresses the allow-list as defense in depth).

### R-002: The client derives the image path from existing payload keys

Tile keys already encode kind and id, so the image path is derived on the client
(`a:9001` → `/api/images/anime/9001`) and the puzzle payload is not modified.

- Consequence: stored `daily_puzzles` rows stay valid as-is. No regeneration, no migration, no
  serve-time augmentation, and FR-005 holds trivially — the payload bytes are unchanged, so the
  puzzle is identical with or without images.
- Rejected: adding an `image` field to the payload at generation time. Every already-stored row
  would lack it, forcing row regeneration (a manual developer action, as spec 001's plan already
  knows) or a serve-time join that re-derives per request.
- Rejected: serve-time payload augmentation — mutates stored content at read time and adds a
  per-request cost for data the client can already derive.

### R-003: File existence on disk is the download tracker

Filename: `{kind}-{malId}-{sha256(image_url).slice(0,16)}.{ext}`, stored under the cache
directory. If the file exists, it is served and never re-downloaded — exactly the user's rule.

- The URL hash in the name means an upstream URL change produces a different filename and a
  fresh download, with no revalidation traffic for unchanged URLs.
- Rejected: a tracking table in Postgres. The app owns new tables for game data; asset
  bookkeeping is not game data, and file existence already answers "downloaded?" in one
  `stat` call.
- Rejected: TTL revalidation (HEAD/If-Modified-Since). It re-contacts the upstream on every
  expiry, contradicting "don't try to download again if already exists."

### R-004: Cache lives in a gitignored runtime directory

`.cache/images/` at the repository root, added to `.gitignore`.

- Rejected: `public/` — Nuxt would treat contents as committed static assets and ship them in
  deployments, violating the Delivery Model rule that deployment artifacts exclude local
  scratch data.
- Rejected: the OS temp directory — it can be purged between restarts, which would silently
  re-enable re-downloads.

### R-005: Download on first request, deduplicated in flight

The image route downloads lazily when a tile is first rendered. Concurrent requests for the same
key share one in-flight download via a per-key promise map; the response is written to a temp
file and atomically renamed into place, so a partial file can never be served.

- Rejected: eager prefetch during puzzle generation. Generation runs inside the create-once
  transaction (spec 001 R-005); putting network I/O in that path couples puzzle creation to
  upstream availability and risks a first-request failure for reasons unrelated to the puzzle.
- Prefetch after generation, fire-and-forget, remains a possible later optimization; it is not
  needed for v1 because the first player to view a board simply triggers the download.

### R-006: Failures return a structured error and are never written to disk

An upstream failure produces `IMAGE_FETCH_FAILED` (502), writes no file (so a later request can
succeed), and is remembered in an in-memory per-key backoff for five minutes so a dead upstream
is not hammered once per page view. The backoff resets on restart, which makes the failure
self-healing.

- Rejected: a permanent failure marker on disk — it would outlive the outage and require manual
  cleanup.
- Rejected: no backoff at all — every page view would re-attempt every failed image.

### R-007: Scheme, host, and content-type allow-lists

A download is attempted only when the catalog URL is `https://`, the host is
`cdn.myanimelist.net`, and the upstream response `Content-Type` is one of `image/jpeg`,
`image/png`, `image/webp`, `image/gif`. Otherwise: `IMAGE_UNAVAILABLE` (404), nothing cached.

- The host allow-list is defense in depth against a poisoned catalog row turning the route into
  an SSRF gadget; the measured catalog matches it at 100%.
- The content-type allow-list stops an HTML or script response from ever being served with an
  image content type on this origin.

### R-008: Cached responses are immutable

The response carries `Content-Type` from the validated upstream header and
`Cache-Control: public, max-age=31536000, immutable`. The filename already binds the bytes to a
URL hash, so the browser never needs to revalidate.

### R-009: Images are progressive enhancement with a visible fallback

Each tile renders name text immediately; the image loads alongside it. On error the component
swaps to the existing CSS placeholder — never a broken-image icon, never an empty region
(Principle V, FR-003). Alt text comes from the message catalog in both locales (FR-009).
Images never gate interactivity (FR-010, SC-005).

### R-010: No new dependency

Node 22 built-ins only: global `fetch` for downloading, `node:fs/promises` for the cache,
`node:crypto` for the URL hash. Nothing is added to `package.json`, so Principle VI's
approval-by-name requirement is not triggered.

### R-011: Coverage makes SC-001 achievable without new data work

Measured coverage is 100%, well above SC-001's 95% threshold. The gap between 95% and 100% is
absorbed by transient fetch failures, which fall back per R-009. No image sourcing work is in
scope (spec Assumptions).

### R-012: Reconciliation with spec 001 (carried to `/speckit.tasks`)

Spec 001 encoded the pre-amendment no-images stance. Under Constitution v3.0.0 and spec 002 the
following must be updated when implementing, not before:

| Spec 001 item | Disposition |
|---|---|
| FR-055 (no external artwork) | Superseded by spec 002 FR-001 |
| FR-029 (CSS placeholder only, room for art later) | Placeholder retained as fallback only (spec 002 FR-003); real images now load |
| SC-014 (no request to any host but our own) | Stays TRUE: the browser only requests our origin (R-001) |
| R-009 in research.md (hotlinking rejected, needed amendment) | Amendment happened: Constitution v3.0.0; superseded by R-001 here |
| `server/catalog/queries.ts:39-41` comment ("No image_url ... is ever read") | Reworded: image_url is read by the new allow-listed queries |
| `match.placeholder` copy ("No image: ...") | Reworded to a fallback caption in both locales |
| `tests/routes/puzzle.get.test.ts:132` (served payload contains no `image_url`) | Stays green — payloads still carry no upstream URL (R-002) |
