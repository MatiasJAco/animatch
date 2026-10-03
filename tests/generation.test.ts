import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { isolatedPuzzleDate } from './helpers/dbDates'
import { isTransactionControl, isWrite, recordSql } from './helpers/sqlRecorder'
import { generateMatchTheSeries } from '../server/generators/matchTheSeries'
import { getCalendarSeason } from '../server/utils/day'
import {
  computePuzzleSignature,
  getDailyPuzzle,
  getOrCreateDailyPuzzle,
} from '../server/db/puzzles'

const connectionString = process.env.DATABASE_URL ?? ''

describe('puzzle store', () => {
  let pool: Pool | undefined
  const game = 'more_or_less' as const
  let puzzleDate: string

  beforeAll(() => {
    if (connectionString) {
      pool = new Pool({ connectionString })
    }
  })

  afterAll(async () => {
    await pool?.end()
  })

  beforeEach(async () => {
    puzzleDate = isolatedPuzzleDate(3)
    await pool?.query('DELETE FROM daily_puzzles WHERE game = $1 AND puzzle_date = $2', [
      game,
      puzzleDate,
    ])
  })

  // The stub payload below must never survive: today's real puzzle is created on first
  // request, and a leftover row would be served instead of generating.
  afterEach(async () => {
    await pool?.query('DELETE FROM daily_puzzles WHERE game = $1 AND puzzle_date = $2', [
      game,
      puzzleDate,
    ])
  })

  it('gives the same game and day one deterministic puzzle in exactly one row', async () => {
    // Determinism: the seed depends on the game and the UTC day alone.
    expect(computePuzzleSignature(game, puzzleDate)).toBe(computePuzzleSignature(game, puzzleDate))
    expect(computePuzzleSignature(game, puzzleDate)).not.toBe(
      computePuzzleSignature('groups', puzzleDate),
    )

    if (!pool) {
      return
    }

    const payload = { signature: computePuzzleSignature(game, puzzleDate), data: { rounds: 10 } }
    const solution = { chain: [{ key: 'p:1', count: 3 }] }
    const generate = async () => ({ payload, solution })

    const first = await getOrCreateDailyPuzzle(game, puzzleDate, generate)
    const second = await getOrCreateDailyPuzzle(game, puzzleDate, generate)
    const read = await getDailyPuzzle(game, puzzleDate)

    expect(first.game).toBe(game)
    expect(second.payload).toEqual(first.payload)
    expect(read?.payload).toEqual(payload)
    expect(read?.solution).toEqual(solution)

    const { rows } = await pool.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM daily_puzzles WHERE game = $1 AND puzzle_date = $2',
      [game, puzzleDate],
    )
    expect(rows[0]?.count).toBe('1')
  })

  // Generation runs the real catalog queries, so it needs more than the default budget.
  it('reads the catalog and writes only one daily_puzzles row, keeping no visitor record', async () => {
    if (!pool) {
      return
    }

    // Principle I / R-016: generation touches the catalog read-only and stores the day's puzzle
    // once. It must never create a record of who visited.
    // A clean slate, so the recorded run really does generate rather than read a stored row.
    await pool.query('DELETE FROM daily_puzzles WHERE game = $1 AND puzzle_date = $2', [
      'match_the_series',
      puzzleDate,
    ])

    const recorder = recordSql()
    try {
      await getOrCreateDailyPuzzle('match_the_series', puzzleDate, () =>
        generateMatchTheSeries('match_the_series', puzzleDate, getCalendarSeason()),
      )
    } finally {
      recorder.restore()
    }

    const statements = recorder.statements()
    const writes = statements.filter(isWrite)

    // Exactly one write, and it is the puzzle row itself.
    expect(writes).toHaveLength(1)
    expect(writes[0]).toMatch(/insert into daily_puzzles/i)

    // Nothing outside the puzzle table is ever written, so no visitor record can exist.
    for (const statement of writes) {
      expect(statement.toLowerCase()).not.toMatch(/insert into (?!daily_puzzles)/)
    }

    // Everything else is a catalog read or transaction control, never a modification.
    expect(statements.length).toBeGreaterThan(writes.length)
    for (const statement of statements.filter((entry) => !isWrite(entry))) {
      expect(isTransactionControl(statement) || /^select\b/i.test(statement)).toBe(true)
    }
    expect(statements.some((entry) => /^select\b/i.test(entry))).toBe(true)
  }, 30_000)
})