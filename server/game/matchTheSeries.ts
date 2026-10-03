export const MATCH_WRONG_LIMIT = 3
export const MATCH_BOARD_SIZE = 16

export type MatchTileKind = 'character' | 'person'

export interface MatchTheSeriesTile {
  key: string // 'c:12345' | 'p:678'
  kind: MatchTileKind
  name: string
}

export interface MatchTheSeriesSeries {
  key: string // 'a:9001'
  title: string
}

export interface MatchTheSeriesPayloadData {
  game: 'match_the_series'
  date: string
  season: { season: string; year: number }
  tiles: MatchTheSeriesTile[]
  series: MatchTheSeriesSeries[]
  wrongLimit: number
}

export interface MatchTheSeriesSolution {
  answers: Record<string, string> // tileKey -> seriesKey
}

export interface MatchTheSeriesAttemptBody {
  tileKey?: unknown
  seriesKey?: unknown
}

export interface MatchTheSeriesOutcomeHit {
  result: 'hit'
  tileKey: string
  seriesKey: string
  state: 'in_progress' | 'won'
}

// FR-027a: below the mistake limit nothing is disclosed about the correct pairing.
export interface MatchTheSeriesOutcomeMissInPlay {
  result: 'miss'
  tileKey: string
  seriesKey: string
  state: 'in_progress'
}

// FR-027: the ending miss discloses this pairing and the full solution.
export interface MatchTheSeriesOutcomeMissEnded {
  result: 'miss'
  tileKey: string
  seriesKey: string
  correctSeriesKey: string
  answers: Record<string, string>
  state: 'lost'
}

export type MatchTheSeriesOutcome =
  | MatchTheSeriesOutcomeHit
  | MatchTheSeriesOutcomeMissInPlay
  | MatchTheSeriesOutcomeMissEnded

export class MatchInvalidAttemptError extends Error {
  readonly code = 'INVALID_ATTEMPT' as const
}

export function parseMatchAttempt(body: MatchTheSeriesAttemptBody): {
  tileKey: string
  seriesKey: string
} {
  const tileKey = body?.tileKey
  const seriesKey = body?.seriesKey
  if (typeof tileKey !== 'string' || typeof seriesKey !== 'string') {
    throw new MatchInvalidAttemptError('tileKey and seriesKey are required')
  }
  return { tileKey, seriesKey }
}

export interface MatchAttemptContext {
  matched: ReadonlySet<string>
  misses: number
}

/**
 * Validates the pairing against the stored puzzle only; the server holds no game state,
 * so the caller supplies its own matched-set and mistake count.
 */
export function resolveMatchOutcome(
  payload: MatchTheSeriesPayloadData,
  solution: MatchTheSeriesSolution,
  attempt: { tileKey: string; seriesKey: string },
  context: MatchAttemptContext,
): MatchTheSeriesOutcome {
  const tileKeys = new Set(payload.tiles.map((tile) => tile.key))
  const seriesKeys = new Set(payload.series.map((series) => series.key))
  if (!tileKeys.has(attempt.tileKey) || !seriesKeys.has(attempt.seriesKey)) {
    throw new MatchInvalidAttemptError('pairing references an entity outside the puzzle')
  }

  const correctSeriesKey = solution.answers[attempt.tileKey]
  if (!correctSeriesKey) {
    throw new MatchInvalidAttemptError('no stored answer for that tile')
  }

  if (attempt.seriesKey === correctSeriesKey) {
    const matched = new Set(context.matched)
    matched.add(attempt.tileKey)
    const won = matched.size >= payload.tiles.length
    return { result: 'hit', ...attempt, state: won ? 'won' : 'in_progress' }
  }

  const misses = context.misses + 1
  if (misses >= payload.wrongLimit) {
    return {
      result: 'miss',
      ...attempt,
      correctSeriesKey,
      answers: solution.answers,
      state: 'lost',
    }
  }

  return { result: 'miss', ...attempt, state: 'in_progress' }
}