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
  verifyGroupsProgress,
  type GroupsPayloadData,
  type GroupsSolution,
} from '../../server/game/groups'
import {
  parseMatchAttempt,
  resolveMatchOutcome,
  verifyMatchProgress,
  type MatchTheSeriesPayloadData,
  type MatchTheSeriesSolution,
} from '../../server/game/matchTheSeries'
import { getCalendarSeason } from '../../server/utils/day'
import { createErrorEnvelope, STATUS_FOR_CODE } from '../../server/utils/errors'
import {
  isRetryableCode,
  readErrorCode,
} from '../../app/composables/attemptFailure'

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

  it('never ends a match the Series game on a miss and discloses nothing about the answer', async () => {
    const row = await getOrCreateDailyPuzzle('match_the_series', matchDate, () =>
      generateMatchTheSeries(
        'match_the_series',
        matchDate,
        getCalendarSeason(new Date(`${matchDate}T00:00:00.000Z`)),
      ),
    )
    const payload = stripSignature(row.payload) as MatchTheSeriesPayloadData
    const solution = row.solution as MatchTheSeriesSolution

    const clue = payload.clues[0]
    const rightSeriesKey = solution.answers[clue.key]
    const wrongSeriesKey = payload.grid.series.find((s) => s.key !== rightSeriesKey)
      ?.key as string

    const hit = resolveMatchOutcome(
      payload,
      solution,
      { clueKey: clue.key, seriesKey: rightSeriesKey },
      verifyMatchProgress(solution, []),
    )
    expect(hit.result).toBe('hit')
    expect(hit.state).toBe('in_progress')
    // FR-026: a hit discloses the clicked series and nothing else. The evidence list the
    // device sends must never be echoed back in the outcome.
    expect(hit.seriesKey).toBe(rightSeriesKey)
    expect(Object.keys(hit).sort()).toEqual(['clueKey', 'result', 'seriesKey', 'state'])

    // FR-001: mistakes are unlimited. Five wrong clicks all stay in progress and none reveals
    // the correct series or the full mapping.
    for (let index = 0; index < 5; index += 1) {
      const miss = resolveMatchOutcome(
        payload,
        solution,
        { clueKey: clue.key, seriesKey: wrongSeriesKey },
        verifyMatchProgress(solution, []),
      )
      expect(miss.result).toBe('miss')
      expect(miss.state).toBe('in_progress')
      expect(Object.keys(miss).sort()).toEqual(['clueKey', 'result', 'seriesKey', 'state'])
      expect(Object.keys(miss)).not.toContain('correctSeriesKey')
      expect(Object.keys(miss)).not.toContain('answers')
    }

    // FR-027d: the abandoned entity stays in the pool and stays answerable.
    expect(payload.clues.map((entry) => entry.key)).toContain(clue.key)
    expect(solution.answers[clue.key]).toBe(rightSeriesKey)
    // The payload no longer carries a mistake cap.
    expect(Object.keys(payload)).not.toContain('wrongLimit')

    // R-020: the attempt names the card being answered, not an entity id.
    expect(() => parseMatchAttempt({ seriesKey: payload.grid.series[0].key })).toThrow()
    expect(() => parseMatchAttempt({ clueKey: clue.key })).toThrow()
    expect(() => parseMatchAttempt({ clueKey: clue.key, seriesKey: 42 })).toThrow()

    // A card or a series that is not in the stored puzzle is invalid too.
    expect(() =>
      resolveMatchOutcome(
        payload,
        solution,
        { clueKey: 'c:1', seriesKey: payload.grid.series[0].key },
        verifyMatchProgress(solution, []),
      ),
    ).toThrow()
    expect(() =>
      resolveMatchOutcome(
        payload,
        solution,
        { clueKey: clue.key, seriesKey: 'a:999999' },
        verifyMatchProgress(solution, []),
      ),
    ).toThrow()

    // FR-041: a rejected attempt changes no state, so the stored puzzle is untouched.
    const reread = await getDailyPuzzle('match_the_series', matchDate)
    expect(reread?.payload).toEqual(row.payload)
    expect(reread?.solution).toEqual(row.solution)

    // SC-007: a rejection is a structured envelope naming the code with the right status,
    // never a blank body and never a leaked internal message.
    expect(STATUS_FOR_CODE.INVALID_ATTEMPT).toBe(400)

    // Principle V / T079: the client renders the code the server sent, and only offers a
    // Retry when replaying the identical request could succeed.
    const asResponse = (code: string, status: number) =>
      ({ ok: false, status, json: async () => JSON.parse(JSON.stringify(createErrorEnvelope(code as never))) }) as unknown as Response
    await expect(readErrorCode(asResponse('INVALID_ATTEMPT', 400))).resolves.toBe('INVALID_ATTEMPT')
    await expect(
      readErrorCode(asResponse('DATABASE_UNAVAILABLE', 503)),
    ).resolves.toBe('DATABASE_UNAVAILABLE')
    await expect(
      readErrorCode({ ok: false, status: 500, json: async () => { throw new Error('html') } } as unknown as Response),
    ).resolves.toBe('DATABASE_UNAVAILABLE')
    await expect(
      readErrorCode({ ok: false, status: 500, json: async () => ({ error: { code: 'NOPE' } }) } as unknown as Response),
    ).resolves.toBe('DATABASE_UNAVAILABLE')
    expect(isRetryableCode('INVALID_ATTEMPT')).toBe(false)
    expect(isRetryableCode('UNKNOWN_GAME')).toBe(false)
    expect(isRetryableCode('DATABASE_UNAVAILABLE')).toBe(true)
    expect(isRetryableCode('PUZZLE_UNAVAILABLE')).toBe(true)

    const envelope = createErrorEnvelope('INVALID_ATTEMPT')
    expect(envelope).toEqual({
      error: { code: 'INVALID_ATTEMPT', message: expect.any(String) },
    })
    const serialized = JSON.stringify(envelope)
    for (const forbidden of ['postgres', 'SELECT', 'INSERT', 'at Object.', 'ECONNREFUSED', '.ts:']) {
      expect(serialized).not.toContain(forbidden)
    }
    expect(Object.keys(envelope)).toEqual(['error'])
    expect(Object.keys(envelope.error).sort()).toEqual(['code', 'message'])

    // FR-041: a rejected attempt changed no state, so the stored puzzle is still identical.
    const stillUnchanged = await getDailyPuzzle('match_the_series', matchDate)
    expect(stillUnchanged?.payload).toEqual(row.payload)
    expect(stillUnchanged?.solution).toEqual(row.solution)
  })

  it('wins only when all nine grid series are green and never returns an attempt count', async () => {
    const series = Array.from({ length: 9 }, (_, index) => ({
      key: `a:${index + 1}`,
      title: `Series ${index + 1}`,
    }))
    const clues = Array.from({ length: 18 }, (_, index) => ({
      key: index % 2 === 0 ? `c:${index}` : `p:${index}`,
      kind: (index % 2 === 0 ? 'character' : 'person') as 'character' | 'person',
      name: `Entity ${index}`,
    }))
    // Two cards per series, so the ninth green tile can be reached by either card.
    const answers = Object.fromEntries(
      clues.map((clue, index) => [clue.key, series[Math.floor(index / 2)].key]),
    )
    const payload: MatchTheSeriesPayloadData = {
      game: 'match_the_series',
      date: '2026-10-06',
      season: { season: 'fall', year: 2026 },
      grid: { rows: 3, cols: 3, series },
      clues,
    }
    const solution = { answers }

    // Constitution IV: progress is presented as evidence the server verifies against the
    // answer key, so the loop below accumulates real clue/series pairs.
    const greenPairs: Array<{ clueKey: string; seriesKey: string }> = []
    let green = new Set<string>()
    let state = 'in_progress'
    let last = resolveMatchOutcome(
      payload,
      solution,
      { clueKey: clues[0].key, seriesKey: answers[clues[0].key] },
      verifyMatchProgress(solution, []),
    )
    for (const clue of clues) {
      if (green.size >= series.length) break
      const outcome = resolveMatchOutcome(
        payload,
        solution,
        { clueKey: clue.key, seriesKey: answers[clue.key] },
        verifyMatchProgress(solution, greenPairs),
      )
      expect(outcome.result).toBe('hit')
      expect(outcome.seriesKey).toBe(answers[clue.key])
      if (outcome.result === 'hit') {
        green = new Set([...green, outcome.seriesKey])
        greenPairs.push({ clueKey: clue.key, seriesKey: outcome.seriesKey })
      }
      state = outcome.state
      last = outcome
    }

    // A forged green list cannot win: a claimed tile only survives with the clue card that
    // genuinely answers for it, and that answer key never reaches the client.
    expect(() =>
      verifyMatchProgress(
        solution,
        series.map((entry) => ({ clueKey: clues[0].key, seriesKey: entry.key })),
      ),
    ).toThrow(/correct pairing/)
    expect(() =>
      verifyMatchProgress(solution, [{ clueKey: clues[0].key, seriesKey: series[0].key }]),
    ).not.toThrow()
    // FR-028: the game is won once all nine tiles are green.
    expect(green.size).toBe(9)
    expect(state).toBe('won')

    // FR-041 / R-012: attempt bookkeeping stays on the device, so no outcome carries it.
    expect(Object.keys(last)).not.toContain('attempts')
    expect(Object.keys(last)).not.toContain('attemptCount')
    expect(Object.keys(solution.answers)).toHaveLength(18)
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
    const { tileKeys } = parseGroupsAttempt({ tileKeys: group.keys }, knownKeys)
    expect(tileKeys).toHaveLength(4)

    const hit = resolveGroupsOutcome(solution, tileKeys, verifyGroupsProgress(solution, [], []))
    expect(hit.result).toBe('hit')
    expect(hit.result === 'hit' && hit.criterion.type).toBe(group.criterion.type)
    expect(Object.keys(hit)).not.toContain('attempts')

    // FR-035a: a miss reports only the overlap figure and names no group or fact.
    const twoFromOne = [group.keys[0], group.keys[1], solution.groups[1].keys[0], solution.groups[2].keys[0]]
    const miss = resolveGroupsOutcome(solution, twoFromOne, verifyGroupsProgress(solution, [], []))
    expect(miss.result).toBe('miss')
    expect(miss.result === 'miss' && miss.overlap).toBe(2)
    expect(Object.keys(miss)).not.toContain('groups')
    expect(JSON.stringify(miss)).not.toContain('same_')

    // Zero when no two submitted tiles share a hidden group.
    const scattered = solution.groups.map((entry) => entry.keys[0])
    expect(computeOverlap(scattered, solution.groups)).toBe(0)

    // FR-035: the fifth mistake ends the game and reveals the groups. The count comes from
    // four verified rejections, not from a claimed integer.
    const fourMisses = Array.from({ length: 4 }, () => twoFromOne)
    const ended = resolveGroupsOutcome(solution, twoFromOne, verifyGroupsProgress(solution, [], fourMisses))
    expect(ended.result === 'miss' && ended.state).toBe('lost')
    expect(ended.result === 'miss' && ended.groups).toHaveLength(4)

    // FR-036: all four groups found is the win, and the server derives it from the stored
    // solution rather than from a claimed consumed list.
    let foundKeys: string[][] = []
    let state = 'in_progress'
    for (const entry of solution.groups) {
      const outcome = resolveGroupsOutcome(solution, entry.keys, verifyGroupsProgress(solution, foundKeys, []))
      foundKeys = [...foundKeys, entry.keys]
      state = outcome.state
    }
    expect(state).toBe('won')

    // Constitution IV: the win is derived from groups the server recognises. A bag of tiles
    // that spans two real groups names no group at all, so the claimed win is rejected, and
    // the retired bare `consumed` list can no longer assemble one.
    const spanning = [
      solution.groups[0].keys[0],
      solution.groups[0].keys[1],
      solution.groups[1].keys[0],
      solution.groups[1].keys[1],
    ]
    expect(() => verifyGroupsProgress(solution, [spanning], [])).toThrow(
      /not one of the day puzzle groups/,
    )
    expect(
      resolveGroupsOutcome(solution, solution.groups[0].keys, verifyGroupsProgress(solution, [], [])).state,
    ).toBe('in_progress')
    // Naming all four real groups is the only route to a win, and that means knowing the key.
    expect(verifyGroupsProgress(solution, solution.groups.map((g) => g.keys), []).consumed).toHaveLength(16)
    // A "miss" log that is actually a correct group is rejected. Repeating a real rejected
    // proposal stays legal, since FR-035 counts mistakes and does not forbid it.
    expect(() => verifyGroupsProgress(solution, [], [solution.groups[1].keys])).toThrow(
      /actually a correct group/,
    )
    expect(verifyGroupsProgress(solution, [], [twoFromOne, twoFromOne]).mistakeCount).toBe(2)

    // FR-039: wrong count, unknown key, duplicate key, and a consumed key are all rejected.
    expect(() => parseGroupsAttempt({ tileKeys: group.keys.slice(0, 3) }, knownKeys)).toThrow()
    expect(() => parseGroupsAttempt({ tileKeys: ['c:1@a:2'] }, knownKeys)).toThrow()
    expect(() =>
      parseGroupsAttempt({ tileKeys: [group.keys[0], group.keys[0], group.keys[1], group.keys[2]] }, knownKeys),
    ).toThrow()
    expect(() =>
      resolveGroupsOutcome(solution, group.keys, verifyGroupsProgress(solution, [group.keys], [])),
    ).toThrow(/already consumed/)
  })
})
