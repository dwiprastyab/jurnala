# Free browser-test tools for Jurnala (issue #2)

Question: which free browser-test tool fits a Vite + `@cloudflare/vite-plugin` + Worker + D1 app run locally? Needs: drive the dev server, sample an element's size and position every animation frame during a 1400 ms Web Animations slide, screenshots at 390 / 768 / 1440 px, intercept API calls with fixed JSON, devDependency only, run on demand locally.

Findings only. Researched 2026-11-15. Sources are official docs (links inline). Tags: `[repo]` read from this repo; `[npm]` measured with `npm view` today; `[local]` measured on this machine; `[inferred]` my reading, not stated by a doc.

## Repo facts `[repo]`

- `package.json`: `vitest ^4.1.12`, `@cloudflare/vitest-plugin ^1.8.2`, `vite ^8.3.6`, `@cloudflare/vite-plugin ^1.69.1`, `wrangler ^4.162.0`, `tsx ^4.23.15`. `npm run dev` = `vite`. No Playwright or browser package installed.
- `vite.config.ts`: plugins `react()`, `tailwindcss()`, `cloudflare()`. So `vite` serves the SPA and runs the Worker + D1 together.
- `vitest.config.ts`: two inline projects. `worker` (uses `cloudflareTest`, includes `test/**/*.test.ts`) and `web` (Node env, includes `src/**/*.test.ts`).
- `wrangler.jsonc`: assets are SPA fallback, `run_worker_first: ["/api/*"]`, D1 binding `DB`.
- `docs/research/` did not exist; this file creates it. No other note-folder convention found (`docs/` has PRD, api, architecture, development, plan).

## Shared facts (apply to all three options)

