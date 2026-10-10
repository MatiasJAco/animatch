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
  greenPairs: MatchScoredPair[]
  // FR-008: remaining play time, carried through every write.
  timerRemainingMs?: number
  // FR-007: the time-out reveal, carried through every write so a reload keeps it.
  revealedAnswers?: Record<string, string>
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
 * complete state — including the green evidence the server re-derives from (Constitution IV) and
 * the timer/reveal fields the countdown and the time-out ending need to survive a reload.
 *
 * FR-001: a wrong answer never ends the game; only nine green tiles (won) or a time-out (lost,
 * written elsewhere) finish it.
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
      greenPairs: state.greenPairs.some((pair) => pair.clueKey === answer.clueKey)
        ? state.greenPairs
        : [...state.greenPairs, answer],
      timerRemainingMs: state.timerRemainingMs,
      revealedAnswers: state.revealedAnswers,
      ...(won ? { endedAt: new Date().toISOString() } : {}),
    }
  }

  return {
    status: 'in_progress',
    attempts,
    greenSeries: state.greenSeries,
    answeredClues: state.answeredClues,
    clueIndex: nextUnansweredIndex(clues, state.answeredClues, state.clueIndex),
    greenPairs: state.greenPairs,
    timerRemainingMs: state.timerRemainingMs,
    revealedAnswers: state.revealedAnswers,
  }
}
