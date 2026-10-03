import { setResponseStatus, type H3Event } from 'h3'
import type { ErrorCode } from './errors'
import { createErrorEnvelope, STATUS_FOR_CODE } from './errors'

/**
 * Every API failure leaves as the contract's ErrorEnvelope with its documented status code.
 * The client renders its own localized copy from the stable code.
 */
export function errorResponse(event: H3Event, code: ErrorCode) {
  setResponseStatus(event, STATUS_FOR_CODE[code])
  return createErrorEnvelope(code)
}