# Database reference

Quick answer to: "what tables do we have, what is in them, and how do I look at them?"

The source of truth for the schema is [`migrations/0001_init.sql`](../migrations/0001_init.sql). If this page and that file disagree, the migration wins. Update this page whenever you add a migration.

## 1. The database at a glance

| Item | Value |
|---|---|
| Engine | Cloudflare D1 (SQLite) |
| Binding name in code | `DB` |
| Database name | `jurnala` |
| Database ID | `7b1046ad-6d35-4200-8994-53b2006c4771` (not a secret) |
| Region | APAC |
| Migrations folder | `migrations/` (one file so far: `0001_init.sql`) |
| All SQL lives in | `worker/db.ts` (every function takes `userId`) |
| Tables | 6 of ours + 1 made by wrangler |

## 2. Where the data lives

| Environment | Where | How to reach it |
|---|---|---|
| Local | A SQLite file under `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/` (the file named `bddb3eab…sqlite`). Not in git. | `--local` flag, or open the file with `sqlite3` |
| Production | Cloudflare D1, account `Dwiprastyab@gmail.com's Account` | `--remote` flag, or the Cloudflare dashboard (Storage & databases, D1, `jurnala`) |

Note: the folder also holds an older file, `9ba2b04b…sqlite`. It is from early QA, from before the real database ID was set. The app does not use it any more.

## 3. Tables

| Table | What it stores | Primary key | Belongs to a user? | Grows with |
|---|---|---|---|---|
| `users` | One row per account: email, name, password hash | `id` | It is the user | Accounts you create |
| `sessions` | One row per active login (the token is stored hashed) | `token_hash` | Yes, `user_id` | Every sign in |
| `login_attempts` | Wrong-password counter per email, for the rate limit | `email` | By email | Failed sign ins |
| `habits` | The habits a user tracks. Archived habits stay here. | `id` | Yes, `user_id` | Habits added |
| `checkins` | "Habit X was done on day Y" | `habit_id` + `day` | Yes, `user_id` | Every tick |
| `entries` | The daily reflection: mood and three text answers | `user_id` + `day` | Yes, `user_id` | One per day written |
| `d1_migrations` | Which migration files already ran. Made by wrangler, not by us. | `id` | No | One per migration |

## 4. Columns, table by table

Type notes: `TEXT` holds words and dates. `INTEGER` holds whole numbers. "Required" means the column can never be empty (`NOT NULL`).

### `users`

| Column | Type | Required | Meaning |
|---|---|---|---|
| `id` | INTEGER | yes (key) | The user's number. Other tables point to this. |
| `email` | TEXT | yes, unique | Sign-in email, always lowercase. Two users cannot share one. |
| `name` | TEXT | yes | Display name |
| `pw_hash` | TEXT | yes | The password, scrambled one way (PBKDF2). It cannot be turned back into the password. |
| `pw_salt` | TEXT | yes | Random value mixed in before hashing |
| `pw_iter` | INTEGER | yes | How many hashing rounds were used (100,000 today) |
| `created_at` | TEXT | yes | When the account was created (ISO time) |

### `sessions`

| Column | Type | Required | Meaning |
|---|---|---|---|
| `token_hash` | TEXT | yes (key) | SHA-256 of the cookie token. The real token is never stored. |
| `user_id` | INTEGER | yes | Who is signed in. Points to `users.id`. |
| `expires_at` | TEXT | yes | When the login stops working (30 days after sign in) |

### `login_attempts`

| Column | Type | Required | Meaning |
|---|---|---|---|
| `email` | TEXT | yes (key) | The email that was tried |
| `fails` | INTEGER | yes | Wrong passwords in the current window (limit is 5) |
| `window_start` | TEXT | yes | When the current 15-minute window began |

### `habits`

| Column | Type | Required | Meaning |
|---|---|---|---|
| `id` | INTEGER | yes (key) | The habit's number |
| `user_id` | INTEGER | yes | Owner. Points to `users.id`. |
| `name` | TEXT | yes | Habit name |
| `sort` | INTEGER | yes | Order on screen (lower comes first) |
| `archived_at` | TEXT | no | Empty means active. A date means archived. |
| `created_at` | TEXT | yes | When the habit was added |

### `checkins`

