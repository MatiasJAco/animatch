import { getPool } from '../db/pool'
import type { GameId } from '../game/ids'
import type { PuzzleDate } from '../utils/day'

export type ImageKind = 'anime' | 'character' | 'person'

// Every catalog query in this module is hand-written and restricts to the allowed facts:
// person name, character name, anime title, anime type, anime year, anime season,
// voice language, voice role, anime source material, and the single artwork reference
// (image_url) that the server-side image route resolves. No favorites, biography, or import
// table is ever read.

export interface PeopleRow {
  mal_id: number
  name: string
}

export interface AnimeRow {
  mal_id: number
  title: string
  type: string | null
  year: number | null
  season: string | null
  episodes: number | null
  source: string | null
}

export interface CharacterRow {
  mal_id: number
  name: string
}

export interface VoiceRoleRow {
  person_mal_id: number
  character_mal_id: number
  anime_mal_id: number
  language: string
  role: string | null
}

export interface AnimeSeasonRow {
  anime_mal_id: number
  year: number
  season: string
}

// FR-023: the career role count is every voice_roles record attributed to the person,
// regardless of character, series, or language. One row per person, no pagination:
// the More or Less generator walks the whole list.
export async function fetchPeopleRoleCounts(): Promise<
  Array<{ id: number; name: string; roleCount: number }>
> {
  const { rows } = await getPool().query<{
    id: string
    name: string
    role_count: string
  }>(
    `SELECT vr.person_mal_id AS id, p.name, COUNT(*) AS role_count
     FROM voice_roles vr
     JOIN people p ON p.mal_id = vr.person_mal_id
     GROUP BY vr.person_mal_id, p.name
     ORDER BY vr.person_mal_id`,
  )
  return rows.map((row) => ({ id: Number(row.id), name: row.name, roleCount: Number(row.role_count) }))
}

export async function fetchAllPeopleWithRoleCounts(
  limit = 1000,
  offset = 0,
): Promise<Array<{ mal_id: number; name: string; role_count: number }>> {
  const { rows } = await getPool().query<{
    mal_id: number
    name: string
    role_count: string
  }>(
    `SELECT p.mal_id, p.name, COUNT(*) AS role_count
     FROM voice_roles vr
     JOIN people p ON p.mal_id = vr.person_mal_id
     GROUP BY p.mal_id, p.name
     ORDER BY p.mal_id
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  )
  return rows.map((row) => ({ ...row, role_count: Number(row.role_count) }))
}

export async function countPeopleWithAtLeastOneRole(): Promise<number> {
  const { rows } = await getPool().query<{ count: string }>(
    `SELECT COUNT(DISTINCT person_mal_id) AS count FROM voice_roles`,
  )
  return Number(rows[0]?.count ?? 0)
}

export async function countVoicedCharacters(): Promise<number> {
  const { rows } = await getPool().query<{ count: string }>(
    `SELECT COUNT(DISTINCT character_mal_id) AS count FROM voice_roles`,
  )
  return Number(rows[0]?.count ?? 0)
}

export async function countCurrentSeasonSeries(year: number, season: string): Promise<number> {
  const { rows } = await getPool().query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM anime_seasons
     WHERE year = $1 AND lower(trim(season)) = lower(trim($2))`,
    [year, season],
  )
  return Number(rows[0]?.count ?? 0)
}

export async function fetchCurrentSeasonSeries(
  year: number,
  season: string,
  limit = 500,
  offset = 0,
): Promise<CurrentSeasonSeries[]> {
  const { rows } = await getPool().query<CurrentSeasonSeries>(
    `SELECT s.anime_mal_id, a.title, s.year, s.season
     FROM anime_seasons s
     JOIN anime a ON a.mal_id = s.anime_mal_id
     WHERE s.year = $1 AND lower(trim(s.season)) = lower(trim($2))
     ORDER BY s.anime_mal_id
     LIMIT $3 OFFSET $4`,
    [year, season, limit, offset],
  )
  return rows
}

/**
 * Series in the season that have at least one character or person appearing in exactly one
 * season series. A match-the-series board is only playable when 16 such series exist.
 */
