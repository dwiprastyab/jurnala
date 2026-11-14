// All date maths is on YYYY-MM-DD strings through Date.UTC, so daylight saving cannot shift a day.
export function addDays(day: string, n: number): string {
	const [y, m, d] = day.split('-').map(Number)
	return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

const utc = (day: string) => {
	const [y, m, d] = day.split('-').map(Number)
	return Date.UTC(y, m - 1, d)
}

export const daysBetween = (from: string, to: string): number => Math.round((utc(to) - utc(from)) / 86400000)

// Streak rule (PRD): consecutive check-in days counting back from the viewed day;
// an unticked viewed day starts counting from the day before.
export function streak(days: Iterable<string>, viewed: string): number {
	const set = new Set(days)
	let cur = set.has(viewed) ? viewed : addDays(viewed, -1)
	let n = 0
	while (set.has(cur)) {
		n++
		cur = addDays(cur, -1)
	}
	return n
}

// Longest run of consecutive days. `sortedDays` must be ascending and unique.
export function bestStreak(sortedDays: string[]): number {
	let best = 0
	let run = 0
	let prev = ''
	for (const d of sortedDays) {
		run = prev && addDays(prev, 1) === d ? run + 1 : 1
		if (run > best) best = run
		prev = d
	}
	return best
}

// `YYYY-MM-DD` that is a real calendar date.
export function isRealDay(day: unknown): day is string {
	if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
	const t = utc(day)
	return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === day
}

// A real date, and not later than tomorrow in UTC (absorbs time zones).
export const validDay = (day: unknown, now = new Date()): day is string => isRealDay(day) && day <= addDays(now.toISOString().slice(0, 10), 1)
