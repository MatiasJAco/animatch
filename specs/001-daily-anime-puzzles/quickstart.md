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
  curl -s "localhost:3000/api/daily/$g" | grep -Eo 'solution|roleCounts|image_url|clueSeries' || echo "$g clean"
done
```

Expect `clean` for each game. Only the More or Less initial visible count may appear, and no Match
the Series clue card may carry the series it belongs to. Proves FR-009, FR-024a, and the contract
rule that no GET response contains a solution.

### 4. Valid attempt reveals the answer

```bash
curl -s -X POST localhost:3000/api/daily/more_or_less/attempt \
  -H 'content-type: application/json' -d '{"round":0,"answer":"more"}'

curl -s -X POST localhost:3000/api/daily/match_the_series/attempt \
  -H 'content-type: application/json' -d '{"clueKey":"c:12345","seriesKey":"a:9102"}'

curl -s -X POST localhost:3000/api/daily/groups/attempt \
  -H 'content-type: application/json' \
  -d '{"tileKeys":["c:1@a:9","c:2@a:9","c:9@a:1","c:8@a:2"]}'
```

Expect, respectively: a `result` of `hit` or `miss` with `counts.hidden` and `counts.visible`
disclosed; a miss with **no** `correctSeriesKey` and **no** `answers`, because the mistake limit is
not reached; and a miss carrying only `overlap`. None of the three responses carries an attempt
count, because the server holds no game state. Proves FR-018, FR-027a, FR-035a, and R-010, that the
attempt response is the only disclosure path.

### 5. Invalid attempt is rejected visibly

```bash
curl -s -X POST localhost:3000/api/daily/more_or_less/attempt \
  -H 'content-type: application/json' -d '{"round":0,"answer":"maybe"}'

curl -s -X POST localhost:3000/api/daily/match_the_series/attempt \
  -H 'content-type: application/json' -d '{"clueKey":"c:1","seriesKey":"a:1"}'

curl -s -X POST localhost:3000/api/daily/match_the_series/attempt \
  -H 'content-type: application/json' -d '{"seriesKey":"a:9001"}'