- Dev server: Vite's default port is 5173 and it silently moves to the next free port unless `server.strictPort: true` ([Vite server options](https://vite.dev/config/server-options)). A tool that needs a fixed URL must set `strictPort` or read the printed port. `[inferred]`
- Local D1 state: the Cloudflare Vite plugin persists state to `.wrangler/state` by default; `persistState` can change the path or disable it ([CF Vite plugin API](https://developers.cloudflare.com/workers/vite-plugin/reference/api/)). That page has no E2E or testing guidance, so whether a browser test sees clean or dirty D1 is up to us.
- Per-frame sampling and Web Animations are browser APIs, not tool features. `Element.getAnimations()` returns CSS animations, transitions and Web Animations on the element, and `Animation.finished` is a promise ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/getAnimations)). That MDN page does not document `currentTime` or per-frame sampling; sampling with `requestAnimationFrame` plus `getBoundingClientRect()` inside page code is plain page JS `[inferred]`. All three options run code in a real browser page, so all can do it.
- Reduced motion can be emulated in Playwright (`reducedMotion: 'reduce'` / `page.emulateMedia`) ([Emulation](https://playwright.dev/docs/emulation)).
- Browser binary: Playwright downloads its own Chromium. `npx playwright install chromium` installs one browser; `--only-shell` installs only the headless shell; default cache on macOS is `~/Library/Caches/ms-playwright`; `PLAYWRIGHT_BROWSERS_PATH` relocates it, `0` puts it inside `node_modules` ([Browsers](https://playwright.dev/docs/browsers)). Docs example sizes on macOS: about 281 MB Chromium, 187 MB Firefox, 180 MB WebKit. `[local]` this machine already has a Playwright cache: `chromium-1254` 376 MB, `chromium_headless_shell-1254` 205 MB, `ffmpeg-1013` 2.9 MB (the version a new install wants may differ).

## Install size (npm `unpackedSize`, `[npm]` 2026-11-15)

| Package | Version | Unpacked |
|---|---|---|
| `@playwright/test` | 1.65.1 | 28 KB (depends only on `playwright` 1.65.1) |
| `playwright` | 1.65.1 | 5.1 MB (pulls `playwright-core`) |
| `playwright-core` | 1.65.1 | 14.0 MB |
| `vitest` (latest on npm) | 5.1.0 | 2.9 MB (repo is on 4.1.12, already installed) |
| `@vitest/browser` | 5.1.0 | 0.7 MB |
| `@vitest/browser-playwright` | 5.1.0 | 61 KB |
| `@vitest/browser-webdriverio` | 5.0.0 | 36 KB |

`@vitest/browser-playwright@4.1.12` has peer deps `vitest: 4.1.12` (exact) and `playwright: *` `[npm]`, so with the repo's `^4.1.12` range the provider must be pinned to the installed Vitest version. Playwright is about 19 MB of JS plus a 200 to 380 MB browser binary for every option; the options differ by only a few MB of JS.

## Option A: Playwright test runner (`@playwright/test`)

- Setup in this repo: `npm i -D @playwright/test`, `npx playwright install chromium`, add `playwright.config.ts` and a spec file ([Test configuration](https://playwright.dev/docs/test-configuration)).
- Starts the dev server: built in. `webServer: { command, url, reuseExistingServer, timeout }`. `url` must return 2xx/3xx/400/401/402/403; `timeout` default 60000 ms; `reuseExistingServer: true` reuses a server already running; `stdout` is `"ignore"` by default; arrays of servers are allowed ([Web server](https://playwright.dev/docs/test-webserver)). With `command: 'npm run dev'` this starts Vite + Worker + D1 in one process `[inferred]`.
- Coexists with Vitest: separate runner, separate config, no shared plugins, so no clash with `cloudflareTest` `[inferred]`. One overlap to watch: Playwright's default `testMatch` is `**/*.@(spec|test).?(c|m)[jt]s?(x)`, which also matches `*.test.ts`. Set `testDir` to a new folder (for example `e2e/`) so it never picks up `test/` or `src/` files. Vitest's `include` globs here are explicit (`test/**/*.test.ts`, `src/**/*.test.ts`), so an `e2e/` folder is not picked up by Vitest `[repo][inferred]`. A new script such as `test:e2e` leaves `npm test` (`vitest run`) unchanged.
- Viewports: `use.viewport` in config, `test.use({viewport})`, or `page.setViewportSize()`; projects can give one project per width ([Emulation](https://playwright.dev/docs/emulation)).
- Screenshots: `page.screenshot()` and `expect(page).toHaveScreenshot()` (reference images, default `threshold` 0.2, baselines named per browser and platform, rendering varies by OS and headless mode) ([Snapshots](https://playwright.dev/docs/test-snapshots)). That page does not document `page.screenshot()` options.
- API interception with fixed JSON: `page.route(glob, route => route.fulfill({json}))`, registered before `page.goto()`; a non-matching glob lets the real API be called ([Mock APIs](https://playwright.dev/docs/mock)). The page does not discuss service workers.
- Limits: needs its own config and its own command. Per-frame samples must be returned from `page.evaluate` and asserted in Node. Runner extras (projects, parallelism, retries, reporters, tracing) are only in the runner ([Library vs runner](https://playwright.dev/docs/library)).

## Option B: Plain Node script using the `playwright` library

- Setup in this repo: `npm i -D playwright`, `npx playwright install chromium`, one script file. The repo already has `tsx` `[repo]`; the Playwright docs example runs a `.js` file with `node` ([Library](https://playwright.dev/docs/library)).
- Starts the dev server: not built in. The library docs describe no web server option; the script must spawn `vite` and wait for the URL, or the user starts `npm run dev` first `[inferred]`.
- Coexists with Vitest: fully separate; nothing to configure. Not picked up by Vitest unless placed under `test/` or `src/` with a `.test.ts` name `[repo][inferred]`.
- Viewports: `browser.newContext({ viewport })` or `page.setViewportSize()` ([Emulation](https://playwright.dev/docs/emulation)); loop over 390 / 768 / 1440 in the script.
- Screenshots: `page.screenshot({ path })` ([Library](https://playwright.dev/docs/library)). No baseline comparison (`toHaveScreenshot` is a test-runner assertion per the snapshots page).
- API interception: same `page.route` / `route.fulfill` ([Mock APIs](https://playwright.dev/docs/mock)); it is a core page API, so it works in the library `[inferred]`.
- Limits ([Library vs runner](https://playwright.dev/docs/library)): you launch and close browser, context and page yourself; no web-first auto-retrying assertions; no config matrix, parallelism, reporting, retries or tracing; default operation timeout about 30 s. Pass or fail must be coded by hand (exit code, `assert`).

## Option C: Vitest browser mode (`@vitest/browser-playwright`)

- Setup in this repo: install `@vitest/browser-playwright` and `playwright`, pinned to the installed Vitest; `npx playwright install chromium`; add `test.browser` with `enabled`, `provider: playwright()` and at least one `instances` entry; `npx vitest init browser` can scaffold it ([Browser mode](https://vitest.dev/guide/browser/), [Playwright provider](https://vitest.dev/guide/browser/playwright)).
- Starts the dev server: it does not drive your running app. Browser mode runs tests inside a page served by Vitest's own Vite dev server (port 23315, so it can run next to your dev server), with framework plugins from the Vite `plugins` array ([Browser mode](https://vitest.dev/guide/browser/)). Tests are code loaded into the browser, built for component and unit tests. Loading the full Worker app at its real URL is not a documented use `[inferred]`. For real `/api/*` plus D1 you would still start your own `vite` and navigate to it; no doc describes that flow.
- Coexists with Vitest: it is Vitest, so it fits the existing `projects` array. Projects can differ in `plugins`, `test.browser`, environment; root plugins are inherited unless `extends: false`; filter with `--project` ([Projects](https://vitest.dev/guide/projects)). Unknown: the Cloudflare plugin docs say "Custom Vitest `environment`s or `runner`s are not supported" and say nothing about running next to a browser project ([CF config](https://developers.cloudflare.com/workers/testing/vitest-integration/configuration/)). The current config already keeps `cloudflareTest` inside the `worker` project's own `plugins`, so a third `browser` project would not inherit it `[repo][inferred]`. Not verified by running. `@cloudflare/vitest-plugin` needs Vitest 4.1 or later ([get started](https://developers.cloudflare.com/workers/testing/vitest-integration/get-started/)).
- Viewports: `browser.viewport` in config or per instance, or `page.viewport` in a test ([Browser mode](https://vitest.dev/guide/browser/), [instances](https://vitest.dev/config/browser/instances)). The Playwright provider page says a viewport set in `contextOptions` is lost in headless mode; use `test.browser.viewport`.
- Screenshots: `toMatchScreenshot` (pixelmatch, references in `__screenshots__` next to the test, names include browser and platform, actual and diff images in `tests/.vitest/attachments/`) ([Visual regression](https://vitest.dev/guide/browser/visual-regression-testing)). That page does not document `page.screenshot` directly.
- API interception: the Playwright provider sets `serviceWorkers: 'allow'` for MSW mocking ([Playwright provider](https://vitest.dev/guide/browser/playwright)), so MSW (another dependency) is the documented route. Custom commands can reach the Playwright `page`, `frame`, `iframe` and `context` when the provider is Playwright, but the docs warn against touching `page`, and the page does not mention `route` ([Commands](https://vitest.dev/guide/browser/commands)). `page.route` from a command is undocumented `[inferred]`.
- Limits: one page per test file, not per test; `launch.headless` ignored (use `browser.headless`); `persistentContext` ignored in parallel runs; blocking dialogs (`alert`, `confirm`, `print`) can hang tests; no `vi.spyOn` on module exports; animations can cause screenshot flakiness and stability timeouts ([Playwright provider](https://vitest.dev/guide/browser/playwright), [Browser mode](https://vitest.dev/guide/browser/), [Visual regression](https://vitest.dev/guide/browser/visual-regression-testing)). The Browser mode guide does not say whether the feature is stable or experimental.

## Comparison

| | A: `@playwright/test` | B: `playwright` script | C: Vitest browser mode |
|---|---|---|---|
| New npm deps | 1 package (pulls `playwright`) | 1 package | 2 packages, pinned to Vitest |
| Browser download | yes | yes | yes |
| New config file | `playwright.config.ts` | none | edit `vitest.config.ts` |
| Starts dev server | yes, `webServer` | no, script spawns it | no, serves its own Vite instance |
| Runs real app + `/api/*` + D1 | yes, via `webServer` | yes, if script starts it | not a documented use |
| Per-frame sampling | `page.evaluate` | `page.evaluate` | in-page test code |
| Viewports 390/768/1440 | projects or `setViewportSize` | loop in script | instances or `page.viewport` |
| Screenshot baselines | `toHaveScreenshot` | manual files only | `toMatchScreenshot` |
| Fixed-JSON API mock | `page.route` (documented) | `page.route` | MSW (documented); `page.route` not documented |
| Coexists with current Vitest | separate runner, avoid `testMatch` overlap | separate | same runner; interaction with `cloudflareTest` untested |

## Fits best because

Option A fits best on the documented facts: it is the only one that starts the Vite + Worker + D1 dev server itself (`webServer`) and also documents `page.route`, per-width projects and screenshot baselines, in a runner separate from the existing Vitest setup.

## Not checked

- Nothing was installed or run; no claim here comes from running a tool against this repo.
- `webServer` behavior with `@cloudflare/vite-plugin` (startup time, D1 reset between runs) is `[inferred]`.
- Frame-timing accuracy of `requestAnimationFrame` sampling in headless Chromium is not covered by any doc read.
- `npm view` sizes are unpacked package sizes, not the total `node_modules` footprint.
