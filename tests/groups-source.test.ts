import { describe, expect, it } from 'vitest'
import { fetchSameSourcePools, type GroupCandidateTile } from '../server/catalog/queries'
import { findValidGroups } from '../server/generators/groups'
import { generateGroups, PuzzleUnavailableError } from '../server/generators/groups'
import type { GroupsSolutionGroup } from '../server/game/groups'
import type { GroupsPayloadData, GroupsSolution } from '../server/game/groups'
import { getCalendarSeason } from '../server/utils/day'
import { isolatedPuzzleDate } from './helpers/dbDates'

const connectionString = process.env.DATABASE_URL ?? ''

describe.skipIf(!connectionString)('source-material pool query', () => {
  it('returns pools keyed by non-blank source, ≥ 4 distinct characters across ≥ 4 distinct anime, deterministically ordered', async () => {
    const pools = await fetchSameSourcePools()
    expect(pools.length).toBeGreaterThan(0)
    for (const pool of pools) {
      expect(pool.criterion).toBe('same_source')
      expect(pool.source.trim().length).toBeGreaterThan(0)
      expect(pool.tiles.length).toBeGreaterThanOrEqual(4)
      // FR-005: every candidate row pins the source it is judged on.
      for (const tile of pool.tiles) {
        expect(tile.source).toBe(pool.source)
        expect(tile.source.trim().length).toBeGreaterThan(0)
      }
      // No character is repeated inside a pool.
      expect(new Set(pool.tiles.map((tile) => tile.id)).size).toBe(pool.tiles.length)
      // FR-003: the group can never collapse into a hidden "same anime" group.
      expect(new Set(pool.tiles.map((tile) => tile.animeId)).size).toBeGreaterThanOrEqual(4)
    }
    // Principle III: the same catalog state reproduces the same pools in the same order.
    const rerun = await fetchSameSourcePools()
    expect(
      rerun.map((pool) => `${pool.source}:${pool.tiles.map((tile) => tile.id).join(',')}`),
    ).toEqual(pools.map((pool) => `${pool.source}:${pool.tiles.map((tile) => tile.id).join(',')}`))
  })

  it('excludes blank sources and any source under the ≥ 4 distinct anime bar', async () => {
    const pools = await fetchSameSourcePools()
    const { Pool } = await import('pg')
    const pool = new Pool({ connectionString })
    try {
      const { rows } = await pool.query<{ src: string; anime_count: string }>(
        `SELECT btrim(a.source) AS src, COUNT(DISTINCT r.anime_mal_id) AS anime_count
         FROM voice_roles r
         JOIN anime a ON a.mal_id = r.anime_mal_id
         WHERE btrim(a.source) <> '' AND btrim(r.language) <> ''
         GROUP BY btrim(a.source)`,
      )
      const eligible = new Set(
        rows.filter((row) => Number(row.anime_count) >= 4).map((row) => row.src),
      )
      // R-004: a pool is only ever returned when it clears the distinct-anime bar.
      for (const poolEntry of pools) {
        expect(eligible.has(poolEntry.source)).toBe(true)
      }
    } finally {
      await pool.end()
    }
  })
})

describe('source-material criterion judgement', () => {
  it('accepts a tile by its own pinned source, never by shared anime or language', () => {
    const tile = (id: number, animeId: number, source: string): GroupCandidateTile => ({
      kind: 'character',
      id,
      name: `Character ${id}`,
      animeId,
      language: 'ja',
      voiceActorId: 9001,
      source,
    })

    const webNovel = [
      tile(1, 1, 'Web novel'),
      tile(2, 2, 'Web novel'),
      tile(3, 3, 'Web novel'),
      tile(4, 4, 'Web novel'),
    ]
    // Same animeId AND same language as the first Web novel tile, different source.
    const manga = tile(5, 1, 'Manga')
    const tiles = [...webNovel, manga]

    const groups: GroupsSolutionGroup[] = [
      {
        keys: webNovel.map((entry) => `c:${entry.id}@a:${entry.animeId}`),
        criterion: { type: 'same_source', source: 'Web novel' },
      },
    ]

    const { valid, ambiguous } = findValidGroups(tiles, groups, () => undefined)
    // Exactly the four Web novel tiles form the group; the Manga tile can never substitute in,
    // no matter how much it shares with them via anime or language (FR-005, FR-002).
    expect(valid).toHaveLength(1)
    expect(valid[0]).toEqual({ type: 'same_source', source: 'Web novel' })
    expect(ambiguous).toBe(false)
  })
})