```

Expect `INVALID_ATTEMPT` in all three cases: an unknown clue card, an unknown series, and a body
missing `clueKey`. No change to the stored puzzle, and no increment of the client's answer count.
Proves FR-039, FR-041, SC-007, and R-020.

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

### 16. Match the Series is a 3x3 grid with a clue deck

```bash
curl -s localhost:3000/api/daily/match_the_series \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['grid']['rows'], d['grid']['cols'], len(d['grid']['series']), len(d['clues']))"
```

Expect `3 3 9 18`: nine series titles in a three-by-three grid, and eighteen clue cards, two per
grid series. Every clue key is unique and the deck holds both `character` and `person` kinds. Then
open `/game/match-the-series` and confirm the clue card above the grid shows a name plus a neutral
placeholder with no image request in the network panel, and that clicking a tile colors exactly one
tile green and loads a different card. Proves FR-024, FR-024a, FR-026, FR-026a, FR-028, FR-029,
SC-014, R-019.

### 17. Next is a free skip

Play Match the Series, note the attempt count and the mistake counter, press Next several times, and
confirm the card changes each time while both counters stay put. Confirm in the network panel that
pressing Next issues **no** request. Then answer the card that Next landed on and confirm the tile
turns green. Repeat until only one unanswered card remains and confirm Next is then disabled and the
game is still playable. Proves FR-026b, FR-026c, FR-026d, FR-041, SC-021, R-021.

### 18. Back to home from every game screen

Open each of the three game screens, and on each one start a game, then use the home control while
the game is in progress. Expect the home page to load and, after reopening that game, the same round
or board position with the same attempt count. Repeat from the won or lost screen and expect the
finished marker to still be there. Proves FR-056, FR-043a, SC-022, R-023.

### 19. Debug reset clears one game and nothing else

With `npm run dev` running, play two games partway. Note the attempt counts and the current UTC date.
Press the reset control on the first game only. Expect that game to restart from its first round or
board position with zero attempts, the second game untouched, and the date entry still today's.

```bash
psql "$DATABASE_URL" -c "select game, puzzle_date, created_at from daily_puzzles order by game;"
```

Expect the stored puzzles unchanged, and the same puzzle served again after the reset. Then build and
run the production bundle (`npm run build`, then `node .output/server/index.mjs`) and confirm no game
screen shows a reset control, so a finished game cannot be replayed through it. Proves FR-057,
FR-057a, FR-058, FR-043, SC-023, SC-024, R-022.

### 20. A mistake rotates the clue card and keeps the entity reachable

Play Match the Series on the first round, note the entity on the clue card, and click a wrong series.
Expect the mistake counter to increase by one, the clicked tile to stay uncolored, no series pairing
to appear, and the clue card to show a different entity immediately. Confirm in the network panel that
the rotation itself issues no further request beyond the attempt. Then press Next repeatedly and keep
pressing it after further mistakes: expect the originally abandoned entity to be shown again at some
point, and confirm it is still answerable and turns its tile green when answered correctly. Repeat
until only one entity is left unconfirmed and expect play to continue rather than block. Proves
FR-027c, FR-027d, FR-026c, SC-026, R-025.

### 21. Home reset clears all three games in the browser only

With `npm run dev` running, play all three games partway and switch the language to English. Note the
three attempt counts and today's UTC date. Press the home reset control once. Expect all three games
to be playable from the start with zero attempts, the language to still be English, and the date
entry still today's. Then open any game and confirm the puzzle served is byte-identical to the one
served before the reset.

```bash
psql "$DATABASE_URL" -c "select game, puzzle_date, created_at from daily_puzzles order by game;"
```

Expect the stored puzzles unchanged and no new row created. Finally build and run the production
bundle (`npm run build`, then `node .output/server/index.mjs`) and confirm the home page shows no
reset control either. Proves FR-057b, FR-057c, FR-058, SC-025, R-024.

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
| Match the Series board is a 3x3 grid with a clue deck | FR-024, FR-028, R-019 |
| Next is a free skip that never leaves the browser | FR-026b, FR-026c, FR-041, R-021 |
| Home control on every game screen, progress kept | FR-056, SC-022 |
| Debug reset clears one game only, puzzle untouched | FR-057, FR-058, SC-023 |
| No reset control in a production build | FR-057a, SC-024 |
| A mistake rotates the card, abandoned entity still reachable | FR-027c, FR-027d, SC-026 |
| Home reset clears all three games, language and puzzle kept | FR-057b, FR-057c, SC-025 |
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
- Neither reset control reaches the database, so neither is a substitute for deleting a stored
  `daily_puzzles` row. That deletion stays a deliberate developer action, needed only when a stored
  row must be regenerated in an older shape; regenerating is deterministic, so a delete alone does not
  change which puzzle is served.
- The 2-second target in SC-019 is checked on a throttled mid-range phone profile, not by an
  automated test.
## Validation record

Run against the production build (`npm run build` then `node .output/server/index.mjs`) with the
local catalog. Date of the run: 2026-10-05 UTC, after the clarification session.

Checks were re-run after the Match the Series rewrite. The automated suite is green at exactly 15
tests, and the API and server-rendered HTML were exercised directly. **No browser is available in
this environment**, so the click-driven and `localStorage`-driven parts of checks 8, 9, 17, 18, 19,
20, and 21 are covered by the automated local-progress and attempt tests plus the rendered-HTML
probes recorded below, not by a human clicking through. Those seven still need one pass by hand
before the feature is called done.

Checks 20 and 21 cover the home reset and the mistake rotation. They were added by the third
clarification session on 2026-10-05 and were **verified on 2026-10-05** in the same pass that
implemented them, by the automated suite, a development-build render probe, and a production-build
render probe. Neither was exercised by hand, for the browser reason above.

| # | Check | Criterion | Observed |
|---|-------|-----------|----------|
| 1 | Home lists three games | SC-001, FR-012 | Re-run 2026-10-05: `date` `2026-10-05` plus `more_or_less`, `match_the_series`, `groups`, all `ready`; the rendered page lists all three with their summaries |
| 2 | One stored puzzle per game per day | SC-002, FR-003, FR-004 | Repeated GETs byte-identical for all three games; one row per game |
| 3 | No solution in any GET | FR-009 | Re-run 2026-10-05: no `solution`, `answers`, `roleCounts`, `image_url` or `correctSeriesKey` in any of the three payloads |
| 4 | Valid attempt reveals the answer | FR-018, FR-027a, FR-035a, R-010 | Re-run 2026-10-05. More or Less `hit` returned `counts.hidden` 8 and `visible` 3; Match `miss` in play returned only `result`, `clueKey`, `seriesKey`, `state`; Groups `miss` returned `overlap` 2 and named no group; no attempt count in any response |
| 5 | Invalid attempt rejected | FR-039, FR-041, SC-007 | Re-run 2026-10-05. A Groups body with one tile and a Match body missing `clueKey` both returned 400 `INVALID_ATTEMPT`; the stored payload and solution were byte-identical after the rejections |
| 6 | Unknown game | FR-001 | Re-run 2026-10-05: 404 with `UNKNOWN_GAME` |
| 7 | Database not responding | FR-050, SC-008, SC-009, R-016 | Re-run 2026-10-05 against the production build with a dead `DATABASE_URL`. Home rendered "Algo salió mal / El puzzle no se pudo cargar ahora mismo / Inténtalo de nuevo / Reintentar" and `/api/daily` reported `status: error`, `code: DATABASE_UNAVAILABLE` for all three games; the game page rendered the same retry control. Restarting the same build with a working `DATABASE_URL` returned all three to `ready` with the error copy gone and the board rendered. Extended 2026-10-05: the failure is now logged server-side with its operation and the driver's error class, code and message, never the connection string, SQL, stack or hostname; the listing test asserts a failed listing leaves every stored row byte-identical; a failed *attempt* now renders the same bilingual retry state instead of returning silently |
| 8 | Already played today, on the client | FR-013, FR-042, SC-003 | Covered by the local-progress tests plus `GameCard`/`ResultPanel` wiring; no browser available for a manual click-through |
| 9 | Yesterday's result does not apply today | FR-015, SC-004, FR-043b, FR-049b, FR-052 | Date-scoped progress and the separate language entry are asserted in the local-progress tests |
| 10 | The day key is UTC | FR-002, FR-047 | Identical `date` under `TZ=Asia/Tokyo` and `TZ=America/New_York`, matching the UTC civil date |
| 11 | Share text does not spoil | FR-044, FR-045, SC-006 | `ShareButton` builds text from game, outcome and attempt count only |
| 12 | Bilingual UI | FR-048, FR-049, SC-011, SC-017 | 69 keys in each language after the two reset-all keys and the loss-reveal heading were added, none missing and none empty, exact set parity between locales (asserted by the test suite); server-rendered pages default to Spanish |
| 13 | No forbidden facts or external images | SC-010, SC-014 | Built assets reference only `w3.org` namespaces and a Vue error-reference string; no image, font or script host |
| 14 | Novelty between days | FR-007, EC-001 | A planted yesterday signature is rejected; the regenerated board has a different signature |
| 15 | Groups has exactly one solution | FR-037, R-011 | The generator gates every stored board on this: `findValidGroups` enumerates all 1820 four-tile subsets, and `server/generators/groups.ts` rejects the attempt unless exactly four subsets are valid, none is valid under two criteria, and the valid set equals the intended four (lines 218 to 229). Enumerated on a stored board on 2026-10-03: exactly 4 valid, each under exactly one criterion. Re-confirmed for the 2026-10-05 board through the API: the intended group returned its `criterion` and a near-miss returned only `overlap` 3 |
| 16 | Match the Series is a 3x3 grid with a clue deck | FR-024, FR-029, R-019 | Ran 2026-10-05. `GET` returned `grid.rows` 3, `grid.cols` 3, 9 distinct series titles, 18 clues of exactly `key`/`kind`/`name`, `wrongLimit` 3, and no series key or `image_url` on any card; the rendered page shows one clue card with a character name and the project placeholder above a `grid-3x3` of nine titles |
| 17 | Next is a free skip | FR-026b, FR-026c, FR-026d, R-021 | Partly verified 2026-10-05. The Next handler in `app/pages/game/match-the-series.vue` advances `clueIndex` through `setGameState` only: it issues no request and touches neither `attempts` nor `wrongClicks`, and the candidate list excludes the current card and every already-answered card. The click itself was not exercised by hand |
| 18 | Back to home from every game screen | FR-056, SC-022, R-023 | Verified 2026-10-05. The home control rendered on all three game routes in both the development and production builds, and it is a `NuxtLink` to `/`, so it cannot alter stored state |
| 19 | Debug reset clears one game and nothing else | FR-057, FR-057a, FR-058, R-022 | Verified 2026-10-05. The reset control rendered on all three game routes in the development build and was absent from the production build HTML, including its confirm label; re-confirmed in the same pass that introduced the home reset, where each game route rendered exactly one control, the always-present home link. The per-game effect and the absence of any network call are asserted in `tests/local-progress.test.ts`. Note: the `nav.reset` and `nav.reset_all` strings remain inside the bundled message catalog, which is a single dictionary; no control renders or is reachable in production |
| 20 | A mistake rotates the clue card and keeps the entity reachable | FR-027c, FR-027d, SC-026, R-025 | Verified 2026-10-05 to the limit of this environment. The miss branch in `app/pages/game/match-the-series.vue` writes `clueIndex: nextUnansweredIndex(clueIndex.value)`, reusing the FR-026c predicate the Next control uses, so the two cannot drift apart; it copies `answeredClues` unchanged, which is what leaves the abandoned entity in the pool, and it issues no request. The endpoint is untouched: a non-ending miss still returns only `result`, `clueKey`, `seriesKey`, `state`, with no next-card or rotation field, asserted in `tests/routes/attempt.post.test.ts`; the persisted rotated state (advanced `clueIndex`, incremented `wrongClicks`, abandoned clue absent from `answeredClues`) is asserted in `tests/local-progress.test.ts`. The third miss returns before the rotation, so the ending never rotates. **The visible card change was not exercised by hand: no browser is available** |
| 21 | Home reset clears all three games in the browser only | FR-057b, FR-057c, SC-025, R-024 | Verified 2026-10-05 to the limit of this environment. `resetAllGames()` in `app/composables/useLocalProgress.ts` replaces the day's entry with an empty one in a single `setItem` and touches no other key, asserted in `tests/local-progress.test.ts` together with `animatch:v1:prefs` surviving, the date entry still reading today, and no `fetch` being reachable during either reset. `HomeResetControls.vue` rendered on `/` in the development build as a single control reading "Reiniciar todo (desarrollo)" and rendered **nothing** in the production build, alongside the per-game control's existing absence; the served puzzle is unchanged because the same day regenerates the identical board (R-005). No server route was added, so no code path from a page can reach `daily_puzzles` (Principle III). **The confirming click was not exercised by hand: no browser is available** |

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
