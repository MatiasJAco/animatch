import es from './es'
import en from './en'

export type Locale = 'es' | 'en'

export type MessageKey = keyof typeof es & keyof typeof en

const spanishVariants = new Set([
  'es',
  'es-ar',
  'es-bo',
  'es-cl',
  'es-co',
  'es-cr',
  'es-cu',
  'es-do',
  'es-ec',
  'es-es',
  'es-gt',
  'es-hn',
  'es-mx',
  'es-ni',
  'es-pa',
  'es-pe',
  'es-pr',
  'es-py',
  'es-sv',
  'es-us',
  'es-uy',
  'es-ve',
])

export function normalizeLocale(input: string | null | undefined): Locale {
  if (!input) {
    return 'es'
  }
  const value = input.trim().toLowerCase()
  if (value.startsWith('en')) {
    return 'en'
  }
  if (value.startsWith('es') || spanishVariants.has(value)) {
    return 'es'
  }
  return 'es'
}

export function getDefaultLocale(navigatorLang?: string | null): Locale {
  return normalizeLocale(navigatorLang ?? null)
}

export function getMessage(locale: Locale, key: MessageKey): string {
  if (locale === 'en') {
    return en[key] ?? es[key] ?? key
  }
  return es[key] ?? en[key] ?? key
}

const catalog = { es, en } as const

export function getCatalog() {
  return catalog
}