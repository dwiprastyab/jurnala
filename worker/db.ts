// All SQL lives in this file. Every function that touches journal data takes `userId` and filters by it.
// Exceptions (they run before a user is known): createUser, getUserByEmail, getSessionUser, login-attempt helpers.

export interface User {
	id: number
	email: string
	name: string
	created_at: string
}
export interface UserWithHash extends User {
	pw_hash: string
	pw_salt: string
	pw_iter: number
}
export interface Habit {
	id: number
	name: string
	sort: number
}
export interface Entry {
	day: string
	mood: number | null
	went_well: string | null
	was_hard: string | null
	tomorrow: string | null
	updated_at: string
}

// ---- users ----

export async function createUser(db: D1Database, u: Omit<UserWithHash, 'id'>): Promise<number> {
	const r = await db
		.prepare('INSERT INTO users (email, name, pw_hash, pw_salt, pw_iter, created_at) VALUES (?, ?, ?, ?, ?, ?)')
		.bind(u.email, u.name, u.pw_hash, u.pw_salt, u.pw_iter, u.created_at)
		.run()
	return r.meta.last_row_id
}

export const getUserByEmail = (db: D1Database, email: string) =>
	db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserWithHash>()

export const getUser = (db: D1Database, userId: number) =>
	db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').bind(userId).first<User>()

// ---- sessions ----

export async function createSession(db: D1Database, tokenHash: string, userId: number, expiresAt: string) {
	await db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(tokenHash, userId, expiresAt).run()
}

// Looks up by token hash (the secret itself), returns the user if the session has not expired.
export const getSessionUser = (db: D1Database, tokenHash: string, now: string) =>
	db
		.prepare(
			'SELECT u.id, u.email, u.name, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?',
		)
		.bind(tokenHash, now)
		.first<User>()

export async function deleteSession(db: D1Database, tokenHash: string) {
	await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run()
}

export async function purgeExpiredSessions(db: D1Database, now: string) {
	await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now).run()
}

// ---- login attempts ----

// Failures counted inside the window that starts at `since` (ISO); 0 when none or the window is stale.
export async function recentFails(db: D1Database, email: string, since: string): Promise<number> {
	const r = await db.prepare('SELECT fails FROM login_attempts WHERE email = ? AND window_start >= ?').bind(email, since).first<{ fails: number }>()
	return r?.fails ?? 0
}

export async function recordFail(db: D1Database, email: string, now: string, since: string) {
	await db
		.prepare(
			`INSERT INTO login_attempts (email, fails, window_start) VALUES (?1, 1, ?2)
			 ON CONFLICT(email) DO UPDATE SET
			   fails = CASE WHEN window_start < ?3 THEN 1 ELSE fails + 1 END,
			   window_start = CASE WHEN window_start < ?3 THEN ?2 ELSE window_start END`,
		)
		.bind(email, now, since)
		.run()
}

export async function clearFails(db: D1Database, email: string) {
	await db.prepare('DELETE FROM login_attempts WHERE email = ?').bind(email).run()
}

// ---- habits ----

const HABIT_COLS = 'id, name, sort'

export const listHabits = async (db: D1Database, userId: number, archived = false) =>
	(
		await db
			.prepare(`SELECT ${HABIT_COLS} FROM habits WHERE user_id = ? AND archived_at IS ${archived ? 'NOT ' : ''}NULL ORDER BY ${archived ? 'archived_at DESC, id DESC' : 'sort, id'}`)
			.bind(userId)
			.all<Habit>()
	).results

export const getHabit = (db: D1Database, userId: number, id: number) =>
	db.prepare(`SELECT ${HABIT_COLS}, archived_at FROM habits WHERE id = ? AND user_id = ?`).bind(id, userId).first<Habit & { archived_at: string | null }>()

export async function countActiveHabits(db: D1Database, userId: number): Promise<number> {
	const r = await db.prepare('SELECT COUNT(*) AS n FROM habits WHERE user_id = ? AND archived_at IS NULL').bind(userId).first<{ n: number }>()
	return r?.n ?? 0
}

export async function createHabit(db: D1Database, userId: number, name: string, now: string): Promise<Habit> {
	const sort = await countActiveHabits(db, userId)
	const r = await db.prepare('INSERT INTO habits (user_id, name, sort, created_at) VALUES (?, ?, ?, ?)').bind(userId, name, sort, now).run()
	return { id: r.meta.last_row_id, name, sort }
}

export async function renameHabit(db: D1Database, userId: number, id: number, name: string) {
	await db.prepare('UPDATE habits SET name = ? WHERE id = ? AND user_id = ?').bind(name, id, userId).run()
}

// Rewrites `sort` as 0..n-1 following `ids` (active habits of this user, in the wanted order).
async function writeOrder(db: D1Database, userId: number, ids: number[]) {
	if (ids.length) await db.batch(ids.map((id, i) => db.prepare('UPDATE habits SET sort = ? WHERE id = ? AND user_id = ? AND archived_at IS NULL').bind(i, id, userId)))
}

