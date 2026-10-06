import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, createRouter, toWebHandler } from 'h3'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import imageHandler from '../../server/api/images/[kind]/[malId].get'
import { generateMoreOrLess } from '../../server/generators/moreOrLess'
import { getDailyPuzzle, getOrCreateDailyPuzzle } from '../../server/db/puzzles'
import { getPool } from '../../server/db/pool'
import { catalogImageUrl } from '../../server/catalog/queries'
import { isolatedPuzzleDate } from '../helpers/dbDates'
import {
  resetImageState,
  setImageCacheDir,
  setImageFetcher,
} from '../../server/images/download'

const connectionString = process.env.DATABASE_URL ?? ''

// T031 (convergence F1): partial mock so a poisoned catalog URL can be exercised at the route
// without a database. Tests 6/7/10 keep their real behavior because the default implementation
// forwards to the original module.
vi.mock('../../server/catalog/queries', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../server/catalog/queries')>()
  return {
    ...original,
    catalogImageUrl: vi.fn(original.catalogImageUrl),
  }
})

const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9])

const router = createRouter()
router.get('/api/images/:kind/:malId', imageHandler)
const app = createApp({ debug: false })
app.use(router)
const webHandler = toWebHandler(app)

async function getImage(path: string): Promise<Response> {
  return webHandler(new Request(`http://localhost${path}`))
}

describe('GET /api/images/:kind/:malId', () => {
  let dir: string
  let okFetcher: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'animatch-route-'))
    setImageCacheDir(dir)
    resetImageState()
    okFetcher = vi.fn(
      (async () =>
        new Response(JPG, { status: 200, headers: { 'content-type': 'image/jpeg' } })) as unknown as typeof fetch,
    )
    setImageFetcher(okFetcher as unknown as typeof fetch)
  })

  afterEach(async () => {
    resetImageState()
    await rm(dir, { recursive: true, force: true })
  })

  it('test 6: serves allow-listed bytes with immutable headers; rejects bad requests without any upstream call', async () => {
    const badKind = await getImage('/api/images/notakind/9001')
    expect(badKind.status).toBe(400)
    expect(((await badKind.json()) as { error: { code: string } }).error.code).toBe(
      'INVALID_IMAGE_REQUEST',
    )
    const badId = await getImage('/api/images/anime/-5')
    expect(badId.status).toBe(400)
    expect(((await badId.json()) as { error: { code: string } }).error.code).toBe(
      'INVALID_IMAGE_REQUEST',
    )
    expect(await getImage('/api/images/anime/1.5')).toBeTruthy()
    expect(okFetcher).not.toHaveBeenCalled()

    if (connectionString) {
      for (const [kind, id] of [
        ['anime', 9001],
        ['character', 12345],
        ['person', 678],
      ] as const) {
        const url = await catalogImageUrl(kind, id)
        if (!url) continue
        const first = await getImage(`/api/images/${kind}/${id}`)
        expect(first.status).toBe(200)
        expect(first.headers.get('content-type')).toBe('image/jpeg')
        expect(first.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
        const cached = await getImage(`/api/images/${kind}/${id}`)
        expect(Buffer.compare(Buffer.from(await cached.arrayBuffer()), Buffer.from(JPG))).toBe(0)
      }

      const missing = await getImage('/api/images/anime/999999999')
      expect(missing.status).toBe(404)
      expect(((await missing.json()) as { error: { code: string } }).error.code).toBe(
        'IMAGE_UNAVAILABLE',
      )
      const cachedFiles = await readdir(dir)
      expect(cachedFiles.some((name) => name.startsWith('anime-999999999-'))).toBe(false)
    }
  })

  it('test 7: a served puzzle payload is unchanged — no image fields, no upstream URLs', async () => {
    if (!connectionString) return
    const date = isolatedPuzzleDate(12)
    await getOrCreateDailyPuzzle('more_or_less', date, () =>
      generateMoreOrLess('more_or_less', date),
    )
    const row = await getDailyPuzzle('more_or_less', date)
    const served = JSON.stringify(row?.payload ?? '').toString()
    expect(served).not.toContain('/images/')
    expect(served).not.toContain('cdn.')
    expect(served).not.toContain('image_url')
  })

  it('test 10: catalog image reads are single parameterized SELECTs — no other statement type', async () => {
    if (!connectionString) return
    const pool = getPool()
    const spy = vi.spyOn(pool, 'query')
    try {
      await catalogImageUrl('anime', 1)
      const sql = spy.mock.calls[0]?.[0] as string
      expect(/^SELECT image_url FROM anime WHERE mal_id = \$1/.test(sql)).toBe(true)
      expect(/\b(INSERT|UPDATE|DELETE)\b/i.test(sql)).toBe(false)
    } finally {
      spy.mockRestore()
    }
  })

  it('test 11: a catalog URL outside the https/host allow-list returns 404 IMAGE_UNAVAILABLE', async () => {
    vi.mocked(catalogImageUrl).mockResolvedValueOnce('https://evil.example/x.jpg')
    const res = await getImage('/api/images/anime/1')
    expect(res.status).toBe(404)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'IMAGE_UNAVAILABLE',
    )
    expect(okFetcher).not.toHaveBeenCalled()
    expect(await readdir(dir)).toHaveLength(0)
  })
})