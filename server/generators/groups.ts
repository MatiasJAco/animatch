import {
  fetchAnimeSeasonById,
  fetchCurrentSeasonSeries,
  fetchSameAnimePools,
  fetchSameSeasonPool,
  fetchSameSourcePools,
  fetchSameVoiceActorPools,
  type GroupCandidateTile,
} from '../catalog/queries'
import { getPool } from '../db/pool'
import { computePuzzleSignature, type PayloadWithSignature } from '../db/puzzles'
import type { PuzzleDate } from '../utils/day'
import { utcDateFrom } from '../utils/day'
import { createPrngFromSeed, sha256Hex } from '../utils/seed'
import { shuffle } from '../utils/shuffle'
import {
  GROUPS_BOARD_SIZE,
  GROUPS_GROUP_COUNT,
  GROUPS_GROUP_SIZE,
  GROUPS_WRONG_LIMIT,
  type GroupCriterion,
  type GroupsPayloadData,
  type GroupsSolution,
  type GroupsSolutionGroup,
  type GroupsTile,
} from '../game/groups'

const NOVELTY_WINDOW_DAYS = 30
const MAX_NOVELTY_RETRIES = 8

export class PuzzleUnavailableError extends Error {
  readonly code = 'PUZZLE_UNAVAILABLE' as const
}

interface Candidate {
  tile: GroupCandidateTile
  key: string
}

function toKey(tile: GroupCandidateTile): string {
  return `c:${tile.id}@a:${tile.animeId}`
}

function toPayloadTile(tile: GroupCandidateTile): GroupsTile {
  return { key: toKey(tile), kind: 'character', name: tile.name }
}

/** A criterion plus the season identity each tile needs to be judged against it. */
interface BoardCriterion {
  criterion: GroupCriterion
  seasonOf: (tile: GroupCandidateTile) => { season: string; year: number } | undefined
}

// R-011: every criterion is a function of the pinned fields on the tile, never of extra lookups.
function holds(tile: GroupCandidateTile, check: BoardCriterion): boolean {
  switch (check.criterion.type) {
    case 'same_anime':
      return tile.animeId === check.criterion.animeId
    case 'same_source':
      // The tile is judged by its own pinned source material (research R-005); sharing an
      // anime or a language never suffices.
      return tile.source === check.criterion.source
    case 'same_voice_actor':
      return tile.voiceActorId === check.criterion.personId
    case 'same_season': {
      // FR-038: season identity is (season, year), so years never merge.
      const season = check.seasonOf(tile)
      return (
        season !== undefined &&
        season.season === check.criterion.season &&
        season.year === check.criterion.year
      )
    }
  }
}

/**
 * Enumerates all 1820 four-tile subsets. Exactly four must satisfy a criterion, each under
 * exactly one, and they must be the four intended groups. Anything else means the board would
 * admit an ambiguous or missing answer (FR-037).
 */
export function findValidGroups(
  tiles: readonly GroupCandidateTile[],
  groups: readonly GroupsSolutionGroup[],
  seasonOf: (tile: GroupCandidateTile) => { season: string; year: number } | undefined,
): { valid: GroupCriterion[]; ambiguous: boolean } {
  const checks: BoardCriterion[] = groups.map((group) => ({
    criterion: group.criterion,
    seasonOf,
  }))

  const valid: GroupCriterion[] = []
  const n = tiles.length
  for (let a = 0; a < n - 3; a += 1) {
    for (let b = a + 1; b < n - 2; b += 1) {
      for (let c = b + 1; c < n - 1; c += 1) {
        for (let d = c + 1; d < n; d += 1) {
          const subset = [tiles[a], tiles[b], tiles[c], tiles[d]]
          const matches = checks.filter((check) => subset.every((tile) => holds(tile, check)))
          if (matches.length > 1) {
            // FR-037: a subset correct under two criteria at once is ambiguous.
            return { valid, ambiguous: true }
          }
          if (matches.length === 1) {
            valid.push(matches[0].criterion)
          }
        }
      }
    }
  }
  return { valid, ambiguous: false }
}

export function contentSignature(groups: readonly GroupsSolutionGroup[]): string {
  return sha256Hex(
    groups
      .map((group) => `${group.criterion.type}:${[...group.keys].sort().join(',')}`)
      .sort()
      .join('|'),
  )
}

