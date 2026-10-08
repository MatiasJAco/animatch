# Phase 1 Data Model: Daily Anime Puzzles (v1)

Feature spec: [spec.md](./spec.md) · Decisions: [research.md](./research.md)

Nothing in this document alters the catalog. The catalog tables listed here are read-only inputs;
the only table created by this feature is `daily_puzzles`.

---

## 1. Catalog inputs (read-only)

Taken verbatim from `docs/catalog-schema.sql`. Columns not listed here are never selected.

| Table | Columns used | Purpose |
|-------|--------------|---------|
| `people` | `mal_id`, `name` | Display name and identity of a voice actor |
| `anime` | `mal_id`, `title` | Display title and identity of a series |
| `characters` | `mal_id`, `name` | Display name and identity of a character |
| `voice_roles` | `person_mal_id`, `character_mal_id`, `anime_mal_id`, `language`, `role` | The fact table: who voices whom, in which series, in which language |
| `anime_seasons` | `anime_mal_id`, `year`, `season` | Season identity, keyed by (anime, year, season) |

Never read: `people.favorites`, `people.about`, `people.alternate_names`, `people.birthday`,
`people.website_url`, `people.mal_url`, `anime.type`, `anime.year`, `anime.source`, `anime.episodes`,
`anime.status`, `anime.aired_from`, `anime.aired_to`, `anime.title_english`,
`anime.title_japanese`, `characters.name_kanji`, all three `image_url` columns, all `mal_url`
columns, all `raw_json` columns, and all `first_seen_at` / `updated_at` columns. `import_state` and
`import_runs` are never read or written (see research R-008).

Casting note: `anime.type` and `anime.year` are deliberately not read. The type fact is available
if a future game needs it, and the year comes from `anime_seasons.year`, which is part of the season
key.

---

## 2. New table: `daily_puzzles`

The only table created by this feature. One migration, one statement, idempotent.

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

| Column | Type | Notes |
|--------|------|-------|
| `game` | `TEXT` | One of `more_or_less`, `match_the_series`, `groups`. Validated in application code; no check constraint, to keep the table exactly as agreed. |
| `puzzle_date` | `DATE` | Civil date in UTC. The rollover is 00:00 UTC. |
| `payload` | `JSONB` | `{ signature, data }`. `signature` is an internal novelty fingerprint (R-006) and is stripped before serving. `data` is exactly what `GET /api/daily/:game` returns. |
| `solution` | `JSONB` | Answers, revealed only through attempt responses. Never included in any `GET` response. |
| `created_at` | `TIMESTAMPTZ` | Provenance metadata. Not part of puzzle content, so the determinism rule (FR-005) does not apply to it. |

**No other tables are needed.** The novelty check that might have motivated a second table is
satisfied by `payload.signature` compared against the previous 30 days in this same table (R-003,
R-006). There is no user table and no history table, per the constitution.

### Lifecycle

```
request (game, today-utc)
  └─ BEGIN
       ├─ SELECT payload FROM daily_puzzles WHERE game=$1 AND puzzle_date=$2
       │     └─ found ──────────────────────────────────► serve (no generation)
       └─ not found
            ├─ generate(tx, game, date)      deterministic, catalog reads only
            │    └─ insufficient coverage ───► ROLLBACK, 503 PUZZLE_UNAVAILABLE
            ├─ INSERT ... ON CONFLICT DO NOTHING
            └─ SELECT payload, solution ... ─► serve the persisted winner
     COMMIT
```

Both concurrent first requests read back the same surviving row, so every visitor on a given day is
served byte-identical puzzle content (FR-003, SC-002).

---

## 3. Shared value types

```ts
type GameId = 'more_or_less' | 'match_the_series' | 'groups'

type PuzzleDate = string        // 'YYYY-MM-DD', civil date in UTC

type EntityRef = {
  id: number                   // catalog mal_id
  name: string                 // people.name / characters.name
  kind: 'person' | 'character' | 'anime'
}

type SeriesRef = { animeId: number; title: string }   // anime.title
```

---

## 4. More or Less

**Concept**: a chain of 11 people. Round *i* (0-indexed) compares chain[*i*] (hidden, left) against
chain[*i*−1] (visible, right). Ten rounds.

**Generation**

1. `SELECT person_mal_id, count(*) AS role_count FROM voice_roles GROUP BY person_mal_id ORDER BY person_mal_id`
   — role count is every voice role record (FR-023, R-010).
