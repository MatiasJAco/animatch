<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { GroupCriterion, GroupsOutcome, GroupsPayloadData } from '~~/server/game/groups'
import { useLocale } from '~/composables/useLocale'
import { useLocalProgress } from '~/composables/useLocalProgress'

const { t } = useLocale()
const progress = useLocalProgress()

const { data: puzzle, pending, error, refresh } = await useFetch<GroupsPayloadData>('/api/daily/groups')

onMounted(() => {
  progress.load()
})

const gameState = computed(() => progress.getGameState('groups'))
const finished = computed(
  () => gameState.value?.status === 'won' || gameState.value?.status === 'lost',
)

const lastOutcome = ref<
  (GroupsOutcome & { attempts: number; mistakes: number }) | null
>(null)

const handleOutcome = (
  outcome: GroupsOutcome & {
    attempts: number
    mistakes: number
    found: Array<{ keys: string[]; criterion: GroupCriterion }>
  },
) => {
  lastOutcome.value = outcome

  if (outcome.state === 'won' || outcome.state === 'lost') {
    progress.markFinished('groups', outcome.state, outcome.attempts)
    return
  }

  // FR-043a: only the visitor's own progress is stored, never puzzle content.
  progress.setGameState('groups', {
    status: 'in_progress',
    attempts: outcome.attempts,
    mistakes: outcome.mistakes,
    found: outcome.found.flatMap((group) => group.keys),
    foundGroups: outcome.found,
  })
}
</script>

<template>
  <main class="page">
    <header class="page-header">
      <div>
        <h1>{{ t('game.groups') }}</h1>
        <p class="muted">{{ t('game.groups.help') }}</p>
      </div>
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
    <ResultPanel
      v-else-if="finished"
      game="groups"
      :state="gameState?.status === 'won' ? 'won' : 'lost'"
      :attempts="lastOutcome?.attempts ?? gameState?.attempts ?? 0"
    />
    <GroupsBoard
      v-else
      :puzzle="puzzle"
      :initial-mistakes="gameState?.mistakes ?? 0"
      :initial-attempts="gameState?.attempts ?? 0"
      :initial-found="(gameState?.foundGroups as never) ?? []"
      @outcome="handleOutcome"
    />
  </main>
</template>