import { defineConfig } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// The dev server reads DATABASE_URL from the environment; Nuxt also loads .env, but passing
// it explicitly keeps `npm run test:viewport` working from a shell that has not sourced .env.
function readDotEnv(): Record<string, string> {
  const path = resolve(process.cwd(), '.env')
  if (!existsSync(path)) {
    return {}
  }
  const env: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (match?.[1] && match[2]) {
      env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  }
  return env
}

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npx nuxt dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 180_000,
    env: { ...process.env, ...readDotEnv() } as Record<string, string>,
  },
})
