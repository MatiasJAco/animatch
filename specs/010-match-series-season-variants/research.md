# Research: Match the Series Seasonal Editions (Autumn, Spring, Summer 2026)

## R1 — How to represent the three editions as games

**Question**: Should each season become one game in the existing `GameId` model, or
should Match the Series stay one game with a season parameter?

**Decision**: Each edition is a full game identity, added to `GameId`:
`match_the_series_autumn_2026`, `match_the_series_spring_2026`, and
`match_the_series_summer_2026`. The season-less `match_the_series` identity is removed.

**Rationale**: The home page, daily API, attempt/expire routes, stored puzzle rows, and
client-side saved state are all keyed by `GameId`. Treating an edition as a game identity
lets every existing mechanism (status probe, deterministic daily puzzle, client resume,
reset, share) work unchanged, without inventing a second dimension. A season parameter
would have to be threaded through routes, storage, and identity for no benefit.

**Alternatives considered**:
- Keep `match_the_series` and add only the two past-season identities. Rejected:
  it leaves a season-less name and a mixed identity scheme, and the Autumn edition
  would still depend on the UTC calendar.
- Introduce a composite key such as `match_the_series:autumn_2026`. Rejected:
  not safe in URL paths, storage keys, or the database `game` column without extra
  normalization.

## R2 — How an edition's season is determined

**Question**: Should the fixed season come from the current UTC date, from configuration,
or from the edition identity?

**Decision**: The season and year are fixed constants derived from the edition identity
through a small lookup (`matchSeasonFor(game)`). They are never recomputed from the UTC
date, catalog data, or client input. Internally the Autumn season maps to the catalog
value `fall`, but is always displayed as "Autumn".

**Rationale**: The feature is explicitly about seasons that are named and fixed
(Autumn 2026, Spring 2026, Summer 2026). Deriving the season at request time would make
the "past season" games drift as the real calendar advances, violating the product
promise. A lookup keyed only on identity keeps generation deterministic and keeps the
availability probe honest.

**Alternatives considered**:
- Pass the season through the API or client. Rejected: violates the no-trust and
  stateless design, and would let a client pick an arbitrary season.
- Store the season in `daily_puzzles`. Rejected: the season is a property of the game,
  not of a day's puzzle; repeating it per row duplicates data.

## R3 — Database and storage impact

**Question**: Does this need a migration or a change to `daily_puzzles`?

**Decision**: No schema change. `daily_puzzles.game` is free text, so the three new game
identities store rows exactly like the existing games. No migration is added.

**Rationale**: The catalog tables are read-only and no other table constrains the set of
game identities. The existing unique key `(game, puzzle_date)` already gives one puzzle
per edition per UTC day.

**Alternatives considered**:
- Add a games/seasons table. Rejected: introduces a new owned table with no behavior
  the constants cannot already provide, and increases scope without benefit.

## R4 — Route and component duplication

**Question**: Should each edition get a copied page, or should the Match the Series page be
parameterized?

**Decision**: Extract the existing Match the Series page body into a reusable component
`MatchTheSeriesGame.vue` that accepts the `GameId` as a prop, and have small static
wrapper pages (`match-the-series-autumn-2026.vue`, etc.) render it. Old
`match-the-series.vue` is removed.

**Rationale**: Static wrapper pages preserve the existing `/game/<id>` route shape and the
home card's `props.game.replace(/_/g, '-')` mapping, while a shared component avoids
copying ~200 lines of logic. The game identity is the only difference between wrappers.

**Alternatives considered**:
- One dynamic route `[game].vue`. Rejected: it would also subsume More or Less and
  Groups and force a broader routing refactor.
- Three fully copied pages. Rejected: identical logic three times is a maintenance and
  drift hazard; the test cap does not reward duplication.

## R5 — Home page ordering and layout

**Question**: How should the five games be displayed and ordered?

**Decision**: Keep the existing game list but make `.game-list` a responsive grid
(auto-fill, minimum card width) rather than a single column, and order `GAME_IDS` so
More or Less, then the Autumn 2026 edition, then Spring 2026, then Summer 2026,
then Groups. The fixed order is what the listing returns; no client-side sort is added.

**Rationale**: The grid handles five cards gracefully across phone and desktop without
adding a dependency, and a single authoritative order (the backend listing) keeps the
server and client consistent. Putting the current season first satisfies the explicit
ordering requirement.

**Alternatives considered**:
- Client-side sort by name. Rejected: locale-dependent and a second source of truth.
- Move all Match editions after Groups. Rejected: breaks the existing grouping where
  Match the Series sat between More or Less and Groups.

## R6 — Stale client state from the old game key

**Question**: What happens to saved state under the removed `match_the_series` key?

**Decision**: `useLocalProgress` keeps its `v: 1` shape. During `sanitize`, entries
whose key is not one of the current `GameId`s (including the old `match_the_series`)
are deleted, so the visitor simply starts an edition fresh and reset-all clears them.

**Rationale**: This degrades gracefully, matching the constitution (empty state on
lost storage) and the feature's "ignored, not an error" requirement, with no migration
version bump.

**Alternatives considered**:
- Bump storage to v2 and migrate the old entry into the Autumn edition. Rejected:
  assumes the old entry's season matches Autumn, is unverifiable, and adds
  versioning/migration work for no user value.

## R7 — Game card and i18n strings

**Question**: How are game names and route slugs formed?

**Decision**: Add message-catalog entries for the three edition identities in both
languages, e.g. "Match the Series — Autumn 2026" / "Empareja la serie — Otoño 2026".
The card slug is produced by the existing `props.game.replace(/_/g, '-')`, so no
routing change is needed. Board/help copy uses the neutral "series" wording rather
than "current-season series".

**Rationale**: Reuses the existing name/slug/address machinery exactly. Neutral board
copy keeps the past-season editions accurate.

**Alternatives considered**:
- Keep "current-season series" wording for all editions. Rejected: factually wrong
  for the Spring and Summer editions.