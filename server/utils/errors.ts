export type ErrorCode =
  | 'UNKNOWN_GAME'
  | 'INVALID_ATTEMPT'
  | 'DATABASE_UNAVAILABLE'
  | 'PUZZLE_UNAVAILABLE'

// Shape matches the OpenAPI ErrorEnvelope: a nested `error` object with a stable code
// the client renders in its own language, plus an English fallback message.
export interface ErrorEnvelope {
  error: {
    code: ErrorCode
    message: string
  }
}

const FALLBACK: Record<ErrorCode, string> = {
  UNKNOWN_GAME: 'That game is not available.',
  INVALID_ATTEMPT: 'That answer is not valid.',
  DATABASE_UNAVAILABLE: 'The puzzle could not be loaded right now.',
  PUZZLE_UNAVAILABLE: 'No puzzle is available for today.',
}

export function createErrorEnvelope(code: ErrorCode): ErrorEnvelope {
  return { error: { code, message: FALLBACK[code] } }
}

export const STATUS_FOR_CODE: Record<ErrorCode, number> = {
  UNKNOWN_GAME: 404,
  INVALID_ATTEMPT: 400,
  PUZZLE_UNAVAILABLE: 503,
  DATABASE_UNAVAILABLE: 503,
}