export const MATCH_WRONG_LIMIT = 3
export const MATCH_BOARD_SIZE = 9
// R-019: two cards per grid series, so every tile keeps a second correct route
// and the Next control never dead-ends.
export const MATCH_CLUE_COUNT = 18

export type MatchClueKind = 'character' | 'person'

export interface MatchTheSeriesClue {
  key: string // 'c:12345' | 'p:678'
  kind: MatchClueKind
  name: string
}

export interface MatchTheSeriesSeries {
  key: string // 'a:9001'
  title: string
}

export interface MatchTheSeriesGrid {
  rows: 3
  cols: 3
  series: MatchTheSeriesSeries[]
}

export interface MatchTheSeriesPayloadData {
  game: 'match_the_series'
  date: string
  season: { season: string; year: number }
  grid: MatchTheSeriesGrid
  clues: MatchTheSeriesClue[]
  wrongLimit: number
}

export interface MatchTheSeriesSolution {
  answers: Record<string, string> // clueKey -> seriesKey
}

export interface MatchTheSeriesAttemptBody {
  clueKey?: unknown
  seriesKey?: unknown
  // Constitution IV: the board lives on the device, so the server cannot see how many tiles
  // are green. It can check a claim against the stored solution, which never reaches the
  // client, so the device presents the pairs it has already scored rather than a bare
  // `green` key list and a `misses` integer that would simply be believed.
  greenPairs?: unknown
  missLog?: unknown
}

export interface MatchTheSeriesOutcomeHit {
  result: 'hit'
  clueKey: string
  seriesKey: string
  state: 'in_progress' | 'won'
}

// FR-027a: below the mistake limit nothing is disclosed about the correct series.
export interface MatchTheSeriesOutcomeMissInPlay {
  result: 'miss'
  clueKey: string
  seriesKey: string
  state: 'in_progress'
}

// FR-027: the ending miss discloses this pairing and the full mapping.
export interface MatchTheSeriesOutcomeMissEnded {
  result: 'miss'
  clueKey: string
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

// R-020: the attempt names the clue card that was on screen. Without it the server
// would have to assume which card is showing and could score a stale client wrongly.
export function parseMatchAttempt(body: MatchTheSeriesAttemptBody): {
  clueKey: string
  seriesKey: string
  greenPairs: MatchScoredPair[]
  missLog: MatchScoredPair[]
} {
  const clueKey = body?.clueKey
  const seriesKey = body?.seriesKey
  if (typeof clueKey !== 'string' || typeof seriesKey !== 'string') {
    throw new MatchInvalidAttemptError('clueKey and seriesKey are required')
  }
  return {
    clueKey,
    seriesKey,
    greenPairs: parseScoredPairs(body?.greenPairs, 'greenPairs'),
    missLog: parseScoredPairs(body?.missLog, 'missLog'),
  }
}

export interface MatchScoredPair {
  clueKey: string
  seriesKey: string
}

function parseScoredPairs(value: unknown, field: string): MatchScoredPair[] {
  if (value === undefined || value === null) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new MatchInvalidAttemptError(`${field} must be a list of scored pairs`)
  }
  return value.map((entry) => {
    if (
      entry === null ||
      typeof entry !== 'object' ||
      typeof (entry as MatchScoredPair).clueKey !== 'string' ||
      typeof (entry as MatchScoredPair).seriesKey !== 'string'
    ) {
      throw new MatchInvalidAttemptError(`${field} holds a malformed pair`)
    }
    return { clueKey: (entry as MatchScoredPair).clueKey, seriesKey: (entry as MatchScoredPair).seriesKey }
  })
}

export interface MatchVerifiedProgress {
  green: Set<string>
  misses: number
}

/**
 * Constitution IV: re-derives the board from the stored solution.
 *
 * The answer key is never sent to the client, so a claimed green tile only survives if the
 * device can present the clue card that genuinely answers for it, and a logged miss only
 * survives if that pairing is genuinely wrong. A bare `green` list or `misses` count can no
 * longer decide the outcome.
 *
 * FR-027d keeps an abandoned card in the pool, so the same clue may be missed twice and is
 * deliberately not deduplicated. FR-035 counts mistakes on the device by design (R-013), and
 * with no stored state the server cannot separate a repeated real miss from a padded one;
 * that residual belongs to the stateless contract, not to this check.
 */
export function verifyMatchProgress(
  solution: MatchTheSeriesSolution,
  greenPairs: readonly MatchScoredPair[],
  missLog: readonly MatchScoredPair[],
): MatchVerifiedProgress {
  const green = new Set<string>()
  for (const pair of greenPairs) {
    if (solution.answers[pair.clueKey] !== pair.seriesKey) {
      throw new MatchInvalidAttemptError('a claimed green pair is not a correct pairing')
    }
    green.add(pair.seriesKey)
  }

  for (const pair of missLog) {
    const correct = solution.answers[pair.clueKey]
    if (correct === undefined) {
      throw new MatchInvalidAttemptError('a logged miss references an unknown clue card')
    }
    if (correct === pair.seriesKey) {
      throw new MatchInvalidAttemptError('a logged miss is actually a correct pairing')
    }
  }

  return { green, misses: missLog.length }
}

/**
 * Validates the answer against the stored puzzle only; the server holds no game state,
 * so the caller presents its board as evidence the server re-derives. The Next control
 * never reaches this function: it is a client-side skip, not an answer (FR-026b).
 */
export function resolveMatchOutcome(
  payload: MatchTheSeriesPayloadData,
  solution: MatchTheSeriesSolution,
  attempt: { clueKey: string; seriesKey: string },
  progress: MatchVerifiedProgress,
): MatchTheSeriesOutcome {
  const clueKeys = new Set(payload.clues.map((clue) => clue.key))
  const seriesKeys = new Set(payload.grid.series.map((series) => series.key))
  if (!clueKeys.has(attempt.clueKey) || !seriesKeys.has(attempt.seriesKey)) {
    throw new MatchInvalidAttemptError('answer references a card or series outside the puzzle')
  }

  const correctSeriesKey = solution.answers[attempt.clueKey]
  if (!correctSeriesKey) {
    throw new MatchInvalidAttemptError('no stored answer for that clue card')
  }

  if (attempt.seriesKey === correctSeriesKey) {
    const green = new Set(progress.green)
    green.add(correctSeriesKey)
    // FR-028: the win is all nine tiles green, not all eighteen cards answered.
    const won = green.size >= payload.grid.series.length
    return { result: 'hit', ...attempt, state: won ? 'won' : 'in_progress' }
  }

  const misses = progress.misses + 1
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
