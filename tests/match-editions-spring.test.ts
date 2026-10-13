import { describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { isolatedPuzzleDate } from './helpers/dbDates'
import { getOrCreateDailyPuzzle, stripSignature } from '../server/db/puzzles'
import { generateMatchTheSeries } from '../server/generators/matchTheSeries'
import { matchSeasonFor } from '../server/game/matchSeasons'
import type { MatchTheSeriesPayloadData } from '../server/game/matchTheSeries'

const connectionString = process.env.DATABASE_URL ?? ''

describe.skipIf(!connectionString)('Spring 2026 edition', () => {
  it('draws only Spring 2026 series from its fixed season', async () => {
    const date = isolatedPuzzleDate(11)
    let payload: MatchTheSeriesPayloadData
    try {
      const row = await getOrCreateDailyPuzzle('match_the_series_spring_2026', date, () =>
        generateMatchTheSeries(
          'match_the_series_spring_2026',
          date,
          matchSeasonFor('match_the_series_spring_2026'),
        ),
      )
      payload = stripSignature(row.payload) as MatchTheSeriesPayloadData
    } catch (error) {
      // The shared catalog may have no Spring 2026 coverage; then the edition is unavailable.
      expect((error as { code?: string }).code).toBe('PUZZLE_UNAVAILABLE')
      return
    }

    expect(payload.game).toBe('match_the_series_spring_2026')
    expect(payload.season).toEqual({ season: 'spring', year: 2026 })
    expect(payload.grid.series).toHaveLength(9)

    const pool = new Pool({ connectionString })
    try {
      const { rows } = await pool.query<{ anime_mal_id: number }>(
        `SELECT anime_mal_id FROM anime_seasons
         WHERE year = 2026 AND lower(trim(season)) = 'spring'`,
      )
      const allowed = new Set(rows.map((row) => `a:${row.anime_mal_id}`))
      for (const series of payload.grid.series) {
        expect(allowed.has(series.key)).toBe(true)
      }
    } finally {
      await pool.end()
    }
  })
})
