import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

export default defineConfig(async () => ({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        // The migrations are applied in test/setup.ts. 1,000 iterations keep tests fast; production uses worker/auth.ts.
        bindings: { TEST_MIGRATIONS: await readD1Migrations('./migrations'), PBKDF2_ITERATIONS: '1000' },
      },
    }),
  ],
  test: { include: ['test/**/*.test.ts'], setupFiles: ['./test/setup.ts'] },
}))
