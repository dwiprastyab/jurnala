import { SELF } from 'cloudflare:test'
import { it, expect } from 'vitest'

it('GET /api/health', async () => {
  const res = await SELF.fetch('https://x.test/api/health')
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ ok: true })
})
