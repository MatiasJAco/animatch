import { ref } from 'vue'
import type { GameId } from '~~/server/game/ids'
import { getUtcDateNow, type PuzzleDate } from '~~/server/utils/day'

const STORAGE_KEY = 'animatch:v1:progress'

export type GameStatus = 'in_progress' | 'won' | 'lost'

export interface LocalGameState {
  status: GameStatus
  attempts: number
  round?: number
  matched?: string[]
  matchedTiles?: string[]
  wrongPairs?: number
  found?: string[]
  // Groups keeps the revealed criterion per found group so a resumed board can show it again.
  foundGroups?: Array<{ keys: string[]; criterion: unknown }>
  mistakes?: number
  endedAt?: string
}

export interface LocalProgress {
  v: 1
  date: PuzzleDate
  games: Partial<Record<GameId, LocalGameState>>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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
      return { v: 1, date: parsed.date, games: parsed.games as LocalProgress['games'] }
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

  const markFinished = (game: GameId, status: GameStatus, attempts: number) => {
    setGameState(game, {
      status,
      attempts,
      endedAt: new Date().toISOString(),
    })
  }

  const reset = () => {
    current.value = { v: 1, date: getUtcDateNow(), games: {} }
    save()
  }

  return { load, save, getGameState, setGameState, markFinished, reset, current }
}