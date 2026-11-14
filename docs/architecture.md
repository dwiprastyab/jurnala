# Jurnala v1 — Architecture

How the pieces fit. This describes the **planned** system: no application code exists yet (see [`plan.md`](plan.md)). Where this file and [`api.md`](api.md) disagree on shapes, `api.md` wins. Where it and [`PRD.md`](PRD.md) disagree on behaviour, `PRD.md` wins.

## Overview

One Cloudflare Worker on the free plan does everything:

```
Browser (React SPA)
   │  GET /, /assets/*            ──► Static Assets (served by Cloudflare, no Worker code runs)
   │  /api/*                      ──► Worker (worker/index.ts → hand-written switch router)
   │                                      │
   │                                      └──► D1 (SQLite), only through worker/db.ts
```

- `wrangler.jsonc`: `assets.run_worker_first: ["/api/*"]` so only API calls reach the Worker; `assets.not_found_handling: "single-page-application"` so any other path returns the SPA; one D1 binding named `DB`.
- Deployed with `wrangler deploy` to `jurnala.<account>.workers.dev`.
- Two environments only: local (`wrangler dev`) and production. No staging.

## Code layout (target)

| Path | Responsibility |
|---|---|
| `worker/index.ts` | Entry point, routes `/api/*` |
| `worker/router.ts` | The `switch` router, origin and content-type checks, error shape |
| `worker/auth.ts` | Password hashing, sessions, login rate limit |
| `worker/db.ts` | **All SQL.** Every function takes `userId` and filters by it |
| `worker/streak.ts` | Streak maths on `YYYY-MM-DD` strings |
| `src/` | React SPA. `src/day.ts` holds `localDay()`, the only way the browser builds a date |
| `migrations/` | D1 migrations |
| `scripts/create-user.ts` | Admin script, the only way to create an account |
| `test/` | Vitest tests, including `isolation.test.ts` |

## Request flow

1. The SPA loads and calls `GET /api/me`. `200` shows Today, `401` shows Sign in.
2. Every request except `GET /api/health` and `POST /api/login` needs a valid `session` cookie, else `401 {"error":"Please sign in again."}`.
3. `POST`, `PUT` and `PATCH` need `Content-Type: application/json` and an `Origin` whose host equals the request host, else `403`.
4. The router calls a `db.ts` function with the session's `userId`. A resource that is missing or belongs to someone else returns the same `404 {"error":"Not found."}`.
5. Errors are always `{"error":"<message>"}`; 500s log the cause server-side without request bodies.

## Data model

Defined in task B3 (`migrations/`). Six tables and two indexes:

| Table | Holds | Key |
|---|---|---|
| `users` | email, name, PBKDF2 hash, salt, iteration count, `created_at` | `id`; `email` unique |
| `sessions` | SHA-256 of the session token, `user_id`, `expires_at` | `token_hash` |
| `login_attempts` | failure count and window start per email | `email` |
| `habits` | `user_id`, name, `sort`, `archived_at`, `created_at` | `id` |
| `checkins` | `habit_id`, `user_id`, `day` (one row = done) | `(habit_id, day)` |
| `entries` | `user_id`, `day`, mood 1–5, three texts, `updated_at` | `(user_id, day)` |

Indexes: `idx_habits_user (user_id)`, `idx_checkins_user_day (user_id, day)`.

Days are `TEXT` in `YYYY-MM-DD` form. Streaks and calendars do date arithmetic on those strings through `Date.UTC`, never on local `Date` objects, so daylight saving cannot shift a day.

## Security model

- **Isolation.** Journal data is sensitive. `worker/db.ts` is the only file with SQL, and each function filters by `userId`. `test/isolation.test.ts` proves user A cannot read or change user B's data on every endpoint.
- **Passwords.** PBKDF2-SHA256 through WebCrypto with a per-user random salt. The iteration count is stored per user and is chosen by the B2 spike on the real free plan (believed cap 100,000, unverified).
- **Sessions.** Random token in an `HttpOnly; Secure; SameSite=Strict; Path=/` cookie, 30 days. Only its SHA-256 is stored.
- **Login.** The same message for an unknown email and a wrong password. 5 failures per email in 15 minutes returns `429`.
- **CSRF.** `SameSite=Strict` plus the `Origin` and content-type check on writes.
- **Accounts.** Created only by `scripts/create-user.ts`, which prints the generated password once and stores it nowhere. No sign-up, no email, no reset flow.
- **Export.** CSV only. Never includes the hash, salt, sessions or login attempts. Cells starting with `=`, `+`, `-`, `@`, tab or CR get a leading `'` so spreadsheets do not run them.
- **Before any second user:** account and data deletion, and a self-service password reset.

## Free-plan budget

| Limit | Value (verified 2026-11-14) | Consequence |
|---|---|---|
| CPU per request | 10 ms | Password hashing is the risk; the iteration count must fit. Local `wrangler dev` does not enforce this, so only production counts. |
| Requests per day | 100,000 | Far above one user's use. |
| D1 size | 500 MB per database | One user's text journal is tiny. |

Unverified: D1 free daily row read and write quotas. `GET /api/insights` scans check-in rows; its cost is checked in B6, and the scan is capped to the last 400 days if CPU time becomes a problem.

## Frontend

- React + Vite + `@cloudflare/vite-plugin` + Tailwind v4, TypeScript. No router library and no state library.
- Appearance (Scenes or Classic, and the time-of-day preview) lives in `localStorage` on the device, never on the server.
- The only images are the four scene SVGs in `public/scenes/`, loaded as `<img>`. Motion stops under `prefers-reduced-motion`.
- Visual rules: [`../DESIGN.md`](../DESIGN.md). The mockup and the scene SVGs win over prose.

## Backup and recovery

Weekly manual `wrangler d1 export`, plus D1 Time Travel (7 days on the Free plan). The step-by-step runbook is written in task B10 as `docs/runbook.md`; it does not exist yet.
