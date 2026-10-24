import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GAME_IDS } from '../server/game/ids'
import { gameArtPath } from '../app/utils/gameArt'

describe('home game artwork map', () => {
  it('maps every game to one distinct, self-contained SVG file', () => {
    const paths = GAME_IDS.map((game) => gameArtPath(game))

    expect(new Set(paths).size).toBe(paths.length)

    for (const path of paths) {
      expect(path.startsWith('/games/')).toBe(true)
      const file = resolve(process.cwd(), 'public', path.replace(/^\//, ''))
      expect(existsSync(file), `${file} is missing`).toBe(true)

      const svg = readFileSync(file, 'utf8')
      expect(svg.trimStart().startsWith('<svg')).toBe(true)
      expect(svg).not.toContain('<text')
      // The XML namespace is the only allowed URL; no external asset may be referenced.
      expect(svg.replace('http://www.w3.org/2000/svg', '')).not.toMatch(/https?:\/\//)
    }
  })
})
