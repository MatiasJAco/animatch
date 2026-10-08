<script setup lang="ts">
import type { GameId } from '~~/server/game/ids'
import { useLocale } from '~/composables/useLocale'

defineProps<{ game: GameId; state: 'won' | 'lost'; attempts: number }>()

const { t } = useLocale()
</script>

<template>
  <!-- Feedback round: the "You lost"/"You won" card duplicated the board's own result, so the
       frame and heading are gone. Only the result-specific content and the share controls stay,
       rendered inline so the board keeps the reclaimed space. -->
  <section class="result-summary">
    <p class="muted">{{ t('result.attempts', { count: attempts }) }}</p>
    <slot />
    <ShareButton :game="game" :state="state" :attempts="attempts" />
  </section>
</template>
