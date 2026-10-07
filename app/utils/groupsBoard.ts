import type {
  GroupsTile,
  GroupCriterion,
  GroupsSolutionGroup,
} from '../../server/game/groups'

export interface GroupRow {
  kind: 'found' | 'revealed'
  criterion: GroupCriterion
  tileKeys: string[]
}

export interface BoardPresentation {
  rows: GroupRow[]
  selectable: string[]
}

export function buildBoardRows(
  tiles: GroupsTile[],
  found: GroupsSolutionGroup[],
  revealed: GroupsSolutionGroup[] | null,
): BoardPresentation {
  const foundKeys = new Set(found.flatMap((group) => group.keys))
  const rows: GroupRow[] = [
    ...found.map((group) => ({
      kind: 'found' as const,
      criterion: group.criterion,
      tileKeys: group.keys,
    })),
    ...(revealed ?? [])
      .filter((group) => !group.keys.every((key) => foundKeys.has(key)))
      .map((group) => ({
        kind: 'revealed' as const,
        criterion: group.criterion,
        tileKeys: group.keys,
      })),
  ]
  return {
    rows,
    selectable: revealed ? [] : tiles.map((tile) => tile.key).filter((key) => !foundKeys.has(key)),
  }
}