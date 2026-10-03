# Phase 0 Research: Daily Anime Puzzles (v1)

Feature spec: [spec.md](./spec.md) · Constitution: v2.1.0

Every unknown raised while drafting the technical context is resolved below. Each entry states the
decision, the reason, and the alternatives that were weighed, so the choice can be revisited later
without re-reading the code.

---

## R-001: Postgres driver for the Nitro server

**Decision**: `pg` (node-postgres), used from server code only, with a single connection pool
created lazily and closed on Nitro shutdown.

**Rationale**: The catalog access pattern needs explicit transactions (create-today's-puzzle-once)
and a pool; `pg` makes both first-class and is pure JavaScript, so there is no native build step in
local setup or in a future container image. It is the most widely deployed Node Postgres driver.

**Alternatives considered**: `postgres` (porsager) has a nicer tagged-template API and is equally
capable; rejected only for lower operational familiarity. `pg-native` needs a compiler; rejected.

---

## R-002: Test runner

**Decision**: `vitest`, as a dev dependency, running plain Node tests (no Nuxt runtime, no browser).

**Rationale**: The suite must exercise the three API routes, the UTC day rule, and the generators.
Vitest handles async handler tests and module mocking without ceremony, and its syntax matches
what the rest of the Nuxt toolchain uses. It is the only new dev dependency.

**Alternatives considered**: Node's built-in `node:test` adds zero dependencies but needs a
hand-rolled event stub for each route handler, spending test budget that the 15-test cap makes
scarce. Full Nuxt test utilities were rejected as unnecessary: no browser E2E is required, and the
target is route-level behavior.

---

## R-003: New tables beyond `daily_puzzles`

**Decision**: No additional tables. One migration creates exactly `daily_puzzles`, as specified:

```sql
CREATE TABLE IF NOT EXISTS daily_puzzles (
  game        TEXT        NOT NULL,
  puzzle_date DATE        NOT NULL,
  payload     JSONB       NOT NULL,
  solution    JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (game, puzzle_date)
);
```

**Rationale**: The one requirement that looked like it might need its own table was FR-007, "a day's
setup MUST NOT repeat any earlier day's setup". Storing a separate `signature` column or a
`puzzle_setups` table would have satisfied it, but the signature can live inside the existing
`payload` JSONB as a deterministic fingerprint of the ids used (see R-006). Every game in v1 is
one puzzle per day stored once, so there is no other per-game data to normalize.

**Alternatives considered**: A `puzzle_setups` history table (rejected: duplicate of what the
`payload` fingerprint gives, and it would be a second table needing its own migration). A
`game_results` table (forbidden by the constitution: no server-side history, no user table).

---

## R-004: Determinism and seeding

**Decision**: The seed is `sha256("<game>:<puzzle_date>")` interpreted as a 64-bit integer, used to
initialize a small integer PRNG (mulberry32). Every catalog read used during generation is ordered
by primary key before selection. Selection is by index into the ordered list, never by
`OFFSET`/`LIMIT` without `ORDER BY` and never by unordered `SELECT`.

**Rationale**: FR-005 requires the same game and day to always yield the same puzzle, and FR-007
requires the setup to be novel. A hash of game plus date is stable across processes, machines, and
deploys, which a process-local `Math.random()` is not. Primary-key ordering removes the one
remaining source of divergence, which is the database returning rows in a different order.

**Alternatives considered**: Seeding with the date alone (rejected: the three games must not share
a selection sequence). Ordering by a human-readable name (rejected: names are not unique, and
ordering by them would make the puzzle depend on catalog text that may be re-imported). A
sequence table to assign puzzles (rejected: violates "seed is the date plus the game id").

---

## R-005: Creating today's row exactly once

**Decision**: For a missing `(game, puzzle_date)`, the server generates the puzzle and inserts it
inside one transaction with `ON CONFLICT (game, puzzle_date) DO NOTHING`, then re-reads the row and
returns the persisted row regardless of who won the race:

```
BEGIN
  generate from catalog        -- deterministic, may read many rows
  INSERT ... ON CONFLICT DO NOTHING
  SELECT payload, solution FROM daily_puzzles WHERE game = $1 AND puzzle_date = $2
COMMIT
```

**Rationale**: The final `SELECT` is the important part. Two simultaneous first requests may both
generate, but only one insert survives, and both callers then serve the survivor's payload. That is
what makes "two visitors on the same day see an identical puzzle" true by construction rather than
by luck (FR-003, SC-002). The primary key does the locking, so no advisory lock or serializable
retry is needed.

**Alternatives considered**: `INSERT ... ON CONFLICT DO UPDATE` (rejected: pointless writes that
would bump nothing and could overwrite a good puzzle). Advisory lock on `(game, puzzle_date)`
(rejected: extra failure modes, no benefit over the primary key). Generate outside the transaction
and insert after (rejected: allows two different generated puzzles to race for the row and leaves a
long-lived idle-in-transaction risk).

---

## R-006: Proving a day's setup is not a repeat of an earlier day

**Decision**: When generating, the server computes a signature: the sorted, deduplicated list of
catalog ids used by the puzzle, joined into a string, then hashed. The stored `payload` carries it
as `payload.signature`. Before accepting a generated puzzle, the server compares that signature
against the signatures of the previous 30 days (one indexed range query on the same table).

**Rationale**: FR-007 requires novelty. Comparing fingerprints stored alongside previous puzzles
answers "has this exact setup happened before" without a second table (R-003) and without comparing
whole payloads. Thirty days is well beyond the human-noticeable window for a daily game while
keeping the check to one cheap query.

**Alternatives considered**: Storing a `signature` column (rejected: it changes the agreed table
definition for no functional gain, since the payload is already JSONB and internal metadata is
stripped before serving). Comparing raw payloads (rejected: wasteful and fragile to formatting).

---

## R-007: Season identity and the current calendar season

**Decision**: A season is identified by the pair (year, season name), read from `anime_seasons`,
whose primary key is exactly `(anime_mal_id, year, season)`. The current season is derived from the
UTC date with this month mapping, using the catalog's own labelling convention:

| UTC months | Season | Year used |
|------------|--------|-----------|
| Jan, Feb, Mar | winter | calendar year of the date |
| Apr, May, Jun | spring | calendar year of the date |
| Jul, Aug, Sep | summer | calendar year of the date |
| Oct, Nov, Dec | fall | calendar year of the date |

Season text is compared case-insensitively after trimming (`lower(trim(season))`), because the
exact casing stored by the importer is not guaranteed by `docs/catalog-schema.sql`, which declares
`season TEXT` with no check constraint.

`anime.season` and `anime.year` exist as a denormalized copy but are **not** read. `anime_seasons`
is the authority: it is a proper key table, its index `idx_anime_seasons_year_season` matches the
current-season lookup, and it cannot disagree with itself.

**Rationale**: FR-030 fixes the current season to the calendar season at play time with no
older-season substitution, and FR-038 requires Groups' "same season" to use that same identity. A
season name alone would merge Summer 2024 with Summer 2025, which would silently create valid
four-tile groups that are not the intended season.

**Alternatives considered**: Most recent season present in the catalog (rejected by the user; it was
the recommended default and was explicitly overridden). Falling back to the previous season when the
calendar season has no rows (rejected: FR-030 forbids substitution, and it would hide a catalog
refresh problem).

**Consequence, accepted deliberately**: in the window between a season ending and the catalog
covering the new one, Match the Series has no valid puzzle and shows the bilingual error state with
retry (FR-050, EC-002). A verification task checks the real season labels in the catalog before the
generators are finished, because a label mismatch would surface as a permanent error state rather
than as wrong data.

---

## R-008: Which catalog columns are read at all

**Decision**: Queries select only the allowed facts and the join keys needed to relate them:

| Fact | Column |
|------|--------|
| Person name | `people.name` |
| Character name | `characters.name` |
| Anime title | `anime.title` |
| Anime type | `anime.type` (unused by v1 games, available) |
| Anime year | `anime.year` (unused; `anime_seasons.year` is used instead) |
| Anime season | `anime_seasons.season` |
| Voice language | `voice_roles.language` |
| Voice role | `voice_roles.role` (unused as a grouping criterion in v1) |

Never selected: `people.favorites`, `people.about`, `people.alternate_names`, `people.birthday`,
`people.website_url`, `people.mal_url`, `anime.source`, `anime.episodes`, `anime.status`,
`anime.aired_from`, `anime.aired_to`, `anime.title_english`, `anime.title_japanese`,
`characters.name_kanji`, and every `raw_json` column. The `first_seen_at` / `updated_at` columns are
ignored.

**Rationale**: `docs/catalog-schema.sql` shows the catalog holds far more than the eight allowed
facts, including three `image_url` columns, a favorites count, and biography text. FR-009 and
FR-055 forbid presenting any of it. Choosing the allow-list at the query level rather than at the
render level means a forbidden field cannot leak even by accident, and it is directly testable.

**Alternatives considered**: Selecting `title_english` as a secondary title line (deferred: it is
still an allowed fact, but it doubles the display surface and the localization decision for series
names, with no gameplay value in v1). Using `anime.title_english` for the Spanish UI (rejected for
the same reason). Selecting `image_url` for tiles (forbidden by FR-029 and FR-055, and would
require a hotlinked request to a third-party host, which SC-014 forbids).

---

## R-009: Tile images without artwork

**Decision**: Match the Series left tiles render the entity name as text plus a neutral placeholder
mark drawn by the project's own CSS. No image file, no image URL, and no image request leaves the
site.

**Rationale**: The user decided artwork arrives later and v1 uses a placeholder. The catalog does
carry `image_url` on `characters`, `people`, and `anime`, so using it would have been the cheapest
route to a prettier board, but SC-014 requires that no page request an image from any host other
than the site's own, and FR-055 forbids hotlinking. A CSS placeholder satisfies the layout need
without introducing an asset pipeline, a licensing question, or a third-party dependency.

**Alternatives considered**: Hotlinking `image_url` (rejected: violates FR-055 and SC-014; would
require a constitution amendment). Committing placeholder image files (rejected: CSS is enough and
avoids binary assets in v1).

---

## R-010: More or Less round structure and where counts live

**Decision**: The stored puzzle is a chain of 11 people. Round *i* (0-indexed) compares chain[*i*]
with chain[*i*−1], where chain[−1] is the initial visible actor; ten rounds, eleven people,
adjacent counts always different. Role count is `count(*)` of `voice_roles` rows per person
(FR-023), matching the user's decision to count every voice role record.

No role count appears in the served payload except the initial visible actor's. The remaining
counts live in `solution` and are revealed one at a time by the attempt response, because a client
that received the whole chain with counts could read every answer from the network before playing.

**Rationale**: This is the direct consequence of the user's rule that the left actor's count is
hidden, combined with FR-041 and FR-045 (reveal on resolution, never spoil in advance). It also
gives the attempt endpoint a real job: it is the only place a hidden count is ever disclosed.

**Alternatives considered**: Sending all counts and hiding them in the UI (rejected: trivially
spoiled by reading the response). Server-side round state (rejected: would require a session or a
server-side store, both forbidden in v1).

---

## R-011: Guaranteeing Groups has exactly one solution

**Decision**: Every Groups tile is a *fact* of the form (kind, entity id, anime id, language), so
that each of the four criteria is a function over the stored fields rather than a lookup that could
resolve two ways. Generation then enumerates all 1820 four-tile subsets and rejects the candidate
board unless exactly four subsets satisfy a criterion, each satisfying exactly one, and matching the
four intended groups.

**Rationale**: FR-037 forbids a submission that is correct under two criteria at once. With anime
id and language pinned per tile, the risky cases are exactly the ones this catches: four characters
from one anime who all share a voice actor and a language would satisfy same-anime, same-voice-actor,
and same-language at once, and the player could submit it and be told it was right for the wrong
reason.

**Alternatives considered**: Building groups from four different criterion families and trusting
that overlaps are rare (rejected: they are not rare, and a single ambiguous board ruins a day).
Restricting to character-only tiles (rejected: the spec requires each tile to be a character or a
voice actor, and person tiles are needed for variety).

---

## R-012: Invalid attempts and client trust

**Decision**: An attempt is rejected as `INVALID_ATTEMPT` when its shape is wrong or any referenced
id is not a member of the day's stored puzzle. Validation is membership in the stored puzzle only;
the client is never trusted, and the server never looks up the catalog during attempt validation.

**Rationale**: FR-039 requires an attempt naming something outside the day's puzzle to be visibly
rejected. Because the puzzle already contains only entities that existed in the catalog at
generation time (FR-006), membership in the puzzle implies existence in the catalog, so a separate
catalog probe would add a query without adding information.

---

## R-013: No server state means answers can be enumerated

**Decision**: Accepted as a known property of v1. The attempt endpoint is stateless, so a player
could ask for each round's answer without playing. No mitigation is built.

**Rationale**: Nothing is at stake: there are no prizes, no leaderboard, no server-side history, and
the share text is spoiler-free regardless. Preventing enumeration would require server-side session
state, which Principle IV forbids, and any client-side obfuscation would be security theatre. This
is recorded so it is a decision rather than an oversight, and so a future competitive feature
revisits it.

**Alternatives considered**: Per-IP rate limiting (rejected: no value against a self-spoiler, and it
requires client-IP handling that CloudFront will later invalidate anyway). Signing the solution and
checking it client-side (rejected: the key would ship to the browser, so it proves nothing).

---

## R-014: Server-rendered day versus browser day

**Decision**: The server is the sole authority for the puzzle and its `puzzle_date`. The browser
computes its own UTC date only to namespace locally stored results. After hydration, the client
compares the `date` field of the API response with its own UTC date and refetches once if they
differ, which is the midnight-rollover edge case.

**Rationale**: A page rendered at 23:59:58 UTC and opened at 00:00:02 UTC would otherwise show
yesterday's puzzle until reload. Both dates are UTC, so this comparison is exact everywhere and
involves no timezone conversion. It also keeps Principle III intact: the browser timezone is used
for display only.

**Alternatives considered**: Client-side rendering of the puzzle (rejected: the user asked for SSR,
and it would make the blank-screen failure mode more likely). Comparing against the server clock on
every request (unnecessary: the response already carries the date).

---

## R-015: Client-stored state, including mid-game resume

**Decision**: Two versioned browser-storage entries. `animatch:v1:progress` holds the UTC date and a
per-game record with status (`in_progress`, `won`, `lost`), the attempt count, and the minimal board
state needed to resume (the current round index for More or Less, the matched and mistake counts for
Match the Series, the consumed tiles and mistake count for Groups). Progress is written on every
accepted answer, and an entry whose `date` differs from the browser's current UTC date is discarded
on load. `animatch:v1:prefs` holds the language choice alone and is never discarded.

**Rationale**: The user chose resume over restart. Resuming needs the in-progress state on the
device, which Principle IV permits since nothing is stored server-side. Keying progress by date
inside the entry is what makes yesterday's result never apply to today (FR-015): the comparison is
a single field check instead of a per-game purge. Clearing or losing storage degrades to a fresh
playable puzzle (FR-043b, FR-052). The language choice lives in its own entry because the clarified
requirement makes it survive the rollover (FR-049b); a single shared blob would have reset the
visitor's language every night at 00:00 UTC, which is why the storage is split rather than one
versioned record.

**Alternatives considered**: A separate storage key per game and date (rejected: unbounded key
growth and a cleanup problem). Persisting the full puzzle board in storage (rejected: the board is
refetched from the API and must not be trusted from storage; only the player's own progress is
stored). One entry for progress and preferences (rejected: rejected by the rollover bug above).

**Spec status**: resolved in `spec.md` as FR-043a, FR-043b, and SC-015.

---

## R-016: Catalog write protection in practice

**Decision**: Catalog access lives in one server module whose queries are hand-written `SELECT`s
with no generic query builder, no ORM, no migration tool pointed at the catalog, and no string-built
SQL from user input. The `daily_puzzles` insert is the only write in the codebase, and it is the
only non-`SELECT` statement. A test asserts this by capturing executed SQL.

**Rationale**: Principle I forbids catalog writes outright. With an ORM or dynamic query layer, a
future edit could introduce a write without anyone noticing. Hand-written statements make the
boundary reviewable, and one test makes it enforced.

**Alternatives considered**: A read-only Postgres role for the app's pool (attractive, but the same
role also inserts puzzle rows, so it would need a second role, which is a deployment concern rather
than a code one; noted for the future container work). Database triggers blocking writes (rejected:
that would alter catalog behavior, which Principle I forbids).

