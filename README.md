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
boots the app and asserts, at 1920x1080, 1440x900, 1280x800, and 1024x768, that the document
never scrolls and that every primary region stays inside the viewport; it needs the catalog
database and downloads Chromium once via `npx playwright install chromium`. `@playwright/test`
is dev-only verification tooling and is never shipped.

## Layout

| Path | Holds |
|------|-------|
| `app/` | Everything the browser renders: pages, components, composables, styles, messages |
| `server/` | Everything that touches the database: API routes, generators, catalog queries |
| `migrations/` | This app's own schema changes, one file per change |
| `scripts/` | Operational scripts such as the migration runner |
| `tests/` | The automated vitest suite |
| `e2e/` | The Playwright viewport-fit gate |
| `specs/001-daily-anime-puzzles/` | Specification, plan, research, data model, contract, tasks |
| `docs/` | Reference documentation for the existing catalog |

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