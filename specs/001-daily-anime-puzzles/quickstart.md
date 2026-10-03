# Quickstart: Daily Anime Puzzles (v1)

Runnable validation guide for the feature. It covers setup, the single run command, and a set of
manual checks that each map to a success criterion in [spec.md](./spec.md). No implementation code
belongs here; the contracts are in [contracts/openapi.yaml](./contracts/openapi.yaml) and the
storage shapes are in [data-model.md](./data-model.md).

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js 20 or newer | Developed against Node 22 |
| A PostgreSQL database with the catalog loaded | The five read-only tables from `docs/catalog-schema.sql` |
| `DATABASE_URL` in the environment | Never committed. `.env.example` documents the variable name only |
| npm | Installed with Node |

No global tooling, no database CLI, and no container runtime are needed. Docker comes later, with
the future deployment work, not in this feature.

---

## Setup

```bash
npm install
```

This installs the approved dependencies only: `nuxt`, `pg`, and `vitest` (dev). Nothing else is
added; any new dependency requires approval and a plan update first.

## Database

The catalog is imported and maintained elsewhere. This feature creates exactly one table:

```bash
npm run db:migrate
```

Runs `migrations/001_daily_puzzles.sql`, which is a single idempotent `CREATE TABLE IF NOT EXISTS`
executed inside a transaction. It is safe to re-run. It does not touch the catalog, and it does not
create a migration bookkeeping table.

Verify without modifying anything:

```bash
psql "$DATABASE_URL" -c "\d daily_puzzles"
psql "$DATABASE_URL" -c "select game, puzzle_date, created_at from daily_puzzles order by puzzle_date desc limit 5;"
```

## Run

One process serves both the site and the API:

```bash
npm run dev
```

- Site: `http://localhost:3000`
- API: `http://localhost:3000/api/daily`

## Test

```bash
npm test
```

At most 15 tests, no browser end-to-end. The suite covers the three routes, the UTC day rule, valid
and invalid attempts, the client's already-played-today state, and the database-not-responding
error.

---

## Manual validation checks

Run these against `npm run dev`. Each names the criterion it proves.

### 1. Home loads with three games

Open `http://localhost:3000/`. All three games appear for today's UTC date.

```bash
curl -s localhost:3000/api/daily
```

Expect `date` plus exactly three entries with a `status` of `ready`, `unavailable`, or `error`.
Proves SC-001 and FR-012.

### 2. One stored puzzle per game per day

```bash
curl -s localhost:3000/api/daily/more_or_less | tee /tmp/a.json
curl -s localhost:3000/api/daily/more_or_less | tee /tmp/b.json
diff /tmp/a.json /tmp/b.json && echo "identical"
```

Repeat for the other two games. The two responses must be identical, and one row per game per day
must exist in `daily_puzzles`. Proves SC-002, FR-003, FR-004.

### 3. No solution is ever served

```bash
for g in more_or_less match_the_series groups; do
  curl -s "localhost:3000/api/daily/$g" | grep -Eo 'solution|answers|roleCounts|image_url|correctSeriesKey' || echo "$g clean"
done
```

Expect `clean` for each game. Only the More or Less initial visible count may appear. Proves FR-009
and the contract rule that no GET response contains a solution.

### 4. Valid attempt reveals the answer

```bash
curl -s -X POST localhost:3000/api/daily/more_or_less/attempt \
  -H 'content-type: application/json' -d '{"round":0,"answer":"more"}'

curl -s -X POST localhost:3000/api/daily/match_the_series/attempt \
  -H 'content-type: application/json' -d '{"tileKey":"c:12345","seriesKey":"a:9102"}'

curl -s -X POST localhost:3000/api/daily/groups/attempt \
  -H 'content-type: application/json' \
  -d '{"tileKeys":["c:1@a:9","c:2@a:9","c:9@a:1","c:8@a:2"]}'
```

Expect, respectively: a `result` of `hit` or `miss` with `counts.hidden` and `counts.visible`
disclosed; a miss with **no** `correctSeriesKey`, because the mistake limit is not reached; and a
miss carrying only `overlap`. None of the three responses carries an attempt count, because the
server holds no game state. Proves FR-018, FR-027a, FR-035a, and R-010, that the attempt response is
the only disclosure path.

### 5. Invalid attempt is rejected visibly

```bash
curl -s -X POST localhost:3000/api/daily/more_or_less/attempt \
  -H 'content-type: application/json' -d '{"round":0,"answer":"maybe"}'

curl -s -X POST localhost:3000/api/daily/match_the_series/attempt \
  -H 'content-type: application/json' -d '{"tileKey":"c:1","seriesKey":"a:1"}'
```

