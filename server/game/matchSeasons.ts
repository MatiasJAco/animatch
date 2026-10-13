import type { GameId } from './ids'

export type MatchEditionId = Extract<GameId, `match_the_series_${string}`>

export interface MatchSeason {
  season: 'fall' | 'spring' | 'summer'
  year: number
}

// The three seasonal Match the Series editions. Each is fixed to a 2026 season and never derived
// from the UTC date, the catalog, the client, the locale, or the timezone (spec FR-005/FR-016).
const MATCH_SEASONS: Record<MatchEditionId, MatchSeason> = {
  match_the_series_autumn_2026: { season: 'fall', year: 2026 },
  match_the_series_spring_2026: { season: 'spring', year: 2026 },
  match_the_series_summer_2026: { season: 'summer', year: 2026 },
}

export function isMatchEditionId(game: GameId): game is MatchEditionId {
  return game in MATCH_SEASONS
}

export function matchSeasonFor(game: GameId): MatchSeason {
  if (!isMatchEditionId(game)) {
    throw new Error(`matchSeasonFor: ${game} is not a Match the Series edition`)
  }
  return MATCH_SEASONS[game]
}
