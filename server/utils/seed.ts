import { createHash } from 'node:crypto'

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), t | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function toSeedInt(hex: string, start = 0, length = 8): number {
  const slice = hex.slice(start, start + length)
  return Number.parseInt(slice, 16) >>> 0
}

export type Prng = () => number

export function createPrngFromSeed(hex: string): Prng {
  return mulberry32(toSeedInt(hex))
}