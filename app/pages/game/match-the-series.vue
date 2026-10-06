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
import { applyMatchAnswer, nextUnansweredIndex } from '~/utils/matchState'

const { t } = useLocale()
const progress = useLocalProgress()

const { data: puzzle, pending, error, refresh } = await useFetch<MatchTheSeriesPayloadData>(
  '/api/daily/match_the_series',
)

onMounted(() => {
  progress.load()
})

const gameState = computed(() => progress.getGameState('match_the_series'))
const finished = computed(
  () => gameState.value?.status === 'won' || gameState.value?.status === 'lost',
)

const greenSeries = computed(() => gameState.value?.greenSeries ?? [])
const answeredClues = computed(() => gameState.value?.answeredClues ?? [])
const clueIndex = computed(() => gameState.value?.clueIndex ?? 0)
const wrongClicks = computed(() => gameState.value?.wrongClicks ?? 0)
const attempts = computed(() => gameState.value?.attempts ?? 0)
// Constitution IV: the server re-derives the green set and the miss count from these
// evidence lists against the answer key, which is never sent to the device.
const greenPairs = computed(
  () => gameState.value?.greenPairs ?? ([] as Array<{ clueKey: string; seriesKey: string }>),
)
const missLog = computed(
  () => gameState.value?.missLog ?? ([] as Array<{ clueKey: string; seriesKey: string }>),
)

const busy = ref(false)
const revealed = ref<Record<string, string> | null>(null)
// Principle V: a rejected or failed attempt is a visible state with a retry.
const attemptError = ref<AttemptErrorCode | null>(null)
const lastSeriesKey = ref<string | null>(null)

const currentClue = computed(() => puzzle.value?.clues[clueIndex.value] ?? null)

// FR-043a: board position is written on every accepted answer, never on a Next press.
const persist = (state: 'in_progress' | 'won' | 'lost', next: Partial<typeof gameState.value>) => {
  progress.setGameState('match_the_series', {
    status: state,
    attempts: attempts.value,
    greenSeries: greenSeries.value,
    answeredClues: answeredClues.value,
    greenPairs: greenPairs.value,
    missLog: missLog.value,
    clueIndex: clueIndex.value,
    wrongClicks: wrongClicks.value,
    ...next,
  })
}

const answer = async (seriesKey: string) => {
  const clue = currentClue.value
  if (busy.value || finished.value || !clue || !puzzle.value) {
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
        missLog: missLog.value,
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
    if (outcome.result === 'miss' && outcome.state === 'lost') {
      // FR-027: the ending miss reveals every pairing.
      revealed.value = 'answers' in outcome ? outcome.answers : null
    }

    // The whole board lives in the device store, and setGameState replaces the entry
    // wholesale, so every transition writes the complete state — including the two evidence
    // lists the server re-derives the miss count and the green set from. Dropping them would
    // silently let the mistake limit and the win condition slip (Constitution IV).
    const next = applyMatchAnswer(
      {
        status: gameState.value?.status ?? 'in_progress',
        attempts: attempts.value,
        greenSeries: greenSeries.value,
        answeredClues: answeredClues.value,
        clueIndex: clueIndex.value,
        wrongClicks: wrongClicks.value,
        greenPairs: greenPairs.value,
        missLog: missLog.value,
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
  if (finished.value || !puzzle.value) {
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
</script>

<template>
  <main class="page">
    <header class="page-header">
      <div>
        <h1>{{ t('game.match_the_series') }}</h1>
        <p class="muted">{{ t('game.match_the_series.help') }}</p>
      </div>
      <GameHeaderControls game="match_the_series" />
    </header>

    <ErrorPanel
      v-if="error"
      code="PUZZLE_UNAVAILABLE"
      :pending="pending"
      :retry="() => refresh()"
    />
    <p v-else-if="pending || !puzzle">{{ t('common.loading') }}</p>

    <template v-else>
      <ErrorPanel
        v-if="attemptError"
        :code="attemptError"
        :pending="busy"
        :retry="attemptError && isRetryableCode(attemptError) ? retry : undefined"
      />

      <MatchGrid
        :puzzle="puzzle"
        :green-series="greenSeries"
        :answered-clues="answeredClues"
        :clue-index="clueIndex"
        :wrong-clicks="wrongClicks"
        :attempts="attempts"
        :finished="finished"
        :busy="busy"
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
  </main>
</template>
