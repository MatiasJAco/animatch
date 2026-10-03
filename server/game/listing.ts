import type { GameId } from './ids'
import { GAME_IDS } from './ids'
import { getUtcDateNow, getCalendarSeason, type PuzzleDate } from '../utils/day'
import {
  countMatchableCurrentSeasonSeries,
  countPeopleWithAtLeastOneRole,
  countVoicedCharacters,
} from '../catalog/queries'

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
  const { season, year } = getCalendarSeason()
  switch (game) {
    case 'more_or_less':
      return (await countPeopleWithAtLeastOneRole()) >= REQUIRED_PEOPLE
    case 'match_the_series':
      return (await countMatchableCurrentSeasonSeries(year, season)) >= REQUIRED_SERIES
    case 'groups':
      return (await countVoicedCharacters()) >= REQUIRED_TILES
  }
}

// Availability is per game, so a coverage gap in one game never blanks the home page.
async function resolveStatus(game: GameId): Promise<DailyGameEntry> {
  try {
    return (await probeCoverage(game))
      ? { game, status: 'ready' }
      : { game, status: 'unavailable', code: 'PUZZLE_UNAVAILABLE' }
  } catch {
    return { game, status: 'error', code: 'DATABASE_UNAVAILABLE' }
  }
}

export async function listDaily(): Promise<DailyListing> {
  const date = getUtcDateNow()
  const games = await Promise.all(GAME_IDS.map((game) => resolveStatus(game)))
  return { date, games }
}