Expect `INVALID_ATTEMPT` in both cases, no change to the stored puzzle, and no increment of the
client's answer count. Proves FR-039, FR-041, SC-007.

### 6. Unknown game

```bash
curl -s localhost:3000/api/daily/bingo
```

Expect 404 with `UNKNOWN_GAME`. Proves FR-001, that v1 has exactly three games.

### 7. Database not responding

Point `DATABASE_URL` at an unreachable host, then load the home page and a game route.

Expect a visible bilingual error state with a retry action, never a blank page or a permanent
loading state. Restore `DATABASE_URL`, restart, and retry: the puzzle loads normally. Proves
FR-050, SC-008, SC-009.

### 8. Already played today, on the client

Play a game to completion, reload the home page, then close the browser and reopen it on the same
UTC day. Expect the finished marker to persist for exactly that game.

```bash
# after finishing game X today
curl -s localhost:3000/api/daily | grep -o '"game":"[a-z_]*","status":"[a-z]*"'
```

The API reports availability only and never reports completion: completion is client-side by design.
Verify the marker in the browser's storage under `animatch:v1:progress`, and confirm that the stored
`date` matches today's UTC date. Proves FR-013, FR-042, SC-003.

Then close the tab mid-game in a second game, reopen it the same UTC day, and expect play to resume
at the same round with the same answer count. Proves FR-043a and SC-015.

### 9. Yesterday's result does not apply today

Change the stored `date` inside the `animatch:v1:progress` entry to an earlier UTC date and reload.
Expect no game marked finished. Proves FR-015 and SC-004.

Then clear the device storage entirely and reload: expect every game playable from the start with no
error, and expect the chosen language to still be remembered, since it is stored separately from the
date-scoped progress. Proves FR-043b, FR-049b, FR-052.

### 10. The day key is UTC, not local time

```bash
TZ=Asia/Tokyo curl -s localhost:3000/api/daily | grep -o '"date":"[^"]*"'
TZ=America/New_York curl -s localhost:3000/api/daily | grep -o '"date":"[^"]*"'
```

Expect the same date from both, matching the UTC civil date at that moment. Then, in the browser,
check the displayed countdown: it must be rendered in the visitor's own timezone while the puzzle
stays the UTC day's. Proves FR-002, FR-047.

### 11. Share text does not spoil

Finish each game in any outcome, copy the share text, and inspect it. Expect the game name, the
outcome, and the attempt count, and no answer, count, pairing, or criterion. Proves FR-044, FR-045,
SC-006.

### 12. Bilingual UI

Open the site in a browser set to Spanish and then in one set to an unsupported language, both with
empty device storage. Expect Spanish in the first case and Spanish again in the second. Then switch
the language with the visible control and expect every string to change immediately, including error
states and help text. Reload and expect the explicit choice to be remembered, and expect it to
survive a change of the stored UTC date. Proves FR-048, FR-049, FR-049a, FR-049b, SC-011, SC-017.

### 13. No forbidden facts and no external images

Play each game and inspect the network panel. Expect no request to any host other than the site's
own, and no display of studio, biography, favorites ranking, or image. Proves SC-010, SC-014.

### 14. Novelty between days

Change the system-independent day by pointing the app at a fixed date in a test, or insert a
yesterday row with the same signature and regenerate. Expect the generator to reject the repeated
setup. Proves FR-007 and EC-001.

### 15. Groups has exactly one solution

Take the 16 tile keys from `GET /api/daily/groups` and enumerate every four-tile subset. Expect
exactly four valid subsets, each satisfying exactly one criterion. This is the same check the
generator runs internally before storing a board. Proves FR-037 and the uniqueness guarantee in
R-011.

---

## Expected outcomes summary

| Check | Criterion |
|-------|-----------|
| Home loads three games | SC-001 |
| Same day returns the same puzzle | SC-002, FR-003, FR-004 |
| No solution in any GET | FR-009 |
| Valid attempt reveals counts | FR-018, FR-045 |
| Invalid attempt rejected and uncounted | FR-039, FR-041, SC-007 |
| Unknown game rejected | FR-001 |
| Catalog down gives bilingual error and retry | FR-050, SC-008, SC-009 |
| Finished state persists on the device | FR-013, FR-042, SC-003 |
| Mid-game return resumes the same round | FR-043a, SC-015 |
| Yesterday's result ignored | FR-015, SC-004 |
| Cleared storage leaves the game playable | FR-043b, FR-052 |
| Day key is UTC, display is local | FR-002, FR-047 |
| Share text is spoiler-free | FR-044, FR-045, SC-006 |
| Groups miss shows only the overlap count | FR-035a, SC-016 |
| Match the Series reveals nothing before the limit | FR-027a, SC-018 |
| Both languages complete, detected then remembered | FR-048, FR-049a, FR-049b, SC-011, SC-017 |
| No forbidden facts, no external images | SC-010, SC-014 |
| Day-over-day novelty | FR-007, EC-001 |
| Groups has a unique solution | FR-037 |

