import { describe, expect, it } from 'vitest'
import {
  applyMatchAnswer,
  nextUnansweredIndex,
  type MatchBoardState,
} from '../app/utils/matchState'

const CLUES = Array.from({ length: 10 }, (_, index) => ({ key: `c:${index + 1}` }))

const fresh: MatchBoardState = {
  status: 'in_progress',
  attempts: 0,
  greenSeries: [],
  answeredClues: [],
  clueIndex: 0,
  greenPairs: [],
}

describe('applyMatchAnswer', () => {
  it('never ends the game on a wrong answer, no matter how many are logged', () => {
    // FR-001: the mistake cap is gone. Six straight wrong answers must leave the board in
    // progress and accumulate no green evidence.
    let state = fresh
    for (let index = 0; index < 6; index += 1) {
      state = applyMatchAnswer(
        state,
        CLUES,
        { result: 'miss', clueKey: `c:${index + 1}`, seriesKey: `a:${index + 1}`, state: 'in_progress' },
        { clueKey: `c:${index + 1}`, seriesKey: `a:${index + 1}` },
      )
    }
    expect(state.status).toBe('in_progress')
    expect(state.greenPairs).toHaveLength(0)
    expect(state.attempts).toBe(6)
  })

  it('keeps the green evidence when a reply misses, so later hits can still accumulate a win', () => {
    const hit = applyMatchAnswer(
      fresh,
      CLUES,
      { result: 'hit', clueKey: 'c:1', seriesKey: 'a:1', state: 'in_progress' },
      { clueKey: 'c:1', seriesKey: 'a:1' },
    )
    expect(hit.greenPairs).toHaveLength(1)

    const miss = applyMatchAnswer(
      hit,
      CLUES,
      { result: 'miss', clueKey: 'c:2', seriesKey: 'a:2', state: 'in_progress' },
      { clueKey: 'c:2', seriesKey: 'a:2' },
    )
    // The previously earned tile's evidence survives the miss instead of being dropped.
    expect(miss.greenPairs).toHaveLength(1)
    expect(miss.greenSeries).toEqual(['a:1'])
    expect(miss.status).toBe('in_progress')
  })

  it('reaches won once nine distinct series are green, and carries the timer through', () => {
    let state: MatchBoardState = { ...fresh, timerRemainingMs: 42_000 }
    for (let index = 1; index <= 9; index += 1) {
      const won = index === 9
      state = applyMatchAnswer(
        state,
        CLUES,
        { result: 'hit', clueKey: `c:${index}`, seriesKey: `a:${index}`, state: won ? 'won' : 'in_progress' },
        { clueKey: `c:${index}`, seriesKey: `a:${index}` },
      )
    }
    expect(state.status).toBe('won')
    expect(state.greenSeries).toHaveLength(9)
    // FR-008: the timer field must ride along every write (setGameState replaces the entry).
    expect(state.timerRemainingMs).toBe(42_000)
    expect(state.endedAt).toBeTypeOf('string')
  })

  it('counts attempts once per accepted answer', () => {
    const afterTwo = [
      applyMatchAnswer(
        fresh,
        CLUES,
        { result: 'hit', clueKey: 'c:1', seriesKey: 'a:1', state: 'in_progress' },
        { clueKey: 'c:1', seriesKey: 'a:1' },
      ),
      applyMatchAnswer(
        fresh,
        CLUES,
        { result: 'miss', clueKey: 'c:1', seriesKey: 'a:2', state: 'in_progress' },
        { clueKey: 'c:1', seriesKey: 'a:2' },
      ),
    ]
    expect(afterTwo.every((state) => state.attempts === 1)).toBe(true)
  })
})

describe('nextUnansweredIndex', () => {
  it('skips answered cards, wraps around, and falls back to the current index', () => {
    expect(nextUnansweredIndex(CLUES, ['c:1'], 0)).toBe(1)
    expect(nextUnansweredIndex(CLUES, ['c:10'], 9)).toBe(0)
    expect(nextUnansweredIndex(CLUES, CLUES.map((clue) => clue.key), 3)).toBe(3)
    expect(nextUnansweredIndex([], [], 0)).toBe(0)
  })
})
