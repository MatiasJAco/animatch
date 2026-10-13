import type { GameId } from './ids'
import { GAME_IDS } from './ids'
import { getUtcDateNow, type PuzzleDate } from '../utils/day'
import { logDatabaseFailure } from '../db/pool'
import {
  countMatchableCurrentSeasonSeries,
  countPeopleWithAtLeastOneRole,
  countVoicedCharacters,
} from '../catalog/queries'
import { isMatchEditionId, matchSeasonFor } from './matchSeasons'

export type GameStatus = 'ready' | 'unavailable' | 'error'

export interface DailyGameEntry {
  game: GameId
  status: GameStatus
  code?: string
}

export interface DailyListing {
  date: PuzzleDate
  games: DailyGameEntry[]
}

// Board sizes from the spec: a chain of 11 actors, 16 series, 16 tiles.
const REQUIRED_PEOPLE = 11
const REQUIRED_SERIES = 16
const REQUIRED_TILES = 16

async function probeCoverage(game: GameId): Promise<boolean> {
  if (game === 'more_or_less') {
    return (await countPeopleWithAtLeastOneRole()) >= REQUIRED_PEOPLE
  }
  if (game === 'groups') {
    return (await countVoicedCharacters()) >= REQUIRED_TILES
  }
  // Each Match the Series edition is probed against its own fixed season, never the UTC date.
  if (isMatchEditionId(game)) {
    const { season, year } = matchSeasonFor(game)
    return (await countMatchableCurrentSeasonSeries(year, season)) >= REQUIRED_SERIES
  }
  return false
}

// Availability is per game, so a coverage gap in one game never blanks the home page.
async function resolveStatus(game: GameId): Promise<DailyGameEntry> {
  try {
    return (await probeCoverage(game))
      ? { game, status: 'ready' }
      : { game, status: 'unavailable', code: 'PUZZLE_UNAVAILABLE' }
  } catch (error) {
    // Principle V: the visitor sees DATABASE_UNAVAILABLE, the operator sees why. The
    // underlying error is logged, never returned.
    logDatabaseFailure(`daily_listing.coverage ${game}`, error)
    return { game, status: 'error', code: 'DATABASE_UNAVAILABLE' }
  }
}

export async function listDaily(): Promise<DailyListing> {
  const date = getUtcDateNow()
  const games = await Promise.all(GAME_IDS.map((game) => resolveStatus(game)))
  return { date, games }
}
