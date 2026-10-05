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

## R-019: Match the Series board shape and clue deck size

**Decision**: The grid is the answer board: nine current-season series titles in a three-by-three
grid. The stored puzzle also carries a **clue deck** of eighteen cards, two unambiguous entities per
grid series (a character and a person wherever the coverage allows, otherwise the second card is
another entity of whatever kind exists). Grid tiles are identified by series key; the solution maps
each clue card key to exactly one grid series key. The deck is shuffled once by the generator and
served in that order.

**Rationale**: FR-028 needs nine green tiles and every tile needs an answerable card, so nine cards
is the floor. FR-026c requires Next to supply a *different, not-yet-answered* card, and with exactly
nine cards a player who skipped through the deck would exhaust it and lose Next after FR-026d
disabled it, which reads as a broken button rather than a finished puzzle. Two cards per series
keeps at least two ways to green every tile, so Next stays useful for the whole game, while the
payload stays small: eighteen small objects, one row read, no extra table. Two cards per series also
means the character and person variants the user described ("a character name and their image, or a
voice actor and their photo") both appear for most series without a separate rule.

**Alternatives considered**: Exactly nine cards, one per series (rejected: Next dies early, and the
pool of unambiguous entities per series is thin for some titles). A large deck of forty or more
(rejected: more payload, and repeated cards for one series read as a bug). Dealing one card at a
time from a shuffled deck (rejected: a client-side shuffle would reshuffle on every reload and break
the "resume the same board position" guarantee; a server-side deal needs server state, which
Principle IV forbids).

---

## R-020: The attempt names the clue card and the clicked series

**Decision**: `POST /api/daily/match_the_series/attempt` takes `{ "clueKey": "c:12345",
"seriesKey": "a:9001" }`. Both keys must be members of the day's stored puzzle; anything else is
`INVALID_ATTEMPT`. Next never reaches the server.

**Rationale**: FR-025 removed the first selection step, so one click is the whole answer, but the
server still has to know *which* clue card was being answered when it validates against the stored
solution. A bare `seriesKey` cannot express that: the server would have to assume the first
unanswered card, which silently mis-scores a client whose displayed card and stored progress have
drifted apart after a reload. Naming the card keeps the endpoint stateless and still exact.

**Alternatives considered**: `seriesKey` alone, assuming the first unsolved card (rejected: wrong
answer scored against the wrong card after any resume). A server-side "current card" (rejected: that
is game state, which Principle IV forbids). Sending the whole deck position (rejected: more surface
for the same information).

---

## R-021: Where the grid state and the free skip live

**Decision**: Everything the board needs to resume lives on the device: the set of green series
keys, the set of answered clue card keys, the mistake count, and the index of the clue card showing.
Next walks the served deck order to the next card that is not in the answered set, changes no
counter, and is disabled when no such card remains. The server keeps nothing.

**Rationale**: The server is stateless by design (R-012, Principle IV), so any state that must
survive a reload has to be on the device (FR-043a). Deck order comes from the stored payload, so it
is identical on every request for that day and a resumed board looks exactly like the one the player
left. Serving the deck in a fixed order also keeps Next predictable rather than arbitrary.

**Alternatives considered**: Reshuffling the deck client-side on each load (rejected: Next would feel
random and the resumed board would differ from the abandoned one). Randomly choosing the Next target
(rejected: same problem). Keeping the deck position server-side (rejected: Principle IV).

---

## R-022: Making the debug reset a development-only control

**Decision**: The reset control is rendered only under Nuxt's build-time development flag
(`import.meta.dev`), so a production bundle does not contain it at all. It clears the one game's
entry from `animatch:v1:progress` in the browser and calls no endpoint. The home control is
unconditional.

**Rationale**: FR-057a requires the control to be absent in production, and a build-time flag makes
that structural rather than conditional: the button cannot be reached by keyboard or script in a
production bundle, so no visitor can clear a finished result and replay a game (FR-043). FR-058
requires the control to touch device state only, so there is no server route to write and therefore
no unauthenticated mutation surface to protect.

**Alternatives considered**: A runtime environment variable (rejected: it can be misconfigured in
exactly the deployment where it matters, and it would leave the control reachable by default). A
server route that deletes the day's stored puzzle (rejected: violates FR-058, and it would change the
puzzle for every other visitor that day, breaking FR-003 and SC-002). Hiding the control with CSS in
production (rejected: it would stay in the DOM and remain focusable).

