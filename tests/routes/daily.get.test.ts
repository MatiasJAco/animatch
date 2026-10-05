import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'
import { listDaily } from '../../server/game/listing'
import { getPool } from '../../server/db/pool'

const connectionString = process.env.DATABASE_URL ?? ''

const countToday = async (pool: Pool): Promise<string> => {
  const { rows } = await pool.query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM daily_puzzles WHERE puzzle_date = (now() AT TIME ZONE \'UTC\')::date',
  )
  return rows[0]?.count ?? '0'
}

/** Every stored row for today, so a failed read can be shown to have changed nothing. */
const snapshotToday = async (pool: Pool): Promise<unknown[]> => {
  const { rows } = await pool.query<{ game: string; payload: unknown; solution: unknown }>(
    `SELECT game, payload, solution FROM daily_puzzles
     WHERE puzzle_date = (now() AT TIME ZONE 'UTC')::date ORDER BY game`,
  )
  return rows
}

describe('GET /api/daily listing', () => {
  const realQuery = getPool().query.bind(getPool())

  let pool: Pool | undefined

  beforeAll(() => {
    if (connectionString) {
      pool = new Pool({ connectionString })
    }
  })

  afterAll(async () => {
    await pool?.end()
    await getPool().end()
  })

  afterEach(() => {
    // Any stub installed by the catalog-unreachable case is removed again.
    ;(getPool() as unknown as { query?: unknown }).query = realQuery
  })

  it('returns three games for the current UTC date and never reports completion', async () => {
    const listing = await listDaily()

    expect(listing.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(listing.games).toHaveLength(3)
    expect(listing.games.map((entry) => entry.game).sort()).toEqual([
      'groups',
      'match_the_series',
      'more_or_less',
    ])

    for (const entry of listing.games) {
      expect(['ready', 'unavailable', 'error']).toContain(entry.status)
      // Completion is device-local; the server never reports it.
      expect(Object.keys(entry)).not.toContain('completed')
      expect(Object.keys(entry)).not.toContain('finished')
      expect(Object.keys(entry)).not.toContain('attempts')
    }

    if (pool) {
      // The listing is a read: calling it again changes no stored row.
      const before = await countToday(pool)
      await listDaily()
      expect(await countToday(pool)).toBe(before)
    }
  })

  it('reports a structured DATABASE_UNAVAILABLE per game when the catalog is unreachable', async () => {
    // FR-050 / FR-051 / SC-008: the stored puzzle must survive the failure untouched.
    const before = pool ? await snapshotToday(pool) : null

    // Every probe query fails, which is what an unreachable catalog looks like to the server.
    ;(getPool() as unknown as { query: () => Promise<never> }).query = () =>
      Promise.reject(new Error('connection refused'))

    const listing = await listDaily()

    // FR-050 / FR-051 / SC-008: never a blank success and never an unlabelled failure.
    expect(listing.games).toHaveLength(3)
    for (const entry of listing.games) {
      expect(entry.status).toBe('error')
      expect(entry.code).toBe('DATABASE_UNAVAILABLE')
    }
    expect(listing.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    // A failed listing is a read failure: nothing is inserted, changed, or removed.
    if (pool && before) {
      expect(await snapshotToday(pool)).toEqual(before)
    }
  })
})