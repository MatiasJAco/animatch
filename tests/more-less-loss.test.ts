import { describe, expect, it } from 'vitest'
import type { MoreOrLessPuzzleData } from '../server/game/moreOrLess'
import { moreOrLessLossView } from '../app/utils/moreOrLessLoss'

function fixturePuzzle(chainLength: number): MoreOrLessPuzzleData {
  const chain = Array.from({ length: chainLength }, (_, i) => ({
    id: 2 + i,
    name: `Person ${2 + i}`,
  }))
  return {
    game: 'more_or_less',
    date: '2026-10-07',
    rounds: 10,
    initialVisible: { id: 1, name: 'Person 1', roleCount: 5 },
    chain,
  }
}

describe('moreOrLessLossView', () => {
  it('derives the failed-round person from the payload exactly like the server, and carries the recorded comparison', () => {
    const puzzle = fixturePuzzle(11)
    const view = moreOrLessLossView(puzzle, {
      round: 3,
      given: 'less',
      correct: 'more',
      hidden: 22,
      visible: 5,
    })
    // ordered = [initialVisible, ...chain]; round 3's hidden person is ordered[4] = chain[3],
    // and the person it was compared against is ordered[3].
    expect(view.personId).toBe(5)
    expect(view.personName).toBe('Person 5')
    expect(view.visibleId).toBe(4)
    expect(view.visibleName).toBe('Person 4')
    expect(view.round).toBe(3)
    expect(view.totalRounds).toBe(10)
    expect(view.given).toBe('less')
    expect(view.correct).toBe('more')
    expect(view.hidden).toBe(22)
    expect(view.visible).toBe(5)

    const second = moreOrLessLossView(puzzle, {
      round: 0,
      given: 'more',
      correct: 'less',
      hidden: 9,
      visible: 5,
    })
    // ordered[1] = chain[0], and it was compared against the starting person ordered[0].
    expect(second.personId).toBe(2)
    expect(second.personName).toBe('Person 2')
    expect(second.visibleId).toBe(1)
    expect(second.visibleName).toBe('Person 1')
  })

  it('degrades to null tiles when the round is out of range of the day chain, keeping every count', () => {
    const short = fixturePuzzle(2)
    const view = moreOrLessLossView(short, {
      round: 3,
      given: 'less',
      correct: 'more',
      hidden: 4,
      visible: 5,
    })
    expect(view.personId).toBeNull()
    expect(view.personName).toBe('')
    expect(view.visibleId).toBeNull()
    expect(view.visibleName).toBe('')
    expect(view.totalRounds).toBe(10)
    expect(view.given).toBe('less')
    expect(view.correct).toBe('more')
    expect(view.hidden).toBe(4)
    expect(view.visible).toBe(5)
  })
})