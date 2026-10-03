export const ROUNDS = 10

export interface PersonTile {
  id: number
  name: string
}

export interface VisiblePersonTile extends PersonTile {
  roleCount: number
}

export interface MoreOrLessPuzzleData {
  game: 'more_or_less'
  date: string
  rounds: number
  chain: PersonTile[]
  initialVisible: VisiblePersonTile
}

export interface MoreOrLessSolution {
  answers: Array<'more' | 'less'>
  roleCounts: Record<string, number>
}

export type MoreOrLessAnswer = 'more' | 'less'

export interface MoreOrLessCounts {
  hidden: number
  visible: number
}

export interface MoreOrLessOutcome {
  result: 'hit' | 'miss'
  round: number
  correct: MoreOrLessAnswer
  given: MoreOrLessAnswer
  counts: MoreOrLessCounts
  state: 'in_progress' | 'won' | 'lost'
}

export class InvalidAttemptError extends Error {
  readonly code = 'INVALID_ATTEMPT' as const
}

export interface MoreOrLessAttemptBody {
  round?: unknown
  answer?: unknown
}

export function parseMoreOrLessAttempt(body: MoreOrLessAttemptBody): {
  round: number
  answer: MoreOrLessAnswer
} {
  const { round, answer } = body ?? {}

  if (typeof round !== 'number' || !Number.isInteger(round) || round < 0 || round >= ROUNDS) {
    throw new InvalidAttemptError(`round out of range: ${String(round)}`)
  }
  if (answer !== 'more' && answer !== 'less') {
    throw new InvalidAttemptError(`unknown answer: ${String(answer)}`)
  }

  return { round, answer }
}

/**
 * FR-039: an attempt is validated against the day's stored puzzle alone. The outcome
 * discloses the hidden count for the resolved round only, which is the sole disclosure path.
 */
export function resolveMoreOrLessOutcome(
  payload: MoreOrLessPuzzleData,
  solution: MoreOrLessSolution,
  round: number,
  answer: MoreOrLessAnswer,
): MoreOrLessOutcome {
  const ordered = [payload.initialVisible, ...payload.chain]
  const hidden = ordered[round + 1]
  const visible = ordered[round]

  const hiddenCount = solution.roleCounts[String(hidden.id)]
  const visibleCount = solution.roleCounts[String(visible.id)]
  if (hiddenCount === undefined || visibleCount === undefined) {
    throw new InvalidAttemptError(`puzzle row missing a role count for round ${round}`)
  }

  const correct = solution.answers[round]
  const hit = answer === correct

  let state: MoreOrLessOutcome['state'] = 'lost'
  if (hit) {
    state = round === ROUNDS - 1 ? 'won' : 'in_progress'
  }

  return {
    result: hit ? 'hit' : 'miss',
    round,
    correct,
    given: answer,
    counts: { hidden: hiddenCount, visible: visibleCount },
    state,
  }
}