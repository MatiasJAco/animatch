# Animatch

Daily anime puzzles in the browser: three short games about voice actors, characters and series,
one puzzle per game per UTC day, played without an account.

v1 scope and requirements: [specs/001-daily-anime-puzzles/spec.md](specs/001-daily-anime-puzzles/spec.md).
Technical plan: [plan.md](specs/001-daily-anime-puzzles/plan.md).
Tasks: [tasks.md](specs/001-daily-anime-puzzles/tasks.md).

## Prerequisites

- Node.js 22.18 or newer
- PostgreSQL 13 or newer holding the read-only catalog (`people`, `anime`, `characters`,
  `voice_roles`, `anime_seasons`); see [docs/catalog-schema.sql](docs/catalog-schema.sql)

## Setup

```bash
npm install
cp .env.example .env      # then set DATABASE_URL
```

`.env` is gitignored and must never be committed. `.env.example` carries only an empty
placeholder.

## Database

```bash
npm run db:migrate
```

Applies every file in `migrations/` in filename order, each in its own transaction. The only table
this app creates is `daily_puzzles`; the catalog is owned elsewhere and is never written to.

## Run

```bash
npm run dev
```

One process serves the pages and the API. The browser never talks to the database: puzzle and
catalog data reach it as JSON from this app's own endpoints.

### Development-only reset

Every game screen shows a control back to the home page, plus a **Reset** button that only exists
in a development build. It clears that one game's saved state for the current UTC day in your own
browser storage, so you can replay today's puzzle without a reload. It makes no request and writes
nothing on the server, which is why it cannot change the puzzle anyone else is given, and why it is
absent from `npm run build` output. To discard a puzzle the *server* already stored, delete its
`daily_puzzles` row yourself; see [tasks.md](specs/001-daily-anime-puzzles/tasks.md).

## Test

```bash
npm test              # vitest unit/integration suite (no network required)
npm run test:viewport # Playwright viewport-fit gauge (needs DATABASE_URL + a browser)
```

Vitest is capped at 15 tests per feature and requires no network access. `npm run test:viewport`
boots the app and asserts, at 1920x1080, 1440x900, 1280x800, and 1024x768, that each game screen is
board-first (the board is the first region, then the actions, then the status/how-to-play copy), that
the title and Home/Reset share one row, and that no screen overflows horizontally. Vertical scrolling
is allowed so the secondary copy can sit below the fold. The gate needs the catalog database and
downloads Chromium once via `npx playwright install chromium`; `@playwright/test` is dev-only
verification tooling and is never shipped.

## Layout

| Path | Holds |
|------|-------|
| `app/` | Everything the browser renders: pages, components, composables, styles, messages |
| `public/games/` | The artwork shown on each home game card: one image file per game |
| `public/artwork/` | The Matchi mascot shown on the home screen and the five game screens |
| `artwork/sources/` | The committed source artwork the shipped images were derived from; never served |
| `server/` | Everything that touches the database: API routes, generators, catalog queries |
| `migrations/` | This app's own schema changes, one file per change |
| `scripts/` | Operational scripts such as the migration runner and the artwork pipeline |
| `tests/` | The automated vitest suite |
| `e2e/` | The Playwright viewport-fit gate |
| `specs/001-daily-anime-puzzles/` | Specification, plan, research, data model, contract, tasks |
| `docs/` | Reference documentation for the existing catalog |

## Home game artwork

Each home card uses exactly one image file from `public/games/`. The file names match the game
route slugs, and `app/utils/gameArt.ts` maps each game to its path. To replace an image, overwrite
the matching file; no component or CSS change is needed. If you rename the file, update the
one-line mapping. A missing or broken image falls back to the neutral card placeholder.

The three Match the Series cards carry seasonal artwork as processed WebP files
(`match-the-series-spring-2026.webp`, `match-the-series-summer-2026.webp` and
`match-the-series-autumn-2026.webp`, each 800x450). Each one frames the character from the crown
of the head down to the waist at its own scale, with a blurred continuation of the same scene in
the lateral margins. The More or Less and Groups cards keep their
original SVG illustrations. `public/artwork/matchi-mascot.webp` is the Matchi mascot that floats
over the home screen and the five game screens; it is decorative, adds no focus stop and never
intercepts a click. It is the same mascot everywhere: one file, one size rule and one corner — the
viewport's bottom inline-end corner — on the home screen and on every game screen, in every state
a game screen can be in (loading, playing, finished and puzzle-unavailable). On viewports of 1024
pixels and wider it fills 80 % of the free column to the right of the centered catalog, and below
that it scales down with the viewport. See
[specs/014-game-mascot/contracts/game-mascot.md](specs/014-game-mascot/contracts/game-mascot.md).

Known limitation, accepted by the project owner on 2026-11-14: below 1024 pixels the game screen's
column reaches the window's edge, so the mascot floats over the board's bottom inline-end region and
may visually cover tile artwork, labels, counts, the More/Fewer buttons and the status copy. What it
never does is change the layout, swallow a click, add a scrollbar, or remove, hide or truncate any
text: every control beneath it still answers clicks and taps, and the covered content can be
scrolled out from under it. The overlap is a recorded limitation, not a defect to engineer away —
resizing or moving the mascot would break "the same mascot everywhere".

Known limitation, accepted by the project owner on 2026-11-13: at 200% browser text zoom the
mascot overlaps card text at viewports narrower than about 1024 pixels, because a wrapped
card-summary line reaches the corner the mascot occupies and no single size token is both wide
enough to be legible at 320 pixels and narrow enough to clear the text at 480 pixels. At the
default text size no card text is covered at any tested viewport. See
[specs/013-home-artwork/contracts/home-mascot.md](specs/013-home-artwork/contracts/home-mascot.md) §5.

`artwork/sources/` holds the original artwork the shipped images were derived from — the seasonal
scenes and the mascot. It sits outside `public/`, so it is never served: the sources are a project
record, and every shipped file is a smaller, re-encoded derivative of exactly one of them. The
file format is always detected from the content, never from the extension.

To regenerate or re-check the processed assets you need Python 3 with Pillow 12.x:

```bash
npm run artwork:build            # python3 scripts/artwork/build.py — rebuild from artwork/sources/
npm run artwork:check            # python3 scripts/artwork/check.py — verify them against the sources
npm run artwork:check -- --rebuild   # also rebuild into a temporary directory and compare the bytes
```

Pillow is a build-time tool only: it is not an npm dependency, the app never imports it, and the
processed assets are committed, so building, running and deploying the app never needs it.

## Ground rules

- The catalog is read-only. `import_state` and `import_runs` are never read or written.
- No account, no session, no server-side record of a visitor. Progress lives in the visitor's own
  browser storage.
- The day is a UTC date and rolls over at 00:00 UTC. The browser's timezone is used only to display
  times.
- Original names, copy, layout and assets. No external fonts or scripts. Game-tile artwork is
  fetched once from the catalog (`cdn.myanimelist.net`) by our own server, cached on disk under
  `.cache/images/`, and served forever from this site's origin via `/api/images/{kind}/{malId}` —
  the browser never talks to any third-party host.