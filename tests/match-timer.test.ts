import { describe, expect, it } from 'vitest'
import {
  MATCH_TIME_LIMIT_MS,
  advanceRemaining,
  clampRemaining,
  formatMatchClock,
} from '../app/utils/matchTimer'

describe('match timer', () => {
  it('shows the remaining time as two digits, reaching 00 only at zero', () => {
    // FR-014: always two digits, so the circle never changes width.
    expect(formatMatchClock(MATCH_TIME_LIMIT_MS)).toBe('90')
    expect(formatMatchClock(89_500)).toBe('90')
    expect(formatMatchClock(9_000)).toBe('09')
    expect(formatMatchClock(1)).toBe('01')
    expect(formatMatchClock(0)).toBe('00')
    expect(formatMatchClock(-5)).toBe('00')
  })

  it('clamps every value into [0, 90_000]', () => {
    expect(clampRemaining(-5)).toBe(0)
    expect(clampRemaining(120_000)).toBe(MATCH_TIME_LIMIT_MS)
    expect(clampRemaining(Number.NaN)).toBe(0)
    expect(clampRemaining(45_000)).toBe(45_000)
  })

  it('advances by the elapsed time and floors at zero', () => {
    expect(advanceRemaining(MATCH_TIME_LIMIT_MS, 1_500)).toBe(88_500)
    expect(advanceRemaining(1_000, 5_000)).toBe(0)
  })
})
