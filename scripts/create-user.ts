// Usage: npx tsx scripts/create-user.ts <email> <name> [--local | --remote]
// Prints the generated password once. Writes it nowhere; only its PBKDF2 hash goes into D1. Default is --local.
import { execFileSync } from 'node:child_process'
import { randomInt } from 'node:crypto'
import { hashPassword, PBKDF2_ITERATIONS } from '../worker/auth.ts'

const args = process.argv.slice(2)
const remote = args.includes('--remote')
const [email, name] = args.filter((a) => !a.startsWith('--'))
if (!email || !name || !email.includes('@')) {
	console.error('Usage: npx tsx scripts/create-user.ts <email> <name> [--local | --remote]')
	process.exit(1)
}

const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no look-alikes (0/O, 1/l/I)
const password = Array.from({ length: 20 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
const h = await hashPassword(password, PBKDF2_ITERATIONS)
const q = (s: string) => `'${s.replace(/'/g, "''")}'`
const sql = `INSERT INTO users (email, name, pw_hash, pw_salt, pw_iter, created_at) VALUES (${q(email.trim().toLowerCase())}, ${q(name.trim())}, ${q(h.pw_hash)}, ${q(h.pw_salt)}, ${h.pw_iter}, ${q(new Date().toISOString())})`

execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', remote ? '--remote' : '--local', '--command', sql], { stdio: ['ignore', 'ignore', 'inherit'] })
console.log(`Created ${email} on ${remote ? 'REMOTE' : 'local'} D1.\nPassword (shown once, not saved anywhere): ${password}`)
