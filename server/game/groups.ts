export const GROUPS_BOARD_SIZE = 16
export const GROUPS_GROUP_SIZE = 4
export const GROUPS_GROUP_COUNT = 4
export const GROUPS_WRONG_LIMIT = 5

export type GroupTileKind = 'character' | 'person'

export interface GroupsTile {
  key: string // 'c:12345@a:9001'
  kind: GroupTileKind
  name: string
}

export type GroupCriterion =
  | { type: 'same_anime'; animeId: number }
  | { type: 'same_season'; season: string; year: number }
  | { type: 'same_language'; animeId: number; language: string }
  | { type: 'same_voice_actor'; personId: number }

export interface GroupsPayloadData {
  game: 'groups'
  date: string
  tiles: GroupsTile[]
  groupCount: number
  wrongLimit: number
}

export interface GroupsSolutionGroup {
  keys: string[]
  criterion: GroupCriterion
}

export interface GroupsSolution {
  groups: GroupsSolutionGroup[]
}

export interface GroupsAttemptBody {
  tileKeys?: unknown
  consumed?: unknown
}

export interface GroupsOutcomeHit {
  result: 'hit'
  tileKeys: string[]
  criterion: GroupCriterion
  state: 'in_progress' | 'won'
}

// FR-035a: the miss names no group and no shared fact, only the overlap count.
export interface GroupsOutcomeMiss {
  result: 'miss'
  overlap: number
  state: 'in_progress' | 'lost'
  // Only present once the mistake limit ends the game (FR-035).
  groups?: GroupsSolutionGroup[]
}

export type GroupsOutcome = GroupsOutcomeHit | GroupsOutcomeMiss

export class GroupsInvalidAttemptError extends Error {
  readonly code = 'INVALID_ATTEMPT' as const
}

/**
 * FR-039: exactly four known, unconsumed tile keys. The consumed set arrives from the device,
 * so the server stores nothing about the visitor.
 */
export function parseGroupsAttempt(
  body: GroupsAttemptBody,
  knownKeys: ReadonlySet<string>,
): { tileKeys: string[]; consumed: string[] } {
  const tileKeys = body?.tileKeys
  if (!Array.isArray(tileKeys) || tileKeys.length !== GROUPS_GROUP_SIZE) {
    throw new GroupsInvalidAttemptError(`exactly ${GROUPS_GROUP_SIZE} tile keys are required`)
  }
  const keys = tileKeys.map((key) => (typeof key === 'string' ? key : null))
  if (keys.some((key) => key === null)) {
    throw new GroupsInvalidAttemptError('tile keys must be strings')
  }
  const unique = new Set(keys as string[])
  if (unique.size !== GROUPS_GROUP_SIZE) {
    throw new GroupsInvalidAttemptError('tile keys must be distinct')
  }
  for (const key of unique) {
    if (!knownKeys.has(key)) {
      throw new GroupsInvalidAttemptError('a tile key is not in the day puzzle')
    }
  }

  const consumed = Array.isArray(body?.consumed)
    ? new Set(body.consumed.filter((key): key is string => typeof key === 'string'))
    : new Set<string>()
  for (const key of consumed) {
    if (unique.has(key)) {
      throw new GroupsInvalidAttemptError('a tile was already consumed by a found group')
    }
  }

  return { tileKeys: keys as string[], consumed: [...consumed] }
}

/**
 * FR-035a: the largest number of submitted tiles inside one hidden group, and zero when no two
 * submitted tiles share a group. A single tile is never a hint, so anything below two is zero.
 */
export function computeOverlap(submitted: string[], groups: GroupsSolutionGroup[]): number {
  let best = 0
  for (const group of groups) {
    const members = new Set(group.keys)
    const count = submitted.filter((key) => members.has(key)).length
    if (count > best) {
      best = count
    }
  }
  return best < 2 ? 0 : best
}

export function resolveGroupsOutcome(
  solution: GroupsSolution,
  submitted: string[],
  wrongCount: number,
  consumed: readonly string[] = [],
): GroupsOutcome {
  const hit = solution.groups.find((group) => {
    const members = new Set(group.keys)
    return submitted.every((key) => members.has(key))
  })

  if (hit) {
    // The consumed tiles come from the device, so the win is decided from that plus this hit.
    const held = new Set([...consumed, ...hit.keys])
    const complete = solution.groups.filter((group) =>
      group.keys.every((key) => held.has(key)),
    ).length
    return {
      result: 'hit',
      tileKeys: hit.keys,
      criterion: hit.criterion,
      state: complete >= solution.groups.length ? 'won' : 'in_progress',
    }
  }

  const overlap = computeOverlap(submitted, solution.groups)
  const ended = wrongCount + 1 >= GROUPS_WRONG_LIMIT
  return {
    result: 'miss',
    overlap,
    state: ended ? 'lost' : 'in_progress',
    ...(ended ? { groups: solution.groups } : {}),
  }
}