import {
  fetchAnimeSeasonById,
  fetchSameAnimePools,
  fetchSameLanguagePools,
  fetchSameSeasonPool,
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
    case 'same_language':
      return tile.animeId === check.criterion.animeId && tile.language === check.criterion.language
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
  const [animePools, seasonTiles, languagePools, actorPools] = await Promise.all([
    fetchSameAnimePools(),
    fetchSameSeasonPool(season.year, season.season),
    fetchSameLanguagePools(),
    fetchSameVoiceActorPools(),
  ])

  const seasonMap = new Map(seasonTiles.map((tile) => [tile.animeId, { season: season.season, year: season.year }]))

  const recent = await fetchRecentSignatures(game, puzzleDate)
  const daySeed = computePuzzleSignature(game, puzzleDate)

  for (let attempt = 0; attempt < MAX_NOVELTY_RETRIES; attempt += 1) {
    const prng = createPrngFromSeed(attempt === 0 ? daySeed : sha256Hex(`${daySeed}:${attempt}`))

    // One candidate group per criterion type, chosen deterministically from its pool.
    const animePool = animePools[Math.floor(prng() * animePools.length)]
    const languagePool = languagePools[Math.floor(prng() * languagePools.length)]
    const actorPool = actorPools[Math.floor(prng() * actorPools.length)]
    if (!animePool || !languagePool || !actorPool || seasonTiles.length < GROUPS_GROUP_SIZE) {
      throw new PuzzleUnavailableError('the catalog cannot fill four groups')
    }

    const proposed: GroupsSolutionGroup[] = [
      {
        keys: pickFour(shuffle(animePool.tiles, prng), prng).map(toKey),
        criterion: { type: 'same_anime', animeId: animePool.animeId },
      },
      {
        keys: pickFour(shuffle(seasonTiles, prng), prng).map(toKey),
        criterion: { type: 'same_season', season: season.season, year: season.year },
      },
      {
        keys: pickFour(shuffle(languagePool.tiles, prng), prng).map(toKey),
        criterion: {
          type: 'same_language',
          animeId: languagePool.animeId,
          language: languagePool.language,
        },
      },
      {
        keys: pickFour(shuffle(actorPool.tiles, prng), prng).map(toKey),
        criterion: { type: 'same_voice_actor', personId: actorPool.personId },
      },
    ]

    // FR-037: no repeated tile key and no repeated display label anywhere on the board.
    const allKeys = proposed.flatMap((group) => group.keys)
    if (new Set(allKeys).size !== GROUPS_BOARD_SIZE) {
      continue
    }
    const tileByKey = new Map<string, GroupCandidateTile>()
    for (const pool of [animePool.tiles, languagePool.tiles, actorPool.tiles, seasonTiles]) {
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