export async function countMatchableCurrentSeasonSeries(
  year: number,
  season: string,
): Promise<number> {
  const { rows } = await getPool().query<{ count: string }>(
    `WITH season_series AS (
       SELECT anime_mal_id
       FROM anime_seasons
       WHERE year = $1 AND lower(trim(season)) = lower(trim($2))
     ),
     char_occurrences AS (
       SELECT r.character_mal_id AS entity_id, COUNT(DISTINCT r.anime_mal_id) AS series_count
       FROM voice_roles r
       JOIN season_series ss ON ss.anime_mal_id = r.anime_mal_id
       WHERE r.character_mal_id IS NOT NULL
       GROUP BY r.character_mal_id
     ),
     person_occurrences AS (
       SELECT r.person_mal_id AS entity_id, COUNT(DISTINCT r.anime_mal_id) AS series_count
       FROM voice_roles r
       JOIN season_series ss ON ss.anime_mal_id = r.anime_mal_id
       WHERE r.person_mal_id IS NOT NULL
       GROUP BY r.person_mal_id
     ),
     unique_char AS (
       SELECT co.entity_id, MIN(r.anime_mal_id) AS anime_mal_id
       FROM char_occurrences co
       JOIN voice_roles r ON r.character_mal_id = co.entity_id
       JOIN season_series ss ON ss.anime_mal_id = r.anime_mal_id
       WHERE co.series_count = 1
       GROUP BY co.entity_id
     ),
     unique_person AS (
       SELECT po.entity_id, MIN(r.anime_mal_id) AS anime_mal_id
       FROM person_occurrences po
       JOIN voice_roles r ON r.person_mal_id = po.entity_id
       JOIN season_series ss ON ss.anime_mal_id = r.anime_mal_id
       WHERE po.series_count = 1
       GROUP BY po.entity_id
     ),
     named_unique_char AS (
       SELECT u.anime_mal_id
       FROM unique_char u
       JOIN characters c ON c.mal_id = u.entity_id
       WHERE btrim(c.name) <> ''
     ),
     named_unique_person AS (
       SELECT u.anime_mal_id
       FROM unique_person u
       JOIN people p ON p.mal_id = u.entity_id
       WHERE btrim(p.name) <> ''
     )
     SELECT COUNT(DISTINCT anime_mal_id) AS count
     FROM (
       SELECT anime_mal_id FROM named_unique_char
       UNION
       SELECT anime_mal_id FROM named_unique_person
     ) AS matchable`,
    [year, season],
  )
  return Number(rows[0]?.count ?? 0)
}

export async function fetchCharactersAndVoicesForSeason(
  year: number,
  season: string,
): Promise<{
  series: CurrentSeasonSeries[]
  roles: VoiceRoleRow[]
  characters: CharacterRow[]
  people: PeopleRow[]
}> {
  const series = await fetchCurrentSeasonSeries(year, season, 1000, 0)
  if (series.length === 0) {
    return { series, roles: [], characters: [], people: [] }
  }
  const animeIds = series.map((s) => s.anime_mal_id)
  const roles = await fetchVoiceRolesForSeries(animeIds)
  const charIds = Array.from(new Set(roles.map((r) => r.character_mal_id)))
  const personIds = Array.from(new Set(roles.map((r) => r.person_mal_id)))
  const characters = await fetchCharactersByIds(charIds)
  const people = await fetchPeopleByIds(personIds)
  return { series, roles, characters, people }
}

export interface CurrentSeasonSeries {
  anime_mal_id: number
  title: string
  year: number
  season: string
}

export async function fetchCharactersForSeries(animeMalIds: number[]): Promise<CharacterRow[]> {
  if (animeMalIds.length === 0) {
    return []
  }
  const { rows } = await getPool().query<CharacterRow>(
    `SELECT c.mal_id, c.name
     FROM voice_roles vr
     JOIN characters c ON c.mal_id = vr.character_mal_id
     WHERE vr.anime_mal_id = ANY($1::int[])
     GROUP BY c.mal_id, c.name
     ORDER BY c.mal_id`,
    [animeMalIds],
  )
  return rows
}

