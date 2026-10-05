<script setup lang="ts">
import { ref } from 'vue'
import type { GameId } from '~~/server/game/ids'
import { useLocale } from '~/composables/useLocale'
import { useLocalProgress } from '~/composables/useLocalProgress'

const props = defineProps<{ game: GameId }>()

const { t } = useLocale()
const progress = useLocalProgress()

// FR-057: clearing one game for the day. The component holds no storage logic of its own;
// it calls the composable's operation, which touches browser storage only (FR-058).
const reset = () => {
  progress.resetGame(props.game)
}

// FR-057a: a development tool. The build flag removes this from the production bundle
// entirely, so no production page can reach the reset operation (R-022).
const showReset = import.meta.dev
const confirming = ref(false)

const askReset = () => {
  confirming.value = !confirming.value
}

const confirmReset = () => {
  reset()
  confirming.value = false
}
</script>

<template>
  <nav class="game-header-controls">
    <!-- FR-056: every game screen offers a visible way back to the home page. -->
    <NuxtLink class="game-header-controls__link" to="/">{{ t('nav.home') }}</NuxtLink>

    <template v-if="showReset">
      <button
        v-if="!confirming"
        class="game-header-controls__link"
        type="button"
        @click="askReset"
      >
        {{ t('nav.reset') }}
      </button>
      <button
        v-else
        class="game-header-controls__link"
        type="button"
        @click="confirmReset"
      >
        {{ t('nav.reset_confirm') }}
      </button>
    </template>
  </nav>
</template>
