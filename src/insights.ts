import type { HistoryDay, InsightsData } from './api'
import { addDays, addMonths, daysInMonth, diffDays, longDate, MONTH_ABBR, mondayOf, monthTitle, shortDate, weekdayName, weekdayMon } from './day'

export const MIN_ENTRIES = 7
export const MILES = [7, 14, 30, 60, 100, 180, 365]
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

export type Group = 'day' | 'week' | 'month'
export type Bar = { start: string; label: string; tip: string; done: number; poss: number; p: number; live: boolean }

/** Months (YYYY-MM) shown by the period select: sign-up month to this month, newest first. */
export function periods(first: string, today: string): string[] {
  const out: string[] = []
  for (let y = +today.slice(0, 4), m = +today.slice(5, 7); `${y}-${String(m).padStart(2, '0')}` >= first.slice(0, 7); m === 1 ? (y--, m = 12) : m--) out.push(`${y}-${String(m).padStart(2, '0')}`)
  return out
}

/** The first and last day a group view needs: one month (Day, Week; a week belongs to the month of its Monday) or one year (Month). `key` is YYYY-MM, or YYYY for Month. */
export function rangeOf(g: Group, key: string): [string, string] {
  if (g === 'month') return [`${key}-01`, `${key}-12-31`]
  const a = `${key}-01`, last = addDays(`${addMonths(key, 1)}-01`, -1)
  return g === 'day' ? [a, last] : [mondayOf(a), addDays(mondayOf(last), 6)]
}

/**
 * Bars for the Habits-over-time card, oldest first. Possible check-ins = days counted * habits active now.
 * Days before sign-up and after today are not counted; a bar with no countable day is dropped.
 */
export function series(days: HistoryDay[], g: Group, key: string, today: string, habitCount: number, first: string): Bar[] {
  const by = new Map(days.map((d) => [d.day, d]))
  const span = (a: string, z: string) => {
    let done = 0, n = 0
    for (let d = diffDays(a, first) < 0 ? first : a; diffDays(d, z) <= 0 && diffDays(d, today) <= 0; d = addDays(d, 1)) { n++; done += by.get(d)?.done ?? 0 }
    return { done, poss: n * habitCount }
  }
  const out: Omit<Bar, 'p'>[] = []
  const [from, to] = rangeOf(g, key)
  if (g === 'day') for (let d = from; diffDays(d, to) <= 0 && diffDays(d, today) <= 0; d = addDays(d, 1)) {
    if (diffDays(d, first) >= 0) out.push({ ...span(d, d), start: d, label: String(+d.slice(8)), tip: longDate(d), live: d === today })
  }
  if (g === 'week') for (let ws = from; diffDays(ws, today) <= 0; ws = addDays(ws, 7)) {
    if (ws.slice(0, 7) !== key) continue
    const s7 = span(ws, addDays(ws, 6))
    if (s7.poss) out.push({ ...s7, start: ws, label: shortDate(ws), tip: `Week of ${shortDate(ws)}`, live: diffDays(today, ws) < 7 })
  }
  if (g === 'month') for (let k = 1; k <= 12; k++) {
    const m = `${key}-${String(k).padStart(2, '0')}`, s = span(`${m}-01`, `${m}-${String(daysInMonth(m)).padStart(2, '0')}`)
    if (diffDays(`${m}-01`, today) <= 0 && s.poss) out.push({ ...s, start: m, label: MONTH_ABBR[k - 1], tip: monthTitle(m), live: m === today.slice(0, 7) })
  }
  return out.map((x) => ({ ...x, p: pct(x.done, x.poss) }))
}

/** Message about the finished periods (percentages, newest last). Wording from the PRD table; `unit` is day, week or month. */
export function periodMessage(unit: Group, ps: number[]): string {
  const n = ps.length
  if (!n) return ''
  let good = 0
  while (good < n && ps[n - 1 - good] >= 80) good++
  if (ps[n - 1] === 100) return `A perfect ${unit}. Well earned.`
  if (good >= 4) return `Four ${unit}s of steady effort. Be proud of that.`
  if (good >= 2) return `Two good ${unit}s in a row. The pattern is forming.`
  if (good === 1) return `A good ${unit}. Keep it going.`
  return ps[n - 1] < 50 ? `A slow ${unit} happens. Don't lose heart. Tomorrow we build a better day.` : `A steady ${unit}. Every bit counts.`
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

/** Days written this month (any reflection, mood or not) and the average mood, 1 to 5, over days that have a mood. */
export function monthStats(days: HistoryDay[], today: string) {
  const mo = days.filter((d) => d.day.slice(0, 7) === today.slice(0, 7))
  const ms = mo.filter((d) => d.mood !== null)
  const sum = ms.reduce((s, d) => s + (d.mood as number), 0)
  return { wrote: mo.filter((d) => d.entry).length, dayOfMonth: Number(today.slice(8)), avgMood: ms.length ? Math.round(sum / ms.length) : null }
}

export const streakStats = (habits: InsightsData['habits']) => ({
  current: Math.max(0, ...habits.map((h) => h.streak)),
  best: Math.max(0, ...habits.map((h) => h.best_streak)),
})

export const milestones = (best: number) => MILES.map((n) => ({ n, reached: best >= n, left: Math.max(0, n - best) }))
