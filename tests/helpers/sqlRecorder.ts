import { getPool } from '../../server/db/pool'

export interface SqlRecorder {
  statements: () => string[]
  reset: () => void
  restore: () => void
}

/**
 * Captures every SQL string the app executes against the shared pool so a test can prove
 * generation only reads the catalog and writes exactly one row (Principle I, R-016).
 */
export function recordSql(): SqlRecorder {
  const pool = getPool() as unknown as {
    query: (...args: unknown[]) => Promise<unknown>
    connect: () => Promise<unknown>
  }
  const statements: string[] = []
  const realQuery = pool.query.bind(pool)
  const realConnect = pool.connect.bind(pool)

  // pg routes pool.query through connect(), so a naive wrap records every statement twice.
  // The flag suppresses the inner client note while a pool-level query is in flight.
  let insidePoolQuery = 0

  const note = (text: unknown, level: 'pool' | 'client') => {
    if (level === 'client' && insidePoolQuery > 0) {
      return
    }
    if (typeof text === 'string') {
      statements.push(text.replace(/\s+/g, ' ').trim())
    }
  }

  const wrapClient = (client: unknown) => {
    const target = client as { query: (...args: unknown[]) => Promise<unknown> }
    const clientQuery = target.query.bind(target)
    target.query = ((...args: unknown[]) => {
      note(args[0], 'client')
      return clientQuery(...args)
    }) as typeof target.query
    return target
  }

  pool.query = ((...args: unknown[]) => {
    insidePoolQuery += 1
    note(args[0], 'pool')
    return realQuery(...args).finally(() => {
      insidePoolQuery -= 1
    })
  }) as typeof pool.query

  // getOrCreateDailyPuzzle inserts on a dedicated client, so the check-out path must be
  // wrapped too. pg calls connect with a callback internally, so both forms are preserved.
  pool.connect = ((callback?: (err: Error | null, client?: unknown) => void) => {
    if (typeof callback === 'function') {
      return realConnect((err: Error | null, client: unknown) => {
        callback(err, client ? wrapClient(client) : client)
      })
    }
    return realConnect().then(wrapClient)
  }) as unknown as typeof pool.connect

  return {
    statements: () => [...statements],
    reset: () => {
      statements.length = 0
    },
    restore: () => {
      pool.query = realQuery as typeof pool.query
      pool.connect = realConnect
    },
  }
}

/** Transaction control is neither a catalog read nor a data write. */
export function isTransactionControl(sql: string): boolean {
  return /^\s*(begin|commit|rollback|savepoint|release savepoint)\b/i.test(sql)
}

/** True when a statement writes rather than reads. */
export function isWrite(sql: string): boolean {
  return /^\s*(insert|update|delete|truncate|alter|drop|create|grant|revoke)\b/i.test(sql)
}
