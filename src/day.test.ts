import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { addDays, addMonths, daysInMonth, diffDays, localDay, mondayOf, weekdayMon } from './day'

const TZ0 = process.env.TZ
afterEach(() => { process.env.TZ = TZ0 })

describe('localDay', () => {
  // Same instant, built from local clock parts in each zone.
  const cases: [string, string, string][] = [
    ['Asia/Jakarta', '2026-11-14T00:30:00', '2026-11-14'], // UTC date would be the 13th
    ['Asia/Jakarta', '2026-11-14T23:30:00', '2026-11-14'],
    ['America/Los_Angeles', '2026-11-14T00:30:00', '2026-11-14'],
    ['America/Los_Angeles', '2026-11-14T23:30:00', '2026-11-14'], // UTC date would be the 15th
  ]
  for (const [tz, local, want] of cases) {
    it(`${tz} ${local}`, () => {
      process.env.TZ = tz
      expect(localDay(new Date(local))).toBe(want)
    })
  }
  it('pads', () => {
    process.env.TZ = 'Asia/Jakarta'
    expect(localDay(new Date('2026-01-05T00:30:00'))).toBe('2026-01-05')
  })
})

describe('day maths', () => {
  it('month end, year end, leap day', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })
  it('is DST-safe in a DST zone', () => {
    process.env.TZ = 'America/Los_Angeles'
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08')
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02')
    expect(diffDays('2026-03-09', '2026-03-08')).toBe(1)
    expect(diffDays('2026-11-02', '2026-11-01')).toBe(1)
  })
  it('months and weeks', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(daysInMonth('2028-02')).toBe(29)
    expect(daysInMonth('2026-02')).toBe(28)
    expect(weekdayMon('2026-11-16')).toBe(0) // Monday
    expect(weekdayMon('2026-11-15')).toBe(6) // Sunday
    expect(mondayOf('2026-11-15')).toBe('2026-11-09')
  })
})

describe('no toISOString for days', () => {
  it('src/ never uses toISOString or toJSON outside tests', () => {
    const hits: string[] = []
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && /toISOString|toJSON\(/.test(readFileSync(p, 'utf8'))) hits.push(p)
      }
    }
    walk(join(__dirname))
    expect(hits).toEqual([])
  })
})
