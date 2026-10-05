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

const nextUnansweredIndex = (from: number): number => {
  const clues = puzzle.value?.clues ?? []
  const answered = new Set(answeredClues.value)
  for (let step = 1; step <= clues.length; step += 1) {
    const index = (from + step) % clues.length
    if (!answered.has(clues[index].key)) {
      return index
    }
  }
  return from
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

    // FR-041: the device counts accepted answers. A rejected attempt changes nothing.
    const counted = attempts.value + 1

    if (outcome.result === 'hit') {
      const green = greenSeries.value.includes(seriesKey)
        ? greenSeries.value
        : [...greenSeries.value, seriesKey]
      const answered = [...answeredClues.value, clue.key]
      const won = outcome.state === 'won'

      // FR-026a: the next unanswered card loads itself once the answer resolves.
      const advance = nextUnansweredIndex(clueIndex.value)
      progress.setGameState('match_the_series', {
        status: won ? 'won' : 'in_progress',
        attempts: counted,
        greenSeries: green,
        answeredClues: answered,
        greenPairs: greenPairs.value.some((pair) => pair.clueKey === clue.key)
          ? greenPairs.value
          : [...greenPairs.value, { clueKey: clue.key, seriesKey }],
        clueIndex: won ? clueIndex.value : advance,
        wrongClicks: wrongClicks.value,
        ...(won ? { endedAt: new Date().toISOString() } : {}),
      })
      return
    }

    const misses = wrongClicks.value + 1
    // The rejected pairing is recorded as evidence, so the next request can prove the count.
    const logged = [...missLog.value, { clueKey: clue.key, seriesKey }]
    if (outcome.state === 'lost') {
      // FR-027: the ending miss reveals every pairing.
      revealed.value = 'answers' in outcome ? outcome.answers : null
      progress.setGameState('match_the_series', {
        status: 'lost',
        attempts: counted,
        greenSeries: greenSeries.value,
        answeredClues: answeredClues.value,
        missLog: logged,
        clueIndex: clueIndex.value,
        wrongClicks: misses,
        endedAt: new Date().toISOString(),
      })
      return
    }

    // FR-027a / FR-027c: nothing is disclosed below the limit, no request is made, and
    // the card rotates to another eligible entity. The abandoned entity is not recorded
    // as answered, so it stays in the pool and can come back (FR-027d, R-025).
    // nextUnansweredIndex reuses the FR-026c predicate, so Next and the mistake cannot
    // drift apart; it returns the same index when nothing else is eligible, which is
    // FR-026d's continue-showing fallback.
    const rotated = nextUnansweredIndex(clueIndex.value)
    progress.setGameState('match_the_series', {
      status: 'in_progress',
      attempts: counted,
      greenSeries: greenSeries.value,
      answeredClues: answeredClues.value,
      missLog: logged,
      clueIndex: rotated,
      wrongClicks: misses,
    })
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
  const index = nextUnansweredIndex(clueIndex.value)
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
