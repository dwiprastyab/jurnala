import { describe, expect, it } from 'vitest'
import { addDays, diffDays } from './day'
import { bestWeekday, milestones, monthStats, pct, periodMessage, periods, rangeOf, series, streakStats } from './insights'

const today = '2026-11-15' // a Sunday
const day = (d: string, done = 0, mood: number | null = 3, entry = false) => ({ day: d, mood, entry: mood !== null || entry, done, total: 4 })

describe('periodMessage', () => {
  it.each([
    [[100], 'A perfect week. Well earned.'],
    [[90, 85, 80, 80], 'Four weeks of steady effort. Be proud of that.'],
    [[60, 85, 80], 'Two good weeks in a row. The pattern is forming.'],
    [[60, 85], 'A good week. Keep it going.'],
    [[70], 'A steady week. Every bit counts.'],
    [[40], "A slow week happens. Don't lose heart. Tomorrow we build a better day."],
    [[], ''],
  ])('%j', (ps, msg) => expect(periodMessage('week', ps)).toBe(msg))
  it('uses the unit', () => expect(periodMessage('month', [100])).toBe('A perfect month. Well earned.'))
})

describe('periods and rangeOf', () => {
  it('lists sign-up month to now, newest first', () => expect(periods('2026-09-20', today)).toEqual(['2026-11', '2026-10', '2026-09']))
  it('crosses a year', () => expect(periods('2025-12-31', '2026-01-02')).toEqual(['2026-01', '2025-12']))
  it('a week range starts on a Monday and fits the 42-day API cap', () => {
    const [a, z] = rangeOf('week', '2026-11')
    expect([a, z]).toEqual(['2026-10-26', '2026-12-06'])
    expect(diffDays(z, a) + 1).toBeLessThanOrEqual(42)
  })
})

describe('series', () => {
  it('week: Monday to Sunday, live week, a week belongs to the month of its Monday', () => {
    const days = [day('2026-11-09', 4), day('2026-11-10', 2), day('2026-11-15', 4)]
    const bars = series(days, 'week', '2026-11', today, 4, '2026-11-01')
    const last = bars[bars.length - 1]
    expect(bars.map((b) => b.start)).toEqual(['2026-11-02', '2026-11-09'])
    expect([last.done, last.poss, last.p, last.live]).toEqual([10, 28, 36, true])
    expect(bars[0].live).toBe(false)
  })
  it('counts only days from sign-up', () => {
    const bars = series([], 'week', '2026-11', '2026-11-12', 4, '2026-11-11')
    expect(bars).toHaveLength(1)
    expect([bars[0].poss, bars[0].live]).toEqual([8, true])
  })
  it('day: one bar per day up to today, from sign-up', () => {
    const bars = series([day('2026-11-15', 2)], 'day', '2026-11', today, 4, '2026-11-10')
    expect(bars.map((b) => b.label)).toEqual(['10', '11', '12', '13', '14', '15'])
    expect([bars[5].p, bars[5].live]).toEqual([50, true])
  })
  it('month: skips months before sign-up and after today', () => {
    const bars = series([day('2026-10-05', 4)], 'month', '2026', today, 4, '2026-10-01')
    expect(bars.map((b) => b.label)).toEqual(['Oct', 'Nov'])
    expect(bars[0].poss).toBe(31 * 4)
    expect(bars[1].live).toBe(true)
  })
  it('nothing counts before sign-up', () => expect(series([], 'week', '2026-10', today, 4, '2026-11-12')).toEqual([]))
})

describe('bestWeekday', () => {
  const rich = Array.from({ length: 84 }, (_, i) => day(addDays(today, -i), new Date(addDays(today, -i) + 'T00:00:00Z').getUTCDay() === 3 ? 4 : 1))
  it('picks the strongest weekday', () => expect(bestWeekday(rich, today, 4, '2020-01-01')).toBe('Wednesday'))
  it('needs 28 days of data', () => expect(bestWeekday(rich, today, 4, addDays(today, -26))).toBeNull()) // 27 days
  it('works at exactly 28 days', () => expect(bestWeekday(rich, today, 4, addDays(today, -27))).not.toBeNull())
  it('null when nothing done', () => expect(bestWeekday([], today, 4, '2020-01-01')).toBeNull())
})

describe('monthStats, streakStats, milestones, pct', () => {
  it('averages mood this month only', () => {
    const r = monthStats([day('2026-11-01', 0, 5), day('2026-11-02', 0, 4), day('2026-10-31', 0, 1), day('2026-11-03', 2, null), day('2026-11-04', 0, null, true)], today)
    expect(r).toEqual({ wrote: 3, dayOfMonth: 15, avgMood: 5 }) // 4.5 rounds to 5
  })
  it('streaks take the best habit', () => {
    expect(streakStats([{ id: 1, name: 'a', last30: 0, done30: 0, span30: 30, best_streak: 9, streak: 2 }, { id: 2, name: 'b', last30: 0, done30: 0, span30: 30, best_streak: 4, streak: 3 }])).toEqual({ current: 3, best: 9 })
    expect(streakStats([])).toEqual({ current: 0, best: 0 })
  })
  it('milestones', () => {
    const m = milestones(14)
    expect(m.filter((x) => x.reached).map((x) => x.n)).toEqual([7, 14])
    expect(m.find((x) => x.n === 30)?.left).toBe(16)
  })
  it('pct handles zero', () => expect([pct(1, 3), pct(0, 0)]).toEqual([33, 0]))
})
