import { utcDateFrom } from '../../server/utils/day'

/**
 * Each DB-backed test file writes real rows for one game and day. Give every file its own
 * day so a beforeEach cleanup in one file cannot delete a row another file is asserting on.
 */
export function isolatedPuzzleDate(offsetDays: number, now: Date = new Date()): string {
  const anchor = new Date(`${utcDateFrom(now)}T00:00:00.000Z`)
  anchor.setUTCDate(anchor.getUTCDate() + offsetDays)
  return utcDateFrom(anchor)
}
