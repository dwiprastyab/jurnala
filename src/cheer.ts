// Encouragement lines (PRD feature 8). Text only, never blames.
export const STREAK_MSG: Record<number, string> = {
  3: "Three days in a row. It's becoming a habit.",
  5: 'Five days straight. Keep going.',
  7: "One full week. That's real.",
  14: 'Two weeks of showing up.',
  30: 'Thirty days. This is who you are now.',
}
export const ALL_DONE = 'Every habit done. Rest well.'
export const HARD_DAY = 'A hard day still counts. Be kind to yourself.'

/** Line after ticking a habit: a streak milestone wins over "every habit done". Unticking says nothing. */
export const cheerForTick = (done: boolean, streak: number, allDone: boolean) =>
  !done ? '' : STREAK_MSG[streak] ?? (allDone ? ALL_DONE : '')

/** Line after saving a reflection: only for Rough (1) or Low (2). */
export const cheerForMood = (mood: number | null) => (mood === 1 || mood === 2 ? HARD_DAY : '')