export async function fetchVoiceRolesForSeries(animeMalIds: number[]): Promise<VoiceRoleRow[]> {
  if (animeMalIds.length === 0) {
    return []
  }
  const { rows } = await getPool().query<VoiceRoleRow>(
    `SELECT person_mal_id, character_mal_id, anime_mal_id, language, role
     FROM voice_roles
     WHERE anime_mal_id = ANY($1::int[])
     ORDER BY person_mal_id, character_mal_id, anime_mal_id, language`,
    [animeMalIds],
  )
  return rows
}

export async function fetchPeopleByIds(personMalIds: number[]): Promise<PeopleRow[]> {
  if (personMalIds.length === 0) {
    return []
  }
  const { rows } = await getPool().query<PeopleRow>(
    `SELECT mal_id, name FROM people WHERE mal_id = ANY($1::int[]) ORDER BY mal_id`,
    [personMalIds],
  )
  return rows
}

export async function fetchCharactersByIds(characterMalIds: number[]): Promise<CharacterRow[]> {
  if (characterMalIds.length === 0) {
    return []
  }
  const { rows } = await getPool().query<CharacterRow>(
    `SELECT mal_id, name FROM characters WHERE mal_id = ANY($1::int[]) ORDER BY mal_id`,
    [characterMalIds],
  )
  return rows
}

export async function fetchAnimesByIds(animeMalIds: number[]): Promise<AnimeRow[]> {
  if (animeMalIds.length === 0) {
    return []
  }
  const { rows } = await getPool().query<AnimeRow>(
    `SELECT mal_id, title, type, year, season, episodes, source
     FROM anime WHERE mal_id = ANY($1::int[]) ORDER BY mal_id`,
    [animeMalIds],
  )
  return rows
}

/**
 * One anime's calendar season, used to judge a same_season criterion for a candidate tile.
 * Only the two columns the criterion needs are read, and the row is ordered by year so the
 * result is deterministic (Principle I: this module owns every catalog read).
 */
export async function fetchAnimeSeasonById(
  animeMalId: number,
): Promise<{ year: number; season: string } | null> {
  const { rows } = await getPool().query<{ year: number; season: string }>(
    `SELECT year, season FROM anime_seasons WHERE anime_mal_id = $1 ORDER BY year LIMIT 1`,
    [animeMalId],
  )
  return rows[0] ?? null
}

// Groups candidate tiles: characters whose linkage fields are already pinned to the anime,
// source material, language, and voice actor they are judged on. Only the nine allowed facts
// are read; no image column and no duplicated label is ever returned (FR-031, FR-032, R-011,
// R-013).

export interface GroupCandidateTile {
  kind: 'character'
  id: number
  name: string
  animeId: number
  source: string
  language: string
  voiceActorId: number
}

export interface SameAnimePool {
  criterion: 'same_anime'
  animeId: number
  tiles: GroupCandidateTile[]
}

/**
 * Characters with a voice role in one anime, grouped by that anime. Blank `language` is the
 * column default and is never eligible, so every tile here can also serve a language criterion.
 */
export async function fetchSameAnimePools(limit = 200): Promise<SameAnimePool[]> {
  const { rows } = await getPool().query<{
    anime_mal_id: number
    character_mal_id: number
    name: string
    language: string
    person_mal_id: number
    source: string
  }>(
    `SELECT r.anime_mal_id, r.character_mal_id, c.name, r.language, r.person_mal_id,
            COALESCE(a.source, '') AS source
     FROM voice_roles r
     JOIN characters c ON c.mal_id = r.character_mal_id
     JOIN anime a ON a.mal_id = r.anime_mal_id
     WHERE btrim(r.language) <> ''
     ORDER BY r.anime_mal_id, r.character_mal_id, r.person_mal_id, r.language
     LIMIT $1`,
    [limit * 40],
  )

  const byAnime = new Map<number, GroupCandidateTile[]>()
  for (const row of rows) {
    const list = byAnime.get(row.anime_mal_id) ?? []
    const already = list.some(
      (tile) =>
        tile.id === row.character_mal_id &&
        tile.language === row.language &&
        tile.voiceActorId === row.person_mal_id,
    )
    if (already || row.name.trim() === '') {
      continue
    }
    list.push({
      kind: 'character',
      id: row.character_mal_id,
      name: row.name,
      animeId: row.anime_mal_id,
      source: row.source,
      language: row.language,
      voiceActorId: row.person_mal_id,
    })
    byAnime.set(row.anime_mal_id, list)
  }

  const pools: SameAnimePool[] = []
  for (const [animeId, tiles] of [...byAnime.entries()].sort((a, b) => a[0] - b[0])) {
    if (new Set(tiles.map((tile) => tile.id)).size >= 4) {
      pools.push({ criterion: 'same_anime', animeId, tiles })
    }
    if (pools.length >= limit) {
      break
    }
  }
  return pools
}

