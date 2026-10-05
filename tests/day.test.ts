import { afterEach, describe, expect, it } from 'vitest'
import {
  getCalendarSeason,
  getNextUtcRollover,
  getUtcDateNow,
  utcDateFrom,
} from '../server/utils/day'

const originalTz = process.env.TZ

afterEach(() => {
  if (originalTz === undefined) {
    delete process.env.TZ
  } else {
    process.env.TZ = originalTz
  }
})

describe('UTC day rule', () => {
  it('derives a UTC civil date that rolls over at 00:00 UTC', () => {
    expect(utcDateFrom(new Date('2026-03-14T23:59:59.999Z'))).toBe('2026-03-14')
    expect(utcDateFrom(new Date('2026-03-15T00:00:00.000Z'))).toBe('2026-03-15')

    // A local-time date is never used: 23:30 UTC is already the next day in UTC+2.
    expect(utcDateFrom(new Date('2026-03-14T23:30:00.000Z'))).toBe('2026-03-14')

    expect(getUtcDateNow()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(getNextUtcRollover(new Date('2026-03-14T23:30:00.000Z')).toISOString()).toBe(
      '2026-03-15T00:00:00.000Z',
    )
    expect(getCalendarSeason(new Date('2026-01-15T12:00:00.000Z'))).toEqual({
      season: 'winter',
      year: 2026,
    })
    expect(getCalendarSeason(new Date('2026-10-01T00:00:00.000Z'))).toEqual({
      season: 'fall',
      year: 2026,
    })

    // The browser timezone may only format a date for display, never decide the day key
    // (Principle III). The same instant must yield the same key in every zone, including
    // one that is hours ahead and one that is hours behind UTC.
    const instant = new Date('2026-03-14T23:30:00.000Z')
    const seen: string[] = []
    for (const tz of ['UTC', 'Asia/Tokyo', 'America/New_York', 'Pacific/Kiritimati']) {
      process.env.TZ = tz
      seen.push(utcDateFrom(instant))
    }
    expect(new Set(seen)).toEqual(new Set(['2026-03-14']))
  })
})