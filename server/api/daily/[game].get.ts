import { getRouterParam, createError } from 'h3'
import { isGameId } from '../../game/ids'
import { getOrCreatePuzzleFor } from '../../game/puzzleService'
import { stripSignature } from '../../db/puzzles'
import { getUtcDateNow } from '../../utils/day'
import { errorResponse } from '../../utils/http'

export default defineEventHandler(async (event) => {
  const game = getRouterParam(event, 'game')
  if (!isGameId(game)) {
    return errorResponse(event, 'UNKNOWN_GAME')
  }

  const puzzleDate = getUtcDateNow()
  try {
    const row = await getOrCreatePuzzleFor(game, puzzleDate)
    // R-010: the payload is served without the novelty signature and never with the solution.
    return { game: row.game, date: row.puzzle_date, ...(stripSignature(row.payload) as object) }
  } catch (error) {
    if ((error as { code?: string }).code === 'PUZZLE_UNAVAILABLE') {
      return errorResponse(event, 'PUZZLE_UNAVAILABLE')
    }
    if ((error as { code?: string }).code === 'DATABASE_UNAVAILABLE') {
      return errorResponse(event, 'DATABASE_UNAVAILABLE')
    }
    throw createError({ statusCode: 503, statusMessage: 'DATABASE_UNAVAILABLE' })
  }
})