2. `SELECT mal_id, name FROM people WHERE mal_id = ANY($1) ORDER BY mal_id` for the chosen ids.
3. Shuffle candidates with the seeded PRNG (R-004).
4. Walk the shuffled list collecting 11 people such that **adjacent role counts always differ**
   (FR-022). On an equal-count neighbour, skip forward to the next candidate. The walk is
   deterministic because it follows the shuffled order.
5. Reject the day if fewer than 11 usable people exist, or if 30 days of history contain the same
   signature.

**Stored `payload.data`**

```json
{
  "game": "more_or_less",
  "date": "2026-10-02",
  "rounds": 10,
  "chain": [
    { "id": 412, "name": "..." },
    { "id": 88,  "name": "..." }
  ],
  "initialVisible": { "id": 77, "name": "...", "roleCount": 143 }
}
```

`chain` has 11 entries in puzzle order. `initialVisible` is chain[−1]. No other role count is in the
payload: the counts of chain[0..9] are answers.

**Stored `solution`**

```json
{
  "answers": ["more", "less", "more", "less", "less", "more", "less", "more", "more", "less"],
  "roleCounts": { "412": 96, "88": 211, "77": 143 }
}
```

`answers[i]` is the correct answer for round *i*. `roleCounts` is the full count per person id, used
to reveal the hidden number after a round resolves and to compute the answers.

**Attempt**

```
POST /api/daily/more_or_less/attempt  { "round": 0, "answer": "more" }
```

Result on a hit reveals both numbers, which is the only disclosure path for a hidden count.

**State transitions** (client-side; the server holds none)

```
fresh ──first attempt──► in_progress(round 1, attempts 1)
in_progress ──hit───────► in_progress(round+1)  |  won(round 10 reached)
in_progress ──miss──────► lost
```

---

## 5. Match the Series

**Concept**: one three-by-three grid of nine current-season series titles, and a clue deck of eighteen
cards shown one at a time above the grid. Each card is a character or a voice actor belonging to
exactly one of the nine grid series. The visitor clicks the series the card belongs to; a correct
click colors that tile green and loads the next card; three wrong clicks end the game (FR-024 to
FR-029a, R-019).

**Generation**

1. Derive the current season from the UTC date: month → season name, year = calendar year (R-007).
2. Current-season series:
   `SELECT a.mal_id, a.title FROM anime_seasons s JOIN anime a ON a.mal_id = s.anime_mal_id WHERE lower(trim(s.season)) = $1 AND s.year = $2 ORDER BY a.mal_id`
   Fewer than 9 distinct titles ⇒ `PUZZLE_UNAVAILABLE` (FR-030, EC-002). The grid is never shrunk
   and no older season is substituted.
3. Pick 9 series from the set with the seeded PRNG.
4. Clue candidates, restricted to the chosen 9 series:
   - Character cards: a `characters` row whose only series **within the chosen set** is one anime,
     so the answer is a function. Characters appearing in two or more chosen series are excluded,
     since they would have more than one correct answer (FR-024a, FR-029a).
   - Person cards: a `people` row with roles in exactly one anime of the chosen set, same reasoning.
   Both come from `voice_roles` restricted to the set, `ORDER BY` primary key.
5. Choose 18 cards: two per grid series, preferring one character and one person per series and
   filling from whichever kind exists. Every grid series therefore has at least one answerable card.
6. Shuffle the grid into board order and shuffle the deck independently, so no card's series is
   readable from position (R-019, R-021).
7. Novelty signature check (R-006). Below 9 series, or below 2 cards for any chosen series, the day
   is `PUZZLE_UNAVAILABLE` rather than a thin board.

**Stored `payload.data`**

```json
{
  "game": "match_the_series",
  "date": "2026-10-02",
  "season": { "season": "fall", "year": 2026 },
  "grid": {
    "rows": 3,
    "cols": 3,
    "series": [
      { "key": "a:9001", "title": "Series One" },
      { "key": "a:9102", "title": "Series Two" }
    ]
  },
  "clues": [
    { "key": "c:12345", "kind": "character", "name": "Character A" },
    { "key": "p:678",   "kind": "person",    "name": "Person D" }
  ],
  "wrongLimit": 3
}
```

`clues` has 18 entries in served order. `grid.series` has 9. Grid keys are the anime identity and
the title is the only fact shown on a tile; clue cards show the name plus a neutral CSS placeholder
(FR-029, R-009). No `image_url`, no placeholder URL, and **no clue card carries its series key** —
that mapping is the answer and lives only in the solution.

**Stored `solution`**

```json
{ "answers": { "c:12345": "a:9001", "p:678": "a:9102" } }
```

Keyed by clue card key. Two cards may map to the same series key, which is what makes a second
correct route to every tile available (R-019).

