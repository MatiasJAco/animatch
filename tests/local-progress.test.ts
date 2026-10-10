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

    // FR-043a: a Match the Series board resumes with its green tiles, its answered
    // cards, and its remaining time exactly as they were left.
    const board = useLocalProgress()
    board.setGameState('match_the_series', {
      status: 'in_progress',
      attempts: 4,
      greenSeries: ['a:9001', 'a:9102'],
      answeredClues: ['c:1', 'c:2'],
      clueIndex: 3,
      timerRemainingMs: 45_000,
    })
    const resumed = useLocalProgress()
    resumed.load()
    expect(resumed.getGameState('match_the_series')).toMatchObject({
      attempts: 4,
      greenSeries: ['a:9001', 'a:9102'],
      answeredClues: ['c:1', 'c:2'],
      clueIndex: 3,
      timerRemainingMs: 45_000,
    })

    // FR-008: a stored timer value outside the limit is clamped on read.
    resumed.setGameState('match_the_series', {
      status: 'in_progress',
      attempts: 4,
      greenSeries: ['a:9001'],
      answeredClues: ['c:1'],
      clueIndex: 1,
      timerRemainingMs: 999_999,
    })
    const clamped = useLocalProgress()
    clamped.load()
    expect(clamped.getGameState('match_the_series')?.timerRemainingMs).toBe(90_000)

    // FR-007: the time-out reveal persists so it survives a reload.
    resumed.setGameState('match_the_series', {
      status: 'lost',
      attempts: 6,
      greenSeries: ['a:9001'],
      answeredClues: ['c:1'],
      clueIndex: 1,
      revealedAnswers: { 'c:1': 'a:9001', 'c:2': 'a:9102' },
    })
    const afterTimeout = useLocalProgress()
    afterTimeout.load()
    expect(afterTimeout.getGameState('match_the_series')).toMatchObject({
      status: 'lost',
      revealedAnswers: { 'c:1': 'a:9001', 'c:2': 'a:9102' },
    })

    // FR-027c / FR-027d: a non-ending miss stores an advanced clueIndex with the
    // abandoned clue still absent from answeredClues, so the rotation survives a reload
    // and the abandoned entity remains answerable. Only a hit retires a card.
    const afterMiss = useLocalProgress()
    afterMiss.load()
    afterMiss.setGameState('match_the_series', {
      status: 'in_progress',
      attempts: 5,
      greenSeries: ['a:9001', 'a:9102'],
      answeredClues: ['c:1', 'c:2'],
      clueIndex: 4,
      timerRemainingMs: 30_000,
    })
    const rotated = useLocalProgress()
    rotated.load()
    const rotatedState = rotated.getGameState('match_the_series')
    expect(rotatedState?.clueIndex).toBe(4)
    expect(rotatedState?.timerRemainingMs).toBe(30_000)
    // The abandoned clue key is not recorded, so the pool still holds it.
    expect(rotatedState?.answeredClues).not.toContain('c:4')
    expect(rotatedState?.answeredClues).toEqual(['c:1', 'c:2'])
    expect(rotatedState?.greenSeries).toEqual(['a:9001', 'a:9102'])

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

    const counter = useAttemptCount('groups')
    counter.increment()
    counter.increment()
    expect(counter.attempts.value).toBe(2)
    // FR-041: the count lives in the day's progress entry, so it survives a reload.
    const afterAnswers = useLocalProgress()
    afterAnswers.load()
    expect(afterAnswers.getGameState('groups')?.attempts).toBe(2)

    // FR-057: the reset clears one game for the day and nothing else. FR-058: it makes
    // no network call, so the served puzzle and every other game are untouched.
    const requests: string[] = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = ((input: unknown) => {
      requests.push(String(input))
      throw new Error('the reset must not reach the network')
    }) as typeof fetch
    try {
      useLocalPrefs().setStoredLocale('es')
      const resettable = useLocalProgress()
      resettable.load()
      resettable.setGameState('more_or_less', { status: 'won', attempts: 10 })
      resettable.setGameState('groups', { status: 'in_progress', attempts: 2, mistakes: 1 })
      resettable.setGameState('match_the_series', {
        status: 'in_progress',
        attempts: 4,
        greenSeries: ['a:9001'],
        answeredClues: ['c:1'],
        clueIndex: 1,
      })

      resettable.resetGame('match_the_series')
      expect(requests).toEqual([])

      // FR-057: the reset reaches the game the control was given. An unresolved
      // template binding used to pass undefined, which cleared nothing at all,
      // so an unknown id must throw rather than silently delete the key
      // "undefined" and rewrite the store unchanged.
      expect(() => resettable.resetGame(undefined as never)).toThrow(/unknown game id/)
      expect(() => resettable.resetGame('more-or-less' as never)).toThrow(/unknown game id/)

      const afterReset = useLocalProgress()
      afterReset.load()
      expect(afterReset.getGameState('match_the_series')).toBeUndefined()
      expect(afterReset.getGameState('more_or_less')?.status).toBe('won')
      expect(afterReset.getGameState('groups')?.attempts).toBe(2)
      expect(afterReset.current.value?.date).toBe(getUtcDateNow())

      // The same clear holds for each of the three ids the control can carry.
      resettable.load()
      resettable.resetGame('more_or_less')
      resettable.resetGame('groups')
      const afterEachReset = useLocalProgress()
      afterEachReset.load()
      expect(afterEachReset.current.value?.games).toEqual({})
      expect(getStoredLocale()).toBe('es')
      // The language entry is a separate store and is not date-scoped.
      expect(getStoredLocale()).toBe('es')

      // FR-057b: the home reset clears all three games, and FR-057c: it is one write of
      // the progress blob rather than three operations, so the store cannot end up
      // partially cleared. The date entry survives so the day is still today's.
      useLocalProgress().setGameState('match_the_series', {
        status: 'in_progress',
        attempts: 4,
        greenSeries: ['a:9001'],
        answeredClues: ['c:1'],
        clueIndex: 1,
      })
      const writes: string[] = []
      const originalSetItem = localStorage.setItem.bind(localStorage)
      const countingSetItem = ((key: string, value: string) => {
        writes.push(key)
        return originalSetItem(key, value)
      }) as Storage['setItem']
      localStorage.setItem = countingSetItem
      try {
        const homeReset = useLocalProgress()
        homeReset.load()
        homeReset.resetAllGames()
        expect(requests).toEqual([])
        expect(writes).toEqual([KEYS.progress])
      } finally {
        localStorage.setItem = originalSetItem
      }

      const afterHomeReset = useLocalProgress()
      afterHomeReset.load()
      expect(afterHomeReset.current.value?.games).toEqual({})
      expect(afterHomeReset.getGameState('more_or_less')).toBeUndefined()
      expect(afterHomeReset.getGameState('groups')).toBeUndefined()
      expect(afterHomeReset.getGameState('match_the_series')).toBeUndefined()
      expect(afterHomeReset.current.value?.date).toBe(getUtcDateNow())
      // FR-057b: the language choice lives in animatch:v1:prefs and survives untouched.
      expect(getStoredLocale()).toBe('es')
      expect(localStorage.getItem(KEYS.prefs)).toContain('"language":"es"')
      // The served puzzle is unchanged: the same day regenerates the identical board.
      expect(localStorage.getItem(KEYS.progress)).toContain(getUtcDateNow())
    } finally {
      globalThis.fetch = originalFetch
    }
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
    useLocalProgress().setGameState('more_or_less', { status: 'won', attempts: 10 })
    expect(JSON.parse(localStorage.getItem(KEYS.progress) ?? '{}').date).toBe(getUtcDateNow())
    expect(prefs.getStoredLocale()).toBe('en')
    expect(localStorage.getItem(KEYS.prefs)).toContain('"language":"en"')
  })

  it('persists the more_or_less loss record within the UTC day and clears it with the day', () => {
    const progress = useLocalProgress()
    progress.load()
    progress.markFinished('more_or_less', 'lost', 4, {
      loss: { round: 2, given: 'more', correct: 'less', hidden: 7, visible: 12 },
    })

    const reloaded = useLocalProgress()
    reloaded.load()
    expect(reloaded.getGameState('more_or_less')).toMatchObject({
      status: 'lost',
      attempts: 4,
      loss: { round: 2, given: 'more', correct: 'less', hidden: 7, visible: 12 },
    })

    // A previous day's loss never applies to today's board (FR-007 day scoping).
    localStorage.setItem(
      KEYS.progress,
      JSON.stringify({
        v: 1,
        date: '2020-01-01',
        games: {
          more_or_less: {
            status: 'lost',
            attempts: 2,
            loss: { round: 0, given: 'less', correct: 'more', hidden: 4, visible: 3 },
          },
        },
      }),
    )
    const nextDay = useLocalProgress()
    nextDay.load()
    expect(nextDay.getGameState('more_or_less')).toBeUndefined()

    // A malformed loss record is dropped on read while the lost status survives,
    // so a corrupt entry degrades to the plain result, never an error (FR-011).
    localStorage.setItem(
      KEYS.progress,
      JSON.stringify({
        v: 1,
        date: getUtcDateNow(),
        games: {
          more_or_less: { status: 'lost', attempts: 2, loss: { round: 11, given: 'up', hidden: 1 } },
        },
      }),
    )
    const sanitized = useLocalProgress()
    sanitized.load()
    expect(sanitized.getGameState('more_or_less')?.status).toBe('lost')
    expect(sanitized.getGameState('more_or_less')?.loss).toBeUndefined()
  })
})