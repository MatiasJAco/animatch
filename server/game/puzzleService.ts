import type { GameId } from './ids'
import { getOrCreateDailyPuzzle, type DailyPuzzleRow } from '../db/puzzles'
import { generateMoreOrLess } from '../generators/moreOrLess'
import { generateMatchTheSeries } from '../generators/matchTheSeries'
import { generateGroups } from '../generators/groups'
import { getCalendarSeason } from '../utils/day'
import { matchSeasonFor } from './matchSeasons'

export class GeneratorError extends Error {
  constructor(
    readonly code: 'PUZZLE_UNAVAILABLE' | 'DATABASE_UNAVAILABLE',
    message: string,
  ) {
    super(message)
  }
}

type Generate = (
  game: GameId,
  puzzleDate: string,
) => Promise<{ payload: unknown; solution: unknown }>

const GENERATORS: Record<GameId, Generate> = {
  more_or_less: (game, puzzleDate) => generateMoreOrLess(game, puzzleDate),
  // FR-005/FR-016: each Match the Series edition always uses its own fixed season, never the
  // UTC date. Autumn, Spring, and Summer 2026 are the three editions.
  match_the_series_autumn_2026: (game, puzzleDate) =>
    generateMatchTheSeries(game, puzzleDate, matchSeasonFor(game)),
  match_the_series_spring_2026: (game, puzzleDate) =>
    generateMatchTheSeries(game, puzzleDate, matchSeasonFor(game)),
  match_the_series_summer_2026: (game, puzzleDate) =>
    generateMatchTheSeries(game, puzzleDate, matchSeasonFor(game)),
  groups: (game, puzzleDate) =>
    generateGroups(game, puzzleDate, getCalendarSeason(new Date(`${puzzleDate}T00:00:00.000Z`))),
}

/** FR-003: exactly one stored puzzle per game per UTC day, created on first request. */
export async function getOrCreatePuzzleFor(
  game: GameId,
  puzzleDate: string,
): Promise<DailyPuzzleRow> {
  try {
    return await getOrCreateDailyPuzzle(game, puzzleDate, () => GENERATORS[game](game, puzzleDate))
  } catch (error) {
    if (error instanceof GeneratorError) {
      throw error
    }
    const code = (error as { code?: string } | null)?.code
    if (code === 'PUZZLE_UNAVAILABLE') {
      throw new GeneratorError('PUZZLE_UNAVAILABLE', (error as Error).message)
    }
    throw new GeneratorError('DATABASE_UNAVAILABLE', (error as Error).message)
  }
}
