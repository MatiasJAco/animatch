import type { Locale, MessageKey } from './index'

const STORAGE_KEY = 'animatch:v1:prefs'

export interface LocalPrefs {
  v: 1
  language?: Locale
}

function read(): LocalPrefs | null {
  try {
    if (typeof localStorage === 'undefined') {
      return null
    }
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as LocalPrefs
    if (parsed && parsed.v === 1) {
      if (parsed.language === 'es' || parsed.language === 'en') {
        return parsed
      }
    }
    return null
  } catch {
    return null
  }
}

function write(prefs: LocalPrefs): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    }
  } catch {
    // ignore storage errors
  }
}

export function getStoredLocale(): Locale | null {
  return read()?.language ?? null
}

export function setStoredLocale(locale: Locale): void {
  write({ v: 1, language: locale })
}

export function useLocalPrefs() {
  return { getStoredLocale, setStoredLocale }
}