import { describe, expect, it } from 'vitest'
import { entityImageId, imagePath } from '../app/utils/entityImage'

describe('app/utils/entityImage', () => {
  it('test 8: derives paths from the three payload shapes and yields null (placeholder) for malformed input', () => {
    // Match the Series series tile: 'a:9001'
    expect(entityImageId('anime', 'a:9001')).toBe(9001)
    expect(imagePath('anime', entityImageId('anime', 'a:9001'))).toBe('/api/images/anime/9001')

    // Match the Series clue card: 'c:12345' and 'p:678', with an explicit kind
    expect(entityImageId('character', 'c:12345')).toBe(12345)
    expect(entityImageId('person', 'p:678')).toBe(678)
    expect(imagePath('person', entityImageId('person', 'p:678'))).toBe('/api/images/person/678')

    // Groups tile key 'c:12345@a:9001': the entity id is before the '@'
    expect(entityImageId('character', 'c:12345@a:9001')).toBe(12345)
    expect(imagePath('character', entityImageId('character', 'c:12345@a:9001'))).toBe(
      '/api/images/character/12345',
    )

    // More or Less person tiles pass the id straight through
    expect(imagePath('person', 733)).toBe('/api/images/person/733')

    // Malformed input never reaches the network — the tile renders its placeholder.
    expect(entityImageId('anime', 'x:9001')).toBeNull() // wrong prefix for the kind
    expect(entityImageId('anime', 'a:notanumber')).toBeNull()
    expect(entityImageId('anime', 'a:0')).toBeNull()
    expect(entityImageId('mystery', 'a:1')).toBeNull()
    expect(entityImageId('anime', '')).toBeNull()
    expect(entityImageId('anime', undefined as unknown as string)).toBeNull()
    expect(imagePath('anime', undefined as unknown as number)).toBeNull()
    expect(imagePath('anime', -5)).toBeNull()
    expect(imagePath('anime', 1.5)).toBeNull()
  })
})