import { fetchCharactersAndVoicesForSeason } from '../catalog/queries'
import { getPool } from '../db/pool'
import { computePuzzleSignature, type PayloadWithSignature } from '../db/puzzles'
import type { GameId } from '../game/ids'
import type { PuzzleDate } from '../utils/day'
import { utcDateFrom } from '../utils/day'
import { sha256Hex } from '../utils/seed'
import { createPrngFromSeed } from '../utils/seed'
import { shuffle } from '../utils/shuffle'
import {
  MATCH_BOARD_SIZE,
  MATCH_WRONG_LIMIT,
  type MatchTheSeriesPayloadData,
  type MatchTheSeriesSolution,
  type MatchTheSeriesTile,
  type MatchTheSeriesSeries,
} from '../game/matchTheSeries'

const NOVELTY_WINDOW_DAYS = 30
const MAX_NOVELTY_RETRIES = 8

// EC-003 / R-006: the setup signature must differ from the previous thirty days.
export function contentSignature(
  tiles: ReadonlyArray<{ kind: string; id: number }>,
  seriesKeys: readonly string[],
): string {
  return sha256Hex(
    [...tiles.map((t) => `${t.kind}:${t.id}`), ...seriesKeys].sort().join('|'),
  )
}

async function fetchRecentSignatures(game: GameId, puzzleDate: PuzzleDate): Promise<Set<string>> {
  const anchor = new Date(`${puzzleDate}T00:00:00.000Z`)
  if (Number.isNaN(anchor.getTime())) {
    throw new PuzzleUnavailableError(`invalid puzzle date: ${puzzleDate}`)
  }
  anchor.setUTCDate(anchor.getUTCDate() - NOVELTY_WINDOW_DAYS)
  const sinceDate = utcDateFrom(anchor)

  const { rows } = await getPool().query<{ payload: unknown }>(
    `SELECT payload FROM daily_puzzles
     WHERE game = $1 AND puzzle_date > $2 AND puzzle_date < $3`,
    [game, sinceDate, puzzleDate],
  )

  const signatures = new Set<string>()
  for (const row of rows) {
    const payload = row.payload as Partial<PayloadWithSignature> | null
    if (payload && typeof payload.signature === 'string') {
      signatures.add(payload.signature)
    }
  }
  return signatures
}

export class PuzzleUnavailableError extends Error {
  readonly code = 'PUZZLE_UNAVAILABLE' as const
}

// Tiles must be characters or people who appear in exactly one anime of the current season set.
export function buildMatchTiles(
  seriesSet: Set<number>,
  roles: Array<{ character_mal_id: number | null; person_mal_id: number | null; anime_mal_id: number }>,
  characters: Map<number, string>,
  people: Map<number, string>,
  prng: () => number,
): Array<{ kind: 'character' | 'person'; id: number; name: string; animeId: number }> {
  // How many puzzles from the chosen set each entity appears in. Only entities with exactly one
  // are usable, so the pairing stays a function (data-model §5, step 3).
  const charSeries = new Map<number, Set<number>>()
  const personSeries = new Map<number, Set<number>>()
  const charAnime = new Map<number, number>()
  const personAnime = new Map<number, number>()

  for (const r of roles) {
    if (!seriesSet.has(r.anime_mal_id)) {
      continue
    }
    if (r.character_mal_id) {
      const set = charSeries.get(r.character_mal_id) ?? new Set<number>()
      set.add(r.anime_mal_id)
      charSeries.set(r.character_mal_id, set)
      charAnime.set(r.character_mal_id, r.anime_mal_id)
    }
    if (r.person_mal_id) {
      const set = personSeries.get(r.person_mal_id) ?? new Set<number>()
      set.add(r.anime_mal_id)
      personSeries.set(r.person_mal_id, set)
      personAnime.set(r.person_mal_id, r.anime_mal_id)
    }
  }

  const byAnime = new Map<number, Array<{ kind: 'character' | 'person'; id: number; name: string; animeId: number }>>()
  for (const [charId, animes] of charSeries) {
    const name = characters.get(charId)
    if (animes.size === 1 && name) {
      const animeId = charAnime.get(charId) as number
      byAnime.set(animeId, [
        ...(byAnime.get(animeId) ?? []),
        { kind: 'character', id: charId, name, animeId },
      ])
    }
  }
  for (const [personId, animes] of personSeries) {
    const name = people.get(personId)
    if (animes.size === 1 && name) {
      const animeId = personAnime.get(personId) as number
      byAnime.set(animeId, [
        ...(byAnime.get(animeId) ?? []),
        { kind: 'person', id: personId, name, animeId },
      ])
    }
  }

  // One tile per series keeps the board solvable: every series on the right grid has a partner.
  const eligible = [...byAnime.entries()].filter(([, list]) => list.length > 0)
  if (eligible.length < MATCH_BOARD_SIZE) {
    return []
  }

  const charAnimes = eligible.filter(([, list]) => list.some((c) => c.kind === 'character'))
  const personAnimes = eligible.filter(([, list]) => list.some((c) => c.kind === 'person'))

  // Data-model step 4 asks for a mix of both kinds. Take half from each when the season
  // allows it, otherwise fill the rest from whichever kind is available.
  const targetCharacters = Math.min(charAnimes.length, Math.ceil(MATCH_BOARD_SIZE / 2))
  const targetPeople = Math.min(personAnimes.length, MATCH_BOARD_SIZE - targetCharacters)
  const chosen = [
    ...shuffle(charAnimes, prng).slice(0, targetCharacters),
    ...shuffle(personAnimes, prng).slice(0, targetPeople),
  ]
  const filler = shuffle(
    eligible.filter(([animeId]) => !chosen.some(([id]) => id === animeId)),
    prng,
  ).slice(0, MATCH_BOARD_SIZE - chosen.length)
  chosen.push(...filler)

  const tiles: Array<{ kind: 'character' | 'person'; id: number; name: string; animeId: number }> = []
  for (const [, candidates] of chosen) {
    const wanted =
      chosen.filter(([, list]) => list.some((c) => c.kind === 'person')).length > 0 &&
      Math.floor(prng() * 2) === 0
        ? 'person'
        : 'character'
    const pool = candidates.filter((c) => c.kind === wanted)
    tiles.push(pool.length > 0 ? pool[Math.floor(prng() * pool.length)] : candidates[0])
  }

  return shuffle(tiles, prng)
}

