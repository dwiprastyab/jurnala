import { env } from 'cloudflare:test'

export async function resetDb() {
	for (const t of ['checkins', 'entries', 'habits', 'sessions', 'login_attempts', 'users']) await env.DB.exec(`DELETE FROM ${t}`)
}
