import { env } from 'cloudflare:test'
import { beforeEach, expect, it } from 'vitest'
import * as db from '../worker/db'
import { resetDb } from './helpers'

const NOW = '2026-11-14T10:00:00Z'
const user = (email: string) => ({ email, name: 'T', pw_hash: 'h', pw_salt: 's', pw_iter: 1, created_at: NOW })

beforeEach(resetDb)

it('migrations created every table and index', async () => {
	const rows = (await env.DB.prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '%migrations%' AND name NOT LIKE '_cf_%'").all<{ name: string }>()).results.map((r) => r.name)
	for (const n of ['users', 'sessions', 'login_attempts', 'habits', 'checkins', 'entries', 'idx_habits_user', 'idx_checkins_user_day']) expect(rows).toContain(n)
})

it('users: create, find, unique email', async () => {
	const id = await db.createUser(env.DB, user('a@x.test'))
	expect((await db.getUserByEmail(env.DB, 'a@x.test'))?.id).toBe(id)
	expect(await db.getUserByEmail(env.DB, 'nobody@x.test')).toBeNull()
	await expect(db.createUser(env.DB, user('a@x.test'))).rejects.toThrow()
})

it('sessions: valid, expired, deleted', async () => {
	const id = await db.createUser(env.DB, user('a@x.test'))
	await db.createSession(env.DB, 'tok', id, '2026-12-01T00:00:00Z')
	expect((await db.getSessionUser(env.DB, 'tok', NOW))?.id).toBe(id)
	expect(await db.getSessionUser(env.DB, 'tok', '2026-12-02T00:00:00Z')).toBeNull()
	await db.deleteSession(env.DB, 'tok')
	expect(await db.getSessionUser(env.DB, 'tok', NOW)).toBeNull()
})

it('login attempts count inside the window and reset after it', async () => {
	await db.recordFail(env.DB, 'a@x.test', '2026-11-14T10:00:00Z', '2026-11-14T09:45:00Z')
	await db.recordFail(env.DB, 'a@x.test', '2026-11-14T10:01:00Z', '2026-11-14T09:46:00Z')
	expect(await db.recentFails(env.DB, 'a@x.test', '2026-11-14T09:50:00Z')).toBe(2)
	await db.recordFail(env.DB, 'a@x.test', '2026-11-14T11:00:00Z', '2026-11-14T10:45:00Z')
	expect(await db.recentFails(env.DB, 'a@x.test', '2026-11-14T10:45:00Z')).toBe(1)
	await db.clearFails(env.DB, 'a@x.test')
	expect(await db.recentFails(env.DB, 'a@x.test', '2000-01-01T00:00:00Z')).toBe(0)
})

it('habits and check-ins: CRUD, ownership, delete wipes check-ins', async () => {
	const a = await db.createUser(env.DB, user('a@x.test'))
	const b = await db.createUser(env.DB, user('b@x.test'))
	const h = await db.createHabit(env.DB, a, 'Read', NOW)
	expect(await db.listHabits(env.DB, a)).toEqual([h])
	expect(await db.getHabit(env.DB, b, h.id)).toBeNull()
	await db.setCheckin(env.DB, a, h.id, '2026-11-14', true)
	await db.setCheckin(env.DB, a, h.id, '2026-11-14', true) // idempotent
	await db.setCheckin(env.DB, b, h.id, '2026-11-13', true) // not b's habit: inserts nothing
	expect(await db.hasCheckin(env.DB, a, h.id, '2026-11-14')).toBe(true)
	expect([...(await db.checkinDaysByHabit(env.DB, a, '2026-12-31')).get(h.id)!]).toEqual(['2026-11-14'])
	await db.setCheckin(env.DB, a, h.id, '2026-11-14', false)
	expect(await db.hasCheckin(env.DB, a, h.id, '2026-11-14')).toBe(false)
	await db.setCheckin(env.DB, a, h.id, '2026-11-14', true)
	await db.archiveHabit(env.DB, a, h.id, NOW)
	expect(await db.listHabits(env.DB, a)).toEqual([])
	await db.deleteHabit(env.DB, b, h.id) // not b's: no-op
	expect(await db.getHabit(env.DB, a, h.id)).not.toBeNull()
	await db.deleteHabit(env.DB, a, h.id)
	expect(await db.getHabit(env.DB, a, h.id)).toBeNull()
	expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM checkins').first<{ n: number }>())!.n).toBe(0)
})

it('habits: move, archive and restore keep sort contiguous', async () => {
	const a = await db.createUser(env.DB, user('a@x.test'))
	const [h1, h2, h3] = [await db.createHabit(env.DB, a, '1', NOW), await db.createHabit(env.DB, a, '2', NOW), await db.createHabit(env.DB, a, '3', NOW)]
	await db.moveHabit(env.DB, a, h3.id, 0)
	expect((await db.listHabits(env.DB, a)).map((h) => [h.id, h.sort])).toEqual([[h3.id, 0], [h1.id, 1], [h2.id, 2]])
	await db.archiveHabit(env.DB, a, h1.id, NOW)
	expect((await db.listHabits(env.DB, a)).map((h) => h.sort)).toEqual([0, 1])
	await db.restoreHabit(env.DB, a, h1.id)
	expect((await db.listHabits(env.DB, a)).map((h) => [h.id, h.sort])).toEqual([[h3.id, 0], [h2.id, 1], [h1.id, 2]])
})

it('entries: upsert replaces, scoped by user', async () => {
	const a = await db.createUser(env.DB, user('a@x.test'))
	const b = await db.createUser(env.DB, user('b@x.test'))
	await db.putEntry(env.DB, a, { day: '2026-11-14', mood: 4, went_well: 'x', was_hard: null, tomorrow: null }, NOW)
	await db.putEntry(env.DB, a, { day: '2026-11-14', mood: null, went_well: null, was_hard: 'y', tomorrow: null }, NOW)
	expect(await db.getEntry(env.DB, a, '2026-11-14')).toMatchObject({ mood: null, went_well: null, was_hard: 'y' })
	expect(await db.getEntry(env.DB, b, '2026-11-14')).toBeNull()
	expect(await db.countEntries(env.DB, a)).toBe(1)
})