---

## R-017: Error contract and bilingual messages

**Decision**: Every failure returns `{"error": {"code", "message"}}` with a stable machine code
(`UNKNOWN_GAME`, `INVALID_ATTEMPT`, `PUZZLE_UNAVAILABLE`, `DATABASE_UNAVAILABLE`,
`PAYLOAD_UNAVAILABLE`). `message` is a short, non-technical English fallback. The browser renders
its own copy from the message catalog, keyed by code, so the user-facing text is bilingual and the
server never decides the visitor's language. Database errors are logged server-side with context
and replaced by `DATABASE_UNAVAILABLE` before responding.

**Rationale**: Principle V requires a readable, actionable error state in both languages with no
internals leaked, and a machine code is what lets the client localize without parsing prose. This
also keeps the server free of user-facing copy, so FR-049 holds on the error path too.

---

## R-018: Migration mechanics without a second table

**Decision**: `migrations/001_daily_puzzles.sql` contains a single idempotent `CREATE TABLE IF NOT
EXISTS`. `npm run db:migrate` runs the `migrations/` files in filename order, each inside a
transaction, using the same `pg` pool as the app. No bookkeeping table is created, because with one
idempotent migration there is nothing to track.

**Rationale**: The catalog's own DDL in `docs/catalog-schema.sql` uses the same
`IF NOT EXISTS` style, so this matches local convention. Introducing a migration framework would add
a dependency and a schema table for a single statement.

**Alternatives considered**: Applying the file by hand with `psql` (rejected: the README promises one
run command, and a bare `psql` invocation is environment-dependent). `node-pg-migrate` (rejected:
new dependency, plus its own tracking table, for one statement).

---

## Unresolved items

None. All technical-context unknowns were resolved above, and no clarification marker remains in the
spec.