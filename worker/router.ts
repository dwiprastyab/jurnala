import { clearedCookie, iterationsFor, newToken, readSessionToken, SESSION_SECONDS, sessionCookie, sha256Hex, verifyPassword } from './auth.ts'
import * as db from './db.ts'
import { addDays, bestStreak, daysBetween, isRealDay, streak, validDay } from './streak.ts'

const MAX_HABITS = 12
const MAX_FAILS = 5
const WINDOW_MS = 15 * 60 * 1000

const json = (body: unknown, status = 200, headers?: HeadersInit) => Response.json(body, { status, headers })
const fail = (status: number, error: string) => json({ error }, status)
const NOT_FOUND = () => fail(404, 'Not found.')
const INVALID = () => fail(400, "That isn't valid.")
const BAD_DAY = () => fail(400, "That date isn't valid.")
const LIMIT = () => fail(409, `You have ${MAX_HABITS} habits. Archive one to add another.`)
const NAME_ERR = () => fail(400, 'Give the habit a name (up to 60 characters).')
const pick = (h: db.Habit): db.Habit => ({ id: h.id, name: h.name, sort: h.sort })
const noContent = (headers?: HeadersInit) => new Response(null, { status: 204, headers })

interface Ctx {
	req: Request
	env: Env
	url: URL
	user: db.User
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
	try {
		const b = await req.json()
		return b && typeof b === 'object' && !Array.isArray(b) ? (b as Record<string, unknown>) : null
	} catch {
		return null
	}
}

// Dummy hash so an unknown email costs about the same as a wrong password.
const DUMMY = { pw_hash: 'AAAA', pw_salt: 'AAAAAAAAAAAAAAAAAAAAAA==', pw_iter: 0 }

async function login(req: Request, env: Env): Promise<Response> {
	const body = await readBody(req)
	if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') return INVALID()
	const email = body.email.trim().toLowerCase()
	const now = new Date()
	const since = new Date(now.getTime() - WINDOW_MS).toISOString()
	if ((await db.recentFails(env.DB, email, since)) >= MAX_FAILS) return fail(429, 'Too many attempts. Try again in 15 minutes.')
	const u = await db.getUserByEmail(env.DB, email)
	const ok = u ? await verifyPassword(body.password, u) : (await verifyPassword(body.password, { ...DUMMY, pw_iter: iterationsFor(env) }), false)
	if (!u || !ok) {
		await db.recordFail(env.DB, email, now.toISOString(), since)
		return fail(401, "That email or password isn't right.")
	}
	await db.clearFails(env.DB, email)
	const token = newToken()
	await db.createSession(env.DB, await sha256Hex(token), u.id, new Date(now.getTime() + SESSION_SECONDS * 1000).toISOString())
	return json({ user: { name: u.name, email: u.email } }, 200, { 'Set-Cookie': sessionCookie(token) })
}

async function logout(req: Request, env: Env): Promise<Response> {
	const token = readSessionToken(req)
	if (token) await db.deleteSession(env.DB, await sha256Hex(token))
	return noContent({ 'Set-Cookie': clearedCookie })
}

// A trimmed habit name of 1-60 characters, or null.
const cleanName = (v: unknown) => (typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= 60 ? v.trim() : null)

async function habits(c: Ctx, seg: string[]): Promise<Response> {
	const { req, env, user } = c
	if (seg.length === 1 && req.method === 'GET') return json({ habits: await db.listHabits(env.DB, user.id, c.url.searchParams.get('archived') === '1') })
	if (seg.length === 1 && req.method === 'POST') {
		const body = await readBody(req)
		const name = cleanName(body?.name)
		if (!name) return NAME_ERR()
		if ((await db.countActiveHabits(env.DB, user.id)) >= MAX_HABITS) return LIMIT()
		return json({ habit: await db.createHabit(env.DB, user.id, name, new Date().toISOString()) }, 201)
	}
	const id = seg.length === 2 && /^\d+$/.test(seg[1]) ? Number(seg[1]) : null
	if (id === null) return NOT_FOUND()
	const habit = await db.getHabit(env.DB, user.id, id)
	if (!habit) return NOT_FOUND()
	const archived = habit.archived_at !== null

	if (req.method === 'DELETE') {
		if (!archived) return fail(409, 'Archive this habit first.')
		await db.deleteHabit(env.DB, user.id, id)
		return noContent()
	}
	if (req.method === 'PATCH') {
		const b = await readBody(req)
		if (!b) return INVALID()
		let name: string | null = null
		if (b.name !== undefined) {
			name = cleanName(b.name)
			if (!name) return NAME_ERR()
		}
		if (b.archived !== undefined && typeof b.archived !== 'boolean') return INVALID()
		if (b.sort !== undefined && !(Number.isInteger(b.sort) && (b.sort as number) >= 0)) return INVALID()
		if (b.archived === false && archived && (await db.countActiveHabits(env.DB, user.id)) >= MAX_HABITS) return LIMIT()

		if (name) await db.renameHabit(env.DB, user.id, id, name)
		if (b.archived === true && !archived) await db.archiveHabit(env.DB, user.id, id, new Date().toISOString())
		else if (b.archived === false && archived) await db.restoreHabit(env.DB, user.id, id)
		const endsActive = archived ? b.archived === false : b.archived !== true
		if (b.sort !== undefined && endsActive) await db.moveHabit(env.DB, user.id, id, b.sort as number)
		return json({ habit: pick((await db.getHabit(env.DB, user.id, id))!) })
	}
	return NOT_FOUND()
}

