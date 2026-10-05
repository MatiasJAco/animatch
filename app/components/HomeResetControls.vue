<script setup lang="ts">
import { ref } from 'vue'
import { useLocale } from '~/composables/useLocale'
import { useLocalProgress } from '~/composables/useLocalProgress'

const { t } = useLocale()
const progress = useLocalProgress()

// FR-057b: one control that clears all three games' saved state. The component holds
// no storage logic of its own; it calls the composable operation, which touches
// browser storage only (FR-058, Principle III).
const reset = () => {
  progress.resetAllGames()
}

// FR-057c: a development tool. The build flag removes this from the production
// bundle entirely, so no production page can reach the reset operation (R-022).
const showReset = import.meta.dev
const confirming = ref(false)

// R-024: the same two-step confirmation as the per-game control, so the two do not
// behave differently under a fast double-click.
const askReset = () => {
  confirming.value = true
}

const confirmReset = () => {
  reset()
  confirming.value = false
}
</script>

<template>
  <nav v-if="showReset" class="home-reset-controls">
    <button
      v-if="!confirming"
      class="home-reset-controls__link"
      type="button"
      @click="askReset"
    >
      {{ t('nav.reset_all') }}
    </button>
    <button
      v-else
      class="home-reset-controls__link"
      type="button"
      @click="confirmReset"
    >
      {{ t('nav.reset_all_confirm') }}
    </button>
  </nav>
</template>
