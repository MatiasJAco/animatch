import type { MoreOrLessAnswer, MoreOrLessPuzzleData } from '~~/server/game/moreOrLess'

export const MORE_OR_LESS_ROUNDS = 10

export interface MoreOrLessLossRecord {
  round: number
  given: MoreOrLessAnswer
  correct: MoreOrLessAnswer
  hidden: number
  visible: number
}

export interface MoreOrLessLossView {
  round: number
  totalRounds: number
  given: MoreOrLessAnswer
  correct: MoreOrLessAnswer
  hidden: number
  visible: number
  personId: number | null
  personName: string
  visibleId: number | null
  visibleName: string
}

// A stored loss is trusted only when every field is well-formed. Anything else is
// dropped by the progress composable on read so a corrupt entry never blanks the game.
export function isLossRecord(value: unknown): value is MoreOrLessLossRecord {
  if (!value || typeof value !== 'object') {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.round === 'number' &&
    Number.isInteger(record.round) &&
    record.round >= 0 &&
    record.round < MORE_OR_LESS_ROUNDS &&
    (record.given === 'more' || record.given === 'less') &&
    (record.correct === 'more' || record.correct === 'less') &&
    typeof record.hidden === 'number' &&
    Number.isFinite(record.hidden) &&
    typeof record.visible === 'number' &&
    Number.isFinite(record.visible)
  )
}

// Mirrors the server's resolution rule (server/game/moreOrLess.ts): the hidden person
// for a round is ordered[round + 1] with ordered = [initialVisible, ...chain].
export function moreOrLessLossView(
  puzzle: MoreOrLessPuzzleData,
  loss: MoreOrLessLossRecord,
): MoreOrLessLossView {
  const ordered = [puzzle.initialVisible, ...puzzle.chain]
  const person = ordered[loss.round + 1]
  const compared = ordered[loss.round]
  return {
    round: loss.round,
    totalRounds: puzzle.rounds,
    given: loss.given,
    correct: loss.correct,
    hidden: loss.hidden,
    visible: loss.visible,
    personId: person ? person.id : null,
    personName: person ? person.name : '',
    visibleId: compared ? compared.id : null,
    visibleName: compared ? compared.name : '',
  }
}