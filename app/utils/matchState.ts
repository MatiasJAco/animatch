import type { MatchTheSeriesOutcome } from '~~/server/game/matchTheSeries'

export interface MatchScoredPair {
  clueKey: string
  seriesKey: string
}

export interface MatchBoardState {
  status: 'in_progress' | 'won' | 'lost'
  attempts: number
  greenSeries: string[]
  answeredClues: string[]
  clueIndex: number
  wrongClicks: number
  greenPairs: MatchScoredPair[]
  missLog: MatchScoredPair[]
  endedAt?: string
}

export interface MatchAnswer {
  clueKey: string
  seriesKey: string
}

// FR-026c: the next eligible card is the first unanswered card after `from`, wrapping around
// the deck; when nothing else is eligible the same index comes back (FR-026d's
// continue-showing fallback). Shared by the Next control and by the rotation after a miss so
// the two cannot drift apart.
export function nextUnansweredIndex(
  clues: readonly { key: string }[],
  answered: readonly string[],
  from: number,
): number {
  const answeredSet = new Set(answered)
  for (let step = 1; step <= clues.length; step += 1) {
    const index = (from + step) % clues.length
    if (!answeredSet.has(clues[index].key)) {
      return index
    }
  }
  return from
}

/**
 * The one place that turns an accepted attempt outcome into the next device-stored board.
 *
 * `useLocalProgress.setGameState` replaces the whole entry, so every transition must write the
 * complete state. In particular the two evidence lists the server re-derives from must be
 * carried forward (Constitution IV): a hit never clears `missLog`, or the mistake limit would
 * reset, and a miss never clears `greenPairs`, or the win condition could never be proven.
 */
export function applyMatchAnswer(
  state: MatchBoardState,
  clues: readonly { key: string }[],
  outcome: MatchTheSeriesOutcome,
  answer: MatchAnswer,
): MatchBoardState {
  const attempts = state.attempts + 1

  if (outcome.result === 'hit') {
    const greenSeries = state.greenSeries.includes(answer.seriesKey)
      ? state.greenSeries
      : [...state.greenSeries, answer.seriesKey]
    const answeredClues = [...state.answeredClues, answer.clueKey]
    const won = outcome.state === 'won'
    return {
      status: won ? 'won' : 'in_progress',
      attempts,
      greenSeries,
      answeredClues,
      clueIndex: won
        ? state.clueIndex
        : nextUnansweredIndex(clues, answeredClues, state.clueIndex),
      wrongClicks: state.wrongClicks,
      greenPairs: state.greenPairs.some((pair) => pair.clueKey === answer.clueKey)
        ? state.greenPairs
        : [...state.greenPairs, answer],
      missLog: state.missLog,
      ...(won ? { endedAt: new Date().toISOString() } : {}),
    }
  }

  const wrongClicks = state.wrongClicks + 1
  const missLog = [...state.missLog, answer]
  const lost = outcome.state === 'lost'
  return {
    status: lost ? 'lost' : 'in_progress',
    attempts,
    greenSeries: state.greenSeries,
    answeredClues: state.answeredClues,
    clueIndex: lost
      ? state.clueIndex
      : nextUnansweredIndex(clues, state.answeredClues, state.clueIndex),
    wrongClicks,
    greenPairs: state.greenPairs,
    missLog,
    ...(lost ? { endedAt: new Date().toISOString() } : {}),
  }
}