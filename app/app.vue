<script setup lang="ts">
import { onMounted } from 'vue'
import '~/assets/css/main.css'
import { useLocale } from '~/composables/useLocale'

const { locale, init } = useLocale()

// The server renders Spanish for everyone; the browser resolves the real locale.
useHead({ htmlAttrs: { lang: locale } })

onMounted(() => {
  init()
})
</script>

<template>
  <div class="app">
    <NuxtPage />
  </div>
</template>