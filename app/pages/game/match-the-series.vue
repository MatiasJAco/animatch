<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type {
  MatchTheSeriesOutcome,
  MatchTheSeriesPayloadData,
} from '~~/server/game/matchTheSeries'
import { useLocale } from '~/composables/useLocale'
import {
  isRetryableCode,
  readErrorCode,
  type AttemptErrorCode,
} from '~/composables/attemptFailure'
import { useLocalProgress } from '~/composables/useLocalProgress'
import { useMatchTimer } from '~/composables/useMatchTimer'
import { applyMatchAnswer, nextUnansweredIndex } from '~/utils/matchState'

const { t } = useLocale()
const progress = useLocalProgress()

const { data: puzzle, pending, error, refresh } = await useFetch<MatchTheSeriesPayloadData>(
  '/api/daily/match_the_series',
)

const gameState = computed(() => progress.getGameState('match_the_series'))
const finished = computed(
  () => gameState.value?.status === 'won' || gameState.value?.status === 'lost',
)
// Set the moment the clock hits zero so the board locks even if the reveal request must be
// retried (the game is over; only the disclosure is pending).
const timeExpired = ref(false)
const boardLocked = computed(() => finished.value || timeExpired.value)

const greenSeries = computed(() => gameState.value?.greenSeries ?? [])
const answeredClues = computed(() => gameState.value?.answeredClues ?? [])
const clueIndex = computed(() => gameState.value?.clueIndex ?? 0)
const attempts = computed(() => gameState.value?.attempts ?? 0)
// Constitution IV: the server re-derives the green set from these evidence pairs against the
// answer key, which is never sent to the device.
const greenPairs = computed(
  () => gameState.value?.greenPairs ?? ([] as Array<{ clueKey: string; seriesKey: string }>),
)
// FR-007: the time-out reveal lives in the day's progress entry, so it survives a reload instead
// of vanishing with the component.
const revealed = computed(() => gameState.value?.revealedAnswers ?? null)

const busy = ref(false)
// Principle V: a rejected/failed answer and a failed time-out reveal are visible, retryable states.
const attemptError = ref<AttemptErrorCode | null>(null)
const expireError = ref<AttemptErrorCode | null>(null)
const expiring = ref(false)
const lastSeriesKey = ref<string | null>(null)

const currentClue = computed(() => puzzle.value?.clues[clueIndex.value] ?? null)

// Writes the current board wholesale (setGameState replaces the entry), so the timer and reveal
// fields must be carried explicitly or a write would silently drop them.
function writeBoard(overrides: Partial<NonNullable<typeof gameState.value>> = {}) {
  progress.setGameState('match_the_series', {
    status: gameState.value?.status ?? 'in_progress',
    attempts: attempts.value,
    greenSeries: greenSeries.value,
    answeredClues: answeredClues.value,
    greenPairs: greenPairs.value,
    clueIndex: clueIndex.value,
    timerRemainingMs: gameState.value?.timerRemainingMs,
    revealedAnswers: gameState.value?.revealedAnswers,
    endedAt: gameState.value?.endedAt,
    ...overrides,
  })
}

// The timer persists its remaining time at most once per displayed second.
const persistTimer = (remainingMs: number) => writeBoard({ timerRemainingMs: remainingMs })

// FR-006/FR-007: reaching zero ends the day's game and reveals every clue's series.
const expire = async () => {
  if (finished.value || expiring.value) {
    return
  }
  expiring.value = true
  expireError.value = null
  try {
    const res = await fetch('/api/daily/match_the_series/expire', { method: 'POST' })
    if (!res.ok) {
      expireError.value = await readErrorCode(res)
      return
    }
    const body = (await res.json()) as { answers: Record<string, string> }
    writeBoard({
      status: 'lost',
      timerRemainingMs: 0,
      revealedAnswers: body.answers,
      endedAt: new Date().toISOString(),
    })
    timer.pause()
  } catch {
    expireError.value = 'DATABASE_UNAVAILABLE'
  } finally {
    expiring.value = false
  }
}

const timer = useMatchTimer({
  finished,
  persist: persistTimer,
  onExpire: () => {
    timeExpired.value = true
    void expire()
  },
})
// A top-level ref auto-unwraps in the template.
const remaining = timer.label

// FR-043a: board position is written on every accepted answer, never on a Next press.
const persist = (
  state: 'in_progress' | 'won' | 'lost',
  next: Partial<NonNullable<typeof gameState.value>>,
) => {
  writeBoard({ status: state, ...next })
}

