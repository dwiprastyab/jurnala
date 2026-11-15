import { env } from 'cloudflare:test'
import { beforeEach, expect, it } from 'vitest'
import * as db from '../worker/db'
import { resetDb, signIn } from './helpers'

beforeEach(resetDb)
type Client = Awaited<ReturnType<typeof signIn>>['call']
const j = async (r: Response) => (await r.json()) as any
const mkHabit = async (call: Client, name: string) => (await j(await call('POST', '/api/habits', { name }))).habit.id as number
const entry = (call: Client, day: string, body: object) => call('PUT', `/api/entries/${day}`, body)

it('PUT entry: saves, trims, nulls empties, replaces whole entry', async () => {
	const { call } = await signIn('a@x.test')
	const r = await entry(call, '2026-11-14', { mood: 4, went_well: '  Shipped  ', was_hard: '', tomorrow: null })
	expect(r.status).toBe(200)
	const e = (await j(r)).entry
	expect(e).toMatchObject({ day: '2026-11-14', mood: 4, went_well: 'Shipped', was_hard: null, tomorrow: null })
	expect(e.updated_at).toMatch(/^\d{4}-\d\d-\d\dT/)
	const e2 = (await j(await entry(call, '2026-11-14', { tomorrow: 'Rest' }))).entry
	expect(e2).toMatchObject({ mood: null, went_well: null, tomorrow: 'Rest' })
})

it('PUT entry validation: empty, mood 6/0/1.5/"3", 4001 chars, bad day, wrong types', async () => {
	const { call } = await signIn('a@x.test')
	const empty = await entry(call, '2026-11-14', { mood: null, went_well: '  ', was_hard: '' })
	expect(empty.status).toBe(400)
	expect(await j(empty)).toEqual({ error: 'Add at least one answer.' })
	for (const mood of [6, 0, 1.5, '3']) {
		const r = await entry(call, '2026-11-14', { mood, went_well: 'x' })
		expect(r.status).toBe(400)
		expect(await j(r)).toEqual({ error: 'Pick a mood from 1 to 5.' })
	}
	const long = await entry(call, '2026-11-14', { went_well: 'x'.repeat(4001) })
	expect(long.status).toBe(400)
	expect(await j(long)).toEqual({ error: 'Keep each answer under 4,000 characters.' })
	expect((await entry(call, '2026-11-14', { went_well: 'x'.repeat(4000) })).status).toBe(200)
	const bad = await entry(call, '2026-02-30', { mood: 3 })
	expect(bad.status).toBe(400)
	expect(await j(bad)).toEqual({ error: "That date isn't valid." })
	expect((await entry(call, '2999-01-01', { mood: 3 })).status).toBe(400)
	expect((await entry(call, '2026-11-14', { went_well: 5 })).status).toBe(400)
	expect(await db.countEntries(env.DB, (await db.getUserByEmail(env.DB, 'a@x.test'))!.id)).toBe(1)
})

it('GET day: habits with done and streak, entry, yesterday_tomorrow', async () => {
	const { call } = await signIn('a@x.test')
	const read = await mkHabit(call, 'Read')
	const walk = await mkHabit(call, 'Walk')
	for (const d of ['2026-11-12', '2026-11-13', '2026-11-14']) await call('PUT', `/api/checkins/${read}/${d}`, { done: true })
	await entry(call, '2026-11-13', { tomorrow: 'Call Mom' })
	await entry(call, '2026-11-14', { mood: 5, went_well: 'ok' })
	const d = await j(await call('GET', '/api/day/2026-11-14'))
	expect(d).toMatchObject({
		day: '2026-11-14',
		habits: [
			{ id: read, name: 'Read', done: true, streak: 3 },
			{ id: walk, name: 'Walk', done: false, streak: 0 },
		],
		yesterday_tomorrow: 'Call Mom',
	})
	expect(d.entry).toMatchObject({ day: '2026-11-14', mood: 5, went_well: 'ok' })
	const empty = await j(await call('GET', '/api/day/2026-11-10'))
	expect(empty.entry).toBeNull()
	expect(empty.yesterday_tomorrow).toBeNull()
	expect((await call('GET', '/api/day/nope')).status).toBe(400)
})

