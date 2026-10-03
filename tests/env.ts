import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const envPath = resolve(import.meta.dirname, '..', '.env')

if (existsSync(envPath) && !process.env.DATABASE_URL) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (match && match[1] && match[2]) {
      process.env[match[1]] = match[2]
    }
  }
}
