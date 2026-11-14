import { clearedCookie, iterationsFor, newToken, readSessionToken, SESSION_SECONDS, sessionCookie, sha256Hex, verifyPassword } from './auth.ts'
import * as db from './db.ts'
import { streak, validDay } from './streak.ts'

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
	return json({ habit_id: id, day, done: body.done, streak: streak(await db.checkinDays(env.DB, user.id, id, day), day) })
}

// Routes that need a signed-in user. `seg` is the path after /api.
async function authed(c: Ctx, seg: string[]): Promise<Response> {
	const { req } = c
	switch (seg[0]) {
		case 'habits':
			return habits(c, seg)
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

