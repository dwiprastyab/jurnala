import { describe, expect, it } from 'vitest'
import { ALL_DONE, HARD_DAY, cheerForMood, cheerForTick } from './cheer'

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
})
