// Principle V: an error state must name what failed. The endpoint answers with the
// ErrorEnvelope contract, so the client reads that code instead of assuming every non-2xx
// is a database outage.
export type AttemptErrorCode =
  | 'UNKNOWN_GAME'
  | 'INVALID_ATTEMPT'
  | 'DATABASE_UNAVAILABLE'
  | 'PUZZLE_UNAVAILABLE'

const KNOWN: readonly AttemptErrorCode[] = [
  'UNKNOWN_GAME',
  'INVALID_ATTEMPT',
  'DATABASE_UNAVAILABLE',
  'PUZZLE_UNAVAILABLE',
]

export function isAttemptErrorCode(value: unknown): value is AttemptErrorCode {
  return typeof value === 'string' && (KNOWN as readonly string[]).includes(value)
}

/**
 * Reads the code out of an ErrorEnvelope. A body that is missing, unparseable, or carries an
 * unknown code falls back to the database-unavailable message rather than exposing itself.
 */
export async function readErrorCode(res: Response): Promise<AttemptErrorCode> {
  try {
    const body = (await res.json()) as { error?: { code?: unknown } } | null
    const code = body?.error?.code
    if (isAttemptErrorCode(code)) {
      return code
    }
  } catch {
    // A non-JSON or empty body is treated as an unnamed failure below.
  }
  return 'DATABASE_UNAVAILABLE'
}

/**
 * A rejected attempt or an unknown game is deterministic, so replaying the identical request
 * would fail the same way. Only the codes that can succeed on a second try get a Retry.
 */
export function isRetryableCode(code: AttemptErrorCode): boolean {
  return code === 'DATABASE_UNAVAILABLE' || code === 'PUZZLE_UNAVAILABLE'
}