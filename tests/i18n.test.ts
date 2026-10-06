import { describe, expect, it } from 'vitest'
import { en } from '../app/i18n/en'
import { es } from '../app/i18n/es'

describe('image message keys', () => {
  it('test 9: image.* and the reworded match.placeholder caption exist in both locales', () => {
    expect(Object.prototype.hasOwnProperty.call(en, 'image.alt')).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(es, 'image.alt')).toBe(true)
    for (const key of Object.keys(en)) {
      if (!key.startsWith('image.')) continue
      expect(Object.prototype.hasOwnProperty.call(es, key), `${key} is missing from es`).toBe(true)
    }
    for (const key of Object.keys(es)) {
      if (!key.startsWith('image.')) continue
      expect(Object.prototype.hasOwnProperty.call(en, key), `${key} is missing from en`).toBe(true)
    }
    expect(en).toHaveProperty('match.placeholder')
    expect(es).toHaveProperty('match.placeholder')
    expect(en['match.placeholder']).toBeTruthy()
    expect(es['match.placeholder']).toBeTruthy()
    expect(en['match.placeholder']).not.toContain('No image:')
    expect(es['match.placeholder']).not.toContain('Sin imagen:')
  })
})