describe.skipIf(!connectionString)('generated source-material boards', () => {
  const date = isolatedPuzzleDate(21)
  const season = getCalendarSeason(new Date(`${date}T00:00:00.000Z`))

  it('yields four groups of four whose criteria are the three existing plus same_source, never same_language', async () => {
    let payload: GroupsPayloadData
    let solution: GroupsSolution
    try {
      const generated = await generateGroups('groups', date, season)
      payload = generated.payload.data as GroupsPayloadData
      solution = generated.solution
    } catch (error) {
      expect((error as { code?: string }).code).toBe('PUZZLE_UNAVAILABLE')
      return
    }
    // FR-002 / SC-002: sixteen tiles resolving into exactly four groups.
    expect(payload.tiles).toHaveLength(16)
    expect(payload.groupCount).toBe(4)
    expect(solution.groups).toHaveLength(4)
    // FR-001 / SC-001: same_source takes the language group's place; same_language never appears.
    expect(solution.groups.map((group) => group.criterion.type).sort()).toEqual([
      'same_anime',
      'same_season',
      'same_source',
      'same_voice_actor',
    ])
    expect(JSON.stringify(solution)).not.toContain('same_language')
  })

  it('produces a source group spanning more than one anime that is the only source-matching subset', async () => {
    let payload: GroupsPayloadData
    let solution: GroupsSolution
    try {
      const generated = await generateGroups('groups', date, season)
      payload = generated.payload.data as GroupsPayloadData
      solution = generated.solution
    } catch (error) {
      expect((error as { code?: string }).code).toBe('PUZZLE_UNAVAILABLE')
      return
    }

    const sourceGroup = solution.groups.find(
      (group): group is GroupsSolutionGroup & { criterion: { type: 'same_source'; source: string } } =>
        group.criterion.type === 'same_source',
    )
    expect(sourceGroup).toBeDefined()
    const source = sourceGroup?.criterion.source ?? ''
    const animeOf = (key: string) => Number(key.split('@a:')[1])

    // FR-003 / SC-003: the group is never a hidden "same anime" group.
    expect(new Set(sourceGroup?.keys.map(animeOf) ?? []).size).toBeGreaterThan(1)

    // FR-006: exactly four of the sixteen tiles carry the golden source, so the intended subset
    // is the only subset satisfying the source criterion and the board is solvable.
    const sources = await sourcesForBoardKeys(payload.tiles.map((tile) => tile.key))
    expect(sources.size).toBe(16)
    for (const key of sourceGroup?.keys ?? []) {
      expect(sources.get(key)).toBe(source)
    }
    expect([...sources.values()].filter((entry) => entry === source)).toHaveLength(4)

    // SC-002: the board's four groups tile the sixteen keys exactly once each.
    expect(new Set(solution.groups.flatMap((group) => group.keys)).size).toBe(16)
  })

  it('regenerates the same UTC day identically and keeps the unavailable day clear', async () => {
    const first = await generateGroups('groups', date, season)
    const payload = first.payload.data as GroupsPayloadData
    const again = await generateGroups('groups', date, season)
    // FR-008 / SC-006 / Principle III: same day, same catalog state, identical board — including
    // the source group.
    expect(again.payload.data as GroupsPayloadData).toEqual(payload)
    expect(again.solution).toEqual(first.solution)

    // A day no pool can fill keeps today's structured unavailable outcome instead of a
    // weakened or malformed board (FR-008, R-007).
    const emptyDate = '2099-01-01'
    await expect(
      generateGroups(
        'groups',
        emptyDate,
        getCalendarSeason(new Date(`${emptyDate}T00:00:00.000Z`)),
      ),
    ).rejects.toThrow(PuzzleUnavailableError)
  })
})

async function sourcesForBoardKeys(keys: string[]): Promise<Map<string, string>> {
  const pairs = keys.map((key) => {
    const [charId, animeId] = key.split('@a:')
    return { charId: Number(charId.replace('c:', '')), animeId: Number(animeId) }
  })
  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString })
  try {
    const { rows } = await pool.query<{
      character_mal_id: number
      anime_mal_id: number
      source: string
    }>(
      `SELECT r.character_mal_id, r.anime_mal_id, COALESCE(a.source, '') AS source
       FROM voice_roles r
       JOIN anime a ON a.mal_id = r.anime_mal_id
       WHERE r.character_mal_id = ANY($1::int[])
         AND r.anime_mal_id = ANY($2::int[])
         AND btrim(r.language) <> ''`,
      [[...new Set(pairs.map((pair) => pair.charId))], [...new Set(pairs.map((pair) => pair.animeId))]],
    )
    const byPair = new Map(
      rows.map((row) => [`c:${row.character_mal_id}@a:${row.anime_mal_id}`, row.source]),
    )
    return new Map(pairs.map((pair) => [`c:${pair.charId}@a:${pair.animeId}`, byPair.get(`c:${pair.charId}@a:${pair.animeId}`) ?? '']))
  } finally {
    await pool.end()
  }
}