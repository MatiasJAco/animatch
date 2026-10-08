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
    missLog: string[][]
  },
) => {
  lastOutcome.value = outcome

  if (outcome.state === 'won' || outcome.state === 'lost') {
    progress.markFinished('groups', outcome.state, outcome.attempts)
    return
  }

  // FR-043a: only the visitor's own progress is stored, never puzzle content. The rejected
  // proposals are stored too, so a resumed board stays verifiable by the server.
  progress.setGameState('groups', {
    status: 'in_progress',
    attempts: outcome.attempts,
    mistakes: outcome.mistakes,
    found: outcome.found.flatMap((group) => group.keys),
    foundGroups: outcome.found,
    missLog: outcome.missLog,
  })
}
</script>

<template>
  <GameShell :title="t('game.groups')">
    <template #header-actions>
      <GameHeaderControls game="groups" />
    </template>

    <ErrorPanel
      v-if="error"
      code="PUZZLE_UNAVAILABLE"
      :pending="pending"
      :retry="() => refresh()"
    />
    <div v-else-if="pending || !puzzle">
      <p>{{ t('common.loading') }}</p>
    </div>
    <template v-else>
      <!-- Feature 003: the board stays mounted so a finished game keeps its rows visible — the
           loss layout is a reveal of remaining groups, never a swap to a bare result card. -->
      <GroupsBoard
        :puzzle="puzzle"
        :initial-status="(gameState?.status ?? 'in_progress') as never"
        :initial-mistakes="gameState?.mistakes ?? 0"
        :initial-attempts="gameState?.attempts ?? 0"
        :initial-found="(gameState?.foundGroups as never) ?? []"
        :initial-miss-log="gameState?.missLog ?? []"
        @outcome="handleOutcome"
      />
      <ResultPanel
        v-if="finished"
        game="groups"
        :state="gameState?.status === 'won' ? 'won' : 'lost'"
        :attempts="lastOutcome?.attempts ?? gameState?.attempts ?? 0"
      />
    </template>
  </GameShell>
</template>