const activeIds = async (db: D1Database, userId: number) => (await listHabits(db, userId)).map((h) => h.id)

// Moves an active habit to a 0-based position among active habits (clamped); others are renumbered.
export async function moveHabit(db: D1Database, userId: number, id: number, position: number) {
	const ids = (await activeIds(db, userId)).filter((x) => x !== id)
	ids.splice(Math.max(0, Math.min(position, ids.length)), 0, id)
	await writeOrder(db, userId, ids)
}

export async function archiveHabit(db: D1Database, userId: number, id: number, now: string) {
	await db.prepare('UPDATE habits SET archived_at = ? WHERE id = ? AND user_id = ? AND archived_at IS NULL').bind(now, id, userId).run()
	await writeOrder(db, userId, await activeIds(db, userId))
}

// Restores to the end of the active list.
export async function restoreHabit(db: D1Database, userId: number, id: number) {
	const n = await countActiveHabits(db, userId)
	await db.prepare('UPDATE habits SET archived_at = NULL, sort = ? WHERE id = ? AND user_id = ? AND archived_at IS NOT NULL').bind(n, id, userId).run()
}

// Caller has checked the habit is archived and the caller's. Wipes its check-ins.
export async function deleteHabit(db: D1Database, userId: number, id: number) {
	await db.batch([
		db.prepare('DELETE FROM checkins WHERE habit_id = ? AND user_id = ?').bind(id, userId),
		db.prepare('DELETE FROM habits WHERE id = ? AND user_id = ? AND archived_at IS NOT NULL').bind(id, userId),
	])
}

// ---- check-ins ----

// One row = done. The INSERT selects from habits, so a habit that is not the user's inserts nothing.
export async function setCheckin(db: D1Database, userId: number, habitId: number, day: string, done: boolean) {
	await db
		.prepare(
			done
				? 'INSERT OR IGNORE INTO checkins (habit_id, user_id, day) SELECT id, user_id, ?3 FROM habits WHERE id = ?1 AND user_id = ?2'
				: 'DELETE FROM checkins WHERE habit_id = ?1 AND user_id = ?2 AND day = ?3',
		)
		.bind(habitId, userId, day)
		.run()
}

export const hasCheckin = async (db: D1Database, userId: number, habitId: number, day: string) =>
	(await db.prepare('SELECT 1 AS x FROM checkins WHERE habit_id = ? AND user_id = ? AND day = ?').bind(habitId, userId, day).first()) !== null

// shortcut: reads every check-in up to `day` (one user, ~13k rows after 3 years); cap the scan if CPU time becomes a problem.
export async function checkinDaysByHabit(db: D1Database, userId: number, upToDay: string): Promise<Map<number, string[]>> {
	const rows = (await db.prepare('SELECT habit_id, day FROM checkins WHERE user_id = ? AND day <= ? ORDER BY habit_id, day').bind(userId, upToDay).all<{ habit_id: number; day: string }>()).results
	const m = new Map<number, string[]>()
	for (const r of rows) (m.get(r.habit_id) ?? m.set(r.habit_id, []).get(r.habit_id)!).push(r.day)
	return m
}

export const doneOnDay = async (db: D1Database, userId: number, day: string): Promise<Set<number>> =>
	new Set((await db.prepare('SELECT habit_id FROM checkins WHERE user_id = ? AND day = ?').bind(userId, day).all<{ habit_id: number }>()).results.map((r) => r.habit_id))

// ---- entries ----

const ENTRY_COLS = 'day, mood, went_well, was_hard, tomorrow, updated_at'

export const getEntry = (db: D1Database, userId: number, day: string) =>
	db.prepare(`SELECT ${ENTRY_COLS} FROM entries WHERE user_id = ? AND day = ?`).bind(userId, day).first<Entry>()

export async function putEntry(db: D1Database, userId: number, e: Omit<Entry, 'updated_at'>, now: string): Promise<Entry> {
	await db
		.prepare(
			`INSERT INTO entries (user_id, day, mood, went_well, was_hard, tomorrow, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(user_id, day) DO UPDATE SET mood = excluded.mood, went_well = excluded.went_well,
			   was_hard = excluded.was_hard, tomorrow = excluded.tomorrow, updated_at = excluded.updated_at`,
		)
		.bind(userId, e.day, e.mood, e.went_well, e.was_hard, e.tomorrow, now)
		.run()
	return { ...e, updated_at: now }
}

export async function countEntries(db: D1Database, userId: number): Promise<number> {
	const r = await db.prepare('SELECT COUNT(*) AS n FROM entries WHERE user_id = ?').bind(userId).first<{ n: number }>()
	return r?.n ?? 0
}
