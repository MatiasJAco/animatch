import { Pool } from 'pg'
import type { PoolClient } from 'pg'

let globalPool: Pool | null = null

// Principle V: a database failure must be diagnosable from the server log. The context is
// deliberately limited to the operation and the driver's own error class, code and message:
// the connection string, SQL text, stack trace and hostname stay out of the log so they
// cannot reach a log sink that is less protected than the process itself.
export function logDatabaseFailure(operation: string, error: unknown): void {
  const name = error instanceof Error ? error.name : typeof error
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : ''
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[db] ${operation} failed`, { name, code, message })
}

// Every database call is wrapped in this so no failure can escape unlogged.
export async function withDatabaseLogging<T>(
  operation: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    logDatabaseFailure(operation, error)
    throw error
  }
}

export function createPool(connectionString = process.env.DATABASE_URL ?? ''): Pool {
  return new Pool({ connectionString })
}

export async function withClient<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await withDatabaseLogging('connect', () => pool.connect())
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
  const client = await withDatabaseLogging('connect', () => pool.connect())
  try {
    await withDatabaseLogging('begin', () => client.query('BEGIN'))
    const result = await fn(client)
    await withDatabaseLogging('commit', () => client.query('COMMIT'))
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // A rollback that fails because the connection is already gone adds nothing.
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