it('GET history: shape, omits empty days, mood null without entry, total is active habits', async () => {
	const { call } = await signIn('a@x.test')
	const a = await mkHabit(call, 'A')
	const b = await mkHabit(call, 'B')
	await call('PUT', `/api/checkins/${a}/2026-11-13`, { done: true })
	await call('PUT', `/api/checkins/${b}/2026-11-13`, { done: true })
	await entry(call, '2026-11-13', { mood: 4 })
	await call('PUT', `/api/checkins/${a}/2026-11-14`, { done: true })
	await entry(call, '2026-11-10', { went_well: 'x' })
	const h = await j(await call('GET', '/api/history?from=2026-11-01&to=2026-11-30'))
	expect(h).toEqual({
		days: [
			{ day: '2026-11-10', mood: null, entry: true, done: 0, total: 2 },
			{ day: '2026-11-13', mood: 4, entry: true, done: 2, total: 2 },
			{ day: '2026-11-14', mood: null, entry: false, done: 1, total: 2 },
		],
	})
})

it('GET history validation: 42 days ok, 43 days, from>to, bad dates', async () => {
	const { call } = await signIn('a@x.test')
	expect((await call('GET', '/api/history?from=2026-10-01&to=2026-11-11')).status).toBe(200) // 42 days
	const long = await call('GET', '/api/history?from=2026-10-01&to=2026-11-12') // 43 days
	expect(long.status).toBe(400)
	expect(await j(long)).toEqual({ error: 'Pick a range of up to 6 weeks.' })
	expect((await call('GET', '/api/history?from=2026-11-05&to=2026-11-01')).status).toBe(400)
	expect(await j(await call('GET', '/api/history?from=x&to=2026-11-01'))).toEqual({ error: "That date isn't valid." })
	expect((await call('GET', '/api/history')).status).toBe(400)
})

it('GET insights: entries count, 84-day window, per-habit last30, best streak, streak', async () => {
	const { call, userId } = await signIn('a@x.test')
	const a = await mkHabit(call, 'A')
	// habit was created now (UTC), so only days from its creation day count; make it old to test the 30-day window
	await env.DB.prepare("UPDATE habits SET created_at = '2026-01-01T00:00:00Z' WHERE user_id = ?").bind(userId).run()
	for (const d of ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-11-13', '2026-11-14']) await call('PUT', `/api/checkins/${a}/${d}`, { done: true })
	await entry(call, '2026-11-14', { mood: 3 })
	const r = await j(await call('GET', '/api/insights?today=2026-11-14'))
	expect(r.entries).toBe(1)
	expect(r.days.map((d: any) => d.day)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-11-13', '2026-11-14'])
	expect(r.habits).toEqual([{ id: a, name: 'A', last30: 7, done30: 2, span30: 30, best_streak: 4, streak: 2 }]) // Oct 16..Nov 14 holds only the 2 November days: 2/30 -> 7
	expect((await call('GET', '/api/insights')).status).toBe(400)
})

it('insights last30 only counts days since the habit was created', async () => {
	const { call } = await signIn('a@x.test')
	const a = await mkHabit(call, 'A')
	await env.DB.prepare("UPDATE habits SET created_at = '2026-11-11T08:00:00Z'").run()
	for (const d of ['2026-11-11', '2026-11-12']) await call('PUT', `/api/checkins/${a}/${d}`, { done: true })
	const r = await j(await call('GET', '/api/insights?today=2026-11-14'))
	expect(r.habits[0].last30).toBe(50) // 2 of the 4 days Nov 11..14
})

// Minimal RFC 4180 parser so the tests check real cell values.
function parseCsv(text: string): string[][] {
	const rows: string[][] = []
	let row: string[] = []
	let cell = ''
	let q = false
	for (let i = 0; i < text.length; i++) {
		const ch = text[i]
		if (q) {
			if (ch === '"' && text[i + 1] === '"') (cell += '"'), i++
			else if (ch === '"') q = false
			else cell += ch
		} else if (ch === '"') q = true
		else if (ch === ',') (row.push(cell), (cell = ''))
		else if (ch === '\r' && text[i + 1] === '\n') (row.push(cell), rows.push(row), (row = []), (cell = ''), i++)
		else cell += ch
	}
	return rows
}

it('export: headers, BOM, 1/0 habit columns incl. archived, row count == entries count', async () => {
	const { call } = await signIn('a@x.test')
	const read = await mkHabit(call, 'Read')
	const walk = await mkHabit(call, 'Walk')
	await call('PUT', `/api/checkins/${read}/2026-11-14`, { done: true })
	await call('PUT', `/api/checkins/${walk}/2026-11-13`, { done: true })
	await call('PATCH', `/api/habits/${walk}`, { archived: true })
	await entry(call, '2026-11-14', { mood: 4, went_well: 'Shipped, finally', tomorrow: 'Rest' })
	await entry(call, '2026-11-13', { was_hard: 'x' })
	await call('PUT', `/api/checkins/${read}/2026-11-12`, { done: true }) // check-in without reflection: not exported
	const res = await call('GET', '/api/export')
	expect(res.status).toBe(200)
	expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8')
	expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="jurnala-export-\d{4}-\d\d-\d\d\.csv"$/)
	const bytes = new Uint8Array(await res.arrayBuffer())
	expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
	const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes).slice(1)
	expect(text).toContain('2026-11-14,4,"Shipped, finally",,Rest,1,0\r\n')
	const rows = parseCsv(text)
	expect(rows[0]).toEqual(['date', 'mood', 'went_well', 'hard', 'tomorrow', 'Read', 'Walk'])
	expect(rows[1]).toEqual(['2026-11-13', '', '', 'x', '', '0', '1'])
	const entries = (await j(await call('GET', '/api/insights?today=2026-11-14'))).entries
	expect(rows.length - 1).toBe(entries)
	expect(rows.length - 1).toBe(2)
	for (const forbidden of ['pw_hash', 'pw_salt', 'token', 'session']) expect(text).not.toContain(forbidden)
})

