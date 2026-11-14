<script setup lang="ts">
import { onMounted, ref } from 'vue'

// The mascot is decorative: it carries no information the catalog text does not already
// give, so it is hidden from assistive technology and never takes a focus stop.
const failed = ref(false)
const image = ref<HTMLImageElement | null>(null)

// A missing image can fail before hydration attaches the error listener. Re-check the
// element once mounted so the broken image is still removed — the pattern GameArt.vue
// already uses for card artwork.
onMounted(() => {
  if (image.value?.complete && image.value.naturalWidth === 0) {
    failed.value = true
  }
})
</script>

<template>
  <span class="mascot" data-mascot aria-hidden="true">
    <img
      v-if="!failed"
      ref="image"
      class="mascot__img"
      data-mascot-image
      src="/artwork/matchi-mascot.webp"
      alt=""
      width="640"
      height="1137"
      decoding="async"
      draggable="false"
      @error="failed = true"
    />
  </span>
</template>
