import { getRouterParam } from 'h3'
import { getUtcDateNow } from '../../../utils/day'
import { errorResponse } from '../../../utils/http'
import { GeneratorError, getOrCreatePuzzleFor } from '../../../game/puzzleService'
import { resolveMatchExpire, type MatchTheSeriesSolution } from '../../../game/matchTheSeries'
import { isGameId } from '../../../game/ids'
import { isMatchEditionId } from '../../../game/matchSeasons'

// FR-006/FR-007: the client reports that the countdown hit zero and the server returns the
// withheld mapping. Stateless: nothing is stored and no session is created (Constitution IV).
// Only the Match the Series editions have a timed ending, so the other games are rejected.
export default defineEventHandler(async (event) => {
  const game = getRouterParam(event, 'game')
  if (!isGameId(game) || !isMatchEditionId(game)) {
    return errorResponse(event, 'UNKNOWN_GAME')
  }

  try {
    const row = await getOrCreatePuzzleFor(game, getUtcDateNow())
    const solution = row.solution as MatchTheSeriesSolution
    return resolveMatchExpire(solution)
  } catch (error) {
    if (error instanceof GeneratorError) {
      return errorResponse(event, error.code)
    }
    return errorResponse(event, 'DATABASE_UNAVAILABLE')
  }
})
