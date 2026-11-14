import { env, SELF } from 'cloudflare:test'
import { beforeEach, expect, it } from 'vitest'
import { hashPassword, iterationsFor } from '../worker/auth'
import * as db from '../worker/db'
import { resetDb } from './helpers'

const ORIGIN = 'https://x.test'
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
	SELF.fetch(ORIGIN + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers }, body: JSON.stringify(body) })

async function seed(email = 'a@x.test', password = 'correct-horse') {
	await db.createUser(env.DB, { email, name: 'Dwi', created_at: '2026-09-10T03:12:00Z', ...(await hashPassword(password, iterationsFor(env))) })
}
const cookieOf = (res: Response) => res.headers.get('Set-Cookie')!.split(';')[0]

beforeEach(resetDb)

it('correct login returns the user and a session that /api/me accepts', async () => {
	await seed()
	const res = await post('/api/login', { email: 'a@x.test', password: 'correct-horse' })
	expect(res.status).toBe(200)
	expect(await res.json()).toEqual({ user: { name: 'Dwi', email: 'a@x.test' } })
	const me = await SELF.fetch(ORIGIN + '/api/me', { headers: { Cookie: cookieOf(res) } })
	expect(me.status).toBe(200)
	expect(await me.json()).toEqual({ user: { name: 'Dwi', email: 'a@x.test', created_at: '2026-09-10T03:12:00Z' } })
})

it('cookie has HttpOnly, Secure, SameSite=Strict, Path=/ and a 30-day Max-Age', async () => {
	await seed()
	const c = (await post('/api/login', { email: 'a@x.test', password: 'correct-horse' })).headers.get('Set-Cookie')!
	for (const f of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=2592000']) expect(c).toContain(f)
})

it('wrong password and unknown email give the same 401', async () => {
	await seed()
	const a = await post('/api/login', { email: 'a@x.test', password: 'nope' })
	const b = await post('/api/login', { email: 'ghost@x.test', password: 'nope' })
	expect(a.status).toBe(401)
	expect(b.status).toBe(401)
	expect(await a.json()).toEqual({ error: "That email or password isn't right." })
	expect(await b.json()).toEqual({ error: "That email or password isn't right." })
})

it('the 6th attempt after 5 failures is 429, even with the right password', async () => {
	await seed()
	for (let i = 0; i < 5; i++) expect((await post('/api/login', { email: 'a@x.test', password: 'bad' })).status).toBe(401)
	const res = await post('/api/login', { email: 'a@x.test', password: 'correct-horse' })
	expect(res.status).toBe(429)
	expect(await res.json()).toEqual({ error: 'Too many attempts. Try again in 15 minutes.' })
})

it('a success clears earlier failures', async () => {
	await seed()
	for (let i = 0; i < 4; i++) await post('/api/login', { email: 'a@x.test', password: 'bad' })
	expect((await post('/api/login', { email: 'a@x.test', password: 'correct-horse' })).status).toBe(200)
	expect(await db.recentFails(env.DB, 'a@x.test', '2000-01-01T00:00:00Z')).toBe(0)
})

it('no cookie, a garbage cookie and an expired session are all 401', async () => {
	await seed()
	const msg = { error: 'Please sign in again.' }
	const none = await SELF.fetch(ORIGIN + '/api/me')
	expect(none.status).toBe(401)
	expect(await none.json()).toEqual(msg)
	expect((await SELF.fetch(ORIGIN + '/api/me', { headers: { Cookie: 'session=garbage' } })).status).toBe(401)

	const res = await post('/api/login', { email: 'a@x.test', password: 'correct-horse' })
	const cookie = cookieOf(res)
	await env.DB.prepare("UPDATE sessions SET expires_at = '2000-01-01T00:00:00Z'").run()
	expect((await SELF.fetch(ORIGIN + '/api/me', { headers: { Cookie: cookie } })).status).toBe(401)
})

it('logout clears the cookie, kills the session, and is 204 without one', async () => {
	await seed()
	const cookie = cookieOf(await post('/api/login', { email: 'a@x.test', password: 'correct-horse' }))
	const out = await post('/api/logout', {}, { Cookie: cookie })
	expect(out.status).toBe(204)
	expect(out.headers.get('Set-Cookie')).toContain('Max-Age=0')
	expect((await SELF.fetch(ORIGIN + '/api/me', { headers: { Cookie: cookie } })).status).toBe(401)
	expect((await post('/api/logout', {})).status).toBe(204)
})

it('only the SHA-256 of the token is stored', async () => {
	await seed()
	const cookie = cookieOf(await post('/api/login', { email: 'a@x.test', password: 'correct-horse' }))
	const stored = (await env.DB.prepare('SELECT token_hash FROM sessions').first<{ token_hash: string }>())!.token_hash
	expect(cookie).not.toContain(stored)
	expect(stored).toMatch(/^[0-9a-f]{64}$/)
})

it('cross-origin, missing-origin and non-JSON writes are 403', async () => {
	await seed()
	const body = { email: 'a@x.test', password: 'correct-horse' }
	const msg = { error: "That request isn't allowed." }
	const cross = await post('/api/login', body, { Origin: 'https://evil.test' })
	expect(cross.status).toBe(403)
	expect(await cross.json()).toEqual(msg)
	const noOrigin = await SELF.fetch(ORIGIN + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
	expect(noOrigin.status).toBe(403)
	const text = await SELF.fetch(ORIGIN + '/api/login', { method: 'POST', headers: { 'Content-Type': 'text/plain', Origin: ORIGIN }, body: JSON.stringify(body) })
	expect(text.status).toBe(403)
})

it('health needs no auth; unknown routes are 404 after sign-in', async () => {
	expect((await SELF.fetch(ORIGIN + '/api/health')).status).toBe(200)
	await seed()
	const cookie = cookieOf(await post('/api/login', { email: 'a@x.test', password: 'correct-horse' }))
	const r = await SELF.fetch(ORIGIN + '/api/nope', { headers: { Cookie: cookie } })
	expect(r.status).toBe(404)
	expect(await r.json()).toEqual({ error: 'Not found.' })
})

it('bad login bodies are 400', async () => {
	expect((await post('/api/login', { email: 1 })).status).toBe(400)
})
