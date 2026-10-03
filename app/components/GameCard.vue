<script setup lang="ts">
import { computed } from 'vue'
import type { GameId } from '~~/server/game/ids'
import type { MessageKey } from '~/i18n'
import { useLocale } from '~/composables/useLocale'
import type { LocalGameState } from '~/composables/useLocalProgress'
import type { GameStatus } from '~~/server/game/listing'

const props = defineProps<{
  game: GameId
  status: GameStatus
  state?: LocalGameState
}>()

const { t } = useLocale()

const name = computed(() => t(`game.${props.game}` as MessageKey))
const summary = computed(() => t(`game.${props.game}.summary` as MessageKey))
const to = computed(() => `/game/${props.game.replace(/_/g, '-')}`)
const isFinished = computed(() => props.state?.status === 'won' || props.state?.status === 'lost')
const canPlay = computed(() => props.status === 'ready' && !isFinished.value)
</script>

<template>
  <article class="card">
    <h2>{{ name }}</h2>
    <p>{{ summary }}</p>
    <p v-if="isFinished" class="badge">{{ t('home.finished_today') }}</p>
    <p v-else-if="status === 'unavailable'" class="feedback--wrong">
      {{ t('error.PUZZLE_UNAVAILABLE') }}
    </p>
    <p v-else-if="status === 'error'" class="feedback--wrong">
      {{ t('error.DATABASE_UNAVAILABLE') }}
    </p>
    <NuxtLink v-if="canPlay" class="button" :to="to">{{ t('home.play') }}</NuxtLink>
  </article>
</template>