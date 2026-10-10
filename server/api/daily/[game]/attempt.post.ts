import { getRouterParam, readBody } from 'h3'
import { isGameId } from '../../../game/ids'
import { getOrCreatePuzzleFor } from '../../../game/puzzleService'
import { GeneratorError } from '../../../game/puzzleService'
import { stripSignature } from '../../../db/puzzles'
import { getUtcDateNow } from '../../../utils/day'
import { errorResponse } from '../../../utils/http'
import {
  InvalidAttemptError,
  parseMoreOrLessAttempt,
  resolveMoreOrLessOutcome,
  type MoreOrLessAttemptBody,
  type MoreOrLessPuzzleData,
  type MoreOrLessSolution,
} from '../../../game/moreOrLess'
import {
  MatchInvalidAttemptError,
  parseMatchAttempt,
  resolveMatchOutcome,
  verifyMatchProgress,
  type MatchTheSeriesAttemptBody,
  type MatchTheSeriesPayloadData,
  type MatchTheSeriesSolution,
} from '../../../game/matchTheSeries'
import {
  GroupsInvalidAttemptError,
  parseGroupsAttempt,
  resolveGroupsOutcome,
  verifyGroupsProgress,
  type GroupsAttemptBody,
  type GroupsPayloadData,
  type GroupsSolution,
} from '../../../game/groups'

/**
 * FR-039 / FR-041: the attempt is validated against the stored puzzle. The server holds no
 * game state, and the outcome never carries an attempt count; counting lives on the device.
 */
async function resolveAttempt(game: string, body: unknown) {
  if (game === 'more_or_less') {
    const row = await getOrCreatePuzzleFor('more_or_less', getUtcDateNow())
    const payload = stripSignature(row.payload) as MoreOrLessPuzzleData
    const solution = row.solution as MoreOrLessSolution
    const { round, answer } = parseMoreOrLessAttempt((body ?? {}) as MoreOrLessAttemptBody)
    return { outcome: resolveMoreOrLessOutcome(payload, solution, round, answer) }
  }

  if (game === 'match_the_series') {
    const row = await getOrCreatePuzzleFor('match_the_series', getUtcDateNow())
    const payload = stripSignature(row.payload) as MatchTheSeriesPayloadData
    const solution = row.solution as MatchTheSeriesSolution

    // Constitution IV: the board lives on the device, so the server stores nothing
    // (FR-041, R-012). The device presents the pairs it has already scored and the server
    // re-derives the green tiles from the stored answer key.
    const attempt = parseMatchAttempt((body ?? {}) as MatchTheSeriesAttemptBody)
    const progress = verifyMatchProgress(solution, attempt.greenPairs)
    // FR-026: the outcome echoes the clicked pair and nothing else, so the evidence list
    // stays on this side of the boundary.
    return {
      outcome: resolveMatchOutcome(payload, solution, {
        clueKey: attempt.clueKey,
        seriesKey: attempt.seriesKey,
      }, progress),
    }
  }

  if (game === 'groups') {
    const row = await getOrCreatePuzzleFor('groups', getUtcDateNow())
    const payload = stripSignature(row.payload) as GroupsPayloadData
    const solution = row.solution as GroupsSolution

    const knownKeys = new Set(payload.tiles.map((tile) => tile.key))
    const attempt = parseGroupsAttempt((body ?? {}) as GroupsAttemptBody, knownKeys)

    // Constitution IV: the found groups and the rejected proposals are re-checked against
    // the stored solution, so neither the consumed tiles nor the mistake count is believed.
    const progress = verifyGroupsProgress(solution, attempt.foundGroups, attempt.missLog)

    return { outcome: resolveGroupsOutcome(solution, attempt.tileKeys, progress) }
  }

  return { error: 'UNSUPPORTED' as const }
}

export default defineEventHandler(async (event) => {
  const game = getRouterParam(event, 'game')
  if (!isGameId(game)) {
    return errorResponse(event, 'UNKNOWN_GAME')
  }

  const body = await readBody(event).catch(() => null)

  try {
    const result = await resolveAttempt(game, body)
    if ('error' in result) {
      return errorResponse(event, 'UNKNOWN_GAME')
    }
    return result.outcome
  } catch (error) {
    if (
      error instanceof InvalidAttemptError ||
      error instanceof MatchInvalidAttemptError ||
      error instanceof GroupsInvalidAttemptError
    ) {
      return errorResponse(event, 'INVALID_ATTEMPT')
    }
    if (error instanceof GeneratorError) {
      return errorResponse(event, error.code)
    }
    return errorResponse(event, 'DATABASE_UNAVAILABLE')
  }
})