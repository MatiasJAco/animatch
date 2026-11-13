# Source artwork

The original artwork this project ships, committed so every processed asset can be traced back to
the file it was derived from. This directory lives at the repository root, **outside `public/`**, so
nothing here is reachable by a visitor's browser: `public/` is the only directory the app serves,
and a request for `/artwork/sources/matchi-spring.jpg` returns 404 (FR-022, SC-011).

## The five sources

| File | What it is | Intrinsic size | Derived asset |
|------|------------|----------------|---------------|
| `matchi-board.png` | Matchi, the character, standing on a plain light backdrop | 1152x1712 | `public/artwork/matchi-mascot.webp` |
| `matchi-spring.jpg` | Matchi in the spring scene | 832x1248 | `public/games/match-the-series-spring-2026.webp` |
| `matchi-summer.jpg` | Matchi in the summer scene | 832x1248 | `public/games/match-the-series-summer-2026.webp` |
| `matchi-autumn.jpg` | Matchi in the autumn scene | 832x1248 | `public/games/match-the-series-autumn-2026.webp` |
| `matchi-winter.jpg` | Matchi in the winter scene | 832x1248 | `public/games/match-the-series-winter-2026.webp` |

The names are the delivered names, kept unchanged. The winter scene is processed and stored beside
the other seasonal assets but is mapped to no game: it is reserved for a future edition and is
never requested by the home page (FR-020).

## The format is detected from the content, never from the extension

`matchi-board.png` carries **JPEG data under a `.png` name**. The file was delivered that way, so
the name stays as delivered and every tool in the pipeline reads the format from the file's bytes
rather than from its suffix (research R-001). Do not "fix" the extension and do not trust it: a
tool that picks its decoder by suffix will silently mis-decode the mascot source.

## Each source has exactly one derived asset

The mapping is one-to-one in both directions: five sources, five processed assets, no source
without a derivative and no derivative without a source. The two other shipped illustrations,
`public/games/more-or-less.svg` and `public/games/groups.svg`, are pre-existing files with no
source artwork — this feature does not process them.

## Regenerating and checking the processed assets

```bash
npm run artwork:build     # python3 scripts/artwork/build.py — rebuild the processed assets
npm run artwork:check     # python3 scripts/artwork/check.py — verify them against the sources
```

The tooling is **Python 3 with Pillow 12.x**, approved by the project owner on 2026-11-13 and used
at build time only: it is not an npm dependency, the app never imports it, and the processed assets
are committed, so the app builds, runs, and deploys without it (FR-033, Constitution VI).

The build is deterministic — fixed crop windows, fixed resampling filter, fixed encoder settings —
so `python3 scripts/artwork/check.py --rebuild` regenerates each asset into a temporary directory
and compares the bytes, which proves every committed file really is the derivative the pipeline
defines.
