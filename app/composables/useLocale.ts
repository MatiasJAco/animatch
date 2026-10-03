import { computed, ref } from 'vue'
import type { Locale, MessageKey } from '~/i18n'
import { getDefaultLocale, getMessage, normalizeLocale } from '~/i18n'
import { getStoredLocale, setStoredLocale } from './useLocalPrefs'

const locale = ref<Locale>('es')

export function useLocale() {
  const resolved = computed(() => locale.value)

  const init = () => {
    const stored = getStoredLocale()
    if (stored) {
      locale.value = stored
      return
    }
    if (typeof navigator !== 'undefined' && navigator.language) {
      locale.value = getDefaultLocale(navigator.language)
      return
    }
    locale.value = 'es'
  }

  const setLocale = (next: Locale) => {
    locale.value = next
    setStoredLocale(next)
    if (typeof document !== 'undefined') {
      document.documentElement.lang = next
    }
  }

  const t = (key: MessageKey, params?: Record<string, string | number>): string => {
    let text = getMessage(locale.value, key)
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`{${k}}`, 'g'), String(v))
      }
    }
    return text
  }

  return { locale: resolved, init, setLocale, t }
}