import { beforeEach, expect, it } from 'vitest'
import { resetDb, signIn } from './helpers'

beforeEach(resetDb)

const names = async (call: Awaited<ReturnType<typeof signIn>>['call']) => ((await (await call('GET', '/api/habits')).json()) as { habits: { name: string; sort: number }[] }).habits.map((h) => h.name)

it('add, list in order, rename', async () => {
	const { call } = await signIn('a@x.test')
	const r = await call('POST', '/api/habits', { name: '  Read 10 pages  ' })
	expect(r.status).toBe(201)
	const { habit } = (await r.json()) as { habit: { id: number; name: string; sort: number } }
	expect(habit).toMatchObject({ name: 'Read 10 pages', sort: 0 })
	await call('POST', '/api/habits', { name: 'Walk' })
	expect(await names(call)).toEqual(['Read 10 pages', 'Walk'])
	const p = await call('PATCH', `/api/habits/${habit.id}`, { name: 'Read' })
	expect(p.status).toBe(200)
	expect(((await p.json()) as any).habit).toEqual({ id: habit.id, name: 'Read', sort: 0 })
})

it('rejects empty, blank and 61-character names', async () => {
	const { call } = await signIn('a@x.test')
	for (const name of ['', '   ', 'x'.repeat(61), undefined]) {
		const r = await call('POST', '/api/habits', { name })
		expect(r.status).toBe(400)
		expect(await r.json()).toEqual({ error: 'Give the habit a name (up to 60 characters).' })
	}
	expect((await call('POST', '/api/habits', { name: 'x'.repeat(60) })).status).toBe(201)
})

it('the 13th active habit is 409, archived ones do not count, restore at the limit is 409', async () => {
	const { call } = await signIn('a@x.test')
	const ids: number[] = []
	for (let i = 0; i < 12; i++) ids.push(((await (await call('POST', '/api/habits', { name: 'h' + i })).json()) as any).habit.id)
	const r = await call('POST', '/api/habits', { name: 'one more' })
	expect(r.status).toBe(409)
	expect(await r.json()).toEqual({ error: 'You have 12 habits. Archive one to add another.' })
	await call('PATCH', `/api/habits/${ids[0]}`, { archived: true })
	expect((await call('POST', '/api/habits', { name: 'one more' })).status).toBe(201)
	const restore = await call('PATCH', `/api/habits/${ids[0]}`, { archived: false })
	expect(restore.status).toBe(409)
})

it('reorder moves a habit and keeps sort contiguous', async () => {
	const { call } = await signIn('a@x.test')
	const ids: number[] = []
	for (const n of ['A', 'B', 'C']) ids.push(((await (await call('POST', '/api/habits', { name: n })).json()) as any).habit.id)
	const r = await call('PATCH', `/api/habits/${ids[2]}`, { sort: 0 })
	expect(((await r.json()) as any).habit.sort).toBe(0)
	expect(await names(call)).toEqual(['C', 'A', 'B'])
	await call('PATCH', `/api/habits/${ids[2]}`, { sort: 99 }) // clamped to the end
	expect(await names(call)).toEqual(['A', 'B', 'C'])
	const sorts = ((await (await call('GET', '/api/habits')).json()) as any).habits.map((h: any) => h.sort)
	expect(sorts).toEqual([0, 1, 2])
})

it('archive hides the habit, keeps check-ins, restore brings it back at the end; undo-able', async () => {
	const { call } = await signIn('a@x.test')
	const a = ((await (await call('POST', '/api/habits', { name: 'A' })).json()) as any).habit.id
	await call('POST', '/api/habits', { name: 'B' })
	await call('PUT', `/api/checkins/${a}/2026-11-14`, { done: true })
	await call('PATCH', `/api/habits/${a}`, { archived: true })
	expect(await names(call)).toEqual(['B'])
	expect(((await (await call('GET', '/api/habits')).json()) as any).habits[0].sort).toBe(0)
	expect(((await (await call('GET', '/api/habits?archived=1')).json()) as any).habits.map((h: any) => h.name)).toEqual(['A'])
	expect((await call('PUT', `/api/checkins/${a}/2026-11-14`, { done: true })).status).toBe(404) // archived
	await call('PATCH', `/api/habits/${a}`, { archived: false })
	expect(await names(call)).toEqual(['B', 'A'])
})

it('delete: only archived (409 otherwise), wipes its check-ins, then 404', async () => {
	const { call } = await signIn('a@x.test')
	const a = ((await (await call('POST', '/api/habits', { name: 'A' })).json()) as any).habit.id
	await call('PUT', `/api/checkins/${a}/2026-11-14`, { done: true })
	const r = await call('DELETE', `/api/habits/${a}`)
	expect(r.status).toBe(409)
	expect(await r.json()).toEqual({ error: 'Archive this habit first.' })
	await call('PATCH', `/api/habits/${a}`, { archived: true })
	expect((await call('DELETE', `/api/habits/${a}`)).status).toBe(204)
	expect((await call('DELETE', `/api/habits/${a}`)).status).toBe(404)
	const { env } = await import('cloudflare:test')
	expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM checkins').first<{ n: number }>())!.n).toBe(0)
})

it('PATCH validation and unknown ids', async () => {
	const { call } = await signIn('a@x.test')
	const a = ((await (await call('POST', '/api/habits', { name: 'A' })).json()) as any).habit.id
	expect((await call('PATCH', `/api/habits/${a}`, { name: '' })).status).toBe(400)
	expect((await call('PATCH', `/api/habits/${a}`, { sort: -1 })).status).toBe(400)
	expect((await call('PATCH', `/api/habits/${a}`, { archived: 'yes' })).status).toBe(400)
	expect((await call('PATCH', '/api/habits/99999', { name: 'x' })).status).toBe(404)
	expect((await call('PATCH', '/api/habits/abc', { name: 'x' })).status).toBe(404)
})

it('check-in: idempotent, returns the streak for that day, untick lowers it', async () => {
	const { call } = await signIn('a@x.test')
	const a = ((await (await call('POST', '/api/habits', { name: 'A' })).json()) as any).habit.id
	for (const d of ['2026-11-12', '2026-11-13']) await call('PUT', `/api/checkins/${a}/${d}`, { done: true })
	const r1 = await call('PUT', `/api/checkins/${a}/2026-11-14`, { done: true })
	expect(await r1.json()).toEqual({ habit_id: a, day: '2026-11-14', done: true, streak: 3 })
	expect(((await (await call('PUT', `/api/checkins/${a}/2026-11-14`, { done: true })).json()) as any).streak).toBe(3)
	const r2 = await call('PUT', `/api/checkins/${a}/2026-11-14`, { done: false })
	expect(await r2.json()).toEqual({ habit_id: a, day: '2026-11-14', done: false, streak: 2 })
})

it('check-in validation: bad day 400, future day 400, bad body 400, unknown habit 404', async () => {
	const { call } = await signIn('a@x.test')
	const a = ((await (await call('POST', '/api/habits', { name: 'A' })).json()) as any).habit.id
	for (const d of ['2026-02-30', 'tomorrow', '2999-01-01']) {
		const r = await call('PUT', `/api/checkins/${a}/${d}`, { done: true })
		expect(r.status).toBe(400)
		expect(await r.json()).toEqual({ error: "That date isn't valid." })
	}
	expect((await call('PUT', `/api/checkins/${a}/2026-11-14`, { done: 'yes' })).status).toBe(400)
	expect((await call('PUT', '/api/checkins/99999/2026-11-14', { done: true })).status).toBe(404)
})
