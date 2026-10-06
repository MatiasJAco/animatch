<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { EntityImageKind } from '~/utils/entityImage'
import { imagePath } from '~/utils/entityImage'
import { useLocale } from '~/composables/useLocale'

const props = defineProps<{
  kind: EntityImageKind
  id: number | null | undefined
  name: string
}>()

const { t } = useLocale()

// A failed or missing image must never leave a blank tile (Constitution V): the component
// swaps to the striped fallback and the tile never reaches the network again.
const failed = ref(false)
// The tile follows the entity: Match rounds and Match-clue advances change the id prop,
// so the src must be reactive and a new entity must get a fresh load attempt instead of
// the first entity's image or its cached failure state.
const src = computed(() => imagePath(props.kind, props.id))
watch(src, () => {
  failed.value = false
})

// Exposed to the board so a fallback caption renders only when the image is genuinely
// unavailable (a missing path or a failed load) — never under a loaded image.
const available = computed(() => Boolean(src.value) && !failed.value)
defineExpose({ available })
</script>

<template>
  <span class="entity-art">
    <img
      v-if="src && !failed"
      :src="src"
      :alt="t('image.alt', { name })"
      loading="lazy"
      class="entity-art__img"
      @error="failed = true"
    />
    <span v-else class="entity-art__fallback" aria-hidden="true" />
  </span>
</template>