/**
 * Characters sharing one (year, season) identity. Season matching follows FR-030's rule so
 * different years are never treated as one season, and distinct anime ids are required (FR-038).
 */
export async function fetchSameSeasonPool(
  year: number,
  season: string,
  limit = 60,
): Promise<GroupCandidateTile[]> {
  const { rows } = await getPool().query<{
    character_mal_id: number
    name: string
    anime_mal_id: number
    language: string
    person_mal_id: number
    source: string
  }>(
    `SELECT r.character_mal_id, c.name, r.anime_mal_id, r.language, r.person_mal_id,
            COALESCE(a.source, '') AS source
     FROM voice_roles r
     JOIN characters c ON c.mal_id = r.character_mal_id
     JOIN anime_seasons s ON s.anime_mal_id = r.anime_mal_id
     JOIN anime a ON a.mal_id = r.anime_mal_id
     WHERE s.year = $1
       AND lower(trim(s.season)) = lower(trim($2))
       AND btrim(r.language) <> ''
     ORDER BY r.character_mal_id, r.anime_mal_id, r.person_mal_id, r.language
     LIMIT $3`,
    [year, season, limit * 40],
  )

  const seen = new Set<string>()
  const tiles: GroupCandidateTile[] = []
  for (const row of rows) {
    // One anime per character keeps same_anime from also explaining the whole set.
    const dedupe = `${row.character_mal_id}:${row.language}:${row.person_mal_id}`
    if (seen.has(dedupe) || row.name.trim() === '') {
      continue
    }
    seen.add(dedupe)
    tiles.push({
      kind: 'character',
      id: row.character_mal_id,
      name: row.name,
      animeId: row.anime_mal_id,
      source: row.source,
      language: row.language,
      voiceActorId: row.person_mal_id,
    })
    if (tiles.length >= limit) {
      break
    }
  }
  return tiles
}

/** Characters across distinct anime whose anime share one non-blank source material. */
export async function fetchSameSourcePools(limit = 200): Promise<
  Array<{ criterion: 'same_source'; source: string; tiles: GroupCandidateTile[] }>
> {
  // No LIMIT: the source set is tiny (~13 distinct non-blank values), so every source must be
  // read or the smaller ones sorted after Manga would be truncated and lose board availability.
  const { rows } = await getPool().query<{
    source: string
    character_mal_id: number
    name: string
    anime_mal_id: number
    language: string
    person_mal_id: number
  }>(
    `SELECT btrim(a.source) AS source, r.character_mal_id, c.name, r.anime_mal_id,
            r.language, r.person_mal_id
     FROM voice_roles r
     JOIN characters c ON c.mal_id = r.character_mal_id
     JOIN anime a ON a.mal_id = r.anime_mal_id
     WHERE btrim(a.source) <> '' AND btrim(r.language) <> ''
     ORDER BY btrim(a.source), r.character_mal_id, r.anime_mal_id, r.person_mal_id, r.language`,
  )

  const bySource = new Map<string, GroupCandidateTile[]>()
  for (const row of rows) {
    const list = bySource.get(row.source) ?? []
    if (row.name.trim() !== '' && !list.some((tile) => tile.id === row.character_mal_id)) {
      list.push({
        kind: 'character',
        id: row.character_mal_id,
        name: row.name,
        animeId: row.anime_mal_id,
        source: row.source,
        language: row.language,
        voiceActorId: row.person_mal_id,
      })
      bySource.set(row.source, list)
    }
  }

  const pools: Array<{
    criterion: 'same_source'
    source: string
    tiles: GroupCandidateTile[]
  }> = []
  for (const [source, tiles] of [...bySource.entries()].sort()) {
    // FR-003: distinct anime are required so the group is never a hidden "same anime" group.
    const distinctAnime = new Set(tiles.map((tile) => tile.animeId)).size
    if (tiles.length >= 4 && distinctAnime >= 4) {
      pools.push({ criterion: 'same_source', source, tiles })
    }
    if (pools.length >= limit) {
      break
    }
  }
  return pools
}

