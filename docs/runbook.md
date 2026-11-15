# Runbook

How to operate Jurnala in production. Run every command from the project folder:

```
cd /Users/dwi.baskoro/Documents/personal_projects/jurnala
```

Production URL: `https://jurnala.dwiprastyab.workers.dev`. Database: D1 `jurnala` (see [database.md](database.md)).

Note: some Indonesian ISP DNS (XL Axiata) blocks `workers.dev`. For `curl`, add `--doh-url https://cloudflare-dns.com/dns-query`. On a phone, set Private DNS to `one.one.one.one`.

## 1. Deploy a code change

| Step | Command | Expect |
|---|---|---|
| 1. Test | `npm test` | all tests pass |
| 2. Deploy | `npm run deploy` | builds (`tsc` + `vite`), then deploys. A type error stops it. |
| 3. Health check | `curl -s --doh-url https://cloudflare-dns.com/dns-query https://jurnala.dwiprastyab.workers.dev/api/health` | `{"ok":true}` |
| 4. Try it | Open the app, use the feature you changed. Run `npx wrangler tail` meanwhile. | no errors in the tail |

## 2. Deploy a change that touches the database

There is no staging. Order matters: migrate production first, then deploy the code. Only make additive changes (new table or column), so the old code keeps working during the gap.

| Step | Command |
|---|---|
| 1. Add a NEW file `migrations/000N_name.sql`. Never edit an old one: wrangler tracks files by name. | (editor) |
| 2. Try it locally | `npx wrangler d1 migrations apply DB --local` then `npm test` |
| 3. Back up production | `npx wrangler d1 export DB --remote --output ~/jurnala-backup-$(date +%F).sql` |
| 4. Migrate production | `npx wrangler d1 migrations apply DB --remote` |
| 5. Deploy the code | `npm run deploy` |
| 6. Update [database.md](database.md) | (editor) |

## 3. Create or reset a user

The password is printed once. Save it in a password manager. Never put it in chat, files or commits (the repo is public).

| I want to… | Command |
|---|---|
| Create a user | `npx tsx scripts/create-user.ts someone@example.com "Full Name" --remote` |
| Reset a password | `npx tsx scripts/create-user.ts someone@example.com --reset --remote` |
| Practice on the local DB | replace `--remote` with `--local` |

Reset signs the user out on every device and keeps their data. An unknown email stops with `No user with email ... Nothing changed.`. Never delete a user row (no cascade, data would be orphaned).

Check the result: `npx wrangler d1 execute DB --remote --command "SELECT id, email, name, created_at FROM users"`

## 4. Back up (weekly)

```
npx wrangler d1 export DB --remote --output ~/jurnala-backup-$(date +%F).sql
```

Check the file before you trust it:

| Check | Command |
|---|---|
| File is not empty | `ls -lh ~/jurnala-backup-$(date +%F).sql` |
| It has our tables | `grep -c "CREATE TABLE" ~/jurnala-backup-$(date +%F).sql` (expect 6 plus `d1_migrations`) |
| Row counts match production | `grep -c "INSERT INTO" <file>` should equal the total rows of all tables (including `d1_migrations`) plus 1 for the internal `sqlite_sequence` row. Get counts with [database.md](database.md) section 7, `--remote`. Verified 2026-11-16. |

The backup holds journal text. Keep it off GitHub, shared drives and chat.

### 4a. Copy the backup to Google Drive (encrypted)

One-time setup with `rclone config` (own Google OAuth client, Desktop app type):

| Remote | Type | Points to |
|---|---|---|
| `gdrive` | `drive` | My Drive. Answer `n` to "Shared Drive". |
| `gdrive-crypt` | `crypt` | `gdrive:jurnala-backup`, standard filename and directory encryption |

Save both generated crypt passwords (password and salt) in a password manager. Without them the backups cannot be opened. `rclone config show` also reveals them: never paste its output anywhere.

Each week, after the export in section 4:

| Step | Command | Expect |
|---|---|---|
| 1. Upload | `rclone copy ~/jurnala-backup-$(date +%F).sql gdrive-crypt: -v` | no errors |
| 2. Check it is there | `rclone ls gdrive-crypt:` | the file, same size as the local one |
| 3. Restore test (occasionally) | `mkdir -p ~/restore-test && rclone copy gdrive-crypt: ~/restore-test && diff ~/jurnala-backup-$(date +%F).sql ~/restore-test/jurnala-backup-$(date +%F).sql && echo SAME` | `SAME`, then `rm -r ~/restore-test` |

In the Drive web UI the folder `jurnala-backup` shows random names. That is the encryption working.

If the Google app status is "Testing", the token expires after 7 days (not verified). If `rclone` says the token is invalid or expired, run `rclone config reconnect gdrive:`.

## 5. Restore

Two safety nets: D1 Time Travel (the last 7 days on the Free plan) and your own export files.

### 5a. Time Travel (undo a bad change from the last 7 days)

| Step | Command |
|---|---|
| 1. Take a backup of the current state first | section 4 |
| 2. Find the bookmark for a moment just before the mistake (RFC3339 time, UTC) | `npx wrangler d1 time-travel info DB --timestamp 2026-11-16T08:00:00Z` |
| 3. Restore to it | `npx wrangler d1 time-travel restore DB --timestamp 2026-11-16T08:00:00Z` (or `--bookmark <id>`) |
| 4. Check | count rows and list users (database.md section 7, `--remote`) |

The restore replaces the whole database. Everything written after that moment is lost. `info` and `restore` accept a timestamp and a bookmark: confirmed with `--help`, not yet run on this database.

### 5b. From an export file

Not tested yet. Practise once on the local DB before you ever need it. Never run it first on production. To replay a file into the local database:

```
npx wrangler d1 execute DB --local --file ~/jurnala-backup-YYYY-MM-DD.sql
```

The export file already contains `CREATE TABLE`, so run it against an empty database, not a migrated one. Restoring to production from a file needs a new empty D1 database (change `database_id` in `wrangler.jsonc`), so prefer Time Travel for production.

## 6. Roll back a bad deploy

| Step | Command |
|---|---|
| List recent deployments | `npx wrangler deployments list` |
| Roll back to the previous one | `npx wrangler rollback` (or `npx wrangler rollback <version-id>`) |

This only reverts code. It does not revert the database. If a migration caused the problem, use section 5a.

## 7. Look at logs

| I want to… | Command |
|---|---|
| Watch live requests | `npx wrangler tail` |
| Only errors | `npx wrangler tail --status error` |
| Readable format | `npx wrangler tail --format pretty` |

`tail` shows only live traffic, not history. Error 1102 means the Worker went over its CPU limit (10 ms on Free). If it appears after login, the PBKDF2 iterations are too high: see "Spike result" in `CLAUDE.md`.

## 8. Limits (Free plan)

| Limit | Value |
|---|---|
| CPU per request | 10 ms |
| Requests per day | 100,000 |
| D1 size per database | 500 MB |
| Time Travel | 7 days |

(From `CLAUDE.md`, verified 2026-11-14.)
