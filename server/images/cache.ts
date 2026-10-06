import { createHash } from 'node:crypto'
import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export type ImageKind = 'anime' | 'character' | 'person'

// Feature 002 data-model §2: extension follows the validated upstream content type, never the
// URL. The list is the download allow-list and the cache's dir-probe set in one place.
const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

export const IMAGE_EXTS = Object.keys(CONTENT_TYPE_BY_EXT)

let cacheDir = resolve(process.cwd(), '.cache', 'images')

export function setImageCacheDir(dir: string): void {
  cacheDir = resolve(dir)
}

export function imageCacheDir(): string {
  return cacheDir
}

// sha256(image_url).slice(0,16): a URL change produces a fresh filename and therefore a fresh
// download, while an unchanged URL is served from disk forever (research R-003).
export function urlHash(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16)
}

export function imageFileName(kind: ImageKind, malId: number, url: string, ext: string): string {
  return `${kind}-${malId}-${urlHash(url)}.${ext}`
}

export function imageFilePath(kind: ImageKind, malId: number, url: string, ext: string): string {
  return join(cacheDir, imageFileName(kind, malId, url, ext))
}

export function contentTypeToExt(contentType: string): string | null {
  const type = contentType.split(';')[0]?.trim().toLowerCase() ?? ''
  return IMAGE_EXTS.find((ext) => CONTENT_TYPE_BY_EXT[ext] === type) ?? null
}

export function extToContentType(ext: string): string | undefined {
  return CONTENT_TYPE_BY_EXT[ext]
}

// The file is the download tracker (R-003): existence is "already downloaded". Because the
// extension is only known after the first fetch, a cache hit is found by probing the four
// allowed extensions.
export async function findCachedFile(
  kind: ImageKind,
  malId: number,
  url: string,
): Promise<{ path: string; contentType: string } | null> {
  for (const ext of IMAGE_EXTS) {
    const path = imageFilePath(kind, malId, url, ext)
    try {
      await stat(path)
      return { path, contentType: extToContentType(ext) as string }
    } catch {
      // not cached under this extension; keep probing
    }
  }
  return null
}

// Atomic publish: bytes land in a temp name and are renamed into the final name, so a partial
// download can never be served as an image (research R-005).
export async function writeCachedFile(path: string, bytes: Buffer): Promise<void> {
  await mkdir(cacheDir, { recursive: true })
  const tmp = join(cacheDir, `.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  await writeFile(tmp, bytes)
  try {
    await rename(tmp, path)
  } catch (error) {
    await unlink(tmp).catch(() => undefined)
    throw error
  }
}