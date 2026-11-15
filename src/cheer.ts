import type { DayData } from './api'
import { diffDays } from './day'

// Encouragement lines (PRD feature 8). Text only, never blames.
export const STREAK_MSG: Record<number, string> = {
  3: "Three days in a row. It's becoming a habit.",
  5: 'Five days straight. Keep going.',
  7: "One full week. That's real.",
  14: 'Two weeks of showing up.',
  30: 'Thirty days. This is who you are now.',
}
export const ALL_DONE = 'Every habit done. Rest well.'
export const FIRST = 'A start is the hardest part. You made it.'
export const ENDED = "The streak ended, but you didn't. Tomorrow we start again, a little wiser."
export const BACK = "Welcome back. That's the hardest step."
export const HARD_DAY = 'A hard day still counts. Be kind to yourself.'

/** Line after ticking a habit: a streak milestone wins over "every habit done". Unticking says nothing. */
export const cheerForTick = (done: boolean, streak: number, allDone: boolean, first = false) =>
  !done ? '' : first ? FIRST : STREAK_MSG[streak] ?? (allDone ? ALL_DONE : '')

/**
 * Line when Today opens, worked out from /api/day only (no stored flag): "streak ended" when a habit lost a run of 3+ yesterday,
 * "welcome back" after 2+ full days with nothing saved. Silent once anything is done today.
 */
export const cheerOnOpen = (d: Pick<DayData, 'day' | 'habits' | 'entry' | 'last_active'>) => {
  if (d.entry || d.habits.some((h) => h.done)) return ''
  if (d.habits.some((h) => h.prev_streak >= 3)) return ENDED
  return d.last_active && diffDays(d.day, d.last_active) >= 3 ? BACK : ''
}

/** Line after saving a reflection: only for Rough (1) or Low (2). */
export const cheerForMood = (mood: number | null) => (mood === 1 || mood === 2 ? HARD_DAY : '')
