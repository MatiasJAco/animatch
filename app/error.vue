<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { NuxtError } from '#app'
import { useLocale } from '~/composables/useLocale'

// FR-048 / FR-049 / SC-011: the error page is a visitor-facing surface, so every string comes
// from the bilingual catalog in the resolved locale. Without this, an unknown route served the
// framework's own English-only page, which leaked "Nuxt" as the product name.
const props = defineProps<{ error: NuxtError }>()

const { t, init } = useLocale()

// The server renders Spanish for everyone, like app.vue, and the browser corrects it.
onMounted(() => {
  init()
})

const notFound = computed(() => props.error?.statusCode === 404)
const title = () => t(notFound.value ? 'error.page.not_found.title' : 'error.page.unexpected.title')
const body = () => t(notFound.value ? 'error.page.not_found.body' : 'error.page.unexpected.body')
</script>

<template>
  <main class="page">
    <section class="card" role="alert">
      <h1>{{ title() }}</h1>
      <p class="muted">{{ body() }}</p>
      <NuxtLink to="/" class="button">{{ t('error.page.home') }}</NuxtLink>
    </section>
  </main>
</template>