---

## R-023: One shared game header for both controls

**Decision**: A single shared component is rendered in every game page's header. It carries the home
control always and the reset control in development, and both labels come from the message catalog so
both languages stay complete (FR-049, FR-057).

**Rationale**: FR-056 requires the home control on every game screen, including while a game is in
progress and on the result screen. One component used by all three pages is the only way that
requirement cannot drift page by page; three hand-written links are three chances to forget one.
Putting the controls in the header keeps them above the fold on a phone, which is where a player
mid-round looks for a way out.

**Alternatives considered**: A footer link (rejected: below the fold on a phone and easy to miss
mid-game). A browser-history back button (rejected: FR-056 requires a real route back to home, and
history back can leave the site entirely). A per-page control (rejected: duplication and drift).

---

## R-024: A home control that clears all three games, without a server write

**Decision**: The home page carries one control, in development builds only, that clears all three
games' entries from `animatch:v1:progress` in a single storage operation and leaves
`animatch:v1:prefs` untouched. It is a small component beside the game list, labeled from the message
catalog (FR-057b, FR-057c). No server route is added, and the day's `daily_puzzles` rows are never
read, written, or deleted. It uses the same two-step confirmation as the per-game control so the two
do not behave differently under a fast double-click.

**Rationale**: The user asked for a debug control that removes the need to reach into the database by
hand. Two facts make a database delete the wrong tool. First, generation is deterministic in the game
and the day (R-005), so deleting today's row and re-requesting recreates the identical board; the
delete would change nothing a developer can see. Second, FR-042 keeps the finished-today state on the
device, and that device state is the only thing that actually blocks a retest. Clearing it is
therefore both sufficient and the smaller change. It also keeps FR-058 and Principle III intact by
construction, since no code path from a page can reach the puzzle table, and it leaves no endpoint
that a future mistake could turn into a write. Clearing three entries at once is one write of the
progress blob rather than three operations, so the control cannot leave a partially cleared store.

**Alternatives considered**: A development-only endpoint that deletes the three rows and regenerates
(rejected: adds a server write path for no observable gain, since the regenerated board is identical
by R-005, and it would need its own production gate to satisfy FR-057c). A per-game control on each
home card (rejected: three controls for one intent, and the user asked for one action that resets all
games). Reusing the per-game control's single-game operation three times (rejected: leaves a window
where a failure mid-sequence clears some games and not others, and FR-057b is one action).

---

## R-025: A mistake rotates the clue card, and the abandoned entity stays in the pool

**Decision**: A wrong click that does not end the game advances the card to another entity using the
same eligibility rule the Next control already uses, and records nothing about the abandoned entity
(FR-027c, FR-027d). Rotation draws from the served `clues` list, excludes the card being replaced and
every card the visitor has already answered correctly, and the pool shrinks only when a card is
answered correctly. When no other entity is eligible, the mistake is still counted and the same card
keeps showing. The rotation is client-side and issues no request; the endpoint's miss response is
unchanged, so no pairing is disclosed (FR-027a).

