import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

export default defineConfig(async () => ({
  test: {
    projects: [
      {
        // Worker tests run in workerd (always UTC).
        plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' },
          miniflare: { bindings: { TEST_MIGRATIONS: await readD1Migrations('./migrations'), PBKDF2_ITERATIONS: '1000' } } })],
        test: { name: 'worker', include: ['test/**/*.test.ts'], setupFiles: ['./test/setup.ts'] },
      },
      {
        // Frontend pure-function tests run in Node so TZ can be set per test.
        test: { name: 'web', environment: 'node', include: ['src/**/*.test.ts'] },
      },
    ],
  },
}))
