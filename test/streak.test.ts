import { expect, it } from 'vitest'
import { addDays, bestStreak, daysBetween, streak, validDay } from '../worker/streak'

it('empty list is 0', () => expect(streak([], '2026-11-14')).toBe(0))
it('today only is 1', () => expect(streak(['2026-11-14'], '2026-11-14')).toBe(1))
it('yesterday only counts, an unticked today does not reset', () => expect(streak(['2026-11-13'], '2026-11-14')).toBe(1))
it('two days ago only is 0', () => expect(streak(['2026-11-12'], '2026-11-14')).toBe(0))
it('a gap ends the run', () => expect(streak(['2026-11-10', '2026-11-12', '2026-11-13', '2026-11-14'], '2026-11-14')).toBe(3))
it('counts across a month boundary', () => expect(streak(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'], '2026-11-02')).toBe(4))
it('counts across a year boundary', () => expect(streak(['2025-12-31', '2026-01-01'], '2026-01-01')).toBe(2))
it('counts across a leap day', () => expect(streak(['2028-02-28', '2028-02-29', '2028-03-01'], '2028-03-01')).toBe(3))
it('a non-leap February has no 29th', () => expect(streak(['2026-02-28', '2026-03-01'], '2026-03-01')).toBe(2))
it('viewing an earlier day ignores later check-ins', () => expect(streak(['2026-11-12', '2026-11-13', '2026-11-14'], '2026-11-12')).toBe(1))

it('addDays and daysBetween handle month, year, leap day and DST weeks', () => {
	expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
	expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
	expect(addDays('2026-03-08', 1)).toBe('2026-03-09') // US DST start
	expect(addDays('2026-10-25', 1)).toBe('2026-10-26') // EU DST end
	expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365)
	expect(daysBetween('2028-01-01', '2029-01-01')).toBe(366)
})

it('bestStreak finds the longest run', () => {
	expect(bestStreak([])).toBe(0)
	expect(bestStreak(['2026-11-01'])).toBe(1)
	expect(bestStreak(['2026-10-31', '2026-11-01', '2026-11-05', '2026-11-06', '2026-11-07'])).toBe(3)
})

it('validDay: format, real date, and at most tomorrow (UTC)', () => {
	const now = new Date('2026-11-14T12:00:00Z')
	for (const ok of ['2026-11-14', '2026-11-15', '2026-02-28']) expect(validDay(ok, now)).toBe(true)
	for (const bad of ['2026-11-16', '2026-02-30', '2026-13-01', '2026-1-1', '26-11-14', '', 'abc', null, 5, '0005-01-01']) expect(validDay(bad, now)).toBe(false)
})
