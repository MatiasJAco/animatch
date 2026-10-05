<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { MoreOrLessPuzzleData, MoreOrLessOutcome } from '~~/server/game/moreOrLess'
import { useLocale } from '~/composables/useLocale'
import { useLocalProgress } from '~/composables/useLocalProgress'

const { t } = useLocale()
const progress = useLocalProgress()

const { data: puzzle, pending, error, refresh } = await useFetch<MoreOrLessPuzzleData>('/api/daily/more_or_less')

onMounted(() => {
  progress.load()
})

const gameState = computed(() => progress.getGameState('more_or_less'))

const lastOutcome = ref<(MoreOrLessOutcome & { attempts: number; round: number }) | null>(null)

function handleOutcome(o: MoreOrLessOutcome & { attempts: number; round: number }) {
  lastOutcome.value = o
  if (o.state === 'won' || o.state === 'lost') {
    progress.markFinished('more_or_less', o.state, o.attempts)
    return
  }
  // FR-043a: a closed tab resumes at the same round with the same counters.
  progress.setGameState('more_or_less', {
    status: 'in_progress',
    attempts: o.attempts,
    mistakes: 0,
    round: o.round,
  })
}

const finished = computed(() => gameState.value?.status === 'won' || gameState.value?.status === 'lost')
</script>

<template>
  <main class="page">
    <header class="page-header">
      <div>
        <h1>{{ t('game.more_or_less') }}</h1>
        <p class="muted">{{ t('game.more_or_less.help') }}</p>
      </div>
      <GameHeaderControls game="more_or_less" />
    </header>

    <ErrorPanel
      v-if="error"
      code="PUZZLE_UNAVAILABLE"
      :pending="pending"
      :retry="() => refresh()"
    />
    <div v-else-if="pending || !puzzle">
      <p>{{ t('common.loading') }}</p>
    </div>
    <div v-else-if="finished">
      <ResultPanel
        game="more_or_less"
        :state="gameState?.status === 'won' ? 'won' : 'lost'"
        :attempts="lastOutcome?.attempts ?? gameState?.attempts ?? 0"
      />
    </div>
    <div v-else>
      <MoreOrLessBoard
        :puzzle="puzzle"
        :initial-round="gameState?.round ?? 0"
        :initial-attempts="gameState?.attempts ?? 0"
        @outcome="handleOutcome"
      />
    </div>
  </main>
</template>