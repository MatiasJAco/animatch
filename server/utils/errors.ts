export type ErrorCode =
  | 'UNKNOWN_GAME'
  | 'INVALID_ATTEMPT'
  | 'DATABASE_UNAVAILABLE'
  | 'PUZZLE_UNAVAILABLE'
  | 'INVALID_IMAGE_REQUEST'
  | 'IMAGE_UNAVAILABLE'
  | 'IMAGE_FETCH_FAILED'

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
  INVALID_IMAGE_REQUEST: 'That image request is not valid.',
  IMAGE_UNAVAILABLE: 'That image is not available.',
  IMAGE_FETCH_FAILED: 'That image could not be loaded right now.',
}

export function createErrorEnvelope(code: ErrorCode): ErrorEnvelope {
  return { error: { code, message: FALLBACK[code] } }
}

export const STATUS_FOR_CODE: Record<ErrorCode, number> = {
  UNKNOWN_GAME: 404,
  INVALID_ATTEMPT: 400,
  PUZZLE_UNAVAILABLE: 503,
  DATABASE_UNAVAILABLE: 503,
  INVALID_IMAGE_REQUEST: 400,
  IMAGE_UNAVAILABLE: 404,
  IMAGE_FETCH_FAILED: 502,
}