async function putCheckin(c: Ctx, habitId: string, day: string): Promise<Response> {
	const { env, user } = c
	if (!/^\d+$/.test(habitId)) return NOT_FOUND()
	if (!validDay(day)) return BAD_DAY()
	const body = await readBody(c.req)
	if (!body || typeof body.done !== 'boolean') return INVALID()
	const id = Number(habitId)
	const habit = await db.getHabit(env.DB, user.id, id)
	if (!habit || habit.archived_at !== null) return NOT_FOUND()
	await db.setCheckin(env.DB, user.id, id, day, body.done)
	const first = body.done && (await db.countCheckins(env.DB, user.id)) === 1 // the user's one and only check-in: drives the "first check-in" line
	return json({ habit_id: id, day, done: body.done, streak: streak(await db.checkinDays(env.DB, user.id, id, day), day), first })
}

const TEXT_FIELDS = ['went_well', 'was_hard', 'tomorrow'] as const

async function putEntry(c: Ctx, day: string): Promise<Response> {
	if (!validDay(day)) return BAD_DAY()
	const body = await readBody(c.req)
	if (!body) return INVALID()
	const text: Record<string, string | null> = {}
	for (const f of TEXT_FIELDS) {
		const v = body[f]
		if (v !== undefined && v !== null && typeof v !== 'string') return INVALID()
		const t = typeof v === 'string' ? v.trim() : ''
		if (t.length > 4000) return fail(400, 'Keep each answer under 4,000 characters.')
		text[f] = t === '' ? null : t
	}
	const mood = body.mood ?? null
	if (mood !== null && !(Number.isInteger(mood) && (mood as number) >= 1 && (mood as number) <= 5)) return fail(400, 'Pick a mood from 1 to 5.')
	if (mood === null && TEXT_FIELDS.every((f) => text[f] === null)) return fail(400, 'Add at least one answer.')
	const entry = await db.putEntry(c.env.DB, c.user.id, { day, mood: mood as number | null, went_well: text.went_well, was_hard: text.was_hard, tomorrow: text.tomorrow }, new Date().toISOString())
	return json({ entry })
}

async function dayView(c: Ctx, day: string): Promise<Response> {
	if (!validDay(day)) return BAD_DAY()
	const { DB } = c.env
	const uid = c.user.id
	const [habits, days, entry, prev, lastActive] = await Promise.all([db.listHabits(DB, uid), db.checkinDaysByHabit(DB, uid, day), db.getEntry(DB, uid, day), db.getEntry(DB, uid, addDays(day, -1)), db.lastActiveBefore(DB, uid, day)])
	return json({
		day,
		habits: habits.map((h) => {
			const ds = days.get(h.id) ?? []
			const done = ds.includes(day), st = streak(ds, day)
			// prev_streak: length of a streak that just ended (yesterday was missed), else 0
			return { id: h.id, name: h.name, done, streak: st, prev_streak: !done && st === 0 ? streak(ds, addDays(day, -1)) : 0 }
		}),
		entry,
		yesterday_tomorrow: prev?.tomorrow ?? null,
		last_active: lastActive,
	})
}

// shortcut: `total` and `done` compare to habits active now, not on that day; upgrade if it confuses the Owner
async function dayRows(c: Ctx, from: string, to: string) {
	const [rows, total] = await Promise.all([db.historyRows(c.env.DB, c.user.id, from, to), db.countActiveHabits(c.env.DB, c.user.id)])
	return rows.map((r) => ({ day: r.day, mood: r.mood, entry: !!r.entry, done: r.done, total }))
}

async function history(c: Ctx): Promise<Response> {
	const from = c.url.searchParams.get('from')
	const to = c.url.searchParams.get('to')
	if (!isRealDay(from) || !isRealDay(to)) return BAD_DAY()
	if (from > to || daysBetween(from, to) > 41) return fail(400, 'Pick a range of up to 6 weeks.')
	return json({ days: await dayRows(c, from, to) })
}

