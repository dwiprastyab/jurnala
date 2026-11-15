# Jurnala v1 — Build plan (B1–B10)

For the implementer (Sonnet). Read `CLAUDE.md`, `docs/PRD.md`, `docs/api.md`, `DESIGN.md` first. `docs/api.md` is the exact contract for every endpoint; where this plan and `docs/api.md` differ on a request or response shape, `docs/api.md` wins. The approved look is the board linked in `DESIGN.md` plus `design/scenes/` (Scenes theme, default) and `design/mockup.html` (Classic theme and component CSS). They win over prose.

Rules for every task:
- Do tasks in order. One task = one commit. Run the task's verification before the next task. If verification fails, fix it or stop and report; never skip.
- Smallest complete solution. No Hono, no React router, no state library, no extra dependencies unless a task says so.
- All product copy in English (exact strings are in `docs/PRD.md`).
- All SQL lives in `worker/db.ts`; every function there takes `userId` and filters by it.
- Never put real credentials in files, logs or commits.
- Tailwind v4 uses CSS tokens: copy the custom properties from `DESIGN.md` (Scenes) and `design/mockup.html` (Classic), do not re-derive colours.
- Do not edit `design/scenes/*.svg`. If a scene looks wrong, report it to the Owner.
- Before B3, check the current `@cloudflare/vitest-plugin` docs for how to apply D1 migrations in tests. Do not rely on memory.

---

## B1 — Scaffold

Files: whole project skeleton, `wrangler.jsonc`, `vite.config.ts`, `vitest.config.ts`, `worker/index.ts`.

Do:
- `npm create cloudflare@latest -- jurnala --framework=react` (React + TypeScript, Vite, `@cloudflare/vite-plugin`). If the repo root is not empty, scaffold in a temp folder and move the files in; keep `CLAUDE.md`, `DESIGN.md`, `docs/`, `design/`.
- Add Tailwind v4 (`@tailwindcss/vite`), Vitest + `@cloudflare/vitest-plugin`.
- `wrangler.jsonc`: `assets.run_worker_first: ["/api/*"]`, `assets.not_found_handling: "single-page-application"`, a D1 binding `DB`.
- `GET /api/health` returns `{"ok":true}`.
- Add `.gitignore` entries: `node_modules`, `.wrangler`, `dist`, `.dev.vars`, `.playwright-mcp`.

Done when:
- `npm run dev` serves the page; `curl -s localhost:5173/api/health` → `{"ok":true}`.
- `npx vitest run` is green with one health test.

## B2 — PBKDF2 spike + first deploy (do before any feature)

Needs the Owner: Cloudflare account and `npx wrangler login`. Ask the Owner to do this, then continue.

Do:
- Temporary `GET /api/spike?iter=N`: PBKDF2-SHA256, 16-byte random salt, 32-byte output via WebCrypto.
- `npx wrangler deploy`. Test iterations 100000, 50000, 25000, 20 requests each, against the production URL.
- Local `wrangler dev` does NOT enforce the CPU limit, so only the production result counts.
- Watch for error 1102 (CPU exceeded) and non-200 responses. Also check that the Worker name `jurnala` was free.
- Record the chosen iteration count and the observed result in `CLAUDE.md` under "Spike result". Delete the spike endpoint.

Done when: the result is recorded in `CLAUDE.md`, the endpoint is gone, and production `/api/health` still works. If even 25,000 fails, stop and report to the Owner.

Verification (example): `for i in $(seq 20); do curl -s -o /dev/null -w "%{http_code}\n" "https://jurnala.<account>.workers.dev/api/spike?iter=100000"; done | sort | uniq -c`

## B3 — Migration + db.ts

Files: `migrations/0001_init.sql`, `worker/db.ts`, `test/db.test.ts`.

Schema (exact):
```sql
CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, pw_hash TEXT NOT NULL, pw_salt TEXT NOT NULL, pw_iter INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL);
CREATE TABLE login_attempts (email TEXT PRIMARY KEY, fails INTEGER NOT NULL, window_start TEXT NOT NULL);
CREATE TABLE habits (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), name TEXT NOT NULL, sort INTEGER NOT NULL, archived_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE checkins (habit_id INTEGER NOT NULL REFERENCES habits(id), user_id INTEGER NOT NULL, day TEXT NOT NULL, PRIMARY KEY (habit_id, day));
CREATE TABLE entries (user_id INTEGER NOT NULL REFERENCES users(id), day TEXT NOT NULL, mood INTEGER, went_well TEXT, was_hard TEXT, tomorrow TEXT, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, day));
CREATE INDEX idx_habits_user ON habits(user_id);
CREATE INDEX idx_checkins_user_day ON checkins(user_id, day);
```

