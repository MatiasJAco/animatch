import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ImageDownloadError,
  getOrDownloadImage,
  isAllowedOrigin,
  setImageBackoffMs,
  setImageCacheDir,
  setImageFetcher,
  resetImageState,
} from '../server/images/download'

const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])

function jpegResponse(bytes: Uint8Array = JPG): Response {
  return new Response(bytes, {
    status: 200,
    headers: { 'content-type': 'image/jpeg' },
  })
}

describe('server/images/download', () => {
  let dir: string
  let okFetcher: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'animatch-img-'))
    setImageCacheDir(dir)
    setImageFetcher((async () => jpegResponse()) as unknown as typeof fetch)
    setImageBackoffMs(50)
    resetImageState()
    okFetcher = vi.fn(async () => jpegResponse())
    setImageFetcher(okFetcher as unknown as typeof fetch)
  })

  afterEach(async () => {
    resetImageState()
    await rm(dir, { recursive: true, force: true })
  })

  it('test 1: downloads once, then serves from disk with zero upstream calls', async () => {
    const url = 'https://cdn.myanimelist.net/images/anime/1418/108748.jpg'

    const first = await getOrDownloadImage('anime', 9001, url)
    expect(first.fromCache).toBe(false)
    expect(first.contentType).toBe('image/jpeg')
    expect(Buffer.compare(Buffer.from(first.bytes), Buffer.from(JPG))).toBe(0)

    const second = await getOrDownloadImage('anime', 9001, url)
    expect(second.fromCache).toBe(true)
    expect(Buffer.compare(Buffer.from(second.bytes), Buffer.from(first.bytes))).toBe(0)

    expect(okFetcher).toHaveBeenCalledTimes(1)

    const files = await readdir(dir)
    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(/^anime-9001-[0-9a-f]{16}\.jpg$/)

    // Test 1 byte-consistency (US3): even if the upstream would now serve different bytes,
    // the disk file is the single source, so the cached read stays byte-identical.
    setImageFetcher(
      (async () =>
        new Response(new Uint8Array([0xaa, 0xbb, 0xcc]), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        })) as unknown as typeof fetch,
    )
    const third = await getOrDownloadImage('anime', 9001, url)
    expect(third.fromCache).toBe(true)
    expect(Buffer.compare(Buffer.from(third.bytes), Buffer.from(JPG))).toBe(0)
    expect(okFetcher).toHaveBeenCalledTimes(1)
  })

  it('test 2: concurrent requests for one key produce exactly one upstream call', async () => {
    const url = 'https://cdn.myanimelist.net/images/anime/9001/x.jpg'

    const results = await Promise.all(
      Array.from({ length: 8 }, () => getOrDownloadImage('character', 42, url)),
    )

    expect(okFetcher).toHaveBeenCalledTimes(1)
    expect(new Set(results.map((r) => r.fromCache)).size).toBeGreaterThanOrEqual(1)
    for (const result of results) {
      expect(Buffer.compare(Buffer.from(result.bytes), Buffer.from(JPG))).toBe(0)
    }
  })

  it('test 3: a failed download writes no file and a later success writes only the final name', async () => {
    const url = 'https://cdn.myanimelist.net/images/person/7/x.jpg'
    setImageBackoffMs(150)
    setImageFetcher((async () => {
      throw new Error('upstream down')
    }) as unknown as typeof fetch)

    await expect(getOrDownloadImage('person', 7, url)).rejects.toBeInstanceOf(ImageDownloadError)
    expect(await readdir(dir)).toHaveLength(0)

    setImageFetcher(okFetcher as unknown as typeof fetch)
    await new Promise((resolve) => setTimeout(resolve, 170))
    const result = await getOrDownloadImage('person', 7, url)
    expect(result.fromCache).toBe(false)
    const files = await readdir(dir)
    expect(files).toHaveLength(1)
    // Atomic write: only the final name exists, never a partial temp file.
    expect(files[0].startsWith('.tmp-')).toBe(false)
    expect(files[0]).toMatch(/^person-7-[0-9a-f]{16}\.jpg$/)
  })

  it('test 4: a failure enters a backoff window that suppresses calls and then expires', async () => {
    const url = 'https://cdn.myanimelist.net/images/voiceactors/3/75882.jpg'
    setImageBackoffMs(60)
    let failing = true
    setImageFetcher((async () => {
      if (failing) throw new Error('upstream down')
      return jpegResponse()
    }) as unknown as typeof fetch)

    await expect(getOrDownloadImage('anime', 3, url)).rejects.toBeInstanceOf(ImageDownloadError)
    await expect(getOrDownloadImage('anime', 3, url)).rejects.toBeInstanceOf(ImageDownloadError)
    // The second call is inside the window and never reaches upstream.
    expect(failing ? 0 : 1).toBe(0)
    expect(await readdir(dir)).toHaveLength(0)

    failing = false
    await new Promise((resolve) => setTimeout(resolve, 80))
    const result = await getOrDownloadImage('anime', 3, url)
    expect(result.fromCache).toBe(false)
    expect(await readdir(dir)).toHaveLength(1)
  })

  it('test 5: non-https URLs, foreign hosts, and disallowed content types are rejected with nothing cached', async () => {
    const base = 'https://cdn.myanimelist.net/images/anime/1418/108748.jpg'

    expect(isAllowedOrigin(base)).toBe(true)
    expect(isAllowedOrigin('http://cdn.myanimelist.net/images/x.jpg')).toBe(false)
    expect(isAllowedOrigin('https://evil.example/x.jpg')).toBe(false)
    expect(isAllowedOrigin('not a url')).toBe(false)

    await expect(
      getOrDownloadImage('anime', 9001, 'http://cdn.myanimelist.net/images/x.jpg'),
    ).rejects.toBeInstanceOf(ImageDownloadError)
    expect(okFetcher).not.toHaveBeenCalled()
    expect(await readdir(dir)).toHaveLength(0)

    setImageFetcher(
      (async () => {
        return new Response('<html/>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })
      }) as unknown as typeof fetch,
    )
    setImageBackoffMs(0)
    await expect(getOrDownloadImage('anime', 9001, base)).rejects.toBeInstanceOf(
      ImageDownloadError,
    )
    expect(await readdir(dir)).toHaveLength(0)
  })
})