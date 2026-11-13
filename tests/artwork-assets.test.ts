import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GAME_ART_PATHS } from '../app/utils/gameArt'
import { readImageMeta } from './helpers/imageMeta'

const REPO_ROOT = resolve(process.cwd())
const SOURCE_DIR = resolve(REPO_ROOT, 'artwork', 'sources')
const PUBLIC_DIR = resolve(REPO_ROOT, 'public')

// Every source artwork and the one shipped asset derived from it.
const SOURCES: Record<string, string> = {
  'matchi-board.png': '/artwork/matchi-mascot.webp',
  'matchi-spring.jpg': '/games/match-the-series-spring-2026.webp',
  'matchi-summer.jpg': '/games/match-the-series-summer-2026.webp',
  'matchi-autumn.jpg': '/games/match-the-series-autumn-2026.webp',
  'matchi-winter.jpg': '/games/match-the-series-winter-2026.webp',
}

// The reserved winter scene is stored beside the seasonal assets but mapped to no game.
const RESERVED_WINTER = '/games/match-the-series-winter-2026.webp'

// The set the home page actually serves: three seasonal images, the mascot and the two
// unchanged illustrations.
const HOME_PAGE_ART = [
  '/games/match-the-series-spring-2026.webp',
  '/games/match-the-series-summer-2026.webp',
  '/games/match-the-series-autumn-2026.webp',
  '/artwork/matchi-mascot.webp',
  '/games/more-or-less.svg',
  '/games/groups.svg',
]

const KB = 1000
const CARD_CEILING = 90 * KB
const MASCOT_CEILING = 150 * KB
const PAGE_BUDGET = 450 * KB

function assetPath(served: string): string {
  return resolve(PUBLIC_DIR, served.replace(/^\//, ''))
}

describe('home artwork assets', () => {
  it('commits every source outside the served directory and derives one asset from each', () => {
    const onDisk = readdirSync(SOURCE_DIR).filter((name) => !name.startsWith('.'))
    expect(onDisk.sort()).toEqual(Object.keys(SOURCES).sort())

    const derived = Object.values(SOURCES)
    expect(new Set(derived).size).toBe(derived.length)

    for (const [name, served] of Object.entries(SOURCES)) {
      const source = resolve(SOURCE_DIR, name)
      expect(existsSync(source), `${name} is missing`).toBe(true)

      // The sources are a project record, never a served file.
      expect(relative(PUBLIC_DIR, source).startsWith('..')).toBe(true)
      expect(relative(SOURCE_DIR, source).split(sep)[0]).not.toBe('..')

      const asset = assetPath(served)
      expect(existsSync(asset), `${served} is missing`).toBe(true)

      // A shipped asset is a re-encoded derivative: smaller than its source, and not a copy.
      const sourceBytes = statSync(source).size
      const assetBytes = statSync(asset).size
      expect(assetBytes, `${served} is not smaller than ${name}`).toBeLessThan(sourceBytes)
      expect(readFileSync(asset).equals(readFileSync(source)), `${served} is a copy of ${name}`).toBe(
        false,
      )
    }
  })

  it('ships every seasonal asset at 800x450 and the mascot at 640x1137 with transparency', () => {
    for (const served of [
      '/games/match-the-series-spring-2026.webp',
      '/games/match-the-series-summer-2026.webp',
      '/games/match-the-series-autumn-2026.webp',
      RESERVED_WINTER,
    ]) {
      const asset = assetPath(served)
      expect(existsSync(asset), `${served} is missing`).toBe(true)
      const meta = readImageMeta(readFileSync(asset))
      expect(meta.width, `${served} has the wrong width`).toBe(800)
      expect(meta.height, `${served} has the wrong height`).toBe(450)
      expect(statSync(asset).size, `${served} is over the 90 KB ceiling`).toBeLessThanOrEqual(
        CARD_CEILING,
      )
    }

    const mascot = assetPath('/artwork/matchi-mascot.webp')
    expect(existsSync(mascot), 'the mascot is missing').toBe(true)
    const meta = readImageMeta(readFileSync(mascot))
    expect(meta.width).toBe(640)
    expect(meta.height).toBe(1137)
    expect(meta.alpha, 'the mascot has no alpha channel').toBe(true)
    expect(statSync(mascot).size).toBeLessThanOrEqual(MASCOT_CEILING)

    // The reserved winter scene is stored but mapped to no game.
    expect(Object.values(GAME_ART_PATHS)).not.toContain(RESERVED_WINTER)
    expect(existsSync(assetPath(RESERVED_WINTER))).toBe(true)
  })

  it('keeps the home page artwork inside the page budget', () => {
    let total = 0
    for (const served of HOME_PAGE_ART) {
      const asset = assetPath(served)
      expect(existsSync(asset), `${served} is missing`).toBe(true)
      total += statSync(asset).size
    }
    expect(total).toBeLessThanOrEqual(PAGE_BUDGET)
  })
})
