import { computed } from 'vue'
import type { GameId } from '~~/server/game/ids'
import { type LocalGameState, useLocalProgress } from '~/composables/useLocalProgress'

// FR-041: the attempt count is the visitor's own client-side count of accepted
// answers, correct or wrong, persisted with the rest of the day's progress so a
// reload resumes it. Nothing here can run for a Next press, because Next never
// calls it: a Next press is a free skip, not an answer (FR-026b).
export function useAttemptCount(game: GameId) {
  const progress = useLocalProgress()

  const read = (): LocalGameState | undefined => {
    progress.load()
    return progress.getGameState(game)
  }

  const attempts = computed(() => read()?.attempts ?? 0)

  const increment = () => {
    const previous = read()
    const base: LocalGameState = previous ?? { status: 'in_progress', attempts: 0 }
    progress.setGameState(game, { ...base, attempts: base.attempts + 1 })
  }

  return { attempts, increment }
}
