export type EntityImageKind = 'anime' | 'character' | 'person'

// Tile keys carry the entity identity in every generator payload (feature 002 R-009): the first
// field is the kind prefix, the second the MAL id. In Groups the key is `clueId@seriesId` —
// the value before the '@' is the entity whose face the tile shows.
const KIND_PREFIX: Record<string, EntityImageKind> = {
  a: 'anime',
  c: 'character',
  p: 'person',
}

export function entityImageId(
  kind: EntityImageKind,
  key: string | null | undefined,
): number | null {
  if (!key) return null
  const bare = key.split('@')[0]
  const [prefix, idRaw] = bare.split(':')
  if (!prefix || !idRaw) return null
  if (KIND_PREFIX[prefix] !== kind) return null
  const id = Number(idRaw)
  if (!Number.isInteger(id) || id < 1) return null
  return id
}

// The client can only build a first-party path; an unparseable id renders the placeholder
// instead of ever reaching the network (feature 002 R-008).
export function imagePath(
  kind: EntityImageKind,
  id: number | null | undefined,
): string | null {
  if (id === null || id === undefined) return null
  if (!Number.isInteger(id) || id < 1) return null
  return `/api/images/${kind}/${id}`
}