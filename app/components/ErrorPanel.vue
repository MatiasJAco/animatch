<script setup lang="ts">
import { useLocale } from '~/composables/useLocale'

const props = defineProps<{
  code: string
  retry?: () => void
  pending?: boolean
}>()

const { t } = useLocale()

// FR-050 / FR-051: name the failure in plain language from the bilingual catalog and never
// expose internal detail. Any unmapped code falls back to the generic message.
const messageKey = `error.${props.code}` as const
const known = ['UNKNOWN_GAME', 'INVALID_ATTEMPT', 'DATABASE_UNAVAILABLE', 'PUZZLE_UNAVAILABLE']
const label = () => (known.includes(props.code) ? t(messageKey) : t('error.DATABASE_UNAVAILABLE'))
</script>

<template>
  <section class="card" role="alert">
    <h2>{{ t('groups.error.title') }}</h2>
    <p>{{ label() }}</p>
    <p class="muted">{{ t('error.body') }}</p>
    <button v-if="retry" type="button" class="button" :disabled="pending" @click="retry">
      {{ t('groups.error.retry') }}
    </button>
  </section>
</template>