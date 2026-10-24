import type { GameStatus } from '~~/server/game/listing'
import type { LocalGameState } from '~/composables/useLocalProgress'
import type { MessageKey } from '~/i18n'

export type GameCardTone = 'playable' | 'finished' | 'unavailable' | 'error'

export interface GameCardPresentation {
  playable: boolean
  tone: GameCardTone
  messageKey: MessageKey | null
}

export function gameCardPresentation(
  status: GameStatus,
  state?: Pick<LocalGameState, 'status'>,
): GameCardPresentation {
  if (state?.status === 'won' || state?.status === 'lost') {
    return { playable: false, tone: 'finished', messageKey: 'home.finished_today' }
  }
  if (status === 'error') {
    return { playable: false, tone: 'error', messageKey: 'error.DATABASE_UNAVAILABLE' }
  }
  if (status === 'unavailable') {
    return { playable: false, tone: 'unavailable', messageKey: 'error.PUZZLE_UNAVAILABLE' }
  }
  return { playable: true, tone: 'playable', messageKey: null }
}
