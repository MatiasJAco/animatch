<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type {
  MatchTheSeriesOutcome,
  MatchTheSeriesPayloadData,
} from '~~/server/game/matchTheSeries'
import { useLocale } from '~/composables/useLocale'
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

const lastOutcome = ref<
  (MatchTheSeriesOutcome & { attempts: number; wrongPairs: number }) | null
>(null)

const handleOutcome = (outcome: MatchTheSeriesOutcome & {
  attempts: number
  wrongPairs: number
  matched: string[]
  matchedTiles: string[]
}) => {
  lastOutcome.value = outcome

  if (outcome.state === 'won' || outcome.state === 'lost') {
    progress.markFinished(
      'match_the_series',
      outcome.state === 'won' ? 'won' : 'lost',
      outcome.attempts,
    )
    return
  }

  // FR-043a: store only the visitor's own progress, never puzzle content, so a closed tab
  // resumes the same board position with the same attempt and wrong-pair counts.
  progress.setGameState('match_the_series', {
    status: 'in_progress',
    attempts: outcome.attempts,
    wrongPairs: outcome.wrongPairs,
    matched: outcome.matched,
    matchedTiles: outcome.matchedTiles,
  })
}
</script>

<template>
  <main class="page">
    <header class="page-header">
      <div>
        <h1>{{ t('game.match_the_series') }}</h1>
        <p class="muted">{{ t('game.match_the_series.help') }}</p>
      </div>
    </header>

    <ErrorPanel
      v-if="error"
      code="PUZZLE_UNAVAILABLE"
      :pending="pending"
      :retry="() => refresh()"
    />
    <p v-else-if="pending || !puzzle">{{ t('common.loading') }}</p>

    <ResultPanel
      v-else-if="finished"
      game="match_the_series"
      :state="gameState?.status === 'won' ? 'won' : 'lost'"
      :attempts="lastOutcome?.attempts ?? gameState?.attempts ?? 0"
    />

    <MatchGrid
      v-else
      :puzzle="puzzle"
      :initial-wrong-pairs="gameState?.wrongPairs ?? 0"
      :initial-attempts="gameState?.attempts ?? 0"
      :initial-matched="gameState?.matched ?? []"
      :initial-matched-tiles="gameState?.matchedTiles ?? []"
      @outcome="handleOutcome"
    />
  </main>
</template>