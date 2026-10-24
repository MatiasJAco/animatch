<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { GameId } from '~~/server/game/ids'
import { gameArtPath } from '~/utils/gameArt'

const props = defineProps<{
  game: GameId
}>()

const failed = ref(false)
const image = ref<HTMLImageElement | null>(null)
const src = computed(() => gameArtPath(props.game))

watch(src, () => {
  failed.value = false
})

// A missing image can fail before hydration attaches the error listener. Re-check the element
// once mounted so the placeholder still replaces the broken image.
onMounted(() => {
  if (image.value?.complete && image.value.naturalWidth === 0) {
    failed.value = true
  }
})
</script>

<template>
  <span class="game-art" data-game-art aria-hidden="true">
    <img
      v-if="!failed"
      ref="image"
      :src="src"
      alt=""
      width="320"
      height="180"
      loading="eager"
      decoding="async"
      draggable="false"
      class="game-art__img"
      data-art-image
      @error="failed = true"
    />
    <span v-else class="game-art__fallback" data-art-fallback />
  </span>
</template>