| Column | Type | Required | Meaning |
|---|---|---|---|
| `habit_id` | INTEGER | yes (key, part 1) | Which habit. Points to `habits.id`. |
| `user_id` | INTEGER | yes | Owner (copied here so queries can filter by user) |
| `day` | TEXT | yes (key, part 2) | The day it was done, `YYYY-MM-DD`, from the browser's local date |

A habit can have only one check-in per day, because the key is `habit_id` + `day`.

### `entries`

| Column | Type | Required | Meaning |
|---|---|---|---|
| `user_id` | INTEGER | yes (key, part 1) | Owner. Points to `users.id`. |
| `day` | TEXT | yes (key, part 2) | The day, `YYYY-MM-DD` |
| `mood` | INTEGER | no | 1 to 5, or empty |
| `went_well` | TEXT | no | Answer to "what went well" |
| `was_hard` | TEXT | no | Answer to "what was hard" |
| `tomorrow` | TEXT | no | Answer to "one thing for tomorrow" |
| `updated_at` | TEXT | yes | When it was last saved |

One reflection per user per day. Saving again replaces the whole row.

## 5. How the tables connect

| From | To | Link |
|---|---|---|
| `sessions.user_id` | `users.id` | a login belongs to one user |
| `habits.user_id` | `users.id` | a habit belongs to one user |
| `checkins.habit_id` | `habits.id` | a tick belongs to one habit |
| `entries.user_id` | `users.id` | a reflection belongs to one user |

There is no automatic cascade. Deleting a user does not delete their habits or entries. This is why you reset a password with `create-user.ts --reset` and never delete the user row.

## 6. Indexes (speed-ups, no data of their own)

| Index | On | Used for |
|---|---|---|
| `idx_habits_user` | `habits(user_id)` | listing one user's habits |
| `idx_checkins_user_day` | `checkins(user_id, day)` | loading one user's ticks for a day or range |

## 7. How to check things yourself

Run commands from the project folder: `cd /Users/dwi.baskoro/Documents/personal_projects/jurnala`.
For production, replace `--local` with `--remote`.

| I want to… | Command |
|---|---|
| List all tables | `npx wrangler d1 execute DB --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"` |
| See the columns of one table | `npx wrangler d1 execute DB --local --command "PRAGMA table_info(habits)"` |
| See the full `CREATE` SQL of everything | `npx wrangler d1 execute DB --local --command "SELECT sql FROM sqlite_master WHERE sql IS NOT NULL"` |
| Count rows in every table | `npx wrangler d1 execute DB --local --command "SELECT (SELECT count(*) FROM users) users, (SELECT count(*) FROM habits) habits, (SELECT count(*) FROM checkins) checkins, (SELECT count(*) FROM entries) entries, (SELECT count(*) FROM sessions) sessions"` |
| List users (no hashes) | `npx wrangler d1 execute DB --local --command "SELECT id, email, name, created_at FROM users"` |
| See which migrations ran | `npx wrangler d1 execute DB --local --command "SELECT * FROM d1_migrations"` |
| Apply new migrations | `npx wrangler d1 migrations apply DB --local` |
| Open the local file in a SQLite shell | `sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/bddb3eab647a865648de54dbcc55124def3ec824329ac62486867226f3fc09f6.sqlite` |
| Back up production | `npx wrangler d1 export DB --remote --output ~/jurnala-backup.sql` |

Inside the `sqlite3` shell:

| Type | Result |
|---|---|
| `.tables` | list tables |
| `.schema habits` | schema of one table |
| `.schema` | schema of all tables |
| `.headers on` then `.mode column` | readable `SELECT` results |
| `.quit` | leave |

## 8. Safety rules

| Rule | Why |
|---|---|
| Never `SELECT` `pw_hash` or `pw_salt` into chat, issues or commits | The repo is public. Hashes are secrets. |
| Journal text is sensitive. Do not paste `entries` content into issues or chat. | Same reason. |
| Back up before any `--remote` write (`UPDATE`, `DELETE`, migration) | Time Travel covers 7 days, but a file export is your own copy. |
| Do not delete a user row | No cascade, so their data would be orphaned. Use `create-user.ts <email> --reset`. |
| Change the schema only by adding a new file in `migrations/` | Never edit `0001_init.sql` after it ran in production. |
