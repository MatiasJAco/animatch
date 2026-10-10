import { describe, expect, it } from 'vitest'
import { isolatedPuzzleDate } from '../helpers/dbDates'
import { getOrCreateDailyPuzzle, stripSignature } from '../../server/db/puzzles'
import { generateMatchTheSeries } from '../../server/generators/matchTheSeries'
import {
  resolveMatchExpire,
  type MatchTheSeriesPayloadData,
  type MatchTheSeriesSolution,
} from '../../server/game/matchTheSeries'
import { getCalendarSeason } from '../../server/utils/day'

const connectionString = process.env.DATABASE_URL ?? ''

describe('match time-out reveal contract', () => {
  // FR-006: the time-out ending returns the withheld mapping with a lost state, derived on
  // demand — nothing is stored, and no clue/series pair is required (the client reports the
  // clock, it does not answer).
  it('returns the full mapping and a lost state without an answer body', () => {
    const solution: MatchTheSeriesSolution = { answers: { 'c:1': 'a:9', 'p:2': 'a:8' } }
    expect(resolveMatchExpire(solution)).toEqual({
      result: 'expired',
      state: 'lost',
      answers: solution.answers,
    })
    expect(resolveMatchExpire({ answers: {} }).answers).toEqual({})
  })
})

describe.skipIf(!connectionString)('expire endpoint data contract', () => {
  const matchDate = isolatedPuzzleDate(6)

  it('reveals every stored clue key mapped to one of the grid series', async () => {
    const row = await getOrCreateDailyPuzzle('match_the_series', matchDate, () =>
      generateMatchTheSeries(
        'match_the_series',
        matchDate,
        getCalendarSeason(new Date(`${matchDate}T00:00:00.000Z`)),
      ),
    )
    const payload = stripSignature(row.payload) as MatchTheSeriesPayloadData
    const solution = row.solution as MatchTheSeriesSolution

    const outcome = resolveMatchExpire(solution)
    expect(outcome.state).toBe('lost')
    expect(Object.keys(outcome.answers)).toHaveLength(payload.clues.length)
    const seriesKeys = new Set(payload.grid.series.map((series) => series.key))
    for (const seriesKey of Object.values(outcome.answers)) {
      expect(seriesKeys.has(seriesKey)).toBe(true)
    }
  })
})