`db.ts` exposes functions for users, sessions, login attempts, habits, checkins, entries. No SQL anywhere else.

Done when: `npx wrangler d1 migrations apply DB --local` succeeds and `npx vitest run` passes basic CRUD tests that include the migration.

## B4 — Auth + admin script

Files: `worker/auth.ts`, `worker/router.ts`, `scripts/create-user.ts`, `test/auth.test.ts`.

Do:
- Hash with PBKDF2-SHA256 using the iteration count from B2, store `pw_iter` per user, verify with constant-time compare.
- `POST /api/login {email,password}`, `POST /api/logout`, `GET /api/me`. Session token: 32 random bytes, only its SHA-256 is stored, 30 days. Cookie `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`. (`Secure` cookies work on `localhost` in modern browsers; if a test client drops it, note it.)
- Write requests: reject when `Origin` host differs from the request host, or `Content-Type` is not `application/json`.
- Rate limit: 5 failed logins per email per 15 minutes → 429 `Too many attempts. Try again in 15 minutes.` Wrong email and wrong password both return 401 `That email or password isn't right.`
- `scripts/create-user.ts <email> <name>`: generates a random password (about 20 characters from a safe alphabet), hashes it with the same code as `auth.ts`, prints the password once, and inserts the row via `wrangler d1 execute` (`--local` by default, `--remote` only when passed explicitly). It must not write the password to any file.

Done when tests cover: correct login, wrong password, unknown email (same message), expired session, 6th failure → 429, cookie flags present, cross-origin write rejected.

## B5 — Habits, check-ins, streak

Files: `worker/streak.ts`, handlers in `router.ts`, `test/streak.test.ts`, `test/habits.test.ts`.

Do:
- `GET /api/habits` (active), `POST /api/habits {name}`, `PATCH /api/habits/:id {name?, sort?, archived?}`.
- This is the "user adds their own habits" feature: any signed-in user can add habits from the Habits screen. Name is trimmed, 1–60 characters; at most 12 active habits (13th → 409 with a clear message); archived habits never count. Only an archived habit can be deleted (`DELETE /api/habits/:id`, wipes its check-ins); add the isolation test for it.
- `PUT /api/checkins/:habitId/:day {done}`: verify the habit belongs to the user, otherwise 404. Validate `day` against `^\d{4}-\d{2}-\d{2}$` and a real date.
- `streak.ts`: pure function over a list of days; rule from `docs/PRD.md` ("Streak rule").

Done when streak tests cover: empty, today only, yesterday only (unticked today does not reset), a gap, across a month and a year boundary, a leap day. Habit tests cover add, rename, reorder, archive, name too long, 13th habit.

## B6 — Entries, day, history, export

Files: handlers in `router.ts`, `test/api.test.ts`.

