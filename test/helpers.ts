import { env } from 'cloudflare:test'

export async function resetDb() {
	for (const t of ['checkins', 'entries', 'habits', 'sessions', 'login_attempts', 'users']) await env.DB.exec(`DELETE FROM ${t}`)
}

import { SELF } from 'cloudflare:test'
import { hashPassword, iterationsFor } from '../worker/auth'
import * as db from '../worker/db'

export const ORIGIN = 'https://x.test'

// Creates a user and signs in through the real login endpoint. Returns a fetch helper bound to that session.
export async function signIn(email: string, name = 'Dwi') {
	const userId = await db.createUser(env.DB, { email, name, created_at: '2026-09-10T03:12:00Z', ...(await hashPassword('pw-' + email, iterationsFor(env))) })
	const res = await SELF.fetch(ORIGIN + '/api/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
		body: JSON.stringify({ email, password: 'pw-' + email }),
	})
	const cookie = res.headers.get('Set-Cookie')!.split(';')[0]
	const call = (method: string, path: string, body?: unknown) =>
		SELF.fetch(ORIGIN + path, {
			method,
			headers: { Cookie: cookie, Origin: ORIGIN, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
			body: body !== undefined ? JSON.stringify(body) : undefined,
		})
	return { userId, cookie, call }
}
