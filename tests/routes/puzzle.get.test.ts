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
import type { MoreOrLessPuzzleData, MoreOrLessSolution } from '../../server/game/moreOrLess'

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
    // FR-017: ten rounds, so eleven links after the opening pair and twelve actors.
    expect(payload.rounds).toBe(10)
    expect(payload.chain.length).toBe(11)
    expect(payload.initialVisible.roleCount).toBeTypeOf('number')
    // FR-016a: only the left actor's count is given; every later count is withheld.
    const servedNames = [payload.initialVisible.name, ...payload.chain.map((link) => link.name)]
    const servedKeys = [payload.initialVisible.id, ...payload.chain.map((link) => link.id)]
    expect(new Set(servedNames).size).toBe(12)
    expect(new Set(servedKeys).size).toBe(12)
    const countsInPayload = JSON.stringify(payload).match(/"roleCount":/g) ?? []
    expect(countsInPayload.length).toBe(1)
    expect((row.payload as { signature?: string }).signature).toBeTypeOf('string')

    // FR-001 (feature 008): every actor in the stored solution is strictly above the floor.
    const solution = row.solution as MoreOrLessSolution
    for (const actor of [payload.initialVisible, ...payload.chain]) {
      expect(solution.roleCounts[String(actor.id)]).toBeGreaterThan(80)
    }

    // FR-012 / R-009: no solution and no external media reach the client.
    const served = JSON.stringify(payload)
    expect(served).not.toContain('solution')
    expect(served).not.toMatch(/https?:\/\//)
    expect((await getDailyPuzzle('more_or_less', moreOrLessDate))?.solution).toBeTypeOf('object')
  })

  it('serves a 3x3 match_the_series grid plus a clue deck with no series key on any card', async () => {
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
    expect(payload.season.year).toBeGreaterThan(1950)

    // FR-024: exactly one grid of three by three.
    expect(payload.grid.rows).toBe(3)
    expect(payload.grid.cols).toBe(3)
    expect(payload.grid.series).toHaveLength(9)
    // FR-001: the match payload no longer carries a mistake cap; the countdown ends the game.
    expect(Object.keys(payload)).not.toContain('wrongLimit')

    // FR-024: nine distinct series titles, so no tile is ambiguous.
    expect(new Set(payload.grid.series.map((s) => s.key)).size).toBe(9)
    expect(new Set(payload.grid.series.map((s) => s.title)).size).toBe(9)

    // R-019: the deck is eighteen cards, two per series, so every tile has two routes.
    expect(payload.clues).toHaveLength(18)
    expect(new Set(payload.clues.map((c) => c.key)).size).toBe(18)
    const perSeries = new Map<string, number>()
    for (const [clueKey, seriesKey] of Object.entries(solution.answers)) {
      perSeries.set(seriesKey, (perSeries.get(seriesKey) ?? 0) + 1)
      // FR-024a: the answer is a function of the card, never a choice between series.
      expect(clueKey).toBeTypeOf('string')
    }
    expect([...perSeries.values()].sort()).toEqual(new Array(9).fill(2))
    expect(Object.keys(solution.answers)).toHaveLength(18)
    for (const seriesKey of perSeries.keys()) {
      expect(payload.grid.series.some((s) => s.key === seriesKey)).toBe(true)
    }

    // FR-024a: no card carries its own answer.
    for (const clue of payload.clues) {
      expect(Object.keys(clue).sort()).toEqual(['key', 'kind', 'name'])
      expect(solution.answers[clue.key]).toBeTypeOf('string')
    }
    // FR-029: the card shows a name plus a project placeholder, never an image URL.
    expect(new Set(payload.clues.map((clue) => clue.kind))).toEqual(
      new Set(['character', 'person']),
    )

    const served = JSON.stringify(payload)
    expect(served).not.toContain('solution')
    expect(served).not.toContain('image_url')
    expect(served).not.toMatch(/https?:\/\//)
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