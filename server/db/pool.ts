import { Pool } from 'pg'
import type { PoolClient } from 'pg'

let globalPool: Pool | null = null

export function createPool(connectionString = process.env.DATABASE_URL ?? ''): Pool {
  return new Pool({ connectionString })
}

export async function withClient<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}

export async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // ignore rollback failure
    }
    throw error
  } finally {
    client.release()
  }
}

export function getPool(): Pool {
  if (!globalPool) {
    globalPool = createPool()
  }
  return globalPool
}

export function setPool(pool: Pool | null): void {
  globalPool = pool
}

export async function closePool(): Promise<void> {
  if (globalPool) {
    await globalPool.end()
    globalPool = null
  }
}