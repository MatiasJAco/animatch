import { defineEventHandler, getRouterParam, setResponseHeaders } from 'h3'
import { catalogImageUrl } from '../../../catalog/queries'
import type { ErrorCode } from '../../../utils/errors'
import { errorResponse } from '../../../utils/http'
import { getOrDownloadImage, ImageDownloadError, ImageUnavailableError } from '../../../images/download'
import type { ImageKind } from '../../../images/cache'

const KINDS: readonly ImageKind[] = ['anime', 'character', 'person']

// Feature 002 contract §3: GET /api/images/{kind}/{malId}. The route is the only place the
// catalog image URL is resolved (R-001); the browser only ever receives a first-party path.
export default defineEventHandler(async (event) => {
  const rawKind = getRouterParam(event, 'kind')
  const rawId = getRouterParam(event, 'malId')

  if (!KINDS.includes(rawKind as ImageKind)) {
    return errorResponse(event, 'INVALID_IMAGE_REQUEST')
  }
  const malId = Number(rawId)
  if (!Number.isInteger(malId) || malId < 1) {
    return errorResponse(event, 'INVALID_IMAGE_REQUEST')
  }

  let url: string | null
  try {
    url = await catalogImageUrl(rawKind as ImageKind, malId)
  } catch {
    return errorResponse(event, 'DATABASE_UNAVAILABLE')
  }
  if (!url) {
    return errorResponse(event, 'IMAGE_UNAVAILABLE')
  }

  try {
    const image = await getOrDownloadImage(rawKind as ImageKind, malId, url)
    setResponseHeaders(event, {
      'content-type': image.contentType,
      'cache-control': 'public, max-age=31536000, immutable',
    })
    return new Uint8Array(image.bytes)
  } catch (error) {
    if (error instanceof ImageUnavailableError) {
      return errorResponse(event, 'IMAGE_UNAVAILABLE')
    }
    if (error instanceof ImageDownloadError) {
      return errorResponse(event, 'IMAGE_FETCH_FAILED')
    }
    if ((error as { code?: ErrorCode | string }).code === 'DATABASE_UNAVAILABLE') {
      return errorResponse(event, 'DATABASE_UNAVAILABLE')
    }
    // Any other error (e.g. a disk failure on the cached read) is an internal failure and
    // surfaces as a standard 500, never as a misleading image-code envelope.
    throw error
  }
})