Do:
- `PUT /api/entries/:day {mood?, went_well?, was_hard?, tomorrow?}`: mood 1–5 or null, each text ≤4,000 characters; saving again replaces.
- `GET /api/day/:day` returns active habits with `done` and `streak`, the entry for that day, and `yesterday_tomorrow` (the previous day's `tomorrow` text or null).
- `GET /api/history?from&to`: per day `mood`, `done`, `total`. Range limited to 42 days (a 6-week month grid). Days with no entry and no check-ins may be omitted; the UI treats a missing day as "nothing saved".
- `PUT /api/entries/:day` with every field empty/null and no mood → 400 `Add at least one answer.` (matches the PRD).
- The calendar's first month comes from `GET /api/me` (`created_at`), not from history. Add `GET /api/insights?today=` as specified in `docs/api.md` (one handler, all SQL in `db.ts`, filtered by `userId`).
- `GET /api/export`: CSV exactly as in `docs/api.md` (one row per entry, a 1/0 column per habit, formula-prefix defusing, BOM, `Content-Disposition` download header).
- History "all done" dot compares to currently active habits. Mark that line with `// shortcut: compares to habits active now, not on that day; upgrade if it confuses the Owner`.

Done when tests cover response shape, validation errors (bad day, mood 6, text too long, range too long), and the export's data-row count equals the `entries` count; a test also covers a cell with a comma, a quote, a newline and a leading `=`.

## B7 — Isolation tests

File: `test/isolation.test.ts`.

Create users A and B with data. For EVERY endpoint, as A: read B's data, write B's data, and use B's ids (habit id in checkins and PATCH). Expect 404 or empty, and confirm B's data is unchanged afterwards. Add one test that fails if any file other than `worker/db.ts` contains the strings `.prepare(` or `.exec(`.

Done when: all pass, and temporarily removing a `user_id` filter in `db.ts` makes at least one test fail (try it once, then revert).

## B8 — UI: theme and scenes, tokens, Sign in, Today

Files: `src/theme.ts`, `src/index.css` (tokens), `public/scenes/{dawn,day,dusk,night}.svg` (copied from `design/scenes/`), `public/{favicon.svg,favicon-32.png,apple-touch-icon.png}` (copied from `design/favicon/`, linked in `index.html`; check the tab icon at 16px), `src/components/{Scene,GlassCard,HabitRow,MoodPicker,MoodFace,Reflection,Nav}.tsx` (`MoodFace` inlines the five SVGs from `design/mood/`; no emoji), `src/screens/{SignIn,Today}.tsx`, `src/api.ts`, `src/App.tsx`, self-hosted Newsreader (regular + italic) + Figtree woff2.

Read first: `DESIGN.md` (whole file), `design/scenes/README.md`, `design/scenes/layout.css`, `design/mockup.html` (Classic theme and component CSS).

Do:
- `theme.ts` sets `<html data-theme>` and `<html data-phase>` as in `DESIGN.md` "Themes and phases": local hour → phase, `localStorage` keys `jurnala-theme` and `jurnala-phase` in try/catch, `storage` event, minute re-check while `auto`. Expose a tiny hook (`useTheme`) for Settings. In Classic only, also set `--orb-y` from the clock (same formula as the mockup).
- `Scene.tsx` renders the fixed wrapper with the four `<img>` scene layers and the four Classic gradient layers, per `layout.css`. The scene is `aria-hidden` and `alt=""`; it is decoration.
- Scroll-over layout from `DESIGN.md` "Scenes theme": header in the sky area, content scrolls over the fixed scene.
- Tokens: Scenes dark set and Classic light/dark sets, switched by `data-theme` and `data-phase`. Copy from `DESIGN.md`, not from memory.
- Glass rules, reduced-transparency and reduced-motion fallbacks, 44px touch targets, visible focus.
- Three layouts from `DESIGN.md` "Layouts", breakpoints 700px and 1100px. `Nav` is one component: bottom pill on phones, top bar on tablet, left rail on desktop, with the sliding active marker.
- Motion from `DESIGN.md` "Motion". `@property`, `@starting-style` and View Transitions stay progressive enhancements; no animation library.
- Classic only: text on the sky must never overlap the orb. Long names in the greeting wrap.
- Today: greeting, `Yesterday you said`, habit rows (tap = tick, optimistic update, roll back on error), the reflection card in read and edit mode exactly as `docs/PRD.md` feature 3 and `DESIGN.md` "Reflection card" describe (empty day → form; saved → read mode + `Edit`; `Cancel`, `Discard changes?`, focus rules), closing line `That's today. See you tomorrow.` Each answer is the rich editor (`src/components/Rich.tsx`, limited markdown in `src/md.ts`, `test/md.test.ts`). Today also serves a past day: `Edit this day` in History opens it, with `You are editing a past day.` and `Back to today`.
- The browser sends its local date as `YYYY-MM-DD`, built only by `localDay()` in `src/day.ts` (rules in `docs/api.md`). A unit test runs with the process time zone set to `Asia/Jakarta` and to `America/Los_Angeles` at 00:30 and 23:30 local and checks `localDay()` returns the local date, not the UTC one. A grep test fails if `toISOString` appears in `src/` outside that test.

Done when:
- Playwright screenshots at 390px, 820px and 1440px: Scenes in all four phases and Classic in all four phases (force with `jurnala-phase` / `data-phase`), for Sign in and Today (read and edit). Scenes look like the board; Classic looks like `design/mockup.html`.
- `scrollWidth - clientWidth` is 0 at 320, 390, 820 and 1440.
- With `reducedMotion: 'reduce'` emulated: no animation runs after ticking a habit, and the scene does not move or cross-fade.
- Contrast measured per `DESIGN.md` "Measuring contrast" and the worst ratios written into that file; all ≥ 4.5:1, or the tokens are fixed and re-measured.
- Switching phase while the page is open cross-fades without a white flash; reloading with `localStorage` blocked still renders the default (Scenes, Auto).
- Network tab: scene SVGs are requested from `/scenes/…` and served by Static Assets, not by the Worker (`run_worker_first` covers `/api/*` only).

## B9 — UI: History, Habits, Settings, states

Files: `src/screens/{History,Habits,Settings}.tsx`.

Do:
- History: month calendar per `DESIGN.md` "History: month calendar and day sheet" and PRD feature 4. Fetch one month per request (`/api/history?from&to`, at most 42 days: first Monday on or before the 1st through the last Sunday); month arrows, day numbers in mood-coloured circles, dot for all-done, today outline, days before sign-up and future days disabled, labelled cells. Title opens the picker (year stepper, months, date jump); `Back to this month`. Bounds come from `GET /api/me` `created_at`. Tap opens the day sheet (prototype): `GET /api/day/:day`, a read-only summary (date, mood and habits-done line, the three answers rendered from markdown with `Md`), `Nothing saved for this day.`, icon buttons `Edit this day` and `Close`, `Esc`. No habit list, no Previous/Next, no arrow keys. `Edit this day` opens Today for that day (`You are editing a past day.`, `Back to today`). On phones the sheet is a modal `<dialog>` (`showModal()`, focus returns to the cell). From 700px it is a panel beside the calendar, opened with the `open` attribute so focus stays on the grid, and today is shown by default. After saving in the sheet, refresh that month so the cell colour updates.
- Insights (`src/screens/Insights.tsx`, `Calendar | Insights` switch in History): one `GET /api/insights?today=` call, four cards per PRD feature 7 and `DESIGN.md` "Insights", inline SVG or CSS bars, no chart library. Habits over time has a `Day | Week | Month` group and a `Period` select (Day/Week: one month, Month: one year), fed by `GET /api/history` in 42-day chunks. Pure functions in `src/insights.ts` (periods, series, period message, best weekday, milestones) with unit tests for: under 7 entries, a week at 100%, two and four weeks at 80%+, a week under 50%, fewer than 28 days (no weekday sentence).
- Encouragement (`src/cheer.ts`): message table from PRD feature 8, one line under the habits on Today, 8 seconds, `role="status"`; unit tests for each trigger including `streak ended` and `welcome back` (they need the previous day's state, so derive them from `/api/day` data, never from a stored flag).
- Mood descriptions: tooltip on hover and focus, line under the faces on selection, `aria-describedby`; texts from PRD feature 3. Check it with a keyboard and on a touch device.
- Scene mode: eye button and `Jurnala` brand; cards fly to the current tab and back (Web Animations API), quote of the day (client-side list indexed by date) when the brand is clicked, `Esc` restores, hidden in Classic, instant under reduced motion. Page headers are sticky on Today, History, Habits.
- Habits motion (match `design/mockup.html`: `flip()` helper): rows glide to new positions (FLIP, 380 ms), archive/restore fly between lists, delete-permanently folds the row shut (300 ms); all instant under reduced motion. Insights chart has a Y axis and a hover tooltip; Calendar ↔ Insights slides sideways. Re-check each in the real React build.
- Habits: add (the user types any habit name), icon-only controls with tooltips, rename in place, drag-and-drop reorder (pointer events; keep Arrow Up/Down on the grip for keyboard), archive with `Undo`, empty state `Start with one small thing.`, and at the limit: `You have 12 habits. Archive one to add another.`
- Settings: Appearance (`Background` Scenes/Classic lives here and nowhere else, and `Preview time of day` Auto/Dawn/Day/Dusk/Night, both radio groups bound to `useTheme`, applied immediately, helper line `Auto follows your clock. Saved on this device.`), `Export my data`, `Sign out` (plays the sign-out transition from `DESIGN.md` Motion: cards sink and fade 280 ms, then the sign-in card rises 480 ms; instant under reduced motion; ignore clicks while it runs).
- Loading, error and empty states on every screen. Errors say what happened and what to do.

Done when the full flow works in a browser: sign in → add a habit → tick it → save a reflection → see it in read mode → `Edit` and save changes → open History → jump to a month a year back with the picker → open a filled day (read) → open an empty day → `Edit this day`, write and save, `Back to today` → change Background to Classic and Preview to Night in Settings → reload (choice kept) → export → sign out. Run it once at 390px and once at 1440px; no horizontal scroll on any screen. Screenshots of History (Scenes, all four phases, 390px) and the day sheet at 390px and 1440px. Contrast for History and Settings measured as in B8.

## B10 — Production deploy + runbook

Do:
- `wrangler d1 migrations apply DB --remote` (take `npx wrangler d1 export DB --remote --output <file>` first once the database has data), `wrangler deploy`.
- Create the Owner's account with `scripts/create-user.ts --remote`; hand the printed password to the Owner in the terminal only.
- Write `docs/runbook.md`: deploy, create a user, weekly backup (`wrangler d1 export`), restore (Time Travel and from export), how to read logs (`wrangler tail`).

Done when (from a phone, in production): sign in, tick a habit, save a reflection, open History, export. `wrangler d1 export` row counts for `entries` and `checkins` equal `SELECT count(*)` in production D1. `wrangler tail` during use shows no CPU-limit errors.
