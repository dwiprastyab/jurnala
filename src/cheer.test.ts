import { describe, expect, it } from 'vitest'
import { ALL_DONE, BACK, ENDED, FIRST, HARD_DAY, cheerForMood, cheerForTick, cheerOnOpen } from './cheer'

describe('cheer', () => {
  it('says nothing when unticking', () => expect(cheerForTick(false, 3, true)).toBe(''))
  it('uses the milestone table', () => {
    expect(cheerForTick(true, 3, false)).toBe("Three days in a row. It's becoming a habit.")
    expect(cheerForTick(true, 30, false)).toBe('Thirty days. This is who you are now.')
  })
  it('milestone beats all-done', () => expect(cheerForTick(true, 7, true)).toBe("One full week. That's real."))
  it('all done when no milestone', () => expect(cheerForTick(true, 4, true)).toBe(ALL_DONE))
  it('nothing for an ordinary tick', () => expect(cheerForTick(true, 4, false)).toBe(''))
  it('hard day only for Rough and Low', () => {
    expect([1, 2].map(cheerForMood)).toEqual([HARD_DAY, HARD_DAY])
    expect([3, 4, 5, null].map(cheerForMood)).toEqual(['', '', '', ''])
  })
  it('first check-in ever beats everything on a tick', () => expect(cheerForTick(true, 1, true, true)).toBe(FIRST))
  describe('on open', () => {
    const h = (o = {}) => ({ id: 1, name: 'A', done: false, streak: 0, prev_streak: 0, ...o })
    const d = (o = {}) => ({ day: '2026-11-14', habits: [h()], entry: null, last_active: '2026-11-13', ...o })
    it('says nothing on a normal day', () => expect(cheerOnOpen(d())).toBe(''))
    it('streak ended: a habit lost a run of 3 or more', () => expect(cheerOnOpen(d({ habits: [h({ prev_streak: 3 })] }))).toBe(ENDED))
    it('streak ended needs 3 or more', () => expect(cheerOnOpen(d({ habits: [h({ prev_streak: 2 })] }))).toBe(''))
    it('welcome back after 2 full days away', () => expect(cheerOnOpen(d({ last_active: '2026-11-11' }))).toBe(BACK))
    it('one day away is not enough', () => expect(cheerOnOpen(d({ last_active: '2026-11-12' }))).toBe(''))
    it('a brand-new user (never active) gets nothing', () => expect(cheerOnOpen(d({ last_active: null }))).toBe(''))
    it('silent once something is done today', () => expect(cheerOnOpen(d({ last_active: '2026-11-01', habits: [h({ done: true })] }))).toBe(''))
  })
})
