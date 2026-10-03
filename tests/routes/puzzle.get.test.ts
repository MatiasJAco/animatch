import { beforeEach, describe, expect, it } from 'vitest'
import { getDailyPuzzle, getOrCreateDailyPuzzle, stripSignature } from '../../server/db/puzzles'
import { generateMoreOrLess } from '../../server/generators/moreOrLess'
import { generateGroups } from '../../server/generators/groups'
import { generateMatchTheSeries, PuzzleUnavailableError } from '../../server/generators/matchTheSeries'
import type { GroupsPayloadData } from '../../server/game/groups'
import { getCalendarSeason } from '../../server/utils/day'
import { isolatedPuzzleDate } from '../helpers/dbDates'
import type {
  MatchTheSeriesPayloadData,
  MatchTheSeriesSolution,
} from '../../server/game/matchTheSeries'
import type { MoreOrLessPuzzleData } from '../../server/game/moreOrLess'

const connectionString = process.env.DATABASE_URL ?? ''

async function deleteRows(game: string, date?: string) {
  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString })
  try {
    await pool.query(
      date
        ? 'DELETE FROM daily_puzzles WHERE game = $1 AND puzzle_date = $2'
        : 'DELETE FROM daily_puzzles WHERE game = $1',
      date ? [game, date] : [game],
    )
  } finally {
    await pool.end()
  }
}

describe.skipIf(!connectionString)('GET /api/daily/:game', () => {
  const moreOrLessDate = isolatedPuzzleDate(2)
  const matchDate = isolatedPuzzleDate(5)
  const groupsDate = isolatedPuzzleDate(8)

  beforeEach(async () => {
    if (!connectionString) return
    await deleteRows('more_or_less', moreOrLessDate)
    await deleteRows('match_the_series', matchDate)
    await deleteRows('groups', groupsDate)
  })

  it('serves the more_or_less payload without solution or image URLs', async () => {
    const row = await getOrCreateDailyPuzzle('more_or_less', moreOrLessDate, () =>
      generateMoreOrLess('more_or_less', moreOrLessDate),
    )
    const payload = stripSignature(row.payload) as MoreOrLessPuzzleData

    expect(payload.game).toBe('more_or_less')
    expect(payload.date).toBe(moreOrLessDate)
    expect(payload.chain.length).toBeGreaterThan(0)
    expect((row.payload as { signature?: string }).signature).toBeTypeOf('string')

    // FR-012 / R-009: no solution and no external media reach the client.
    const served = JSON.stringify(payload)
    expect(served).not.toContain('solution')
    expect(served).not.toMatch(/https?:\/\//)
    expect((await getDailyPuzzle('more_or_less', moreOrLessDate))?.solution).toBeTypeOf('object')
  })

  it('serves a solvable 16x16 match_the_series payload without solution or image URLs', async () => {
    let payload: MatchTheSeriesPayloadData
    let solution: MatchTheSeriesSolution
    try {
      const row = await getOrCreateDailyPuzzle('match_the_series', matchDate, () =>
        generateMatchTheSeries(
          'match_the_series',
          matchDate,
          getCalendarSeason(new Date(`${matchDate}T00:00:00.000Z`)),
        ),
      )
      payload = stripSignature(row.payload) as MatchTheSeriesPayloadData
      solution = row.solution as MatchTheSeriesSolution
    } catch (error) {
      // The current season may legitimately have no coverage; the shared catalog decides.
      expect((error as { code?: string }).code).toBe('PUZZLE_UNAVAILABLE')
      return
    }

    expect(payload.game).toBe('match_the_series')
    expect(payload.date).toBe(matchDate)
    expect(payload.tiles).toHaveLength(16)
    expect(payload.series).toHaveLength(16)
    expect(payload.wrongLimit).toBe(3)
    expect(payload.season.year).toBeGreaterThan(1950)

    const served = JSON.stringify(payload)
    expect(served).not.toContain('solution')
    expect(served).not.toMatch(/https?:\/\//)

    // FR-030: unique keys on both grids, and every tile has exactly one partner, so the
    // board is solvable and no answer is ambiguous.
    expect(new Set(payload.tiles.map((t) => t.key)).size).toBe(16)
    expect(new Set(payload.series.map((s) => s.key)).size).toBe(16)
    expect(Object.keys(solution.answers)).toHaveLength(16)
    for (const tile of payload.tiles) {
      const target = solution.answers[tile.key]
      expect(target).toBeTypeOf('string')
      expect(payload.series.some((s) => s.key === target)).toBe(true)
    }
    // The pairing is one-to-one: no series is the answer twice.
    expect(new Set(Object.values(solution.answers)).size).toBe(16)

    // Data-model steps 4 and 5: both tile kinds appear, and the right grid is ordered
    // differently from the left, so no pairing can be read off by position.
    expect(new Set(payload.tiles.map((tile) => tile.kind))).toEqual(
      new Set(['character', 'person']),
    )
    const leftAnswers = payload.tiles.map((tile) => solution.answers[tile.key])
    expect(leftAnswers.some((answer, index) => answer === payload.series[index]?.key)).toBe(false)
  })

  it('serves sixteen distinct groups tiles with no criterion field', async () => {
    let payload: GroupsPayloadData
    let solution: { groups: Array<{ keys: string[]; criterion: { type: string } }> }
    try {
      const row = await getOrCreateDailyPuzzle('groups', groupsDate, () =>
        generateGroups(
          'groups',
          groupsDate,
          getCalendarSeason(new Date(`${groupsDate}T00:00:00.000Z`)),
        ),
      )
      payload = stripSignature(row.payload) as GroupsPayloadData
      solution = row.solution as typeof solution
    } catch (error) {
      expect((error as { code?: string }).code).toBe('PUZZLE_UNAVAILABLE')
      return
    }

    expect(payload.game).toBe('groups')
    expect(payload.date).toBe(groupsDate)
    expect(payload.tiles).toHaveLength(16)
    expect(payload.groupCount).toBe(4)
    expect(payload.wrongLimit).toBe(5)

    // FR-037: sixteen distinct tile keys and sixteen distinct display labels.
    expect(new Set(payload.tiles.map((tile) => tile.key)).size).toBe(16)
    expect(new Set(payload.tiles.map((tile) => tile.name)).size).toBe(16)

    // FR-034: the criterion lives in the solution and must not reach the client.
    expect(solution.groups).toHaveLength(4)
    expect(new Set(solution.groups.map((group) => group.criterion.type)).size).toBe(4)
    const served = JSON.stringify(payload)
    expect(served).not.toContain('criterion')
    expect(served).not.toMatch(/https?:\/\//)
  })

  it('reports PUZZLE_UNAVAILABLE and stores nothing for a season with no coverage', async () => {
    const emptySeasonDate = '2099-01-01'
    await deleteRows('match_the_series', emptySeasonDate)

    await expect(
      getOrCreateDailyPuzzle('match_the_series', emptySeasonDate, () =>
        generateMatchTheSeries(
          'match_the_series',
          emptySeasonDate,
          getCalendarSeason(new Date(`${emptySeasonDate}T00:00:00.000Z`)),
        ),
      ),
    ).rejects.toThrow(PuzzleUnavailableError)

    const row = await getDailyPuzzle('match_the_series', emptySeasonDate)
    expect(row).toBeNull()
  })
})