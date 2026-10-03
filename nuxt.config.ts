// Nuxt configuration. srcDir is app/, so the Nitro server directory stays at the repo root.
export default defineNuxtConfig({
  srcDir: 'app/',
  serverDir: 'server',
  ssr: true,
  devtools: { enabled: false },
  experimental: { appManifest: false },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    databaseUrl: '',
  },
  app: {
    head: {
      htmlAttrs: { lang: 'es' },
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
  compatibilityDate: '2025-01-01',
})