**Rationale**: The user asked for the card to rotate on a mistake, which fixes a real dead end: without
it a player re-clicks a clue they have just disproved and the rotation has no purpose. Two properties
keep that change from costing anything. The abandoned entity stays in the pool, so a wrong guess
costs the mistake and nothing else; three mistakes never retire three of the eighteen cards, and no
entity becomes unreachable. And the rotation reuses the FR-026c predicate rather than introducing a
second selection rule, so the Next control and the mistake cannot drift apart in what they consider
eligible. The eighteen-card deck (R-019) is what makes this comfortable: with nine cards a run of
mistakes could exhaust the pool, and FR-026d's continue-showing fallback would start appearing in
normal play.

**Alternatives considered**: Retiring the abandoned entity (rejected: a wrong guess would permanently
remove a clue, so the player could never return to an entity they found hard, and the deck would
shrink by up to three across a game). Advancing in stored deck order rather than choosing any
eligible card (deferred: both satisfy FR-027c, and eligibility-based selection reuses the existing
predicate; recorded as a plan-level choice in `/speckit.tasks`). Disclosing the correct series as
feedback (rejected: FR-027a and SC-018 forbid it below the mistake limit, and it would let a player
binary-search the answer with three lives). Ending the game on a mistake instead of rotating
(rejected: the user specified a rotation, and the three-mistake limit is unchanged).

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
than as wrong data. The grid was reduced from nine by nine to three by three in clarification, so the
coverage threshold is nine series rather than eighty-one; the catalog held 114 distinct series in
fall 2026, so the error state is now a genuine catalog gap rather than an expected seasonal one.

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

## R-009: Clue card images without artwork

**Decision**: The Match the Series clue card renders the entity name as text plus a neutral
placeholder mark drawn by the project's own CSS. No image file, no image URL, and no image request
leaves the site. The nine grid tiles carry series titles as text only.

**Rationale**: The user chose artwork later and v1 uses a placeholder, and confirmed the choice for
the clue card specifically. The catalog does carry `image_url` on `characters`, `people`, and
`anime`, so using it would have been the cheapest route to a prettier board, but SC-014 requires that
no page request an image from any host other than the site's own, and FR-055 forbids hotlinking. A
CSS placeholder satisfies the layout need without introducing an asset pipeline, a licensing
question, or a third-party dependency.

**Alternatives considered**: Hotlinking `image_url` (rejected by the user in clarification: violates
FR-055 and SC-014, and would require a constitution amendment). Name-only with no image area
(rejected: the card then carries no visual anchor above the grid). Committing placeholder image
files (rejected: CSS is enough and avoids binary assets in v1).

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
id or key is not a member of the day's stored puzzle. Validation is membership in the stored puzzle
only; the client is never trusted, and the server never looks up the catalog during attempt
validation. For Match the Series this covers both the clue card key and the clicked series key
(R-020).

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
state needed to resume (the current round index for More or Less, the green series keys, the answered
clue card keys, the index of the clue card showing, and the mistake count for Match the Series, the
consumed tiles and mistake count for Groups). Progress is written on every accepted answer, and an
entry whose `date` differs from the browser's current UTC date is discarded on load.
`animatch:v1:prefs` holds the language choice alone and is never discarded.

**Rationale**: The user chose resume over restart. Resuming needs the in-progress state on the
device, which Principle IV permits since nothing is stored server-side. Keying progress by date
inside the entry is what makes yesterday's result never apply to today (FR-015): the comparison is
a single field check instead of a per-game purge. Clearing or losing storage degrades to a fresh
playable puzzle (FR-043b, FR-052). The language choice lives in its own entry because the clarified
requirement makes it survive the rollover (FR-049b); a single shared blob would have reset the
visitor's language every night at 00:00 UTC, which is why the storage is split rather than one
versioned record. Match the Series stores green tiles and answered cards rather than a puzzle board,
so a tampered blob can at worst make the player look at their own screen wrongly, never change an
answer (FR-039 is still enforced server-side against the stored puzzle).

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
spec. The two 2026-10-05 clarification sessions added R-019 through R-025 and revised R-007, R-009,
and R-015; every remaining question was either answered by the user or is implementation detail left
to `/speckit.tasks`.