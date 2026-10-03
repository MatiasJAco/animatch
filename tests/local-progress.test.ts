import { describe, expect, it } from 'vitest'
import { useAttemptCount } from '../app/composables/useAttemptCount'
import { getStoredLocale, useLocalPrefs } from '../app/composables/useLocalPrefs'
import { useLocalProgress } from '../app/composables/useLocalProgress'
import { getDefaultLocale, getMessage, normalizeLocale } from '../app/i18n'
import { en } from '../app/i18n/en'
import { es } from '../app/i18n/es'
import { getUtcDateNow } from '../server/utils/day'

const KEYS = { progress: 'animatch:v1:progress', prefs: 'animatch:v1:prefs' }

describe('device state', () => {
  it('keeps finished state per game and per UTC day, and resumes in-progress play', () => {
    const progress = useLocalProgress()
    progress.load()

    progress.markFinished('more_or_less', 'won', 10)
    progress.setGameState('groups', { status: 'in_progress', attempts: 3, found: ['c:1@a:2'] })

    const reloaded = useLocalProgress()
    reloaded.load()
    expect(reloaded.getGameState('more_or_less')).toMatchObject({ status: 'won', attempts: 10 })
    expect(reloaded.getGameState('groups')).toMatchObject({ status: 'in_progress', attempts: 3 })
    expect(reloaded.getGameState('match_the_series')).toBeUndefined()

    // Mid-game close and return on the same day resumes the same position.
    expect(reloaded.current.value?.games.groups?.found).toEqual(['c:1@a:2'])

    // A previous day's state never applies to today.
    localStorage.setItem(
      KEYS.progress,
      JSON.stringify({ v: 1, date: '2020-01-01', games: { groups: { status: 'won', attempts: 6 } } }),
    )
    const nextDay = useLocalProgress()
    nextDay.load()
    expect(nextDay.getGameState('groups')).toBeUndefined()

    // Cleared or malformed storage leaves the game playable from the start.
    localStorage.removeItem(KEYS.progress)
    const wiped = useLocalProgress()
    wiped.load()
    expect(wiped.current.value?.games).toEqual({})

    localStorage.setItem(KEYS.progress, 'not json')
    const cleared = useLocalProgress()
    cleared.load()
    expect(cleared.current.value?.games).toEqual({})

    // A structurally invalid entry is unreadable, not a crash (FR-043b).
    localStorage.setItem(KEYS.progress, JSON.stringify({ v: 1, date: getUtcDateNow() }))
    const broken = useLocalProgress()
    broken.load()
    expect(broken.current.value?.games).toEqual({})

    const counter = useAttemptCount()
    counter.increment()
    counter.increment()
    expect(counter.attempts.value).toBe(2)
  })

  it('remembers an explicit language choice outside the date-scoped progress entry', () => {
    expect(normalizeLocale('es-MX')).toBe('es')
    expect(normalizeLocale('en-GB')).toBe('en')
    expect(normalizeLocale('fr-FR')).toBe('es')
    expect(getDefaultLocale('en-US')).toBe('en')
    expect(getDefaultLocale('es-ES')).toBe('es')
    expect(getDefaultLocale('ja-JP')).toBe('es')
    expect(getDefaultLocale(null)).toBe('es')
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort())
    expect(getMessage('es', 'error.DATABASE_UNAVAILABLE')).toBe(
      'El puzzle no se pudo cargar ahora mismo.',
    )

    // Browser language decides until an explicit choice is stored (FR-049b).
    expect(getStoredLocale()).toBeNull()

    const prefs = useLocalPrefs()
    prefs.setStoredLocale('en')
    expect(prefs.getStoredLocale()).toBe('en')

    // Progress is rewritten with today's date; the language entry is untouched.
    useLocalProgress().reset()
    expect(JSON.parse(localStorage.getItem(KEYS.progress) ?? '{}').date).toBe(getUtcDateNow())
    expect(prefs.getStoredLocale()).toBe('en')
    expect(localStorage.getItem(KEYS.prefs)).toContain('"language":"en"')
  })
})