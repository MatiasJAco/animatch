import { readFile } from 'node:fs/promises'
import {
  extToContentType,
  findCachedFile,
  imageFilePath,
  ImageKind,
  writeCachedFile,
  contentTypeToExt,
} from './cache'

export { setImageCacheDir } from './cache'

// The default fetcher requires Node >= 22.18 (global fetch, node version gate in package.json).
let fetcher: typeof fetch = globalThis.fetch
let backoffMs = 5 * 60 * 1000
const inflight = new Map<string, Promise<ImageResult>>()
const backoff = new Map<string, number>()

export interface ImageResult {
  bytes: Buffer
  contentType: string
  fromCache: boolean
}

export class ImageDownloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageDownloadError'
  }
}

// Deterministic rejection: the stored URL can never be corrected by waiting, so the route maps
// it to IMAGE_UNAVAILABLE (404) — not to the transient IMAGE_FETCH_FAILED (502) — per data-model
// §6, research R-007, and contracts/openapi.yaml. No backoff is entered and nothing is cached.
export class ImageUnavailableError extends ImageDownloadError {
  constructor(message: string) {
    super(message)
    this.name = 'ImageUnavailableError'
  }
}

export function setImageFetcher(fn: typeof fetch): void {
  fetcher = fn
}

export function setImageBackoffMs(ms: number): void {
  backoffMs = ms
}

export function resetImageState(): void {
  inflight.clear()
  backoff.clear()
}

const ALLOWED_ORIGIN = 'cdn.myanimelist.net'

export function isAllowedOrigin(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    if (parsed.hostname !== ALLOWED_ORIGIN) return false
    return true
  } catch {
    return false
  }
}

function markFailed(key: string): never {
  backoff.set(key, Date.now() + backoffMs)
  throw new ImageDownloadError('failed to fetch the catalog image')
}

// First-party image access (research R-001): the server downloads the catalog image URL once,
// publishes it into the disk cache, and never hits the network again for that URL (R-003).
export async function getOrDownloadImage(
  kind: ImageKind,
  malId: number,
  url: string,
): Promise<ImageResult> {
  const key = `${kind}:${malId}`

  const existing = inflight.get(key)
  if (existing) return existing

  const attempt = (async (): Promise<ImageResult> => {
    const cached = await findCachedFile(kind, malId, url)
    if (cached) {
      return {
        bytes: await readFile(cached.path),
        contentType: cached.contentType,
        fromCache: true,
      }
    }

    const retryAt = backoff.get(key)
    if (retryAt !== undefined && Date.now() < retryAt) {
      throw new ImageDownloadError('upstream is in its backoff window')
    }
    backoff.delete(key)

    if (!isAllowedOrigin(url)) {
      throw new ImageUnavailableError('image URL outside the allow-list')
    }

    let response: Response
    try {
      response = await fetcher(url)
    } catch {
      return markFailed(key)
    }
    if (!response.ok) return markFailed(key)

    const ext = contentTypeToExt(response.headers.get('content-type') ?? '')
    if (!ext) return markFailed(key)

    const bytes = Buffer.from(await response.arrayBuffer())
    const path = imageFilePath(kind, malId, url, ext)
    try {
      await writeCachedFile(path, bytes)
    } catch {
      return markFailed(key)
    }

    return {
      bytes,
      contentType: extToContentType(ext) ?? 'image/jpeg',
      fromCache: false,
    }
  })()

  inflight.set(
    key,
    attempt.finally(() => {
      inflight.delete(key)
    }),
  )
  return inflight.get(key) as Promise<ImageResult>
}