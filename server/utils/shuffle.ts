export function shuffle<T>(array: readonly T[], prng: () => number): T[] {
  const result = array.slice()
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(prng() * (i + 1))
    const temp = result[i]
    result[i] = result[j]
    result[j] = temp
  }
  return result
}