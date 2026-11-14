import { describe, expect, it } from 'vitest'
import { addDays } from './day'
import { bestWeekday, milestones, monthStats, pct, streakStats, weekBars, weekMessage } from './insights'

const today = '2026-11-15' // a Sunday
const day = (d: string, done = 0, mood: number | null = 3) => ({ day: d, mood, done, total: 4 })

describe('weekMessage', () => {
  it.each([
    [[100], 'A perfect week. Well earned.'],
    [[90, 85, 80, 80], 'Four weeks of steady effort. Be proud of that.'],
    [[60, 85, 80], 'Two good weeks in a row. The pattern is forming.'],
    [[60, 85], 'A good week. Keep it going.'],
    [[70], 'A steady week. Every bit counts.'],
    [[40], "A slow week happens. Don't lose heart. Tomorrow we build a better day."],
    [[], ''],
  ])('%j', (ps, msg) => expect(weekMessage(ps)).toBe(msg))
})

describe('weekBars', () => {
  it('splits Monday to Sunday and marks the week containing today live', () => {
    const days = [day('2026-11-09', 4), day('2026-11-10', 2), day('2026-11-15', 4)]
    const bars = weekBars(days, today, 4, '2026-11-01')
    const last = bars[bars.length - 1]
    expect(last.start).toBe('2026-11-09')
    expect([last.done, last.poss, last.p]).toEqual([10, 28, 36])
    expect(last.live).toBe(true) // today (the Sunday) is still in progress
    expect(bars[0].start).toBe('2026-10-26')
  })
  it('counts only days from sign-up, and the week still running is live', () => {
    const bars = weekBars([], '2026-11-12', 4, '2026-11-11')
    expect(bars).toHaveLength(1)
    expect([bars[0].poss, bars[0].live]).toEqual([8, true])
  })
  it('caps at the 84-day window', () => expect(weekBars([], today, 4, '2020-01-01').length).toBeLessThanOrEqual(13))
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
    const r = monthStats([day('2026-11-01', 0, 5), day('2026-11-02', 0, 4), day('2026-10-31', 0, 1), day('2026-11-03', 2, null)], today)
    expect(r).toEqual({ wrote: 2, dayOfMonth: 15, avgMood: 5 }) // 4.5 rounds to 5
  })
  it('streaks take the best habit', () => {
    expect(streakStats([{ id: 1, name: 'a', last30: 0, best_streak: 9, streak: 2 }, { id: 2, name: 'b', last30: 0, best_streak: 4, streak: 3 }])).toEqual({ current: 3, best: 9 })
    expect(streakStats([])).toEqual({ current: 0, best: 0 })
  })
  it('milestones', () => {
    const m = milestones(14)
    expect(m.filter((x) => x.reached).map((x) => x.n)).toEqual([7, 14])
    expect(m.find((x) => x.n === 30)?.left).toBe(16)
  })
  it('pct handles zero', () => expect([pct(1, 3), pct(0, 0)]).toEqual([33, 0]))
})
