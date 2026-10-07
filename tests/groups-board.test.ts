import { describe, expect, it } from 'vitest'
import type { GroupsTile, GroupCriterion } from '../server/game/groups'
import { buildBoardRows } from '../app/utils/groupsBoard'

const TILES: GroupsTile[] = Array.from({ length: 16 }, (_, index) => ({
  key: `c:${index + 1}@a:${(index % 4) + 1}`,
  kind: (index % 2 === 0 ? 'character' : 'person') as 'character' | 'person',
  name: `Entity ${index + 1}`,
}))

const GROUP = (
  index: number,
  criterion: GroupCriterion,
): { keys: string[]; criterion: GroupCriterion } => ({
  keys: TILES.slice(index * 4, index * 4 + 4).map((tile) => tile.key),
  criterion,
})

const ALL: GroupCriterion[] = [
  { type: 'same_anime', animeId: 1 },
  { type: 'same_season', season: 'fall', year: 2026 },
  { type: 'same_language', animeId: 2, language: 'ja' },
  { type: 'same_voice_actor', personId: 9001 },
]

const GROUPS = ALL.map((criterion, index) => GROUP(index, criterion))

const keys = (row: { tileKeys: string[] }) => row.tileKeys
const flatKeys = (rows: Array<{ tileKeys: string[] }>) => rows.flatMap(keys)

describe('buildBoardRows', () => {
  it('returns found groups as found rows in discovery order, with found tiles unselectable', () => {
    const result = buildBoardRows(TILES, [GROUPS[0], GROUPS[2]], null)
    expect(result.rows).toHaveLength(2)
    expect(result.rows.map((row) => row.kind)).toEqual(['found', 'found'])
    expect(keys(result.rows[0])).toEqual(GROUPS[0].keys)
    expect(keys(result.rows[1])).toEqual(GROUPS[2].keys)
    expect(result.rows[0].criterion).toEqual({ type: 'same_anime', animeId: 1 })
    for (const key of [...GROUPS[0].keys, ...GROUPS[2].keys]) {
      expect(result.selectable).not.toContain(key)
    }
    expect(result.selectable).toHaveLength(8)
  })

  it('returns no rows and every tile selectable on a clear board', () => {
    const result = buildBoardRows(TILES, [], null)
    expect(result.rows).toEqual([])
    expect(result.selectable).toHaveLength(16)
  })

  it('loss input returns one row per group: found rows first, remaining rows revealed', () => {
    const result = buildBoardRows(TILES, [GROUPS[0]], GROUPS)
    expect(result.rows).toHaveLength(4)
    expect(result.rows.map((row) => row.kind)).toEqual([
      'found',
      'revealed',
      'revealed',
      'revealed',
    ])
    expect(keys(result.rows[0])).toEqual(GROUPS[0].keys)
    expect(keys(result.rows[1])).toEqual(GROUPS[1].keys)
    expect(keys(result.rows[2])).toEqual(GROUPS[2].keys)
    expect(keys(result.rows[3])).toEqual(GROUPS[3].keys)
    expect(result.rows[0].criterion).toEqual({ type: 'same_anime', animeId: 1 })
    expect(result.rows[1].criterion).toEqual({ type: 'same_season', season: 'fall', year: 2026 })
  })

  it('loss layout is exhaustive: every tile appears exactly once, across the rows', () => {
    const result = buildBoardRows(TILES, [GROUPS[1], GROUPS[3]], GROUPS)
    expect(flatKeys(result.rows)).toHaveLength(16)
    const unique = new Set(flatKeys(result.rows))
    expect(unique.size).toBe(16)
    expect(unique).toEqual(new Set(TILES.map((tile) => tile.key)))
  })

  it('once revealed, nothing remains selectable', () => {
    const result = buildBoardRows(TILES, [GROUPS[0]], GROUPS)
    expect(result.selectable).toEqual([])
  })

  it('found rows keep their order and classification no matter what the reveal discloses', () => {
    const foundInDiscoveryOrder = [GROUPS[2], GROUPS[0]]
    const result = buildBoardRows(TILES, foundInDiscoveryOrder, GROUPS)
    expect(keys(result.rows[0])).toEqual(GROUPS[2].keys)
    expect(result.rows[0].kind).toBe('found')
    expect(keys(result.rows[1])).toEqual(GROUPS[0].keys)
    expect(result.rows[1].kind).toBe('found')
    expect(keys(result.rows[2])).toEqual(GROUPS[1].keys)
    expect(keys(result.rows[3])).toEqual(GROUPS[3].keys)
  })

  it('reload-restore input reproduces the identical rows for the same stored foundGroups', () => {
    const storedFound = [GROUPS[1]]
    const first = buildBoardRows(TILES, storedFound, null)
    const second = buildBoardRows(TILES, storedFound, null)
    expect(second.rows).toEqual(first.rows)
    expect(second.selectable).toEqual(first.selectable)
  })
})