export async function generateMatchTheSeries(
  game: 'match_the_series',
  puzzleDate: PuzzleDate,
  seasonInfo: { season: string; year: number },
): Promise<{ payload: PayloadWithSignature; solution: MatchTheSeriesSolution }> {
  // If the requested season has effectively no coverage, fail fast.
  if (seasonInfo.year < 1950 || seasonInfo.year > 2100) {
    throw new PuzzleUnavailableError('no catalog coverage for requested season')
  }
  const { series, roles, characters, people } = await fetchCharactersAndVoicesForSeason(
    seasonInfo.year,
    seasonInfo.season,
  )
  if (series.length < MATCH_BOARD_SIZE) {
    throw new PuzzleUnavailableError('not enough current-season series for match-the-series')
  }
  const seriesSet = new Set(series.map((s) => s.anime_mal_id))
  const charMap = new Map(characters.map((c) => [c.mal_id, c.name]))
  const peopleMap = new Map(people.map((p) => [p.mal_id, p.name]))

  const recent = await fetchRecentSignatures(game, puzzleDate)
  const daySeed = computePuzzleSignature(game, puzzleDate)

  for (let attempt = 0; attempt < MAX_NOVELTY_RETRIES; attempt += 1) {
    const prng = createPrngFromSeed(attempt === 0 ? daySeed : sha256Hex(`${daySeed}:${attempt}`))
    const selectedTiles = buildMatchTiles(seriesSet, roles, charMap, peopleMap, prng)
    if (selectedTiles.length < MATCH_BOARD_SIZE) {
      throw new PuzzleUnavailableError('not enough unique left tiles in current season')
    }

    // The right grid holds the series the tiles actually came from, so every tile has
    // exactly one partner and every tile is answerable (FR-030, R-007).
    const titlesByAnime = new Map(series.map((s) => [s.anime_mal_id, s.title]))
    const pickedSeries = selectedTiles.map((tile) => ({
      anime_mal_id: tile.animeId,
      title: titlesByAnime.get(tile.animeId) as string,
    }))

    const tileList: MatchTheSeriesTile[] = selectedTiles.map((t) => ({
      key: t.kind === 'character' ? `c:${t.id}` : `p:${t.id}`,
      kind: t.kind,
      name: t.name,
    }))
    const seriesList: MatchTheSeriesSeries[] = pickedSeries.map((s) => ({
      key: `a:${s.anime_mal_id}`,
      title: s.title,
    }))

    // The anime id is the answer and never appears in the payload.
    const answers: Record<string, string> = {}
    for (let i = 0; i < selectedTiles.length; i += 1) {
      answers[tileList[i].key] = `a:${selectedTiles[i].animeId}`
    }
    if (Object.keys(answers).length !== MATCH_BOARD_SIZE) {
      continue
    }

    const sig = contentSignature(
      selectedTiles,
      seriesList.map((s) => s.key),
    )
    if (recent.has(sig)) continue

    // Data-model step 5: the right grid is shuffled independently, and its order must differ
    // from the left grid, so no pairing can be read off by position.
    let orderedSeries = shuffle(seriesList, prng)
    for (let tries = 0; tries < 10; tries += 1) {
      if (!orderedSeries.some((series, index) => answers[tileList[index].key] === series.key)) {
        break
      }
      orderedSeries = shuffle(seriesList, prng)
    }

    const payloadData: MatchTheSeriesPayloadData = {
      game,
      date: puzzleDate,
      season: { season: seasonInfo.season, year: seasonInfo.year },
      tiles: tileList,
      series: orderedSeries,
      wrongLimit: MATCH_WRONG_LIMIT,
    }
    return {
      payload: { signature: sig, data: payloadData },
      solution: { answers },
    }
  }
  throw new PuzzleUnavailableError('could not find a novel match-the-series setup')
}