/** Characters voiced by one person across any series. */
export async function fetchSameVoiceActorPools(limit = 200): Promise<
  Array<{ criterion: 'same_voice_actor'; personId: number; tiles: GroupCandidateTile[] }>
> {
  const { rows } = await getPool().query<{
    person_mal_id: number
    character_mal_id: number
    name: string
    anime_mal_id: number
    language: string
    source: string
  }>(
    `SELECT r.person_mal_id, r.character_mal_id, c.name, r.anime_mal_id, r.language,
            COALESCE(a.source, '') AS source
     FROM voice_roles r
     JOIN characters c ON c.mal_id = r.character_mal_id
     JOIN anime a ON a.mal_id = r.anime_mal_id
     WHERE btrim(r.language) <> ''
     ORDER BY r.person_mal_id, r.character_mal_id, r.anime_mal_id, r.language
     LIMIT $1`,
    [limit * 40],
  )

  const byActor = new Map<number, GroupCandidateTile[]>()
  for (const row of rows) {
    const list = byActor.get(row.person_mal_id) ?? []
    if (row.name.trim() !== '' && !list.some((tile) => tile.id === row.character_mal_id)) {
      list.push({
        kind: 'character',
        id: row.character_mal_id,
        name: row.name,
        animeId: row.anime_mal_id,
        source: row.source,
        language: row.language,
        voiceActorId: row.person_mal_id,
      })
      byActor.set(row.person_mal_id, list)
    }
  }

  const pools: Array<{
    criterion: 'same_voice_actor'
    personId: number
    tiles: GroupCandidateTile[]
  }> = []
  for (const [personId, tiles] of [...byActor.entries()].sort((a, b) => a[0] - b[0])) {
    if (tiles.length >= 4) {
      pools.push({ criterion: 'same_voice_actor', personId, tiles })
    }
    if (pools.length >= limit) {
      break
    }
  }
  return pools
}

// The image route's three reads. Each is a single allow-listed column resolved by catalog id
// only: the client never supplies a URL, so the route can never be aimed at an arbitrary host
// (feature 002 R-001, R-007). image_url is presentation data, never an answer, and never leaks
// into a puzzle payload.

export async function fetchAnimeImageUrl(malId: number): Promise<string | null> {
  const { rows } = await getPool().query<{ image_url: string | null }>(
    `SELECT image_url FROM anime WHERE mal_id = $1`,
    [malId],
  )
  return rows[0]?.image_url ?? null
}

export async function fetchCharacterImageUrl(malId: number): Promise<string | null> {
  const { rows } = await getPool().query<{ image_url: string | null }>(
    `SELECT image_url FROM characters WHERE mal_id = $1`,
    [malId],
  )
  return rows[0]?.image_url ?? null
}

export async function fetchPersonImageUrl(malId: number): Promise<string | null> {
  const { rows } = await getPool().query<{ image_url: string | null }>(
    `SELECT image_url FROM people WHERE mal_id = $1`,
    [malId],
  )
  return rows[0]?.image_url ?? null
}

// The image route resolves its URL through this single dispatcher; the client can never name
// the table or the URL (feature 002 R-001).
export function catalogImageUrl(kind: ImageKind, malId: number): Promise<string | null> {
  switch (kind) {
    case 'anime':
      return fetchAnimeImageUrl(malId)
    case 'character':
      return fetchCharacterImageUrl(malId)
    case 'person':
      return fetchPersonImageUrl(malId)
  }
}