async function fetchRecentSignatures(game: 'groups', puzzleDate: PuzzleDate): Promise<Set<string>> {
  const anchor = new Date(`${puzzleDate}T00:00:00.000Z`)
  anchor.setUTCDate(anchor.getUTCDate() - NOVELTY_WINDOW_DAYS)
  const { rows } = await getPool().query<{ payload: unknown }>(
    `SELECT payload FROM daily_puzzles
     WHERE game = $1 AND puzzle_date > $2 AND puzzle_date < $3`,
    [game, utcDateFrom(anchor), puzzleDate],
  )
  const signatures = new Set<string>()
  for (const row of rows) {
    const payload = row.payload as Partial<PayloadWithSignature> | null
    if (payload && typeof payload.signature === 'string') {
      signatures.add(payload.signature)
    }
  }
  return signatures
}

export async function generateGroups(
  game: 'groups',
  puzzleDate: PuzzleDate,
  season: { season: string; year: number },
): Promise<{ payload: PayloadWithSignature; solution: GroupsSolution }> {
  const [animePools, seasonTiles, rawSourcePools, actorPools] = await Promise.all([
    fetchSameAnimePools(),
    fetchSameSeasonPool(season.year, season.season),
    fetchSameSourcePools(),
    fetchSameVoiceActorPools(),
  ])

  const seasonMap = new Map(seasonTiles.map((tile) => [tile.animeId, { season: season.season, year: season.year }]))

  // Availability (R-007): the season group owns the airing season. A tile drawn from a same-season
  // anime by any other group would make the board admit extra same_season subsets and fail the
  // exactly-four gate, so the source, anime, and actor pools drop currently-airing anime — and the
  // too-thin survivors — before any candidate is made.
  const seasonSeries = await fetchCurrentSeasonSeries(season.year, season.season)
  const currentSeasonIds = new Set(seasonSeries.map((series) => series.anime_mal_id))
  const cutSeason = <P extends { tiles: GroupCandidateTile[] }>(pool: P): P | null => {
    const tiles = pool.tiles.filter((tile) => !currentSeasonIds.has(tile.animeId))
    return tiles.length >= GROUPS_GROUP_SIZE ? { ...pool, tiles } : null
  }
  const eligibleAnimePools = animePools.map(cutSeason).filter((p): p is NonNullable<typeof p> => p !== null)
  const eligibleActorPools = actorPools.map(cutSeason).filter((p): p is NonNullable<typeof p> => p !== null)
  // R-004: a source group must also span four distinct anime, never a hidden same-anime group.
  const sourcePools = rawSourcePools
    .map(cutSeason)
    .filter(
      (p): p is NonNullable<typeof p> =>
        p !== null && new Set(p.tiles.map((tile) => tile.animeId)).size >= GROUPS_GROUP_SIZE,
    )
  if (sourcePools.length === 0 || eligibleAnimePools.length === 0 || eligibleActorPools.length === 0) {
    throw new PuzzleUnavailableError('no source pool survives the current-season cut')
  }

  // R-007: candidate source pools are attempted smallest-footprint-first, so the niche sources
  // (which clear the exactly-one-subset gate) are used before the large ones are ever needed.
  const sourceFootprint = (pool: { tiles: GroupCandidateTile[] }) =>
    new Set(pool.tiles.map((tile) => tile.animeId)).size
  const sortedSourcePools = [...sourcePools].sort((a, b) => {
    const byFootprint = sourceFootprint(a) - sourceFootprint(b)
    return byFootprint !== 0 ? byFootprint : a.source < b.source ? -1 : a.source > b.source ? 1 : 0
  })

  const recent = await fetchRecentSignatures(game, puzzleDate)
  const daySeed = computePuzzleSignature(game, puzzleDate)

  for (let attempt = 0; attempt < MAX_NOVELTY_RETRIES; attempt += 1) {
    const prng = createPrngFromSeed(attempt === 0 ? daySeed : sha256Hex(`${daySeed}:${attempt}`))

    // One candidate group per criterion type, chosen deterministically from its pool. The anime,
    // season, and actor groups are drawn first so their twelve tiles pin down which sources must
    // stay off the board (R-007).
    const animePool = eligibleAnimePools[Math.floor(prng() * eligibleAnimePools.length)]
    const actorPool = eligibleActorPools[Math.floor(prng() * eligibleActorPools.length)]
    if (!animePool || !actorPool || seasonTiles.length < GROUPS_GROUP_SIZE) {
      throw new PuzzleUnavailableError('the catalog cannot fill four groups')
    }

    const animePick = pickFour(shuffle(animePool.tiles, prng), prng)
    const seasonPick = pickFour(shuffle(seasonTiles, prng), prng)
    const actorPick = pickFour(shuffle(actorPool.tiles, prng), prng)
    const otherTiles = [...animePick, ...seasonPick, ...actorPick]
    const pickedKeys = new Set(otherTiles.map(toKey))
    const presentSources = new Set(otherTiles.map((tile) => tile.source))

    // Smallest-footprint-first among the pools whose source is absent from the other twelve tiles:
    // a golden source that also appears there would admit extra same_source subsets. A candidate
    // whose tiles collide with a picked key is unusable, and a source tile voiced by the actor
    // under test would make that subset ambiguous. The gate still re-verifies the whole board.
    let chosen: { pool: (typeof sortedSourcePools)[number]; tiles: GroupCandidateTile[] } | undefined
    for (const pool of sortedSourcePools) {
      if (presentSources.has(pool.source)) {
        continue
      }
      const tiles = pool.tiles.filter(
        (tile) => !pickedKeys.has(toKey(tile)) && tile.voiceActorId !== actorPool.personId,
      )
      if (
        tiles.length >= GROUPS_GROUP_SIZE &&
        new Set(tiles.map((tile) => tile.animeId)).size >= GROUPS_GROUP_SIZE
      ) {
        chosen = { pool, tiles }
        break
      }
    }
    if (!chosen) {
      continue
    }

    const proposed: GroupsSolutionGroup[] = [
      {
        keys: animePick.map(toKey),
        criterion: { type: 'same_anime', animeId: animePool.animeId },
      },
      {
        keys: seasonPick.map(toKey),
        criterion: { type: 'same_season', season: season.season, year: season.year },
      },
      {
        keys: pickFour(shuffle(chosen.tiles, prng), prng).map(toKey),
        criterion: {
          type: 'same_source',
          source: chosen.pool.source,
        },
      },
      {
        keys: actorPick.map(toKey),
        criterion: { type: 'same_voice_actor', personId: actorPool.personId },
      },
    ]
    const sourcePool = chosen.pool

    // FR-037: no repeated tile key and no repeated display label anywhere on the board.
    const allKeys = proposed.flatMap((group) => group.keys)
    if (new Set(allKeys).size !== GROUPS_BOARD_SIZE) {
      continue
    }
    const tileByKey = new Map<string, GroupCandidateTile>()
    for (const pool of [animePool.tiles, sourcePool.tiles, actorPool.tiles, seasonTiles]) {
      for (const tile of pool) {
        tileByKey.set(toKey(tile), tile)
      }
    }
    const boardTiles = allKeys.map((key) => tileByKey.get(key)).filter(Boolean) as GroupCandidateTile[]
    if (new Set(boardTiles.map((tile) => tile.name)).size !== GROUPS_BOARD_SIZE) {
      continue
    }

    // Every candidate tile must have a season identity so same_season can be judged on the board.
    for (const tile of boardTiles) {
      if (!seasonMap.has(tile.animeId)) {
        // Principle I: the catalog module owns every catalog read, so this calls the
        // catalog query instead of issuing SQL of its own.
        const found = await fetchAnimeSeasonById(tile.animeId)
        if (found) {
          seasonMap.set(tile.animeId, { season: found.season, year: found.year })
        }
      }
    }

    const { valid, ambiguous } = findValidGroups(boardTiles, proposed, (tile) =>
      seasonMap.get(tile.animeId),
    )
    if (ambiguous || valid.length !== GROUPS_GROUP_COUNT) {
      continue
    }
    const found = new Set(valid.map((criterion) => `${criterion.type}:${JSON.stringify(criterion)}`))
    const intended = new Set(
      proposed.map((group) => `${group.criterion.type}:${JSON.stringify(group.criterion)}`),
    )
    if (found.size !== intended.size || [...intended].some((key) => !found.has(key))) {
      continue
    }

    const sig = contentSignature(proposed)
    if (recent.has(sig)) {
      continue
    }

    const payloadData: GroupsPayloadData = {
      game,
      date: puzzleDate,
      tiles: shuffle(boardTiles.map(toPayloadTile), prng),
      groupCount: GROUPS_GROUP_COUNT,
      wrongLimit: GROUPS_WRONG_LIMIT,
    }
    return { payload: { signature: sig, data: payloadData }, solution: { groups: proposed } }
  }

  throw new PuzzleUnavailableError('could not find a valid groups board')
}

function pickFour(tiles: readonly GroupCandidateTile[], prng: () => number): GroupCandidateTile[] {
  const picked: GroupCandidateTile[] = []
  const seen = new Set<number>()
  for (const tile of tiles) {
    if (picked.length >= GROUPS_GROUP_SIZE) {
      break
    }
    if (!seen.has(tile.id)) {
      seen.add(tile.id)
      picked.push(tile)
    }
  }
  if (picked.length < GROUPS_GROUP_SIZE) {
    throw new PuzzleUnavailableError('a candidate pool could not supply four distinct tiles')
  }
  return picked
}