**Attempt**

```
POST /api/daily/match_the_series/attempt  { "clueKey": "c:12345", "seriesKey": "a:9001" }
```

Both keys must exist in the stored puzzle; anything else is `INVALID_ATTEMPT` (FR-039, R-020). The
Next control never calls this endpoint (FR-026b, R-021).

Outcome disclosure is deliberately asymmetric:

| Situation | Response carries |
|-----------|------------------|
| Correct click | hit; the client colors that series key green and moves to the next unanswered card (FR-026, FR-026a) |
| Wrong click, mistake limit not reached | miss; **no** `correctSeriesKey` and no other pairing; the tile stays uncolored. The client rotates the card to another entity and keeps the abandoned one eligible (FR-027a, FR-027c, FR-027d) |
| Wrong click that ends the game | miss; `correctSeriesKey` for that card, plus the full `answers` map so every green tile's pairing can be revealed (FR-027). No rotation happens |

The server returns no attempt count; the client counts answers itself, and a Next press is not an
answer (FR-041, FR-026b). The rotation is likewise client-side and issues no request, which is what
keeps the miss response free of any disclosure and leaves the endpoint unchanged by R-025.

**Pool eligibility, shared by Next and by mistake rotation.** One predicate governs both, so the two
cannot drift (FR-026c, FR-027c, R-025):

```ts
// candidate pool: served clues, minus the card on screen, minus every card answered correctly
// rotation = any element of the pool; falls back to the current card when the pool is empty
```

`answeredClues` is therefore the only removal from the pool. A mistake never adds to it, so the
abandoned entity stays eligible and can be shown again by a later rotation or by Next (FR-027d). With
eighteen cards and nine series, at most two rotations are ever needed to keep a card available before
the pool empties, and the fallback in FR-026d covers the empty case rather than ending play.

**Attempt-count consequence.** A mistake is still an answer, so `attempts` increases exactly as
before; only which card is on screen changes (FR-041, FR-027c).

**State transitions** (client-side; the server holds none)

```
fresh ──click──► in_progress(green | answered | mistakes, attempts+1)
in_progress ──hit────► in_progress | won(green == 9)
in_progress ──miss───► in_progress(clueIndex advanced, answered unchanged) | lost(mistakes == 3)
in_progress ──next───► in_progress, counters unchanged
```

Green tiles stay visible as locked; the correct pairing is only revealed after the game ends, so a
wrong click cannot leak another pairing (FR-027a, SC-018). The `miss` transition advances
`clueIndex` but leaves `answeredClues` untouched, which is the whole of FR-027d in state terms: the
abandoned card is still in the pool.

---

## 6. Groups

**Concept**: 16 tiles forming exactly four hidden groups of four. Each group shares one allowed
fact: same anime, same season, same source material, or same voice actor.

**Tile fact**: every tile is a fact with its linkage fields pinned, so each criterion is a function
of stored fields (R-011).

```ts
type GroupTile = {
  key: string                    // 'c:12345@a:9001' or 'p:678@a:9001'
  kind: 'character' | 'person'
  id: number                     // characters.mal_id or people.mal_id
  name: string                   // display name only
  animeId: number                // pins the anime, so same-anime and same-season are well defined
  source: string                 // pins the anime's source material, so same-source is well defined
  language: string               // pinned for data completeness; no criterion is judged on it
  voiceActorId: number           // set on character tiles whose role's person is the group's actor
}

type Criterion =
  | { type: 'same_anime';      animeId: number }
  | { type: 'same_season';     season: string; year: number }
  | { type: 'same_source';     source: string }
  | { type: 'same_voice_actor'; personId: number }
```

**Generation**, four candidate pools, each read with primary-key ordering, each selected by the
seeded PRNG:

| Criterion | Pool query shape | Notes |
|-----------|------------------|-------|
| same_anime | characters with a voice role in one anime | ≥ 4 distinct characters required |
| same_season | characters with roles in anime of one (year, season) | ≥ 4 distinct characters, distinct anime ids |
| same_source | characters across distinct anime whose anime share one non-blank `source` | ≥ 4 distinct characters across ≥ 4 distinct anime; blank `source` is never eligible |
| same_voice_actor | characters voiced by one person | ≥ 4 distinct characters |

1. Build one candidate group per criterion type.
2. Require 16 tiles with no repeated tile key and no repeated display label (FR-037).
3. Shuffle the 16 tiles for board order.
4. **Uniqueness check**: enumerate all 1820 four-tile subsets. Exactly four must satisfy a
   criterion, each exactly one, and they must equal the four intended groups. Otherwise regenerate
   from a later position in the shuffled pools, deterministically. This is what makes a submission
   unambiguous.
