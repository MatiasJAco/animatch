import { describe, expect, it } from 'vitest'
import type { MatchTheSeriesOutcome } from '../server/game/matchTheSeries'
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
  wrongClicks: 0,
  greenPairs: [],
  missLog: [],
}

// Mirrors server/game/matchTheSeries.resolveMatchOutcome: the miss count comes from the
// carried miss log and the match ends on the third miss no matter what happened in between.
function resolve(state: MatchBoardState, answer: { clueKey: string; seriesKey: string }): MatchTheSeriesOutcome {
  if (state.missLog.length + 1 >= 3) {
    return { result: 'miss', ...answer, correctSeriesKey: 'a:9', answers: {}, state: 'lost' }
  }
  if (answer.seriesKey.startsWith('wrong-')) {
    return { result: 'miss', ...answer, state: 'in_progress' }
  }
  return { result: 'hit', ...answer, state: 'in_progress' }
}

describe('applyMatchAnswer', () => {
  it('carries the logged misses across a correct answer so the third miss still ends the game', () => {
    // The reported bug: 2 misses, then a correct answer, then the game silently forgot the
    // first two misses and let more wrong clicks through. With the miss log carried, the
    // third counted miss is lost on the next wrong reply.
    const clue = (key: string) => ({ clueKey: `c:${key}`, seriesKey: `wrong-${key}` })
    let state = applyMatchAnswer(fresh, CLUES, resolve(fresh, clue('1')), clue('1'))
    state = applyMatchAnswer(state, CLUES, resolve(state, clue('2')), clue('2'))
    expect(state.missLog).toHaveLength(2)
    expect(state.wrongClicks).toBe(2)

    const hit = applyMatchAnswer(
      state,
      CLUES,
      { result: 'hit', clueKey: 'c:9', seriesKey: 'a:1', state: 'in_progress' },
      { clueKey: 'c:9', seriesKey: 'a:1' },
    )
    expect(hit.status).toBe('in_progress')
    expect(hit.missLog).toHaveLength(2)
    expect(hit.wrongClicks).toBe(2)
    expect(hit.greenPairs).toHaveLength(1)

    const ending = applyMatchAnswer(hit, CLUES, resolve(hit, clue('3')), clue('3'))
    expect(ending.missLog).toHaveLength(3)
    expect(ending.wrongClicks).toBe(3)
    expect(ending.status).toBe('lost')
    expect(ending.endedAt).toBeTypeOf('string')
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
      { result: 'miss', clueKey: 'c:2', seriesKey: 'wrong-2', state: 'in_progress' },
      { clueKey: 'c:2', seriesKey: 'wrong-2' },
    )
    // The previously earned tile's evidence survives the miss instead of being dropped.
    expect(miss.greenPairs).toHaveLength(1)
    expect(miss.greenSeries).toEqual(['a:1'])
    expect(miss.missLog).toHaveLength(1)
    expect(miss.wrongClicks).toBe(1)
  })

  it('reaches won once nine distinct series are green, and discloses nothing but the state', () => {
    let state = fresh
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
    expect(state.wrongClicks).toBe(0)
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
        { result: 'miss', clueKey: 'c:1', seriesKey: 'wrong-1', state: 'in_progress' },
        { clueKey: 'c:1', seriesKey: 'wrong-1' },
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