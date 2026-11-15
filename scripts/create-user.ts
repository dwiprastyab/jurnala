// Usage: npx tsx scripts/create-user.ts <email> <name> [--local | --remote]
//        npx tsx scripts/create-user.ts <email> --reset [--local | --remote]   (new password for an existing user; signs them out everywhere)
// Prints the generated password once. Writes it nowhere; only its PBKDF2 hash goes into D1. Default is --local.
import { execFileSync } from 'node:child_process'
import { randomInt } from 'node:crypto'
import { hashPassword, PBKDF2_ITERATIONS } from '../worker/auth.ts'

const args = process.argv.slice(2)
const remote = args.includes('--remote')
const reset = args.includes('--reset')
const [email, name] = args.filter((a) => !a.startsWith('--'))
if (!email || (!name && !reset) || !email.includes('@')) {
	console.error('Usage: npx tsx scripts/create-user.ts <email> <name> | <email> --reset  [--local | --remote]')
	process.exit(1)
}

const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no look-alikes (0/O, 1/l/I)
const password = Array.from({ length: 20 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
const h = await hashPassword(password, PBKDF2_ITERATIONS)
const q = (s: string) => `'${s.replace(/'/g, "''")}'`
const e = q(email.trim().toLowerCase())
const sql = reset
	? `UPDATE users SET pw_hash = ${q(h.pw_hash)}, pw_salt = ${q(h.pw_salt)}, pw_iter = ${h.pw_iter} WHERE email = ${e}; DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = ${e})`
	: `INSERT INTO users (email, name, pw_hash, pw_salt, pw_iter, created_at) VALUES (${e}, ${q(name.trim())}, ${q(h.pw_hash)}, ${q(h.pw_salt)}, ${h.pw_iter}, ${q(new Date().toISOString())})`

const d1 = (cmd: string) => execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', remote ? '--remote' : '--local', '--json', '--command', cmd], { stdio: ['ignore', 'pipe', 'inherit'] }).toString()
if (reset && !JSON.parse(d1(`SELECT count(*) AS n FROM users WHERE email = ${e}`))[0].results[0].n) {
	console.error(`No user with email ${email}. Nothing changed.`)
	process.exit(1)
}
d1(sql)
console.log(`${reset ? 'Reset password for' : 'Created'} ${email} on ${remote ? 'REMOTE' : 'local'} D1.\nPassword (shown once, not saved anywhere): ${password}`)
