export type GameId =
  | 'more_or_less'
  | 'match_the_series_autumn_2026'
  | 'match_the_series_spring_2026'
  | 'match_the_series_summer_2026'
  | 'groups'

export const GAME_IDS: readonly GameId[] = [
  'more_or_less',
  'match_the_series_autumn_2026',
  'match_the_series_spring_2026',
  'match_the_series_summer_2026',
  'groups',
] as const

export function isGameId(value: unknown): value is GameId {
  if (typeof value !== 'string') {
    return false
  }
  return (GAME_IDS as readonly string[]).includes(value)
}
