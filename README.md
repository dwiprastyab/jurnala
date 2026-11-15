# Jurnala

A habit tracker with a guided daily reflection. Tick off your habits, answer four fixed questions each evening, and be done in under two minutes. It sits on a full-screen illustrated scene that follows the time of day.

> **Status: backend and frontend built locally, not deployed.** B1 and B3–B9 are done and run on `wrangler dev` / Vite. B2 (PBKDF2 spike on the real free plan) and B10 (production deploy) are still pending and need the owner. Nothing runs on Cloudflare yet.

Jurnala is a **learning project**. The main goal is to learn free hosting on Cloudflare: Workers, Static Assets and D1. Version 1 "graduates" when its owner has used it in production for 14 days in a row. It is built for one person, mostly on a phone, mostly in the evening. It is not a multi-user product yet (see [Known limits](#known-limits-accepted-for-v1)).

All product copy is English.

## What v1 does

| Area | What you get |
|---|---|
| **Sign in / out** | Email and password. Accounts are created by an admin script only; there is no public sign-up. Five failed attempts in 15 minutes locks that email for 15 minutes. |
| **Today** | A greeting that follows the local time, yesterday's "one thing for tomorrow" shown back to you, your active habits with streaks (one tap to tick), and the reflection card. |
| **Reflection** | Four prompts, always in this order: mood on a 5-face scale, `What went well today?`, `What was hard?`, `One thing for tomorrow`. All optional, at least one required. One per day, past days editable. Read mode and edit mode. |
| **History** | A month calendar (weeks start Monday) coloured by mood, with a dot on days where every habit was done. A day sheet shows the habits and the reflection. A picker jumps to any month or day since sign-up. |
| **Insights** | After 7 days with an entry: this month's streaks and average mood, habits over time by day, week or month, a per-habit 30-day rate, and milestones (7 to 365 days). |
| **Habits** | Add, rename, drag to reorder, archive. Max 12 active, names up to 60 characters. The only way to delete is `Delete permanently` on an already archived habit, after a confirmation. |
| **Encouragement** | Plain text only. No points, XP, confetti or sound, and the app never blames you. Examples: `A start is the hardest part. You made it.` |
| **Settings** | Background (`Scenes` or `Classic`), a time-of-day preview, `Export my data (CSV)`, and `Sign out`. |
| **Backgrounds** | Four animated vector scenes (dawn, day, dusk, night) that cross-fade over 1.2 s, or a `Classic` gradient with a sun or moon orb. All motion stops under `prefers-reduced-motion`. |

The full text, including every exact message, is in [`docs/PRD.md`](docs/PRD.md).

### What v1 deliberately does not do

Public sign-up, self-service password reset, reminders or notifications, PWA or offline use, weekly or custom habit schedules, attachments or any formatting beyond bold, italic and lists, and account deletion. The last two groups are required before any second user is allowed.

## Tech stack (decided, final for v1)

| Layer | Choice | Why |
|---|---|---|
| Platform | One Cloudflare Worker on the **free plan**: Static Assets (the SPA) + `/api/*` + D1 | The learning goal. Cloudflare's docs say to start new projects on Workers, not Pages. |
| Frontend | React + Vite + `@cloudflare/vite-plugin` + Tailwind v4, TypeScript | No router library, no state library. |
| API | Hand-written `switch` router in `worker/` | No Hono or other framework. |
| Database | Cloudflare D1 (SQLite) | Free, 500 MB per database. |
| Auth | Email + password (PBKDF2-SHA256 via WebCrypto), session in an `HttpOnly; Secure; SameSite=Strict` cookie | Built here on purpose, small and auditable. |
| Tests | Vitest + `@cloudflare/vitest-plugin` against a real local D1 | Tests run on the real runtime, not mocks. |
| Environments | Local (`wrangler dev`) and production. No staging. | One user, one environment that matters. |
| Backup | Weekly manual `wrangler d1 export`, plus D1 Time Travel (7 days on Free) | |

## Design principles that shape the code

- **Journal data is sensitive.** All SQL lives in one file, `worker/db.ts`, and every function in it takes `userId` and filters by it. A test, `test/isolation.test.ts`, must prove that user A cannot read or change user B's data on every endpoint.
- **Free plan only.** 10 ms CPU per request, 100,000 requests per day, D1 500 MB. Nothing may need a paid plan. The password hashing iteration count is chosen by a spike (task B2) measured on the real free plan, before any feature is built.
- **The server never computes "today".** The browser sends its local date as `YYYY-MM-DD`. The one exception is naming the export file.
- **Theme is a per-device choice.** Stored in `localStorage`, never on the server. The only images are the four scene SVGs, loaded as `<img>`.
- **No secrets in the repo.** The admin script prints a generated password once and writes it nowhere.

## Repository layout

```
.
├── CLAUDE.md              Rules and decisions for AI coding agents working in this repo
├── DESIGN.md              Visual system: tokens, components, motion, accessibility
├── README.md              This file
├── LICENSE                MIT
├── docs/
│   ├── PRD.md             What v1 is and is not, with every exact UI string
│   ├── api.md             Request and response shapes for every endpoint
│   ├── architecture.md    How the pieces fit: request flow, data model, security, free-plan budget
│   ├── development.md     Prerequisites, planned commands, how to work task by task
│   ├── plan.md            Ordered build tasks B1–B10, each with a verification step
│   └── agents/            Config for the engineering agent skills (issue tracker, labels, domain docs)
└── design/
    ├── README.md          How to open and preview the mockup
    ├── mockup.html        Clickable mockup, Classic theme and all component CSS (vanilla HTML/CSS/JS)
    ├── scenes/            The four time-of-day SVGs, plus a README and reference CSS
    ├── mood/              The five drawn mood faces
    └── favicon/           Icons
```

The `worker/`, `src/`, `migrations/`, `scripts/` and `test/` folders appear as the build tasks create them.

## Documentation map

Read in this order:

1. [`docs/PRD.md`](docs/PRD.md): the product. Wins on behaviour and copy.
2. [`docs/api.md`](docs/api.md): the API contract. Wins on request and response shapes.
3. [`docs/architecture.md`](docs/architecture.md): how it is put together.
4. [`DESIGN.md`](DESIGN.md): the look. Where it disagrees with the mockup or the scene SVGs, **they win**.
5. [`docs/plan.md`](docs/plan.md): the work, in order.
6. [`docs/development.md`](docs/development.md): how to run things.

## Try the design now

No install needed. Serve the `design/` folder and open the mockup:

```sh
cd design
python3 -m http.server 8912
# open http://localhost:8912/mockup.html
```

The mockup is a front-end only prototype with fake data. Sign in with any values, then use the tabs. Settings lets you switch between Scenes and Classic and preview each time of day. See [`design/README.md`](design/README.md).

The approved Scenes design board is a private Claude artifact (`https://claude.ai/artifact/NeCzjFJPkNC1BATiBCQX3y`) and will not open for other people. Its content is exported into `design/scenes/` and `DESIGN.md`.

## Build plan

Ten tasks, done in order, one commit each, each with a check that must pass before the next. Full detail in [`docs/plan.md`](docs/plan.md).

| Task | What | Needs the owner |
|---|---|---|
| B1 (done) | Scaffold: Vite + React + Worker + Tailwind v4 + Vitest, `GET /api/health` | |
| B2 | **PBKDF2 spike** and first deploy. Pick the hashing iteration count on the real free plan. Must come before any feature. | Cloudflare account, `wrangler login` |
| B3 (done) | Migration and `worker/db.ts` | |
| B4 (done) | Auth and the admin `create-user` script | |
| B5 (done) | Habits, check-ins, streaks | |
| B6 (done) | Reflections, day view, history, insights, CSV export | |
| B7 (done) | Isolation tests: user A vs user B on every endpoint | |
| B8 (done) | UI: theme and scenes, tokens, Sign in, Today (including a text-contrast measurement over the scenes) | |
| B9 (done) | UI: History, Habits, Settings, empty and error states | |
| B10 | Production deploy and runbook | Production access |

## Success measures

- A reflection exists for 14 days in a row.
- Filling in one day takes under 2 minutes.
- The isolation test passes.
- The CSV export has one row per entry, and its row count equals the production `entries` count.

## Known limits accepted for v1

- A wrong phone clock or travel across time zones shifts which date an entry lands on.
- History's "every habit done" dot compares against the habits active now, not those active on that day.
- Appearance settings do not follow you to another device or browser.
- In the Scenes theme the sun and moon are part of the picture and do not move with the clock; only the phase changes.
- The CSV export leaves out a day that has check-ins but no reflection. The full backup is `wrangler d1 export`.
- Accounts exist only through the admin script. Account and data deletion and self-service password reset are required before any second user.

## Unverified assumptions

Tracked in [`CLAUDE.md`](CLAUDE.md) and settled by the tasks above: text contrast over the scenes (B8 measures it), scene animation cost on low-end phones, D1 free daily row read and write quotas, the Workers runtime cap on PBKDF2 iterations (believed to be 100,000), and whether the name `jurnala` is free as a Worker on the owner's account.

## Working with AI coding agents

This repo is set up to be built with an AI coding agent. [`CLAUDE.md`](CLAUDE.md) holds the rules the agent must follow, [`docs/plan.md`](docs/plan.md) holds the ordered tasks, and [`docs/agents/`](docs/agents/) holds the issue tracker, label and domain-doc configuration for the engineering skills.

## License

[MIT](LICENSE) © 2026 Dwi Prastya Baskoro
