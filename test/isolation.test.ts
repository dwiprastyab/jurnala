import { env } from 'cloudflare:test'
import { beforeEach, expect, it } from 'vitest'
import { resetDb, signIn } from './helpers'

beforeEach(resetDb)
const j = async (r: Response) => (await r.json()) as any
const D = '2026-11-14'

// A owns nothing of interest; B owns an active habit, an archived habit, check-ins and an entry.
async function setup() {
	const a = await signIn('a@x.test', 'Alice')
	const b = await signIn('b@x.test', 'Bob')
	const active = (await j(await b.call('POST', '/api/habits', { name: 'B secret habit' }))).habit.id as number
	const other = (await j(await b.call('POST', '/api/habits', { name: 'B second' }))).habit.id as number
	const archived = (await j(await b.call('POST', '/api/habits', { name: 'B old' }))).habit.id as number
	await b.call('PUT', `/api/checkins/${active}/${D}`, { done: true })
	await b.call('PUT', `/api/checkins/${archived}/${D}`, { done: true })
	await b.call('PATCH', `/api/habits/${archived}`, { archived: true })
	await b.call('PUT', `/api/entries/${D}`, { mood: 4, went_well: 'B private reflection' })
	return { a, b, active, other, archived }
}
const snapshot = async () =>
	JSON.stringify(
		await Promise.all(
			['habits', 'checkins', 'entries'].map(async (t) => (await env.DB.prepare(`SELECT * FROM ${t} ORDER BY 1, 2`).all()).results),
		),
	)
const NOT_FOUND = { error: 'Not found.' }

it('A cannot read B through list, day, history, insights or export', async () => {
	const { a } = await setup()
	expect(await j(await a.call('GET', '/api/habits'))).toEqual({ habits: [] })
	expect(await j(await a.call('GET', '/api/habits?archived=1'))).toEqual({ habits: [] })
	const day = await j(await a.call('GET', `/api/day/${D}`))
	expect(day.habits).toEqual([])
	expect(day.entry).toBeNull()
	expect(day.yesterday_tomorrow).toBeNull()
	expect(await j(await a.call('GET', '/api/history?from=2026-11-01&to=2026-11-30'))).toEqual({ days: [] })
	const ins = await j(await a.call('GET', `/api/insights?today=${D}`))
	expect(ins).toMatchObject({ entries: 0, days: [], habits: [] })
	const csv = await (await a.call('GET', '/api/export')).text()
	expect(csv.replace(/^﻿/, '')).toBe('date,mood,went_well,hard,tomorrow\r\n')
	for (const text of [JSON.stringify(day), JSON.stringify(ins), csv]) {
		expect(text).not.toContain('B secret')
		expect(text).not.toContain('B private')
	}
})

it("A cannot use B's habit ids: PATCH (rename, archive, sort), check-ins, DELETE", async () => {
	const { a, active, archived } = await setup()
	const before = await snapshot()
	for (const body of [{ name: 'hacked' }, { archived: true }, { archived: false }, { sort: 0 }]) {
		for (const id of [active, archived]) {
			const r = await a.call('PATCH', `/api/habits/${id}`, body)
			expect(r.status).toBe(404)
			expect(await j(r)).toEqual(NOT_FOUND)
		}
	}
	for (const id of [active, archived]) {
		for (const done of [true, false]) {
			const r = await a.call('PUT', `/api/checkins/${id}/${D}`, { done })
			expect(r.status).toBe(404)
			expect(await j(r)).toEqual(NOT_FOUND)
		}
		const del = await a.call('DELETE', `/api/habits/${id}`)
		expect(del.status).toBe(404)
		expect(await j(del)).toEqual(NOT_FOUND)
	}
	expect(await snapshot()).toBe(before)
})

it("A writing an entry for a day B has an entry on does not touch B's entry", async () => {
	const { a, b } = await setup()
	const before = await snapshot()
	const r = await a.call('PUT', `/api/entries/${D}`, { mood: 1, went_well: 'A text' })
	expect(r.status).toBe(200)
	const mine = (await j(await a.call('GET', `/api/day/${D}`))).entry
	expect(mine).toMatchObject({ mood: 1, went_well: 'A text' })
	const theirs = (await j(await b.call('GET', `/api/day/${D}`))).entry
	expect(theirs).toMatchObject({ mood: 4, went_well: 'B private reflection' })
	const after = JSON.parse(await snapshot())
	expect(after[2]).toHaveLength(2)
	expect(JSON.stringify(JSON.parse(before)[2][0])).toBe(JSON.stringify(after[2].find((e: any) => e.user_id !== mine.user_id && e.went_well === 'B private reflection')))
})

it("A's habit created next to B's gets its own id space; B's list and export stay clean of A", async () => {
	const { a, b } = await setup()
	await a.call('POST', '/api/habits', { name: 'A habit' })
	await a.call('PUT', `/api/entries/2026-11-13`, { went_well: 'A only' })
	const bList = JSON.stringify(await j(await b.call('GET', '/api/habits')))
	expect(bList).not.toContain('A habit')
	const bCsv = await (await b.call('GET', '/api/export')).text()
	expect(bCsv).not.toContain('A only')
	expect(bCsv).not.toContain('A habit')
	const bDay = JSON.stringify(await j(await b.call('GET', '/api/day/2026-11-13')))
	expect(bDay).not.toContain('A only')
})

it("logout and /me only affect the caller's own session", async () => {
	const { a, b } = await setup()
	expect((await j(await a.call('GET', '/api/me'))).user.email).toBe('a@x.test')
	expect((await j(await b.call('GET', '/api/me'))).user.email).toBe('b@x.test')
	await a.call('POST', '/api/logout', {})
	expect((await a.call('GET', '/api/me')).status).toBe(401)
	expect((await b.call('GET', '/api/me')).status).toBe(200)
})

it('B can delete their own archived habit, wiping only its check-ins (control)', async () => {
	const { b, archived, active } = await setup()
	expect((await b.call('DELETE', `/api/habits/${active}`)).status).toBe(409)
	expect((await b.call('DELETE', `/api/habits/${archived}`)).status).toBe(204)
	const left = (await env.DB.prepare('SELECT habit_id FROM checkins').all()).results.map((r: any) => r.habit_id)
	expect(left).toEqual([active])
})

it('no file outside worker/db.ts calls .prepare( or .exec(', () => {
	// The test runtime has no real filesystem, so read sources through Vite.
	const files = import.meta.glob(['../worker/**/*.ts', '../scripts/**/*.ts', '../src/**/*.{ts,tsx}'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
	expect(Object.keys(files).length).toBeGreaterThan(5)
	const hits = Object.entries(files).filter(([p, src]) => !p.endsWith('worker/db.ts') && /\.(prepare|exec)\(/.test(src)).map(([p]) => p)
	expect(hits).toEqual([])
	expect(Object.keys(files).some((p) => p.endsWith('worker/db.ts'))).toBe(true)
})
