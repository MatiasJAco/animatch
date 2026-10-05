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
  // Constitution IV: the server stores no game state, so it cannot count the visitor's
  // turns. It can, however, check any claim against the stored solution, so the device
  // presents its progress as evidence the server verifies rather than as counters it
  // believes. Both lists are optional and default to empty.
  foundGroups?: unknown
  missLog?: unknown
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
 *
 * Constitution IV: a claim is only accepted once it has been checked against the stored
 * solution. The device therefore sends the groups it has already found and the proposals it
 * has already had rejected, not a bare `consumed` key list and a `mistakes` integer. An
 * unverifiable claim is rejected outright instead of being believed.
 */
export function parseGroupsAttempt(
  body: GroupsAttemptBody,
  knownKeys: ReadonlySet<string>,
): { tileKeys: string[]; foundGroups: string[][]; missLog: string[][] } {
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

  return {
    tileKeys: keys as string[],
    foundGroups: parseProposalList(body?.foundGroups, knownKeys, 'foundGroups'),
    missLog: parseProposalList(body?.missLog, knownKeys, 'missLog'),
  }
}

function parseProposalList(
  value: unknown,
  knownKeys: ReadonlySet<string>,
  field: string,
): string[][] {
  if (value === undefined || value === null) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new GroupsInvalidAttemptError(`${field} must be a list of proposals`)
  }
  return value.map((proposal) => {
    if (!Array.isArray(proposal) || proposal.length !== GROUPS_GROUP_SIZE) {
      throw new GroupsInvalidAttemptError(`${field} holds a proposal of the wrong size`)
    }
    const keys = proposal.map((key) => (typeof key === 'string' ? key : null))
    if (keys.some((key) => key === null)) {
      throw new GroupsInvalidAttemptError(`${field} holds a non-string tile key`)
    }
    if (new Set(keys as string[]).size !== GROUPS_GROUP_SIZE) {
      throw new GroupsInvalidAttemptError(`${field} holds a proposal with repeated tiles`)
    }
    for (const key of keys as string[]) {
      if (!knownKeys.has(key)) {
        throw new GroupsInvalidAttemptError(`${field} holds a tile outside the day puzzle`)
      }
    }
    return keys as string[]
  })
}

export interface GroupsVerifiedProgress {
  consumed: string[]
  mistakeCount: number
}

/**
 * Constitution IV: re-derives the device's progress from the stored solution.
 *
 * A `foundGroups` entry must be exactly one of the four hidden groups, so leftover tiles
 * passed off as consumed can never assemble a complete group. A `missLog` entry must be a
 * proposal that genuinely forms no group. Neither a bare consumed list nor a bare mistake
 * integer is accepted, and the win is the server's own conclusion.
 *
 * A visitor may legitimately repeat a rejected proposal, so the log is not deduplicated.
 * FR-035 counts mistakes on the device by design (R-013), and because the server stores no
 * state it cannot distinguish a repeated real rejection from a padded one; that residual is
 * inherent to the stateless contract rather than a gap in this check.
 */
export function verifyGroupsProgress(
  solution: GroupsSolution,
  foundGroups: readonly string[][],
  missLog: readonly string[][],
): GroupsVerifiedProgress {
  const byKeySet = new Map(solution.groups.map((group) => [canonical(group.keys), group]))

  const consumed = new Set<string>()
  for (const proposal of foundGroups) {
    const group = byKeySet.get(canonical(proposal))
    if (!group) {
      throw new GroupsInvalidAttemptError('a claimed group is not one of the day puzzle groups')
    }
    for (const key of group.keys) {
      consumed.add(key)
    }
  }

  for (const proposal of missLog) {
    if (byKeySet.has(canonical(proposal))) {
      throw new GroupsInvalidAttemptError('a rejected proposal was actually a correct group')
    }
  }

  return { consumed: [...consumed], mistakeCount: missLog.length }
}

function canonical(keys: readonly string[]): string {
  return [...keys].sort().join('|')
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
  progress: GroupsVerifiedProgress,
): GroupsOutcome {
  // FR-039: the proposal must be four tiles the device has not already consumed.
  const consumed = new Set(progress.consumed)
  for (const key of submitted) {
    if (consumed.has(key)) {
      throw new GroupsInvalidAttemptError('a tile was already consumed by a found group')
    }
  }

  const hit = solution.groups.find((group) => {
    const members = new Set(group.keys)
    return submitted.every((key) => members.has(key))
  })

  if (hit) {
    // The consumed tiles were re-derived from the stored solution, so this win is the
    // server's conclusion rather than the device's (Constitution IV).
    const held = new Set([...progress.consumed, ...hit.keys])
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
  const ended = progress.mistakeCount + 1 >= GROUPS_WRONG_LIMIT
  return {
    result: 'miss',
    overlap,
    state: ended ? 'lost' : 'in_progress',
    ...(ended ? { groups: solution.groups } : {}),
  }
}