5. Novelty signature check (R-006).

**Stored `payload.data`**

```json
{
  "game": "groups",
  "date": "2026-10-02",
  "tiles": [ { "key": "c:12345@a:9001", "kind": "character", "name": "..." } ],
  "groupCount": 4,
  "wrongLimit": 5
}
```

**Stored `solution`**

```json
{
  "groups": [
    { "keys": ["c:1@a:9", "c:2@a:9", "c:3@a:9", "c:4@a:9"],
      "criterion": { "type": "same_anime", "animeId": 9 } }
  ]
}
```

On a correct submission the response carries the criterion, which is what FR-034 requires the
visitor to see.

**Attempt**

```
POST /api/daily/groups/attempt  { "tileKeys": ["c:1@a:9", "c:2@a:9", "c:3@a:9", "c:4@a:9"] }
```

Invalid when the count is not 4, any key is unknown, or any key was already consumed by a correct
group (FR-039).

On a miss the response carries `overlap`: the largest number of submitted tiles that belong to the
same hidden group, and 0 when no two submitted tiles share a group. It is computed from the stored
solution, names no group, and does not count toward the mistake limit beyond this attempt being a
mistake (FR-035a). Example: submitting two tiles from the same group and two from two other groups
returns `overlap: 2`.

The server returns no attempt count; the client counts answers itself (FR-041, R-012).

**State transitions**

```
fresh ──submission──► in_progress(found, misses, attempts+1)
in_progress ──hit────► in_progress | won(groupCount reached)
in_progress ──miss───► in_progress | lost(misses == 5)
```

---

## 7. Home listing

`GET /api/daily` returns one row per game, derived from the same lookup used by the game routes,
without any puzzle content beyond availability:

```json
{
  "date": "2026-10-02",
  "games": [
    { "game": "more_or_less",     "status": "ready" },
    { "game": "match_the_series", "status": "ready" },
    { "game": "groups",           "status": "unavailable" }
  ]
}
```

`status` is `ready`, `unavailable` (no valid puzzle possible today, e.g. no current-season
coverage), or `error` (catalog unreachable). The listing never fails as a whole because one game is
unavailable, so a coverage gap in one game does not blank the home page (Principle V).

---

## 8. Client-side state (not in the database)

Two separate browser-storage entries, deliberately not one blob.

```text
animatch:v1:progress   date-scoped game progress, discarded on rollover
animatch:v1:prefs      language choice, never discarded
```

### 8.1 Progress: `animatch:v1:progress`

```ts
type LocalProgress = {
  v: 1
  date: PuzzleDate                  // UTC; a mismatch discards the whole entry
  games: Partial<Record<GameId, LocalGameState>>
}

type LocalGameState = {
  status: 'in_progress' | 'won' | 'lost'
  attempts: number                  // every answer given, correct or wrong (FR-041)
  round?: number                    // more_or_less: next round index
  greenSeries?: string[]            // match_the_series: grid tiles already green
  answeredClues?: string[]          // match_the_series: clue cards already answered correctly
  clueIndex?: number                // match_the_series: index of the clue card on screen
  wrongClicks?: number              // match_the_series: wrong clicks so far
  found?: string[]                  // groups: consumed tile keys
  mistakes?: number                 // groups: mistakes so far
  endedAt?: string                  // ISO, UTC
}
```

Rules:

- Keyed by game plus UTC date. An entry whose `date` is not the browser's current UTC date is
  discarded on load, which is how yesterday's result never applies to today (FR-015).
- Puzzle content is **never** read from storage; it always comes from the API, so a tampered blob
  cannot change an answer. Storage holds only the visitor's own progress.
- **In-progress state is written on every accepted answer** and restored on return, so a closed tab
  resumes the same round or board position with the same attempt count (FR-043a).
  Nothing in-progress is ever sent to the server.
- Cleared, missing, or unreadable storage yields a fresh playable game with zero attempts and no
  error (FR-043b, FR-052).
- `attempts` counts every answer that was accepted, correct or wrong, and never an attempt rejected
  as invalid, since a rejection changes no state (FR-041). It also never counts a Next press, which
  is a free skip and not an answer (FR-026b). Consequence per game: a won More or Less is always 10,
  a lost one is between 1 and 10; a won Match the Series is between 9 and 11 and a lost one between
  3 and 11, because three wrong clicks end the game and at most eight tiles can be green before the
  ninth would have won; a lost Groups is between 6 and 9.
- Reading and writing are wrapped in one module with a version guard, so a future shape change
  discards rather than misreads old state.
