export type GameId = 'more_or_less' | 'match_the_series' | 'groups'

export const GAME_IDS: readonly GameId[] = [
  'more_or_less',
  'match_the_series',
  'groups',
] as const

export function isGameId(value: unknown): value is GameId {
  if (typeof value !== 'string') {
    return false
  }
  return (GAME_IDS as readonly string[]).includes(value)
}