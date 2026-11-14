// Uses only WebCrypto, so scripts/create-user.ts can import it under Node.

// shortcut: not yet measured on the production free plan (task B2); lower if error 1102 appears
export const PBKDF2_ITERATIONS = 100000

export const SESSION_SECONDS = 30 * 24 * 3600

// Tests set PBKDF2_ITERATIONS in the test env to keep them fast; production has no such binding.
export const iterationsFor = (env: object) => Number((env as { PBKDF2_ITERATIONS?: string }).PBKDF2_ITERATIONS) || PBKDF2_ITERATIONS

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
	return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt.buffer as ArrayBuffer, iterations }, key, 256))
}

export async function hashPassword(password: string, iterations: number) {
	const salt = crypto.getRandomValues(new Uint8Array(16))
	return { pw_hash: b64(await pbkdf2(password, salt, iterations)), pw_salt: b64(salt), pw_iter: iterations }
}

export async function verifyPassword(password: string, u: { pw_hash: string; pw_salt: string; pw_iter: number }): Promise<boolean> {
	const got = await pbkdf2(password, unb64(u.pw_salt), u.pw_iter)
	const want = unb64(u.pw_hash)
	let diff = got.length ^ want.length
	for (let i = 0; i < got.length; i++) diff |= got[i] ^ (want[i] ?? 0)
	return diff === 0
}

export const newToken = () => b64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export async function sha256Hex(s: string): Promise<string> {
	const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
	return [...d].map((x) => x.toString(16).padStart(2, '0')).join('')
}

export const sessionCookie = (token: string) => `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}`
export const clearedCookie = 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'

export const readSessionToken = (req: Request): string | null => req.headers.get('Cookie')?.match(/(?:^|;\s*)session=([^;]+)/)?.[1] ?? null