- **Per-game reset** (FR-057): one exported operation removes a single game's entry and leaves every
  other game, the entry's `date`, and the language preference untouched. It performs no network call
  and no server write (FR-058). The composable also exposes the exact operation the debug control
  invokes, so the control holds no logic of its own.
- **Reset all games** (FR-057b): a second exported operation removes all three game entries in one
  write of the progress blob. It performs no network call and never reads, writes, or deletes a
  `daily_puzzles` row (FR-057c, R-024), and it leaves `animatch:v1:prefs` untouched so the language
  choice survives (FR-049b). One write rather than three is what makes it atomic from the visitor's
  point of view: there is no state in which some games are cleared and others are not.
- Both reset operations are rendered only in a development build (FR-057a, FR-057c, R-022, R-024), so
  a production bundle contains no way to reach either from the page.

### 8.2 Preferences: `animatch:v1:prefs`

```ts
type LocalPrefs = {
  v: 1
  language?: 'es' | 'en'            // set only when the visitor uses the language control
}
```

Rules:

- Resolution order on load: stored choice, else the browser's language when it is Spanish or
  English with any regional variant mapped to its base language, else Spanish (FR-049a).
- Not date-scoped and never discarded at rollover. This is why it is a separate entry: sharing one
  date-scoped blob would silently reset the language every night at 00:00 UTC.
- Language switching is applied immediately on the open page, covering help text, error states, and
  share text (FR-049b). The API is language-neutral, so no refetch is needed to switch.

---

## 9. Validation rules, collected

| Rule | Enforced by |
|------|-------------|
| Unknown game id | 404 `UNKNOWN_GAME` |
| Attempt references an id or key not in the stored puzzle | 400 `INVALID_ATTEMPT` (FR-039) |
| Attempt body malformed or wrong field types | 400 `INVALID_ATTEMPT` |
| Round index outside 0..9 | 400 `INVALID_ATTEMPT` |
| Match the Series attempt missing `clueKey` or `seriesKey` | 400 `INVALID_ATTEMPT` (FR-025, R-020) |
| Group submission not exactly 4 keys, or a consumed key | 400 `INVALID_ATTEMPT` |
| Catalog unreachable | 503 `DATABASE_UNAVAILABLE`, logged server-side (Principle V) |
| No valid puzzle possible today | 503 `PUZZLE_UNAVAILABLE`, no row inserted |
| No solution data in any GET response | Payload split (R-010); asserted by test |
| No clue card in any payload carries its series key | The `answers` map lives only in `solution` (FR-024a) |
| Wrong click below the mistake limit reveals nothing | `correctSeriesKey` and `answers` omitted unless the game ended (FR-027a) |
| Next never reaches the server | No endpoint consumes it; the client only advances its own index (FR-026b, R-021) |
| A mistake rotates the card without a request | Same client-side advance as Next; the miss response is unchanged (FR-027c, R-025) |
| A rotated-away entity is never retired | `answeredClues` is only appended on a correct answer (FR-027d) |
| Rotation can never leave the player without a card | Empty pool falls back to the current card instead of ending play (FR-026d) |
| Clicking an already-green tile changes nothing | The client ignores the click; the server has no such input (FR-027b) |
| Groups miss discloses only the overlap count | `overlap` integer only; solution never sent on a miss (FR-035a) |
| Invalid attempts never count toward the attempt count | Rejected before any counter is written; counters live client-side (FR-041) |
| Language choice survives the 00:00 UTC rollover | Separate non-date-scoped storage entry (§8.2) |
| Reset touches device state only | One storage operation, no fetch, no server write (FR-058, R-022) |
| Home reset clears all three games at once | One write of the progress blob; `prefs` untouched, so the language survives (FR-057b, FR-057c, R-024) |
| Neither reset can change a stored puzzle | No route is added, so no code path from a page reaches `daily_puzzles` (FR-057c, FR-058) |
| Reset is unreachable in production | Rendered only under the development build flag (FR-057a, FR-057c) |

---

## 10. Relationships

```text
people ──< voice_roles >── characters ──< voice_roles >── anime
                              anime ──< anime_seasons

daily_puzzles   (independent of the catalog except by id; nothing points back)
browser storage (independent of both; keyed by game + UTC date)
```

`daily_puzzles` stores catalog ids as opaque integers with no foreign key to the catalog. A foreign
key would be a constraint on a table the constitution declares read-only and owned elsewhere, and it
would block catalog re-imports. Referential integrity is guaranteed at generation time instead:
every id in a stored puzzle existed in the catalog when the puzzle was created (FR-006).