---

## Notes and known limits

- Cloud hosting sits in front of this later and is out of scope here. Nothing in the design reads
  the client IP, so adding a proxy in front will not require changes.
- Docker packaging is deferred to the future deployment work; the run command stays `npm run dev`.
- No analytics and no third-party scripts or fonts, so a page load contacts only this origin.
- Mid-game resume works from browser storage, which is progress only: the puzzle itself always comes
  from the API. Clearing storage loses in-progress play but never blocks play, and it leaves the
  language choice untouched because that lives in a separate entry.
- The 2-second target in SC-019 is checked on a throttled mid-range phone profile, not by an
  automated test.
## Validation record

Run against the production build (`npm run build` then `node .output/server/index.mjs`) with the
local catalog. Date of the run: 2026-10-03 UTC.

| # | Check | Criterion | Observed |
|---|-------|-----------|----------|
| 1 | Home lists three games | SC-001, FR-012 | `date` plus three games, all `ready` |
| 2 | One stored puzzle per game per day | SC-002, FR-003, FR-004 | Repeated GETs byte-identical for all three games; one row per game |
| 3 | No solution in any GET | FR-009 | No `solution`, `answers`, `roleCounts`, `image_url` or `correctSeriesKey` in any payload |
| 4 | Valid attempt reveals the answer | FR-018, FR-027a, FR-035a, R-010 | More or Less `hit` with both counts; Match `miss` in progress with no `correctSeriesKey`; Groups `miss` with `overlap` only; no attempt count anywhere |
| 5 | Invalid attempt rejected | FR-039, FR-041, SC-007 | `INVALID_ATTEMPT` for all three games, stored puzzle unchanged |
| 6 | Unknown game | FR-001 | 404 with `UNKNOWN_GAME` |
| 7 | Database not responding | FR-050, SC-008, SC-009 | Home and game pages show the bilingual message with a retry action; listing reports `error` per game; recovery after restoring `DATABASE_URL` |
| 8 | Already played today, on the client | FR-013, FR-042, SC-003 | Covered by the local-progress tests plus `GameCard`/`ResultPanel` wiring; no browser available for a manual click-through |
| 9 | Yesterday's result does not apply today | FR-015, SC-004, FR-043b, FR-049b, SC-052 | Date-scoped progress and the separate language entry are asserted in the local-progress tests |
| 10 | The day key is UTC | FR-002, FR-047 | Identical `date` under `TZ=Asia/Tokyo` and `TZ=America/New_York`, matching the UTC civil date |
| 11 | Share text does not spoil | FR-044, FR-045, SC-006 | `ShareButton` builds text from game, outcome and attempt count only |
| 12 | Bilingual UI | FR-048, FR-049, SC-011, SC-017 | 59 keys in each language, none missing and none empty; server-rendered pages default to Spanish |
| 13 | No forbidden facts or external images | SC-010, SC-014 | Built assets reference only `w3.org` namespaces and a Vue error-reference string; no image, font or script host |
| 14 | Novelty between days | FR-007, EC-001 | A planted yesterday signature is rejected; the regenerated board has a different signature |
| 15 | Groups has exactly one solution | FR-037, R-011 | 1820 subsets enumerated on the stored board: exactly 4 valid, each under exactly one criterion, matching the four intended groups |

### SC-019 timing (T068)

Measured over an emulated 4G link: 40 ms RTT on loopback (`tc netem`) and a 12 Mbit/s cap. No
browser is available in this environment, so the measurement covers server-rendered HTML delivery
with the puzzle already embedded, which is what "no client-side loading step" depends on. Twenty
samples per route:

| Route | Median | p95 | Max | Under 2s |
|-------|--------|-----|-----|----------|
| `/` | 0.40s | 0.66s | 0.66s | 20/20 |
| `/game/groups` | 0.42s | 0.48s | 0.48s | 20/20 |
| `/game/match-the-series` | 0.42s | 0.47s | 0.47s | 20/20 |
| `/game/more-or-less` | 0.42s | 0.45s | 0.45s | 20/20 |

First request of a new UTC day also pays generation: 1.08s for Match, 1.45s for More or Less and
2.49s for Groups. Every later request in that day reads the stored row and returns in about 0.42s.
