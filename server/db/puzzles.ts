import { getPool, withTransaction } from './pool'
import type { GameId } from '../game/ids'
import type { PuzzleDate } from '../utils/day'
import { sha256Hex } from '../utils/seed'

export interface DailyPuzzleRow {
  game: GameId
  puzzle_date: PuzzleDate
  payload: unknown
  solution: unknown
  created_at: string
}

export type PayloadWithSignature = {
  signature: string
  data: unknown
}

export function stripSignature(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    if (obj.signature !== undefined && obj.data !== undefined) {
      return obj.data
    }
  }
  return value
}

export function hasSignature(value: unknown): value is PayloadWithSignature {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const obj = value as Record<string, unknown>
  return typeof obj.signature === 'string' && 'data' in obj
}

export async function getDailyPuzzle(
  game: GameId,
  puzzleDate: PuzzleDate,
): Promise<DailyPuzzleRow | null> {
  const pool = getPool()
  const { rows } = await pool.query<DailyPuzzleRow>(
    `SELECT game, puzzle_date, payload, solution, created_at
     FROM daily_puzzles
     WHERE game = $1 AND puzzle_date = $2`,
    [game, puzzleDate],
  )
  return rows[0] ?? null
}

export async function readWithinTransaction(
  client: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  game: GameId,
  puzzleDate: PuzzleDate,
): Promise<DailyPuzzleRow | null> {
  const { rows } = await client.query<DailyPuzzleRow>(
    `SELECT game, puzzle_date, payload, solution, created_at
     FROM daily_puzzles
     WHERE game = $1 AND puzzle_date = $2`,
    [game, puzzleDate],
  )
  return rows[0] ?? null
}

export async function insertWithinTransaction(
  client: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> },
  game: GameId,
  puzzleDate: PuzzleDate,
  payload: unknown,
  solution: unknown,
): Promise<void> {
  await client.query(
    `INSERT INTO daily_puzzles (game, puzzle_date, payload, solution)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (game, puzzle_date) DO NOTHING`,
    [game, puzzleDate, JSON.stringify(payload), JSON.stringify(solution)],
  )
}

// Create-once semantics: a concurrent first request loses the insert and serves the stored winner.
export async function getOrCreateDailyPuzzle(
  game: GameId,
  puzzleDate: PuzzleDate,
  generate: (client: unknown) => Promise<{ payload: unknown; solution: unknown }>,
): Promise<DailyPuzzleRow> {
  return withTransaction(getPool(), async (client) => {
    const existing = await readWithinTransaction(client, game, puzzleDate)
    if (existing) {
      return existing
    }

    const generated = await generate(client)
    await insertWithinTransaction(client, game, puzzleDate, generated.payload, generated.solution)

    const winner = await readWithinTransaction(client, game, puzzleDate)
    if (!winner) {
      throw new Error('daily_puzzles row missing after insert')
    }
    return winner
  })
}

export function computePuzzleSignature(game: GameId, puzzleDate: PuzzleDate): string {
  return sha256Hex(`${game}:${puzzleDate}`)
}