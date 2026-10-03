import { beforeEach, describe, expect, it } from 'vitest'
import { isolatedPuzzleDate } from '../helpers/dbDates'
import { getOrCreateDailyPuzzle, getDailyPuzzle } from '../../server/db/puzzles'
import { generateMoreOrLess } from '../../server/generators/moreOrLess'
import { stripSignature } from '../../server/db/puzzles'
import type { MoreOrLessPuzzleData, MoreOrLessSolution } from '../../server/game/moreOrLess'
import { parseMoreOrLessAttempt, resolveMoreOrLessOutcome } from '../../server/game/moreOrLess'
import { generateGroups } from '../../server/generators/groups'
import { generateMatchTheSeries } from '../../server/generators/matchTheSeries'
import {
  computeOverlap,
  parseGroupsAttempt,
  resolveGroupsOutcome,
  type GroupsPayloadData,
  type GroupsSolution,
} from '../../server/game/groups'
import {
  parseMatchAttempt,
  resolveMatchOutcome,
  type MatchTheSeriesPayloadData,
  type MatchTheSeriesSolution,
} from '../../server/game/matchTheSeries'
import { getCalendarSeason } from '../../server/utils/day'

const connectionString = process.env.DATABASE_URL ?? ''

describe.skipIf(!connectionString)('POST /api/daily/:game/attempt', () => {
  const date = isolatedPuzzleDate(1)
  const matchDate = isolatedPuzzleDate(6)
  const groupsDate = isolatedPuzzleDate(9)

  beforeEach(async () => {
    if (!connectionString) return
    const { Pool } = await import('pg')
    const pool = new Pool({ connectionString })
    await pool.query('DELETE FROM daily_puzzles WHERE game = $1 AND puzzle_date = $2', [
      'more_or_less',
      date,
    ])
    await pool.query('DELETE FROM daily_puzzles WHERE game = $1 AND puzzle_date = $2', [
      'match_the_series',
      matchDate,
    ])
    await pool.query('DELETE FROM daily_puzzles WHERE game = $1 AND puzzle_date = $2', [
      'groups',
      groupsDate,
    ])
    await pool.end()
  })

  it('returns hit/miss with counts disclosed and rejects out-of-puzzle entities', async () => {
    const row = await getOrCreateDailyPuzzle('more_or_less', date, () =>
      generateMoreOrLess('more_or_less', date),
    )
    const payload = stripSignature(row.payload) as MoreOrLessPuzzleData
    const solution = row.solution as MoreOrLessSolution

    const round = 0
    const correct = solution.answers[round]
    const outcome = resolveMoreOrLessOutcome(payload, solution, round, correct)
    expect(outcome.result).toBe('hit')
    expect(outcome.counts.hidden).toBeTypeOf('number')
    expect(outcome.counts.visible).toBe(payload.initialVisible.roleCount)
    expect(Object.keys(outcome)).not.toContain('attempts')
    expect(Object.keys(outcome)).not.toContain('attemptCount')

    const wrong = correct === 'more' ? 'less' : 'more'
    const miss = resolveMoreOrLessOutcome(payload, solution, round, wrong)
    expect(miss.result).toBe('miss')
    expect(miss.state === 'lost').toBe(true)
    expect(miss.counts).toEqual(outcome.counts)

    expect(() => parseMoreOrLessAttempt({ round: 0, answer: 'up' as never })).toThrow()
    expect(() => parseMoreOrLessAttempt({ round: -1, answer: 'more' })).toThrow()
    expect(() => parseMoreOrLessAttempt({ round: 10, answer: 'more' })).toThrow()

    const reread = await getDailyPuzzle('more_or_less', date)
    expect(reread?.game).toBe('more_or_less')
  })

  it('keeps non-ending match misses silent and discloses the pairing only on the third', async () => {
    const row = await getOrCreateDailyPuzzle('match_the_series', matchDate, () =>
      generateMatchTheSeries(
        'match_the_series',
        matchDate,
        getCalendarSeason(new Date(`${matchDate}T00:00:00.000Z`)),
      ),
    )
    const payload = stripSignature(row.payload) as MatchTheSeriesPayloadData
    const solution = row.solution as MatchTheSeriesSolution

    const tile = payload.tiles[0]
    const wrongSeries = payload.series.find(
      (s) => s.key !== solution.answers[tile.key],
    ) as (typeof payload.series)[number]
    const rightSeries = payload.series.find(
      (s) => s.key === solution.answers[tile.key],
    ) as (typeof payload.series)[number]

    const hit = resolveMatchOutcome(
      payload,
      solution,
      { tileKey: tile.key, seriesKey: rightSeries.key },
      { matched: new Set<string>(), misses: 0 },
    )
    expect(hit.result).toBe('hit')
    expect(hit.state).toBe('in_progress')

    // FR-027a: a wrong pair below the limit reveals nothing about the answer.
    const quietMiss = resolveMatchOutcome(
      payload,
      solution,
      { tileKey: tile.key, seriesKey: wrongSeries.key },
      { matched: new Set<string>(), misses: 0 },
    )
    expect(quietMiss.result).toBe('miss')
    expect(quietMiss.state).toBe('in_progress')
    expect(Object.keys(quietMiss)).not.toContain('correctSeriesKey')
    expect(Object.keys(quietMiss)).not.toContain('answers')

    // FR-027: the third miss discloses the pairing and the full solution.
    const endingMiss = resolveMatchOutcome(
      payload,
      solution,
      { tileKey: tile.key, seriesKey: wrongSeries.key },
      { matched: new Set<string>(), misses: payload.wrongLimit - 1 },
    )
    expect(endingMiss.result).toBe('miss')
    expect(endingMiss.state).toBe('lost')
    expect(Object.keys(endingMiss)).toContain('correctSeriesKey')
    expect(Object.keys(endingMiss)).toContain('answers')

    expect(() => parseMatchAttempt({ tileKey: tile.key })).toThrow()
    expect(() =>
      resolveMatchOutcome(
        payload,
        solution,
        { tileKey: 'c:1', seriesKey: rightSeries.key },
        { matched: new Set<string>(), misses: 0 },
      ),
    ).toThrow()
  })

  it('wins only when every tile has been matched and never returns an attempt count', async () => {
    const payload: MatchTheSeriesPayloadData = {
      game: 'match_the_series',
      date: '2026-10-06',
      season: { season: 'fall', year: 2026 },
      tiles: [{ key: 'c:1', kind: 'character', name: 'A' }],
      series: [{ key: 'a:1', title: 'S' }],
      wrongLimit: 3,
    }
    const solution = { answers: { 'c:1': 'a:1' } }
    const matched = new Set(['c:1'])

    const won = resolveMatchOutcome(
      payload,
      solution,
      { tileKey: 'c:1', seriesKey: 'a:1' },
      { matched, misses: 0 },
    )
    expect(won.state).toBe('won')
    // FR-041 / R-012: attempt bookkeeping stays on the device.
    expect(Object.keys(won)).not.toContain('attempts')
    expect(Object.keys(won)).not.toContain('attemptCount')
  })

  it('returns a groups hit with the criterion or a miss with only the overlap count', async () => {
    const row = await getOrCreateDailyPuzzle('groups', groupsDate, () =>
      generateGroups(
        'groups',
        groupsDate,
        getCalendarSeason(new Date(`${groupsDate}T00:00:00.000Z`)),
      ),
    )
    const payload = stripSignature(row.payload) as GroupsPayloadData
    const solution = row.solution as GroupsSolution
    const knownKeys = new Set(payload.tiles.map((tile) => tile.key))

    const group = solution.groups[0]
    const { tileKeys, consumed } = parseGroupsAttempt({ tileKeys: group.keys }, knownKeys)
    expect(tileKeys).toHaveLength(4)
    expect(consumed).toEqual([])

    const hit = resolveGroupsOutcome(solution, tileKeys, 0, [])
    expect(hit.result).toBe('hit')
    expect(hit.result === 'hit' && hit.criterion.type).toBe(group.criterion.type)
    expect(Object.keys(hit)).not.toContain('attempts')

    // FR-035a: a miss reports only the overlap figure and names no group or fact.
    const twoFromOne = [group.keys[0], group.keys[1], solution.groups[1].keys[0], solution.groups[2].keys[0]]
    const miss = resolveGroupsOutcome(solution, twoFromOne, 0, [])
    expect(miss.result).toBe('miss')
    expect(miss.result === 'miss' && miss.overlap).toBe(2)
    expect(Object.keys(miss)).not.toContain('groups')
    expect(JSON.stringify(miss)).not.toContain('same_')

    // Zero when no two submitted tiles share a hidden group.
    const scattered = solution.groups.map((entry) => entry.keys[0])
    expect(computeOverlap(scattered, solution.groups)).toBe(0)

    // FR-035: the fifth mistake ends the game and reveals the groups.
    const ended = resolveGroupsOutcome(solution, twoFromOne, 4, [])
    expect(ended.result === 'miss' && ended.state).toBe('lost')
    expect(ended.result === 'miss' && ended.groups).toHaveLength(4)

    // FR-036: all four groups found is the win.
    let consumedKeys: string[] = []
    let state = 'in_progress'
    for (const entry of solution.groups) {
      const outcome = resolveGroupsOutcome(solution, entry.keys, 0, consumedKeys)
      consumedKeys = [...consumedKeys, ...entry.keys]
      state = outcome.state
    }
    expect(state).toBe('won')

    // FR-039: wrong count, unknown key, duplicate key, and consumed key are all rejected.
    expect(() => parseGroupsAttempt({ tileKeys: group.keys.slice(0, 3) }, knownKeys)).toThrow()
    expect(() => parseGroupsAttempt({ tileKeys: ['c:1@a:2'] }, knownKeys)).toThrow()
    expect(() =>
      parseGroupsAttempt({ tileKeys: [group.keys[0], group.keys[0], group.keys[1], group.keys[2]] }, knownKeys),
    ).toThrow()
    expect(() => parseGroupsAttempt({ tileKeys: group.keys, consumed: group.keys }, knownKeys)).toThrow()
  })
})