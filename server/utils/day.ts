const UTC_TZ = 'UTC' as const

export type PuzzleDate = string // YYYY-MM-DD

export function utcDateFrom(date: Date): PuzzleDate {
  return date.toISOString().slice(0, 10)
}

export function getUtcDateNow(): PuzzleDate {
  return utcDateFrom(new Date())
}

export type CalendarSeason = 'winter' | 'spring' | 'summer' | 'fall'

export interface CalendarSeasonInfo {
  season: CalendarSeason
  year: number
}

export function getCalendarSeason(date = new Date()): CalendarSeasonInfo {
  const utc = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  )
  const month = utc.getUTCMonth()
  const year = utc.getUTCFullYear()

  if (month <= 2) {
    return { season: 'winter', year }
  }
  if (month <= 5) {
    return { season: 'spring', year }
  }
  if (month <= 8) {
    return { season: 'summer', year }
  }
  return { season: 'fall', year }
}

export function seasonLabel(season: CalendarSeason): string {
  switch (season) {
    case 'winter':
      return 'winter'
    case 'spring':
      return 'spring'
    case 'summer':
      return 'summer'
    case 'fall':
      return 'fall'
    default:
      return 'winter'
  }
}

export function getNextUtcRollover(date = new Date()): Date {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = date.getUTCDate()
  const next = new Date(Date.UTC(year, month, day + 1, 0, 0, 0, 0))
  return next
}