<!-- SYNC IMPACT REPORT (temporary; delete before committing)
Version change: 2.0.0 -> 2.1.0
Bump rationale: MINOR. Principle III is expanded with two obligations (UTC as the only project
timezone; browser timezone restricted to display formatting), and the bilingual locale rule drops
its regional pin. The day key was already UTC and stays UTC, so no date maps to a different day
key and no principle is removed or redefined incompatibly. Prior v1.0.0 -> v2.0.0 was the MAJOR
step that moved the day key off a regional zone onto UTC.
Modified principles:
  - III. One Deterministic Puzzle per UTC Day (expanded: UTC-only rule + browser-display-only rule)
  - Additional Constraints, Bilingual UI (regional locale pin removed)
  - Development Workflow and Quality Gates (one gate added, one gate expanded)
  - Governance, versioning policy (timezone change named as a MAJOR trigger)
Added sections: none
Removed sections: none
Follow-up TODOs: none. The prior regional timezone reference is now absent from this document
  entirely, including this report. No puzzle rows exist yet (no application code in the repo), so
  no data migration is required.
-->

# Animatch Constitution

## Core Principles

### I. Read-Only Catalog Ownership
The pre-existing catalog in Postgres (`people`, `anime`, `characters`, `voice_roles`,
`anime_seasons`) is owned by other systems and is read-only for this app.

- Reads of the catalog tables are allowed; writes, DDL, migrations, triggers, indexes, and
  constraint changes against them are forbidden.
- `import_state` and `import_runs` are import-job bookkeeping. This app MUST NOT read or write
  them, including for debugging or health checks.
- Game, user, and history tables do not exist yet. This app creates and owns only its own new
  tables; every column and index it needs in game data MUST be materialized into those tables
  rather than derived from changes to catalog schema.
- Any feature that would require a catalog write or schema change is out of scope and must be
  raised as a constitution amendment, not implemented.

Rationale: the catalog is a shared asset of record. Silent writes or schema drift would corrupt
other consumers and make import replays non-reproducible.

### II. API/UI Separation
The browser never talks to Postgres, directly or indirectly.

- All data access MUST flow through a server-side HTTP API; the UI holds no database driver,
  connection string, query, or credential.
- Database credentials are runtime configuration supplied by the environment (for example
  `DATABASE_URL`) and MUST NOT be committed to git in any form, including `.env` files, fixtures,
  test helpers, CI files, and documentation.
- The API owns validation, authorization-free session handling, and response shaping; the UI
  owns rendering and local interaction state only.
- CORS, host, and CORS-less same-origin serving are the API owner's responsibility; a browser
  failure to reach the API MUST be handled per Principle V.

Rationale: keeping the database one hop behind the API is what makes the read-only catalog
boundary enforceable and reviewable, and it is the only place credentials are ever needed.

### III. One Deterministic Puzzle per UTC Day
Exactly one puzzle exists per game per calendar day, and the same date always yields the same
puzzle.

- UTC is the only project timezone. All server-side time computation, storage, comparison, and
  API representation of dates and timestamps MUST be UTC. No other timezone, locale, or region
  is referenced anywhere in the app, its data, its configuration, or its copy.
- The canonical day key MUST be derived in UTC, never in the viewer's local timezone or the
  server's default timezone. The day rolls over at 00:00 UTC.
- The day's puzzle rows MUST be persisted in this app's own game tables, keyed by game and day.
  Selection is therefore read-then-write, never recomputed per request.
- The first request for a date MUST create the puzzle atomically (unique constraint on
  game + day); concurrent first requests MUST yield the same puzzle row, never duplicates or a
  random alternative.
- Puzzle generation MUST be deterministic given the game, the day key, and the catalog state.
  Non-deterministic inputs (randomness, `NOW()`, sequence ordering) MUST NOT leak into stored
  puzzle content.
- Re-requesting the same date MUST return the identical puzzle for every visitor, with no
  reshuffle, no personalization, and no regeneration path.
- The browser's timezone MUST NOT influence which puzzle is served. Every visitor anywhere plays
  the same puzzle for the same UTC day, including a visitor whose local date already differs
  from the UTC date.
- The browser's timezone MUST be used only to render time for the player: displayed dates, clock
  times, and countdowns to the next rollover. Formatting MUST come from the platform's
  internationalization APIs rather than hand-rolled offsets.
- A displayed time that is ambiguous without a zone (for example "starts in 3h") MUST show the
  player's own zone, and MUST NOT be computed from a hardcoded offset or a country or city
  setting.

Rationale: shared, stable daily content is what makes the game comparable between players and
what allows the client to store today's result without a server-side session. UTC is chosen as
the single authority because it is timezone-stable and server-independent, while localizing
display to the browser keeps the experience legible for the player wherever they are.

### IV. Stateless v1 (No Accounts, Client-Side Result)
v1 has no identity layer.

- No login, signup, session cookie, OAuth, or user table in v1. Server endpoints MUST NOT require
  or create player identity.
- Today's result, and only today's result, is stored on the client (for example `localStorage`)
  under a key namespaced by game and day key.
- The client MUST NOT be trusted for scoring or for anything else the server asserts; any
  future stat-sharing, streak, or history feature requires a new amendment plus its own tables.
- Losing or clearing client storage MUST degrade to a playable, empty-state game, never to an
  error or a blocked page.

Rationale: identity is the single largest source of complexity, privacy, and abuse surface in a
daily puzzle. Deferring it keeps v1 shippable and keeps the catalog boundary simple.

### V. Fail Visible, Never Blank
Every failure path MUST render something a player can read and act on.

- If the database is unavailable, the query fails, or the API returns an error, the page MUST
  show an explicit error state in both supported languages. A blank page, blank game board,
  spinner that never resolves, or silent console-only error is a defect.
