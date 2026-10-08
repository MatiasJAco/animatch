<script setup lang="ts">
import type { GameId } from '~~/server/game/ids'
import { useLocale } from '~/composables/useLocale'

defineProps<{ game: GameId; state: 'won' | 'lost'; attempts: number }>()

const { t } = useLocale()
</script>

<template>
  <section class="card">
    <h2>{{ state === 'won' ? t('result.won') : t('result.lost') }}</h2>
    <p>{{ t('result.attempts', { count: attempts }) }}</p>
    <slot />
    <ShareButton :game="game" :state="state" :attempts="attempts" />
  </section>
</template>