const answer = async (seriesKey: string) => {
  const clue = currentClue.value
  if (busy.value || boardLocked.value || !clue || !puzzle.value) {
    return
  }
  busy.value = true
  attemptError.value = null
  try {
    const res = await fetch('/api/daily/match_the_series/attempt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        clueKey: clue.key,
        seriesKey,
        // Constitution IV: progress travels as verifiable evidence, never as counters.
        greenPairs: greenPairs.value,
      }),
    })
    if (!res.ok) {
      // Principle V: the panel names the failure the server reported. A rejected attempt is
      // deterministic, so it gets no Retry rather than one that cannot succeed.
      lastSeriesKey.value = seriesKey
      attemptError.value = await readErrorCode(res)
      return
    }
    const outcome = (await res.json()) as MatchTheSeriesOutcome
    // FR-001: a wrong answer never ends the game, so there is nothing to reveal here.

    // The whole board lives in the device store, and setGameState replaces the entry
    // wholesale, so every transition writes the complete state — including the green evidence
    // the server re-derives the win from and the timer/reveal fields a reload needs.
    const next = applyMatchAnswer(
      {
        status: gameState.value?.status ?? 'in_progress',
        attempts: attempts.value,
        greenSeries: greenSeries.value,
        answeredClues: answeredClues.value,
        clueIndex: clueIndex.value,
        greenPairs: greenPairs.value,
        timerRemainingMs: gameState.value?.timerRemainingMs,
        revealedAnswers: gameState.value?.revealedAnswers,
        endedAt: gameState.value?.endedAt,
      },
      puzzle.value.clues,
      outcome,
      { clueKey: clue.key, seriesKey },
    )
    progress.setGameState('match_the_series', next)
  } catch {
    lastSeriesKey.value = seriesKey
    attemptError.value = 'DATABASE_UNAVAILABLE'
  } finally {
    busy.value = false
  }
}

// Principle V: the retry replays the identical click against the same clue card.
const retry = () => {
  const key = lastSeriesKey.value
  if (key) {
    void answer(key)
  }
}

// FR-026b / FR-026c: a free skip to a different, unanswered card. No request, and neither
// the attempt count nor the mistake count moves (R-021).
const skip = () => {
  if (boardLocked.value || !puzzle.value) {
    return
  }
  const index = nextUnansweredIndex(
    puzzle.value.clues,
    answeredClues.value,
    clueIndex.value,
  )
  if (index === clueIndex.value) {
    return
  }
  persist('in_progress', { clueIndex: index })
}

const resultState = computed(() => {
  if (gameState.value?.status === 'won') return 'won' as const
  if (gameState.value?.status === 'lost') return 'lost' as const
  return null
})

onMounted(() => {
  progress.load()
  // FR-008: resume the stored remaining time (null means a fresh game), then run only while
  // the day's game is still in progress.
  timer.setRemaining(gameState.value?.timerRemainingMs ?? null)
  if (!finished.value) {
    timer.start()
  }
})
</script>

<template>
  <GameShell :title="t('game.match_the_series')">
    <template #header-actions>
      <GameHeaderControls game="match_the_series" />
    </template>

    <ErrorPanel
      v-if="error"
      code="PUZZLE_UNAVAILABLE"
      :pending="pending"
      :retry="() => refresh()"
    />
    <p v-else-if="pending || !puzzle">{{ t('common.loading') }}</p>

    <template v-else>
      <ErrorPanel
        v-if="expireError"
        :code="expireError"
        :pending="expiring"
        :retry="() => expire()"
      />
      <ErrorPanel
        v-else-if="attemptError"
        :code="attemptError"
        :pending="busy"
        :retry="attemptError && isRetryableCode(attemptError) ? retry : undefined"
      />

      <MatchGrid
        :puzzle="puzzle"
        :green-series="greenSeries"
        :answered-clues="answeredClues"
        :clue-index="clueIndex"
        :attempts="attempts"
        :finished="boardLocked"
        :busy="busy"
        :remaining="remaining"
        :time-up="resultState === 'lost'"
        :answers="revealed"
        @answer="answer"
        @next="skip"
      />

      <ResultPanel
        v-if="resultState"
        game="match_the_series"
        :state="resultState"
        :attempts="attempts"
      />
    </template>
  </GameShell>
</template>
