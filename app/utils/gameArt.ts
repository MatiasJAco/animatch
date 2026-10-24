import type { GameId } from '~~/server/game/ids'

// One stable public path per game. Replacing a card image means replacing the file at this
// path; renaming it only requires editing this map.
export const GAME_ART_PATHS: Record<GameId, string> = {
  more_or_less: '/games/more-or-less.svg',
  match_the_series_autumn_2026: '/games/match-the-series-autumn-2026.svg',
  match_the_series_spring_2026: '/games/match-the-series-spring-2026.svg',
  match_the_series_summer_2026: '/games/match-the-series-summer-2026.svg',
  groups: '/games/groups.svg',
}

export function gameArtPath(game: GameId): string {
  return GAME_ART_PATHS[game]
}
