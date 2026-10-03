import { computed, ref } from 'vue'

export function useAttemptCount() {
  const attempts = ref(0)

  const increment = () => {
    attempts.value += 1
  }

  const reset = () => {
    attempts.value = 0
  }

  return { attempts: computed(() => attempts.value), increment, reset }
}