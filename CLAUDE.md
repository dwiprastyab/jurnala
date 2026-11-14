# Jurnala

Habit tracker + guided daily reflection. A learning project: the main goal is to learn free hosting on Cloudflare (Workers, Static Assets, D1). v1 "graduates" when the Owner has used it in production for 14 days in a row. Product copy is always English. Separate project from Sehari (different repo, do not reuse its code or Docker setup).

## Read first

- `docs/PRD.md` — what v1 is and is not.
- `DESIGN.md` — visual system. Approved look: the Scenes board (https://claude.ai/artifact/NeCzjFJPkNC1BATiBCQX3y) with the SVGs in `design/scenes/` (default theme), and `design/mockup.html` (Classic theme + component CSS). They win over prose when they disagree.
- `docs/api.md` — exact request/response shapes and error messages for every endpoint.
- `docs/plan.md` — ordered build tasks B1–B10. Do them in order, one task = one commit, run the task's verification before moving on.

## Decisions (final for v1)

- **Platform:** one Cloudflare Worker on the free plan: Static Assets (React SPA) + `/api/*` + D1. Deployed with `wrangler deploy` to `jurnala.<account>.workers.dev`. Not Pages: Cloudflare's docs say "If you are starting a new project, use Workers instead of Pages" (verified 2026-11-14).
- **Frontend:** React + Vite + `@cloudflare/vite-plugin` + Tailwind v4, TypeScript. No router library, no state library.
- **API:** hand-written `switch` router in `worker/`. No Hono or other framework.
- **Auth:** email + password, built here. Accounts are created by the admin script only; no sign-up, no email sending, no password reset flow. Session in an `HttpOnly; Secure; SameSite=Strict` cookie.
- **Theme:** Scenes (default; four static SVGs in `public/scenes/`, loaded as `<img>`) or Classic (gradient + orb). Chosen per device in `localStorage`, never on the server. No images other than these SVGs.
- **Days:** the browser sends its local date as `YYYY-MM-DD`. The server never computes "today".
- **Habits:** daily only; archive first. The only way to remove one is `Delete permanently` on an already-archived habit (confirm step; wipes its check-ins). No delete on active habits.
- **Reflection:** one per day, four fixed prompts (see PRD), past days editable.
- **Tests:** Vitest + `@cloudflare/vitest-pool-workers` against a real local D1.
- **Environments:** local (`wrangler dev`) and production. No staging.
- **Backup:** weekly manual `wrangler d1 export`, plus D1 Time Travel (7 days on Free).

## Rules that must not be broken

- **Journal data is sensitive.** All SQL lives in `worker/db.ts`, and every function there takes `userId` and filters by it. `test/isolation.test.ts` must prove user A cannot read or change user B's data on every endpoint.
- **Free plan only.** 10 ms CPU per request, 100,000 requests/day, D1 500 MB per database (verified 2026-11-14). Nothing that needs a paid plan.
- **PBKDF2 spike (task B2) comes before any feature.** Record the result below.
- Never store real credentials in files or memory. The admin script prints the generated password once.
- Needed before any second user: account/data deletion, self-service password reset.

## Spike result (fill in at B2)

- PBKDF2-SHA256 iterations chosen: _not yet tested_
- Observed on production free plan: _not yet tested_

## Unverified assumptions

Text contrast over the Scenes (not yet measured; B8 measures it); scene SVG animation cost on low-end phones; D1 free daily row read/write quotas; the Workers runtime cap on PBKDF2 iterations (believed 100,000); whether `jurnala` is free as a Worker name on the Owner's account.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `dwiprastyab/jurnala` (use `gh`). The repo is public: no credentials or real journal content in issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root (neither exists yet). See `docs/agents/domain.md`.
