import { onScopeDispose, ref } from 'vue'
import type { GameId } from '~~/server/game/ids'
import { getUtcDateNow } from '~~/server/utils/day'

/**
 * FR-002: a visitor keeps today's puzzle. The route serves the puzzle itself, not a
 * `{ data }` envelope, so the response body is stored as-is and re-fetched when the UTC day
 * rolls over while the tab is open.
 */
export function useDailyPuzzle(game: GameId) {
  const data = ref<unknown>(null)
  const date = ref<string>(getUtcDateNow())
  const loading = ref(false)
  const error = ref<unknown>(null)

  const fetchPuzzle = async (forDate?: string) => {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`/api/daily/${game}`, {
        query: forDate ? { date: forDate } : undefined,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        error.value = body ?? { error: true, status: res.status }
        return
      }
      const body = await res.json()
      data.value = body
      // The server owns the date so a clock-skewed client still lands on the right day.
      date.value = typeof body?.date === 'string' ? body.date : getUtcDateNow()
    } catch (e) {
      error.value = e
    } finally {
      loading.value = false
    }
  }

  const refetchOnDateChange = async (nextDate: string = getUtcDateNow()) => {
    if (nextDate === date.value) {
      return
    }
    await fetchPuzzle(nextDate)
  }

  const timer = setInterval(() => {
    void refetchOnDateChange()
  }, 60_000)
  onScopeDispose(() => clearInterval(timer))

  return { data, date, loading, error, fetchPuzzle, refetchOnDateChange }
}