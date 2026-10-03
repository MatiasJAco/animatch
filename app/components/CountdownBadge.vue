<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { getNextUtcRollover } from '~~/server/utils/day'
import { useLocale } from '~/composables/useLocale'

const { t } = useLocale()

// Display only: the rollover itself is decided in UTC by the server.
const remaining = ref('')
let timer: ReturnType<typeof setInterval> | undefined

const format = (target: Date) => {
  const diff = Math.max(0, target.getTime() - Date.now())
  const totalMinutes = Math.floor(diff / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const seconds = Math.floor((diff % 60000) / 1000)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

onMounted(() => {
  const target = getNextUtcRollover()
  remaining.value = format(target)
  timer = setInterval(() => {
    remaining.value = format(target)
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) {
    clearInterval(timer)
  }
})
</script>

<template>
  <p class="badge">
    {{ t('home.next_rollover') }}
    <time>{{ remaining }}</time>
  </p>
</template>