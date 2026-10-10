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
  MATCH_CLUE_COUNT,
  type MatchTheSeriesClue,
  type MatchTheSeriesPayloadData,
  type MatchTheSeriesSeries,
  type MatchTheSeriesSolution,
} from '../game/matchTheSeries'

const NOVELTY_WINDOW_DAYS = 30
const MAX_NOVELTY_RETRIES = 8

// EC-003 / R-006: the setup signature must differ from the previous thirty days.
export function contentSignature(
  clues: ReadonlyArray<{ key: string }>,
  seriesKeys: readonly string[],
): string {
  return sha256Hex(
    [...clues.map((c) => c.key), ...seriesKeys].sort().join('|'),
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

interface ClueCandidate {
  kind: 'character' | 'person'
  id: number
  name: string
  animeId: number
}

export interface MatchDeck {
  clues: MatchTheSeriesClue[]
  answers: Record<string, string>
}

/**
 * FR-024a / FR-029a: an entity is usable only when its anime *within the given series set*
 * is exactly one, so the answer is a function of the card and never a choice between series.
 * Returns the usable candidates grouped by the one anime they belong to.
 */
export function indexClueCandidates(
  seriesIds: readonly number[],
  roles: Array<{ character_mal_id: number | null; person_mal_id: number | null; anime_mal_id: number }>,
  characters: Map<number, string>,
  people: Map<number, string>,
): Map<number, ClueCandidate[]> {
  const inSet = new Set(seriesIds)

  // How many of the given series each entity appears in.
  const charSeries = new Map<number, Set<number>>()
  const personSeries = new Map<number, Set<number>>()
  const charAnime = new Map<number, number>()
  const personAnime = new Map<number, number>()

  for (const role of roles) {
    if (!inSet.has(role.anime_mal_id)) {
      continue
    }
    if (role.character_mal_id) {
      const set = charSeries.get(role.character_mal_id) ?? new Set<number>()
      set.add(role.anime_mal_id)
      charSeries.set(role.character_mal_id, set)
      charAnime.set(role.character_mal_id, role.anime_mal_id)
    }
    if (role.person_mal_id) {
      const set = personSeries.get(role.person_mal_id) ?? new Set<number>()
      set.add(role.anime_mal_id)
      personSeries.set(role.person_mal_id, set)
      personAnime.set(role.person_mal_id, role.anime_mal_id)
    }
  }

  const byAnime = new Map<number, ClueCandidate[]>()
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
  return byAnime
}

const CLUES_PER_SERIES = MATCH_CLUE_COUNT / MATCH_BOARD_SIZE

/**
 * R-019: two cards per series, preferring one character and one person, filling from
 * whichever kind the season offers. FR-030: a series that cannot supply its cards makes the
 * day unavailable rather than serving a thin deck. R-021: the deck order is independent of
 * the grid order, so no card's answer is readable from its position.
 */
export function buildMatchDeck(
  chosenAnimeIds: readonly number[],
  byAnime: Map<number, ClueCandidate[]>,
  prng: () => number,
): MatchDeck {
  for (const animeId of chosenAnimeIds) {
    if ((byAnime.get(animeId) ?? []).length < CLUES_PER_SERIES) {
      return { clues: [], answers: {} }
    }
  }

  const clues: MatchTheSeriesClue[] = []
  const answers: Record<string, string> = {}

  for (const animeId of chosenAnimeIds) {
    const candidates = byAnime.get(animeId) as ClueCandidate[]
    const charactersPool = shuffle(
      candidates.filter((c) => c.kind === 'character'),
      prng,
    )
    const peoplePool = shuffle(
      candidates.filter((c) => c.kind === 'person'),
      prng,
    )

    const picked: ClueCandidate[] = []
    if (charactersPool.length > 0) picked.push(charactersPool.shift() as ClueCandidate)
    if (peoplePool.length > 0) picked.push(peoplePool.shift() as ClueCandidate)
    const rest = shuffle([...charactersPool, ...peoplePool], prng)
    while (picked.length < CLUES_PER_SERIES && rest.length > 0) {
      picked.push(rest.shift() as ClueCandidate)
    }
    if (picked.length < CLUES_PER_SERIES) {
      return { clues: [], answers: {} }
    }

    for (const candidate of picked) {
      const key = candidate.kind === 'character' ? `c:${candidate.id}` : `p:${candidate.id}`
      clues.push({ key, kind: candidate.kind, name: candidate.name })
      answers[key] = `a:${animeId}`
    }
  }

  return { clues: shuffle(clues, prng), answers }
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
  // FR-030: nine distinct current-season series. The grid is never shrunk and no older
  // season is substituted; the caller shows the bilingual error state instead.
  if (series.length < MATCH_BOARD_SIZE) {
    throw new PuzzleUnavailableError('not enough current-season series for match-the-series')
  }
  const charMap = new Map(characters.map((c) => [c.mal_id, c.name]))
  const peopleMap = new Map(people.map((p) => [p.mal_id, p.name]))

  // FR-024a: index the candidates over the whole season so a series that cannot supply
  // its cards is never chosen. This is stricter than the chosen-nine rule, so every card
  // kept below is also unambiguous within the nine that end up on the board.
  const byAnime = indexClueCandidates(
    series.map((s) => s.anime_mal_id),
    roles,
    charMap,
    peopleMap,
  )
  const eligible = series.filter(
    (s) => (byAnime.get(s.anime_mal_id) ?? []).length >= CLUES_PER_SERIES,
  )
  if (eligible.length < MATCH_BOARD_SIZE) {
    throw new PuzzleUnavailableError(
      'not enough current-season series with single-series characters or people',
    )
  }

  const recent = await fetchRecentSignatures(game, puzzleDate)
  const daySeed = computePuzzleSignature(game, puzzleDate)

  for (let attempt = 0; attempt < MAX_NOVELTY_RETRIES; attempt += 1) {
    const prng = createPrngFromSeed(attempt === 0 ? daySeed : sha256Hex(`${daySeed}:${attempt}`))

    const chosenSeries = shuffle(eligible, prng).slice(0, MATCH_BOARD_SIZE)
    const chosenAnimeIds = chosenSeries.map((s) => s.anime_mal_id)

    const deck = buildMatchDeck(chosenAnimeIds, byAnime, prng)
    if (deck.clues.length !== MATCH_CLUE_COUNT) {
      continue
    }
    if (new Set(deck.clues.map((c) => c.key)).size !== MATCH_CLUE_COUNT) {
      continue
    }

    const sig = contentSignature(
      deck.clues,
      chosenAnimeIds.map((id) => `a:${id}`),
    )
    if (recent.has(sig)) continue

    const titlesByAnime = new Map(series.map((s) => [s.anime_mal_id, s.title]))
    const gridSeries: MatchTheSeriesSeries[] = shuffle(
      chosenAnimeIds.map((animeId) => ({
        key: `a:${animeId}`,
        title: titlesByAnime.get(animeId) as string,
      })),
      prng,
    )

    const payloadData: MatchTheSeriesPayloadData = {
      game,
      date: puzzleDate,
      season: { season: seasonInfo.season, year: seasonInfo.year },
      grid: { rows: 3, cols: 3, series: gridSeries },
      clues: deck.clues,
    }
    return {
      payload: { signature: sig, data: payloadData },
      solution: { answers: deck.answers },
    }
  }
  throw new PuzzleUnavailableError('could not find a novel match-the-series setup')
}
