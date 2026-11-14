import type { HistoryDay, InsightsData } from './api'
import { addDays, diffDays, mondayOf, weekdayName, weekdayMon } from './day'

export const MIN_ENTRIES = 7
export const MILES = [7, 14, 30, 60, 100, 180, 365]
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

export type Bar = { start: string; label: string; done: number; poss: number; p: number; live: boolean }

/**
 * Weekly bars, Monday to Sunday, oldest first, only weeks that overlap the data window.
 * Possible check-ins = days counted * habits active now. shortcut: the API gives 84 days, so at most 13 bars, not "every week since sign-up".
 */
export function weekBars(days: HistoryDay[], today: string, habitCount: number, first: string): Bar[] {
  const from = diffDays(first, addDays(today, -83)) > 0 ? first : addDays(today, -83)
  const by = new Map(days.map((d) => [d.day, d]))
  const out: Bar[] = []
  for (let ws = mondayOf(from); diffDays(ws, today) <= 0; ws = addDays(ws, 7)) {
    let done = 0, n = 0
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i)
      if (diffDays(d, from) < 0 || diffDays(d, today) > 0) continue
      n++; done += by.get(d)?.done ?? 0
    }
    if (n) out.push({ start: ws, label: ws, done, poss: n * habitCount, p: pct(done, n * habitCount), live: diffDays(addDays(ws, 6), today) >= 0 })
  }
  return out
}

/** Message about the last finished weeks (percentages, newest last). Wording from the PRD table. */
export function weekMessage(ps: number[]): string {
  const n = ps.length
  if (!n) return ''
  let good = 0
  while (good < n && ps[n - 1 - good] >= 80) good++
  if (ps[n - 1] === 100) return 'A perfect week. Well earned.'
  if (good >= 4) return 'Four weeks of steady effort. Be proud of that.'
  if (good >= 2) return 'Two good weeks in a row. The pattern is forming.'
  if (good === 1) return 'A good week. Keep it going.'
  return ps[n - 1] < 50 ? "A slow week happens. Don't lose heart. Tomorrow we build a better day." : 'A steady week. Every bit counts.'
}

/** Weekday with the highest share of habits done, or null with under 28 days of data (or nothing done). */
export function bestWeekday(days: HistoryDay[], today: string, habitCount: number, first: string): string | null {
  const from = diffDays(first, addDays(today, -83)) > 0 ? first : addDays(today, -83)
  if (diffDays(today, from) + 1 < 28 || !habitCount) return null
  const done = Array(7).fill(0), seen = Array(7).fill(0)
  for (let d = from; diffDays(d, today) <= 0; d = addDays(d, 1)) seen[weekdayMon(d)]++
  for (const x of days) if (diffDays(x.day, from) >= 0) done[weekdayMon(x.day)] += x.done
  let best = -1, top = 0
  for (let i = 0; i < 7; i++) {
    const r = seen[i] ? done[i] / (seen[i] * habitCount) : 0
    if (r > top) { top = r; best = i }
  }
  return best < 0 ? null : weekdayName(addDays(mondayOf(today), best))
}

/** Days written this month (a day with a mood) and the average mood, 1 to 5. shortcut: a reflection with texts but no mood is not counted, the API does not say. */
export function monthStats(days: HistoryDay[], today: string) {
  const ms = days.filter((d) => d.day.slice(0, 7) === today.slice(0, 7) && d.mood !== null)
  const sum = ms.reduce((s, d) => s + (d.mood as number), 0)
  return { wrote: ms.length, dayOfMonth: Number(today.slice(8)), avgMood: ms.length ? Math.round(sum / ms.length) : null }
}

export const streakStats = (habits: InsightsData['habits']) => ({
  current: Math.max(0, ...habits.map((h) => h.streak)),
  best: Math.max(0, ...habits.map((h) => h.best_streak)),
})

export const milestones = (best: number) => MILES.map((n) => ({ n, reached: best >= n, left: Math.max(0, n - best) }))
