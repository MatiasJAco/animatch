import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import {
  MATCH_TIME_LIMIT_MS,
  advanceRemaining,
  clampRemaining,
  formatMatchClock,
} from '~/utils/matchTimer'

// A quarter-second tick keeps the whole-second display accurate without a busy loop.
const TICK_MS = 250

export interface MatchTimerOptions {
  // The game is over (won or lost); the clock stops.
  finished: Ref<boolean>
  // Write the current remaining value into the day's progress entry.
  persist: (remainingMs: number) => void
  // Fired exactly once when the clock reaches zero.
  onExpire: () => void
}

/**
 * Device-owned Match the Series countdown.
 *
 * Constitution IV: the timer is never server state. It counts only while the board is visible,
 * pauses when the tab is hidden (so background time is not charged), and lets the caller restore
 * the stored value across a reload instead of restarting or draining it (FR-008).
 */
export function useMatchTimer(options: MatchTimerOptions) {
  const remainingMs = ref(MATCH_TIME_LIMIT_MS)
  const label = computed(() => formatMatchClock(remainingMs.value))

  let interval: ReturnType<typeof setInterval> | undefined
  let lastTick = 0
  let lastPersistedSecond = Math.ceil(MATCH_TIME_LIMIT_MS / 1000)
  let expired = false

  const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden'

  const stop = () => {
    if (interval !== undefined) {
      clearInterval(interval)
      interval = undefined
    }
  }

  // Persist at most once per displayed second, plus on pause/end, to keep storage writes cheap.
  const persistIfSecondChanged = (force = false) => {
    const second = Math.ceil(remainingMs.value / 1000)
    if (force || second !== lastPersistedSecond) {
      lastPersistedSecond = second
      options.persist(remainingMs.value)
    }
  }

  const tick = () => {
    const now = Date.now()
    const elapsed = now - lastTick
    lastTick = now
    remainingMs.value = advanceRemaining(remainingMs.value, elapsed)
    if (remainingMs.value <= 0) {
      stop()
      persistIfSecondChanged(true)
      if (!expired) {
        expired = true
        options.onExpire()
      }
      return
    }
    persistIfSecondChanged()
  }

  const start = () => {
    if (
      typeof window === 'undefined' ||
      interval !== undefined ||
      expired ||
      options.finished.value ||
      !visible()
    ) {
      return
    }
    lastTick = Date.now()
    interval = setInterval(tick, TICK_MS)
  }

  const pause = () => {
    stop()
    persistIfSecondChanged(true)
  }

  const onVisibility = () => {
    if (visible()) {
      start()
    } else {
      pause()
    }
  }

  // Restore the day's stored remaining time (null/undefined means a fresh game).
  const setRemaining = (value: number | null | undefined) => {
    remainingMs.value = value == null ? MATCH_TIME_LIMIT_MS : clampRemaining(value)
    lastPersistedSecond = Math.ceil(remainingMs.value / 1000)
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility)
  }
  watch(options.finished, (done) => {
    if (done) {
      stop()
      persistIfSecondChanged(true)
    }
  })
  onScopeDispose(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility)
    }
    stop()
  })

  return { remainingMs, label, setRemaining, start, pause }
}
