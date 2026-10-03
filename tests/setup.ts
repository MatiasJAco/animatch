import { afterEach, beforeEach, vi } from 'vitest'

const createMemoryStorage = (): Storage => {
  const items = new Map<string, string>()
  return {
    get length() {
      return items.size
    },
    key: (index: number) => [...items.keys()][index] ?? null,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, String(value)),
    removeItem: (key: string) => void items.delete(key),
    clear: () => items.clear(),
  } as Storage
}

// Each test gets fresh, isolated device storage.
beforeEach(() => {
  const storage = createMemoryStorage()
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('sessionStorage', createMemoryStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})