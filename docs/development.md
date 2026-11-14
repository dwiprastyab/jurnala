# Development

> **Status: nothing below runs yet.** There is no `package.json`. Task B1 creates the project. Commands in the "Planned" section are what B1 is meant to provide; each is checked by B1's "Done when". Until then, only the design preview works.

## Works today: preview the design

```sh
cd design
python3 -m http.server 8912
# open http://localhost:8912/mockup.html
```

Details in [`../design/README.md`](../design/README.md).

## Prerequisites (for B1 onwards)

- Node.js and npm (a current LTS).
- A Cloudflare account on the free plan, and `npx wrangler login`. Needed from task B2 (first deploy). Not needed for B1, B3–B7 locally.
- `git` and, for issues, the `gh` CLI.

## Planned commands (from [`plan.md`](plan.md) B1)

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server with the Worker; `curl -s localhost:5173/api/health` returns `{"ok":true}` |
| `npx vitest run` | Tests against a real local D1 via `@cloudflare/vitest-plugin` |
| `npx wrangler d1 migrations apply DB --local` | Apply migrations to the local D1 (B3) |
| `npx wrangler deploy` | Deploy to production (first at B2) |

The admin script (`scripts/create-user.ts`, B4) creates accounts and prints the password once. Run it with `--remote` only for production.

## How to work

1. Read [`PRD.md`](PRD.md), [`api.md`](api.md) and [`plan.md`](plan.md).
2. Do the tasks **in order**, B1 to B10. One task is one commit.
3. Run the task's "Done when" check before starting the next. Do not move on with a red test.
4. **B2 (PBKDF2 spike) comes before any feature.** Record the result in [`../CLAUDE.md`](../CLAUDE.md) under "Spike result".
5. If code and [`api.md`](api.md) disagree, fix one of them in the same commit.

## Rules to keep in mind

- All SQL lives in `worker/db.ts`, and every function takes `userId`.
- Nothing may need a paid Cloudflare plan.
- The browser builds dates with `localDay()` only; never `toISOString()` for a day.
- Never put real credentials in files, commits or issues. `.dev.vars` is git-ignored.
- Product copy is English.

## Issues

GitHub Issues on `dwiprastyab/jurnala`, driven with `gh`. See [`agents/issue-tracker.md`](agents/issue-tracker.md) and [`agents/triage-labels.md`](agents/triage-labels.md).
