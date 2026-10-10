import { fetchPeopleRoleCounts } from '../catalog/queries'
import { getPool } from '../db/pool'
import { computePuzzleSignature, type PayloadWithSignature } from '../db/puzzles'
import type { GameId } from '../game/ids'
import type { PuzzleDate } from '../utils/day'
import { utcDateFrom } from '../utils/day'
import { createPrngFromSeed, sha256Hex } from '../utils/seed'
import { shuffle } from '../utils/shuffle'
import { ROUNDS, type MoreOrLessSolution, type MoreOrLessPuzzleData } from '../game/moreOrLess'

const CHAIN_LENGTH = ROUNDS + 1
const NOVELTY_WINDOW_DAYS = 30
const MAX_NOVELTY_RETRIES = 8

export interface RoleCountCandidate {
  id: number
  name: string
  roleCount: number
}

// FR-001 (feature 008): only established actors are eligible for More or Less.
// Strictly greater than 80 — an actor with 81+ roles qualifies, an actor with 80 does not.
export const MIN_ROLE_COUNT_EXCLUSIVE = 80

export function isQualifiedRoleCount(roleCount: number): boolean {
  return roleCount > MIN_ROLE_COUNT_EXCLUSIVE
}

export function filterQualifiedCandidates(
  candidates: readonly RoleCountCandidate[],
): RoleCountCandidate[] {
  return candidates.filter((candidate) => isQualifiedRoleCount(candidate.roleCount))
}

export class PuzzleUnavailableError extends Error {
  readonly code = 'PUZZLE_UNAVAILABLE' as const
}

/**
 * FR-022: walks the seeded shuffle collecting people whose adjacent role counts differ.
 * Feature 008 FR-001/FR-010: the input is first narrowed to actors above the role floor, so no
 * chain position can ever hold a below-floor actor regardless of the caller.
 * Returns twelve people: the starting visible actor plus the eleven-actor chain, or
 * null when the catalog cannot supply an unambiguous chain.
 */
export function buildChain(
  candidates: readonly RoleCountCandidate[],
  prng: () => number,
): RoleCountCandidate[] | null {
  const qualified = filterQualifiedCandidates(candidates)
  const ordered = shuffle(qualified, prng).filter(
    (candidate, index, all) =>
      candidate.roleCount > 0 && (index === 0 || candidate.roleCount !== all[index - 1]?.roleCount),
  )

  const needed = CHAIN_LENGTH + 1
  if (ordered.length < needed) {
    return null
  }

  const picked: RoleCountCandidate[] = [ordered[0]]
  for (let i = 1; i < needed; i += 1) {
    const previous = picked[i - 1]
    const next = ordered.find(
      (candidate, index) => index > i - 1 && candidate.roleCount !== previous.roleCount,
    )
    if (!next) {
      return null
    }
    picked.push(next)
  }
  return picked
}

// EC-001/R-006: the setup signature must differ from the previous thirty days.
export function contentSignature(chain: readonly RoleCountCandidate[]): string {
  return sha256Hex(chain.map((person) => `${person.id}:${person.roleCount}`).join('|'))
}

async function fetchRecentSignatures(game: GameId, puzzleDate: PuzzleDate): Promise<Set<string>> {
  const anchor = new Date(`${puzzleDate}T00:00:00.000Z`)
  if (Number.isNaN(anchor.getTime())) {
    throw new PuzzleUnavailableError(`invalid puzzle date: ${puzzleDate}`)
  }
  anchor.setUTCDate(anchor.getUTCDate() - NOVELTY_WINDOW_DAYS)
  const sinceDate = utcDateFrom(anchor)

  const { rows } = await getPool().query<{ payload: unknown }>(
    `SELECT payload FROM daily_puzzles
     WHERE game = $1 AND puzzle_date > $2 AND puzzle_date < $3`,
    [game, sinceDate, puzzleDate],
  )

  const signatures = new Set<string>()
  for (const row of rows) {
    const payload = row.payload as Partial<PayloadWithSignature> | null
    if (payload && typeof payload.signature === 'string') {
      signatures.add(payload.signature)
    }
  }
  return signatures
}

export async function generateMoreOrLess(
  game: 'more_or_less',
  puzzleDate: PuzzleDate,
): Promise<{ payload: PayloadWithSignature; solution: MoreOrLessSolution }> {
  const candidates = await fetchPeopleRoleCounts()

  const recent = await fetchRecentSignatures(game, puzzleDate)
  const daySeed = computePuzzleSignature(game, puzzleDate)

  for (let attempt = 0; attempt < MAX_NOVELTY_RETRIES; attempt += 1) {
    const prng = createPrngFromSeed(attempt === 0 ? daySeed : sha256Hex(`${daySeed}:${attempt}`))
    const chain = buildChain(candidates, prng)
    if (!chain) {
      throw new PuzzleUnavailableError('not enough catalog coverage for an unambiguous chain')
    }

    const signature = contentSignature(chain)
    if (recent.has(signature)) {
      continue
    }

    const [initialVisible, ...chainPeople] = chain
    const data: MoreOrLessPuzzleData = {
      game,
      date: puzzleDate,
      rounds: ROUNDS,
      chain: chainPeople.map((person) => ({ id: person.id, name: person.name })),
      initialVisible: {
        id: initialVisible.id,
        name: initialVisible.name,
        roleCount: initialVisible.roleCount,
      },
    }

    // FR-017: round i compares chain[i] (hidden) against chain[i-1] (visible).
    const ordered = [initialVisible, ...chainPeople]
    const roleCounts: Record<string, number> = {}
    for (const person of ordered) {
      roleCounts[String(person.id)] = person.roleCount
    }
    const answers: Array<'more' | 'less'> = []
    for (let round = 0; round < ROUNDS; round += 1) {
      const hidden = ordered[round + 1]
      const visible = ordered[round]
      answers.push(hidden.roleCount > visible.roleCount ? 'more' : 'less')
    }

    return {
      payload: { signature, data },
      solution: { answers, roleCounts },
    }
  }

  throw new PuzzleUnavailableError('could not find a setup that differs from the last 30 days')
}