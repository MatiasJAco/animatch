import { ref } from 'vue'
import { isGameId, type GameId } from '~~/server/game/ids'
import { getUtcDateNow, type PuzzleDate } from '~~/server/utils/day'
import { isLossRecord, type MoreOrLessLossRecord } from '~/utils/moreOrLessLoss'
import { clampRemaining } from '~/utils/matchTimer'

const STORAGE_KEY = 'animatch:v1:progress'

export type GameStatus = 'in_progress' | 'won' | 'lost'

export interface LocalGameState {
  status: GameStatus
  attempts: number
  round?: number
  matched?: string[]
  // match_the_series: grid series already colored green and locked.
  greenSeries?: string[]
  // match_the_series: clue cards already answered correctly.
  answeredClues?: string[]
  // match_the_series: index of the clue card currently on screen.
  clueIndex?: number
  // match_the_series: the clue card and series that earned each green tile. The server
  // re-derives the green set from these against the answer key it never sends (Principle IV).
  greenPairs?: Array<{ clueKey: string; seriesKey: string }>
  // match_the_series: remaining play time in ms, kept so the 90-second countdown resumes across
  // reloads instead of restarting or draining (FR-008). Clamped to [0, 90_000] on read.
  timerRemainingMs?: number
  // match_the_series: the full clue->series mapping, stored only once a time-out has ended the
  // game so the reveal survives a reload (parity with Groups' foundGroups).
  revealedAnswers?: Record<string, string>
  found?: string[]
  // Groups keeps the revealed criterion per found group so a resumed board can show it again.
  foundGroups?: Array<{ keys: string[]; criterion: unknown }>
  // Groups: the rejected proposals. The server re-derives the mistake count from these, so
  // they must be stored for a resumed board to keep being verifiable (Constitution IV).
  missLog?: string[][]
  mistakes?: number
  endedAt?: string
  // more_or_less: the failed round's comparison, persisted so the loss explanation
  // survives a reload for the rest of the UTC day (FR-007).
  loss?: MoreOrLessLossRecord
}

export interface LocalProgress {
  v: 1
  date: PuzzleDate
  games: Partial<Record<GameId, LocalGameState>>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// A malformed loss record is dropped while the game keeps its lost status, so a corrupt
// entry degrades to the plain result instead of an error or a blank screen (FR-011).
function sanitize(progress: LocalProgress): LocalProgress {
  for (const id of Object.keys(progress.games) as GameId[]) {
    const state = progress.games[id]
    if (state && !isLossRecord(state.loss)) {
      delete state.loss
    }
    if (state && typeof state.timerRemainingMs === 'number') {
      state.timerRemainingMs = clampRemaining(state.timerRemainingMs)
    }
  }
  return progress
}

// Only a well-formed entry counts; anything else is treated as unreadable.
function read(): LocalProgress | null {
  try {
    if (typeof localStorage === 'undefined') {
      return null
    }
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as unknown
    if (
      isRecord(parsed) &&
      parsed.v === 1 &&
      typeof parsed.date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) &&
      isRecord(parsed.games)
    ) {
      return sanitize({ v: 1, date: parsed.date, games: parsed.games as LocalProgress['games'] })
    }
    return null
  } catch {
    return null
  }
}

function clear(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // ignore
  }
}

function write(progress: LocalProgress): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
    }
  } catch {
    // ignore
  }
}

export function useLocalProgress() {
  const current = ref<LocalProgress | null>(null)

  const load = () => {
    const today = getUtcDateNow()
    const stored = read()
    if (stored && stored.date === today) {
      current.value = stored
      return current.value
    }
    // FR-043a: a previous day is discarded, not kept for later.
    if (stored) {
      clear()
    }
    const fresh: LocalProgress = { v: 1, date: today, games: {} }
    current.value = fresh
    return fresh
  }

  const save = () => {
    if (current.value) {
      write(current.value)
    }
  }

  const getGameState = (game: GameId): LocalGameState | undefined => {
    return current.value?.games[game]
  }

  const setGameState = (game: GameId, state: LocalGameState) => {
    if (!current.value) {
      load()
    }
    if (!current.value) {
      current.value = { v: 1, date: getUtcDateNow(), games: {} }
    }
    current.value.games[game] = state
    save()
  }

  const markFinished = (
    game: GameId,
    status: GameStatus,
    attempts: number,
    extra?: Partial<LocalGameState>,
  ) => {
    setGameState(game, {
      status,
      attempts,
      endedAt: new Date().toISOString(),
      ...extra,
    })
  }

  // FR-057: clears one game for the current day. Every other game, the entry's
  // date, and the separate animatch:v1:prefs language entry are left untouched.
  // FR-058: no network call and no server write.
  const resetGame = (game: GameId) => {
    // A caller that passes an unknown id used to delete the literal key
    // "undefined" and silently clear nothing. The id arrives from a template
    // binding, so an unresolved binding must fail loudly instead.
    if (!isGameId(game)) {
      throw new Error(`resetGame: unknown game id ${String(game)}`)
    }
    if (!current.value) {
      load()
    }
    if (!current.value) {
      return
    }
    delete current.value.games[game]
    save()
  }

  // FR-057b: the home control clears all three games at once. It replaces the day's
  // entry with an empty one in a single write, so the store is never left partially
  // cleared, and the date entry keeps the day the visitor is on (R-024).
  // FR-057c: the same day regenerates the identical board (R-005), so clearing device
  // state is sufficient and no daily_puzzles row is ever read, written, or deleted.
  // animatch:v1:prefs holds the language and is a separate key, so it survives.
  const resetAllGames = () => {
    if (!current.value) {
      load()
    }
    current.value = { v: 1, date: getUtcDateNow(), games: {} }
    save()
  }

  return {
    load,
    save,
    getGameState,
    setGameState,
    markFinished,
    resetGame,
    resetAllGames,
    current,
  }
}