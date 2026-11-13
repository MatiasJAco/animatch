import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GAME_IDS, type GameId } from '../server/game/ids'
import { gameArtPath } from '../app/utils/gameArt'
import { readImageMeta } from './helpers/imageMeta'

const PUBLIC_DIR = resolve(process.cwd(), 'public')

// The three seasonal games carry the processed raster artwork.
const SEASONAL_ART: Partial<Record<GameId, string>> = {
  match_the_series_spring_2026: '/games/match-the-series-spring-2026.webp',
  match_the_series_summer_2026: '/games/match-the-series-summer-2026.webp',
  match_the_series_autumn_2026: '/games/match-the-series-autumn-2026.webp',
}

// The winter scene is stored beside them but mapped to no game.
const RESERVED_WINTER = '/games/match-the-series-winter-2026.webp'

describe('home game artwork map', () => {
  it('maps every game to one distinct, self-contained image file', () => {
    const paths = GAME_IDS.map((game) => gameArtPath(game))
    const shipped = readdirSync(resolve(PUBLIC_DIR, 'games'))

    // Every game has one distinct path, one existing file, and that file is either a
    // self-contained SVG or a raster whose header parses.
    expect(new Set(paths).size).toBe(paths.length)

    for (const path of paths) {
      expect(path.startsWith('/games/')).toBe(true)
      const file = resolve(PUBLIC_DIR, path.replace(/^\//, ''))
      expect(existsSync(file), `${file} is missing`).toBe(true)

      const extension = extname(file).toLowerCase()
      if (extension === '.svg') {
        const svg = readFileSync(file, 'utf8')
        expect(svg.trimStart().startsWith('<svg')).toBe(true)
        expect(svg).not.toContain('<text')
        // The XML namespace is the only allowed URL; no external asset may be referenced.
        expect(svg.replace('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:\/\//)
      } else {
        expect(extension, `${file} is neither SVG nor WebP`).toBe('.webp')
        const meta = readImageMeta(readFileSync(file))
        expect(meta.width).toBeGreaterThan(0)
        expect(meta.height).toBeGreaterThan(0)
      }

      // No game depends on a second fallback file: the mapped path is the only file
      // that carries the game's slug.
      const stem = basename(file, extension)
      const siblings = shipped.filter((name) => name.startsWith(`${stem}.`))
      expect(siblings, `${stem} is backed by more than one file`).toEqual([
        `${stem}${extension}`,
      ])
    }

    // The three seasonal entries resolve to the processed 800x450 WebP files.
    for (const [game, path] of Object.entries(SEASONAL_ART)) {
      expect(gameArtPath(game as GameId)).toBe(path)
      const file = resolve(PUBLIC_DIR, path.replace(/^\//, ''))
      expect(existsSync(file), `${file} is missing`).toBe(true)
      const meta = readImageMeta(readFileSync(file))
      expect(meta.width).toBe(800)
      expect(meta.height).toBe(450)
    }

    // No SVG counterpart remains for the three seasonal games.
    for (const path of Object.values(SEASONAL_ART)) {
      const svg = resolve(PUBLIC_DIR, path.replace(/\.webp$/, '.svg').replace(/^\//, ''))
      expect(existsSync(svg), `${svg} still exists`).toBe(false)
    }

    // The reserved winter scene is stored but mapped to no game.
    expect(existsSync(resolve(PUBLIC_DIR, RESERVED_WINTER.replace(/^\//, '')))).toBe(true)
    expect(paths).not.toContain(RESERVED_WINTER)
  })
})