async function insights(c: Ctx): Promise<Response> {
	const today = c.url.searchParams.get('today')
	if (!validDay(today)) return BAD_DAY()
	const { DB } = c.env
	const uid = c.user.id
	const [entries, days, habits, created, checks] = await Promise.all([
		db.countEntries(DB, uid),
		dayRows(c, addDays(today, -83), today),
		db.listHabits(DB, uid),
		db.habitCreatedDays(DB, uid),
		db.checkinDaysByHabit(DB, uid, today),
	])
	const windowStart = addDays(today, -29)
	return json({
		entries,
		days,
		habits: habits.map((h) => {
			const ds = checks.get(h.id) ?? []
			const start = created.get(h.id)! > windowStart ? created.get(h.id)! : windowStart
			const span = Math.max(daysBetween(start, today) + 1, 1)
			const hits = ds.filter((d) => d >= start).length
			return { id: h.id, name: h.name, last30: Math.min(100, Math.round((100 * hits) / span)), done30: hits, span30: span, best_streak: bestStreak(ds), streak: streak(ds, today) }
		}),
	})
}

// A cell starting with = + - @ tab or CR is defused with a leading quote; one with , " or a newline is quoted.
const csvCell = (v: string | number | null): string => {
	let s = v === null ? '' : String(v)
	if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
	return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

async function exportCsv(c: Ctx): Promise<Response> {
	const { habits, entries, checks } = await db.exportData(c.env.DB, c.user.id)
	const lines: (string | number | null)[][] = [['date', 'mood', 'went_well', 'hard', 'tomorrow', ...habits.map((h) => h.name)]]
	for (const e of entries) lines.push([e.day, e.mood, e.went_well, e.was_hard, e.tomorrow, ...habits.map((h) => (checks.has(`${h.id}|${e.day}`) ? 1 : 0))])
	const body = '\uFEFF' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n') + '\r\n'
	return new Response(body, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="jurnala-export-${new Date().toISOString().slice(0, 10)}.csv"`,
		},
	})
}

// Routes that need a signed-in user. `seg` is the path after /api.
async function authed(c: Ctx, seg: string[]): Promise<Response> {
	const { req } = c
	switch (seg[0]) {
		case 'habits':
			return habits(c, seg)
		case 'entries':
			if (seg.length === 2 && req.method === 'PUT') return putEntry(c, seg[1])
			break
		case 'day':
			if (seg.length === 2 && req.method === 'GET') return dayView(c, seg[1])
			break
		case 'history':
			if (seg.length === 1 && req.method === 'GET') return history(c)
			break
		case 'insights':
			if (seg.length === 1 && req.method === 'GET') return insights(c)
			break
		case 'export':
			if (seg.length === 1 && req.method === 'GET') return exportCsv(c)
			break
		case 'checkins':
			if (seg.length === 3 && req.method === 'PUT') return putCheckin(c, seg[1], seg[2])
			break
		case 'me':
			if (seg.length === 1 && req.method === 'GET')
				return json({ user: { name: c.user.name, email: c.user.email, created_at: c.user.created_at } })
			break
	}
	return NOT_FOUND()
}

export async function handle(req: Request, env: Env): Promise<Response> {
	try {
		const url = new URL(req.url)
		const seg = url.pathname.replace(/\/+$/, '').split('/').slice(2)
		if (seg.length === 1 && seg[0] === 'health' && req.method === 'GET') return json({ ok: true })

		if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
			const origin = req.headers.get('Origin')
			let originHost = ''
			try {
				originHost = origin ? new URL(origin).host : ''
			} catch {}
			// DELETE has no body, so only POST/PUT/PATCH need the JSON content type.
			const needsJson = req.method !== 'DELETE'
			if (originHost !== url.host || (needsJson && !req.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')))
				return fail(403, "That request isn't allowed.")
		}

		if (seg.length === 1 && seg[0] === 'login' && req.method === 'POST') return await login(req, env)
		if (seg.length === 1 && seg[0] === 'logout' && req.method === 'POST') return await logout(req, env)

		const token = readSessionToken(req)
		const user = token ? await db.getSessionUser(env.DB, await sha256Hex(token), new Date().toISOString()) : null
		if (!user) return fail(401, 'Please sign in again.')
		return await authed({ req, env, url, user }, seg)
	} catch (e) {
		console.error('request failed:', e instanceof Error ? e.message : 'unknown')
		return fail(500, 'Something went wrong. Try again.')
	}
}