it('export: comma, quote, newline and leading = + - @ cells', async () => {
	const { call } = await signIn('a@x.test')
	await entry(call, '2026-11-14', { went_well: 'a, b', was_hard: 'say "hi"', tomorrow: 'line1\nline2' })
	await entry(call, '2026-11-13', { went_well: '=SUM(A1)', was_hard: '+1', tomorrow: '@cmd' })
	await entry(call, '2026-11-12', { went_well: '-2', was_hard: 'fine - really' })
	await mkHabit(call, '=EVIL')
	const text = (await (await call('GET', '/api/export')).text()).replace(/^﻿/, '')
	expect(text).toContain('"a, b"')
	expect(text).toContain('"say ""hi"""')
	expect(text).toContain('"line1\nline2"')
	const rows = parseCsv(text)
	expect(rows[0][5]).toBe("'=EVIL")
	expect(rows[1].slice(2, 5)).toEqual(["'-2", 'fine - really', ''])
	expect(rows[2].slice(2, 5)).toEqual(["'=SUM(A1)", "'+1", "'@cmd"])
	expect(rows[3].slice(2, 5)).toEqual(['a, b', 'say "hi"', 'line1\nline2'])
	expect(rows.length - 1).toBe(3)
})

it('export with no data is just the header row', async () => {
	const { call } = await signIn('a@x.test')
	const text = (await (await call('GET', '/api/export')).text()).replace(/^﻿/, '')
	expect(text).toBe('date,mood,went_well,hard,tomorrow\r\n')
})

it('GET day: last_active and prev_streak feed the welcome-back and streak-ended lines', async () => {
	const { call } = await signIn('a@x.test')
	const a = await mkHabit(call, 'A')
	expect((await j(await call('GET', '/api/day/2026-11-14'))).last_active).toBe(null)
	for (const d of ['2026-11-08', '2026-11-09', '2026-11-10']) await call('PUT', `/api/checkins/${a}/${d}`, { done: true })
	await entry(call, '2026-11-11', { went_well: 'x' })
	// today 14th: last active 11th (entry only), 2 full days away; yesterday (13th) missed, run ending the 12th is 0
	let d = await j(await call('GET', '/api/day/2026-11-14'))
	expect(d.last_active).toBe('2026-11-11')
	expect(d.habits[0]).toMatchObject({ done: false, streak: 0, prev_streak: 0 })
	// a 3-day run ending the 12th, nothing on the 13th: streak ended on the 14th
	await call('PUT', `/api/checkins/${a}/2026-11-11`, { done: true })
	await call('PUT', `/api/checkins/${a}/2026-11-12`, { done: true })
	d = await j(await call('GET', '/api/day/2026-11-14'))
	expect(d.habits[0]).toMatchObject({ streak: 0, prev_streak: 5 })
	// on the 13th itself the unticked day still holds the run: no "ended" yet
	expect((await j(await call('GET', '/api/day/2026-11-13'))).habits[0]).toMatchObject({ streak: 5, prev_streak: 0 })
})
