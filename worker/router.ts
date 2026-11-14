import { clearedCookie, iterationsFor, newToken, readSessionToken, SESSION_SECONDS, sessionCookie, sha256Hex, verifyPassword } from './auth.ts'
import * as db from './db.ts'

const MAX_FAILS = 5
const WINDOW_MS = 15 * 60 * 1000

const json = (body: unknown, status = 200, headers?: HeadersInit) => Response.json(body, { status, headers })
const fail = (status: number, error: string) => json({ error }, status)
const NOT_FOUND = () => fail(404, 'Not found.')
const INVALID = () => fail(400, "That isn't valid.")
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

// Routes that need a signed-in user. `seg` is the path after /api.
async function authed(c: Ctx, seg: string[]): Promise<Response> {
	const { req } = c
	switch (seg[0]) {
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

