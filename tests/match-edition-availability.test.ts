import { afterEach, describe, expect, it } from 'vitest'
import { getPool } from '../server/db/pool'
import { listDaily } from '../server/game/listing'
import { isMatchEditionId, matchSeasonFor } from '../server/game/matchSeasons'

describe('match edition fixed seasons and isolated availability', () => {
  const realQuery = getPool().query.bind(getPool())

  afterEach(() => {
    ;(getPool() as unknown as { query?: unknown }).query = realQuery
  })

  it('maps each edition to its fixed 2026 season and rejects non-editions', () => {
    expect(matchSeasonFor('match_the_series_autumn_2026')).toEqual({ season: 'fall', year: 2026 })
    expect(matchSeasonFor('match_the_series_spring_2026')).toEqual({ season: 'spring', year: 2026 })
    expect(matchSeasonFor('match_the_series_summer_2026')).toEqual({ season: 'summer', year: 2026 })
    expect(isMatchEditionId('more_or_less')).toBe(false)
    expect(isMatchEditionId('groups')).toBe(false)
  })

  it('keeps one edition probe failure from affecting the others or the page', async () => {
    // Only the Spring probe fails; every other probe (and the other games) succeeds. The
    // resulting listing must mark exactly one entry as an error (spec FR-011/FR-012).
    ;(
      getPool() as unknown as {
        query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>
      }
    ).query = (text, params) => {
      if (params?.[1] === 'spring') {
        return Promise.reject(new Error('connection refused'))
      }
      return Promise.resolve({ rows: [{ count: '999' }] })
    }

    const listing = await listDaily()
    const byGame = new Map(listing.games.map((entry) => [entry.game, entry]))

    const spring = byGame.get('match_the_series_spring_2026')
    expect(spring?.status).toBe('error')
    expect(spring?.code).toBe('DATABASE_UNAVAILABLE')

    for (const id of [
      'more_or_less',
      'match_the_series_autumn_2026',
      'match_the_series_summer_2026',
      'groups',
    ] as const) {
      expect(byGame.get(id)?.status).toBe('ready')
    }
  })
})
