<script setup lang="ts">
import type { Locale, MessageKey } from '~/i18n'
import { useLocale } from '~/composables/useLocale'

const { locale, setLocale, t } = useLocale()

const options: Array<{ value: Locale; label: MessageKey }> = [
  { value: 'es', label: 'lang.switch.es' },
  { value: 'en', label: 'lang.switch.en' },
]
</script>

<template>
  <div class="lang-switch" role="group" :aria-label="t('lang.label')">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="button button--ghost"
      :lang="option.value"
      :aria-pressed="locale === option.value"
      @click="setLocale(option.value)"
    >
      {{ t(option.label) }}
    </button>
  </div>
</template>