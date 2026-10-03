import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Pool } from 'pg'

const migrationsDir = resolve(import.meta.dirname, '..', 'migrations')

const listMigrations = async (): Promise<string[]> => {
  const files = await readdir(migrationsDir)
  return files.filter((name) => name.endsWith('.sql')).sort()
}

const connect = async (pool: Pool) => {
  try {
    return await pool.connect()
  } catch {
    await pool.end()
    console.error('Could not connect to the database. Check DATABASE_URL and that the server is up.')
    process.exit(1)
  }
}

const run = async (): Promise<void> => {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.')
    process.exitCode = 1
    return
  }

  const pool = new Pool({ connectionString })
  const client = await connect(pool)
  try {
    for (const name of await listMigrations()) {
      const sql = await readFile(resolve(migrationsDir, name), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('COMMIT')
        console.log(`applied ${name}`)
      } catch (error) {
        await client.query('ROLLBACK')
        throw new Error(`migration ${name} failed: ${(error as Error).message}`)
      }
    }
  } finally {
    client.release()
    await pool.end()
  }
}

await run()