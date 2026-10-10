import { describe, expect, it } from 'vitest'
import {
  MIN_ROLE_COUNT_EXCLUSIVE,
  buildChain,
  filterQualifiedCandidates,
  isQualifiedRoleCount,
  type RoleCountCandidate,
} from '../server/generators/moreOrLess'
import { createPrngFromSeed } from '../server/utils/seed'

function person(id: number, roleCount: number): RoleCountCandidate {
  return { id, name: `person-${id}`, roleCount }
}

function distinctCounts(count: number, start: number): RoleCountCandidate[] {
  return Array.from({ length: count }, (_, index) => person(100 + index, start + index))
}

describe('more_or_less role-count floor', () => {
  it('treats the floor as exclusive: 80 is out, 81 is in', () => {
    expect(MIN_ROLE_COUNT_EXCLUSIVE).toBe(80)
    expect(isQualifiedRoleCount(0)).toBe(false)
    expect(isQualifiedRoleCount(79)).toBe(false)
    expect(isQualifiedRoleCount(80)).toBe(false)
    expect(isQualifiedRoleCount(81)).toBe(true)
    expect(isQualifiedRoleCount(200)).toBe(true)
  })

  it('filters out every candidate at or below the floor', () => {
    const kept = filterQualifiedCandidates([person(1, 79), person(2, 80), person(3, 81), person(4, 200)])
    expect(kept.map((candidate) => candidate.id)).toEqual([3, 4])
  })

  it('never selects a below-floor actor for any chain position', () => {
    const qualified = distinctCounts(12, 81)
    const below = [person(1, 0), person(2, 79), person(3, 80)]

    const chain = buildChain([...below, ...qualified], createPrngFromSeed('floor-test'))

    expect(chain).toHaveLength(12)
    for (const actor of chain ?? []) {
      expect(isQualifiedRoleCount(actor.roleCount)).toBe(true)
    }
  })

  it('returns no chain when fewer than twelve actors qualify, never a downgraded one', () => {
    // Twelve distinct actors total, but only six are above the floor.
    const below = distinctCounts(6, 1)
    const qualified = distinctCounts(6, 81)

    expect(buildChain([...below, ...qualified], createPrngFromSeed('floor-test'))).toBeNull()
  })
})