- Error states MUST name what failed (data unavailable vs. network vs. unexpected) and MUST
  offer a retry path.
- The API MUST return a structured error response (machine-readable `code` plus a safe message);
  it MUST NOT leak connection strings, SQL, stack traces, or internal hostnames to the client.
- Errors MUST be logged server-side with enough context to diagnose the failure.
- Frontend code MUST NOT swallow failures with empty `catch` blocks that render nothing.

Rationale: a daily game with no server session has only one chance to explain itself; silence
reads as a broken site and destroys trust instantly.

### VI. Lean Tests, Approved Dependencies Only
Test volume is capped and the dependency surface is frozen by default.

- No new library, package, or framework may be added unless the plan for that feature names it
  explicitly and the project owner approves it by name in writing.
- A feature's automated test suite MUST NOT exceed 15 tests. Tests MUST cover behavior, not
  trivia; if the cap is hit, consolidate cases rather than adding more.
- Tests MUST NOT assert against stylesheet source text, CSS class string contents, or markup
  snapshots. Assertions target observable behavior and rendered output semantics.
- Source files MUST NOT contain essay-length comments or multi-paragraph rationale blocks. Code
  states what it does; non-obvious governance rationale lives in this constitution.
- Test code MUST contain no real credentials and MUST not require network access to pass.

Rationale: a small catalog and a fixed runtime shape do not justify a large framework tree or an
exponential test suite. Caps keep review cost proportional to product value.

## Additional Constraints

### Naming and Originality
- The product name, every URL path, and all user-facing UI text MUST NOT contain the literal token
  `Wordle`, in any casing or language variant. The project name is "Animatch".
- Branding, copy, layout, visual structure, and assets MUST NOT be copied from Futbol11 or any
  other puzzle site. Third-party anime data (MyAnimeList identifiers) may be referenced as data,
  never as presentation.
- All artwork, fonts, and visual assets MUST be original, properly licensed, or generated in
  project. No hotlinking and no scraped images.
- Identifiers taken from the catalog (for example `mal_id`) are data references and MUST NOT
  appear in marketing copy or UI chrome.

### Bilingual UI (Spanish and English)
- Every user-facing string MUST exist in both Spanish (`es`) and English (`en`) from the first
  commit that introduces it; a partially translated UI is a defect.
- User-facing strings MUST be referenced through a message catalog, never inlined in components
  or markup, so both locales stay complete and testable.
- The initial locale is `es`; no country, region, or timezone variant of a locale is pinned
  anywhere. Locale selection MUST NOT change which puzzle or day key is served, and the UI MUST
  NOT offer a region or timezone setting (Principle III is locale-independent).
- Code, identifiers, catalog column names, and API payload keys MUST use English and
  MUST NOT be localized.

### Delivery Model
- The game MUST be playable in a browser with nothing to install: no native builds, no app
  store distribution, no mandatory local toolchain or local database for the player.
- The client MUST be a plain, standards-based web client; the app MUST NOT require a specific
  browser vendor or proprietary runtime APIs for core play.
- Deployment artifacts MUST exclude credentials, `.env` files, and local scratch data.

## Development Workflow and Quality Gates

1. Specify before building. Every feature starts with `/speckit.specify`, then
   `/speckit.plan`. The plan is where any new dependency is named for approval.
2. Tasks are derived from the plan (`/speckit.tasks`) and executed in order; a task is not done
   until its tests pass.
3. Quality gates for a feature:
   - No writes or DDL against catalog tables, and no read or write of `import_state` /
     `import_runs` (Principle I).
   - No database driver, credential, or query reachable from the browser (Principle II).
   - The day key is computed in UTC, no timezone other than UTC is referenced, and the stored
     puzzle is stable across repeated requests for the same date (Principle III).
   - Time is displayed in the player's browser timezone and never used to pick the puzzle
     (Principle III).
   - No login, user table, or server-side session introduced in v1 (Principle IV).
   - Every failure path renders a bilingual error state with retry; no blank screen
     (Principle V).
   - Test count for the feature is at or under 15; no stylesheet-text assertions; no essay
     comments (Principle VI).
   - Every new dependency appears in the plan and was approved by name (Principle VI).
4. Definition of done for v1 also requires: both locales complete, `.gitignore` covers secrets,
   and the game is playable end-to-end from a clean browser profile.
5. Reviewers MUST verify compliance with this constitution as part of every change, and MUST
   refuse changes that violate a principle unless the constitution is amended first.

## Governance

This constitution supersedes all other project practices, conventions, and informal preferences.
Where a plan, spec, or task conflicts with it, the constitution wins.

- Amendment procedure: propose the change with rationale, then run `/speckit-constitution`.
  Amendments take effect when this file is updated and committed; code MUST NOT be merged ahead
  of the amendment that authorizes it.
- Versioning policy: semantic versioning.
  - MAJOR: a principle is removed or redefined incompatibly (for example granting catalog write
    access, removing the no-blank-screen rule, or changing the timezone that defines the day key).
  - MINOR: a principle or constraint section is added, or existing guidance is materially
    expanded (for example adding accounts or a new display-time rule in a later version).
  - PATCH: clarifications, wording, and typo fixes with no change in obligations.
- Compliance review: every feature review checks the gates above and records violations as
  blocking. Unjustified complexity MUST be removed or justified against a principle.
- Scope discipline: features that need a principle exception (catalog writes, a user table, a
  new dependency, a login flow) require an explicit amendment, not an implicit exception.
- Operational guidance (runtime configuration, environment variables, deployment) lives in
  project docs and MUST NOT weaken any principle above.

**Version**: 2.1.0 | **Ratified**: 2026-10-02 | **Last Amended**: 2026-10-02