import { describe, expect, it } from 'vitest'
import { gameCardPresentation } from '../app/utils/gameCardState'

describe('home card presentation', () => {
  it('derives one state per card and lets a finished result win', () => {
    expect(gameCardPresentation('ready')).toEqual({
      playable: true,
      tone: 'playable',
      messageKey: null,
    })
    expect(gameCardPresentation('ready', { status: 'in_progress' }).playable).toBe(true)

    for (const status of ['won', 'lost'] as const) {
      expect(gameCardPresentation('ready', { status })).toEqual({
        playable: false,
        tone: 'finished',
        messageKey: 'home.finished_today',
      })
    }

    expect(gameCardPresentation('unavailable')).toEqual({
      playable: false,
      tone: 'unavailable',
      messageKey: 'error.PUZZLE_UNAVAILABLE',
    })
    expect(gameCardPresentation('error')).toEqual({
      playable: false,
      tone: 'error',
      messageKey: 'error.DATABASE_UNAVAILABLE',
    })
    expect(gameCardPresentation('error', { status: 'won' }).tone).toBe('finished')
    expect(gameCardPresentation('unavailable', { status: 'lost' }).tone).toBe('finished')
  })
})
