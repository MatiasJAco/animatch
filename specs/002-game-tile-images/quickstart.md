# Quickstart: Game Tile Images (Phase 1)

**Feature**: 002-game-tile-images | **Date**: 2026-10-06
**Related**: [spec.md](./spec.md), [plan.md](./plan.md)

## Prerequisites

- Node 22.18+
- A reachable Postgres catalog (`DATABASE_URL` in `.env`)
- Network access to `cdn.myanimelist.net` for the first fetch of each image (checks 1, 5, 7)

## Setup and run

```bash
npm install
npm run db:migrate        # no-op for this feature: no new tables
npm run dev
npm test                  # feature 002 suite, 10 tests
```

Cache inspection during checks:

```bash
ls .cache/images | wc -l    # grows as images are first fetched, never shrinks in normal use
```

## Manual checks

Each check names the success criterion or requirement it verifies.

1. **Images render in all three games.** Open More or Less, Match the Series, and Groups.
   Both More-or-Less sides, the nine series tiles, the clue card, and all sixteen Groups tiles
   show artwork next to the name text. *(FR-001, FR-002, FR-011, SC-001)*
2. **Download-once.** Note the file count in `.cache/images/`, reload the same game three times,
   then open the other games and reload them. After the first full pass the count never grows
   again for the same entities. *(R-003, user requirement)*
3. **No upstream URL leaves the server.** With devtools open on the Network tab, every image
   request goes to this site's own origin; no request goes to `cdn.myanimelist.net`, and the
   puzzle JSON contains no image URL. *(FR-005, SC-014 of spec 001)*
4. **Same images for everyone.** Open the same game in a second browser (or a private window)
   and compare tile by tile. *(FR-007, SC-004)*
5. **Cached bytes are served while offline from upstream.** After check 2, block
   `cdn.myanimelist.net` (e.g. hosts-file entry or devtools request blocking), restart the dev
   server, and reload: images still appear, because disk files are served without contacting
   upstream. *(R-003, SC-003 support)*
6. **Missing image falls back cleanly.** Temporarily point one entity's `image_url` to an empty
   string in the catalog (developer-only, revert after), reload: that tile shows the striped
   placeholder and its name — no broken-image icon, game still completable. *(FR-003, SC-002,
   SC-003)*
7. **Upstream failure falls back and does not poison the cache.** Stop network access to the
   upstream (block the host), reload a game you have not opened before: tiles show placeholders,
   `.cache/images` gains no files for the failed keys, and the server logs the failure. Unblock
   and wait past the five-minute backoff (or restart the dev server): images now load.
   *(FR-003, FR-004, R-006, SC-002, SC-003)*
8. **Bad requests are rejected.** Request `/api/images/notakind/1` and
   `/api/images/anime/-5`: both return the JSON error envelope with
   `INVALID_IMAGE_REQUEST`, and neither makes an upstream call. *(R-001, R-007)*
9. **Tiles are usable immediately.** Throttle to a slow 4G profile, hard-reload a game: names,
   tiles, and controls are visible and clickable before images finish loading; no interaction
   waits on an image. *(FR-010, SC-005)*
10. **Bilingual alt text and caption.** Switch language with the in-app control: every image's
    alt text and the placeholder caption appear in the selected language; no English-only string
    appears on a tile. *(FR-009, Bilingual UI principle)*
11. **Production build has no cache or secrets.** Run `npm run build && npm run preview`:
    `.cache/` and `.env` are absent from `.output`. *(Delivery Model)*

## Expected results summary

| After check | `.cache/images` state |
|---|---|
| 1 | ~45 files (2 + 9 + 18 + 16 entity keys for today) |
| 2 | unchanged across reloads |
| 6–7 | no files added for failed keys; no partial files ever visible |
