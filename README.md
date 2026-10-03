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

## Test

```bash
npm test
```

Vitest, capped at 15 tests for the whole feature, with no network access required.

## Layout

| Path | Holds |
|------|-------|
| `app/` | Everything the browser renders: pages, components, composables, styles, messages |
| `server/` | Everything that touches the database: API routes, generators, catalog queries |
| `migrations/` | This app's own schema changes, one file per change |
| `scripts/` | Operational scripts such as the migration runner |
| `tests/` | The automated suite |
| `specs/001-daily-anime-puzzles/` | Specification, plan, research, data model, contract, tasks |
| `docs/` | Reference documentation for the existing catalog |

## Ground rules

- The catalog is read-only. `import_state` and `import_runs` are never read or written.
- No account, no session, no server-side record of a visitor. Progress lives in the visitor's own
  browser storage.
- The day is a UTC date and rolls over at 00:00 UTC. The browser's timezone is used only to display
  times.
- Original names, copy, layout and assets. No external fonts, scripts, or images.