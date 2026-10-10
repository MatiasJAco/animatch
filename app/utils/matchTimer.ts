// Match the Series countdown: the fixed time limit and the pure formatting/clamping the device
// timer and its tests share. No imports and no side effects.
export const MATCH_TIME_LIMIT_MS = 90_000

// Keeps a raw remaining value inside [0, MATCH_TIME_LIMIT_MS]. A non-finite value floors at 0.
export function clampRemaining(remainingMs: number): number {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return 0
  }
  return remainingMs >= MATCH_TIME_LIMIT_MS ? MATCH_TIME_LIMIT_MS : remainingMs
}

// One tick: subtract the elapsed duration and clamp.
export function advanceRemaining(remainingMs: number, elapsedMs: number): number {
  return clampRemaining(remainingMs - elapsedMs)
}

// Whole seconds remaining as two digits. Math.ceil so a full game reads "90" and the value
// reaches "00" only at zero.
export function formatMatchClock(remainingMs: number): string {
  const seconds = Math.ceil(clampRemaining(remainingMs) / 1000)
  return String(seconds).padStart(2, '0')
}
