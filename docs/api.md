# Jurnala v1 — API contract

Source of truth for request and response shapes. The backend (B4–B6) implements it, the frontend (B8–B9) calls it, tests assert it. If code and this file disagree, fix one of them in the same commit.

## Rules for every endpoint

- Base path `/api`. JSON in, JSON out, UTF-8. Dates are `YYYY-MM-DD` strings in the browser's local time; the server never computes "today".
- **The journal follows the user's local time.** The day is always the browser's local calendar date. Build it from local parts (`getFullYear()`, `getMonth()+1`, `getDate()`, zero-padded). Never use `toISOString()` or `toJSON()` for a day: they give the UTC date, which is yesterday for someone in UTC+7 before 07:00. Put this in one helper, `localDay(date = new Date())` in `src/day.ts`, and use only it.
- **Date arithmetic is on the string, not on local `Date` objects.** "Previous day", "next day", month grids and streaks parse `YYYY-MM-DD` into `Date.UTC(y, m-1, d)`, add days there, and format with the UTC getters. This is DST-safe. Both the Worker (`streak.ts`) and the browser use the same approach; test it across a month end, a year end, 29 February and a DST change.
- Everything except `GET /api/health` and `POST /api/login` needs a valid session cookie. Missing or expired → `401 {"error":"Please sign in again."}`.
- Write methods (`POST`, `PUT`, `PATCH`, `DELETE`) need an `Origin` whose host equals the request host, and, except `DELETE` (no body), `Content-Type: application/json`; otherwise `403 {"error":"That request isn't allowed."}`.
- Errors are always `{"error":"<message>"}`. The message is shown to the user as is, so it says what happened and what to do.
- A resource that does not exist or belongs to another user is the same `404 {"error":"Not found."}`. Never reveal which.
- Unknown JSON fields are ignored. Wrong types → `400 {"error":"That isn't valid."}`.
- `day` path parameters must match `^\d{4}-\d{2}-\d{2}$` and be a real calendar date, else `400 {"error":"That date isn't valid."}`. Days later than tomorrow (server UTC date + 1) are rejected the same way, to absorb time zones without trusting the client completely.
- Text answers: strings, trimmed, at most 4,000 characters, else `400 {"error":"Keep each answer under 4,000 characters."}`. Empty string and `null` both mean "no answer" and are stored as `null`.

## Auth

### `POST /api/login`
Body `{"email":"a@b.c","password":"…"}`.
- `200 {"user":{"name":"Dwi","email":"a@b.c"}}` and `Set-Cookie: session=…; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`.
- `401 {"error":"That email or password isn't right."}` (same for unknown email and wrong password).
- `429 {"error":"Too many attempts. Try again in 15 minutes."}` after 5 failures per email in 15 minutes.

### `POST /api/logout`
`204`, cookie cleared (`Max-Age=0`). Also `204` when there was no session.

### `GET /api/me`
`200 {"user":{"name":"Dwi","email":"a@b.c","created_at":"2026-09-10T03:12:00Z"}}`. The frontend calls it on load to decide between Sign in and Today. `created_at` is the sign-up time in UTC; the browser turns it into a local date with `localDay(new Date(created_at))` and uses that as the first month History can show.

## Habits

A habit object is `{"id":3,"name":"Read","sort":1}`.

### `GET /api/habits`
`200 {"habits":[…]}` — active habits only, ordered by `sort`.

### `POST /api/habits`
Body `{"name":"Read 10 pages"}`. Name trimmed, 1–60 characters.
- `201 {"habit":{…}}`, appended at the end.
- `400 {"error":"Give the habit a name (up to 60 characters)."}`
- `409 {"error":"You have 12 habits. Archive one to add another."}`

### `PATCH /api/habits/:id`
Body with any of `{"name":"…","sort":2,"archived":true}`.
- `200 {"habit":{…}}`. Archived habits stop appearing in `GET /api/habits` and `/api/day`; their check-ins stay.
- `archived:false` restores a habit (used by `Undo`). If that would make 13 active → `409` with the message above.
- `sort` is the new 0-based position among active habits; the server renumbers the others so `sort` stays contiguous.
- Same validation errors as `POST` for `name`. `404` for an unknown or foreign id.

## Check-ins

### `PUT /api/checkins/:habitId/:day`
Body `{"done":true}`. Idempotent.
- `200 {"habit_id":3,"day":"2026-11-14","done":true,"streak":12,"first":false}` where `streak` follows the PRD rule, counted for that day. `first` is `true` only when this ticked check-in is the user's only check-in ever (drives the first-check-in line).
- `DELETE /api/habits/:id` → `204`. Only for an archived habit; an active one → `409` `Archive this habit first.`. Deletes the habit and all its check-ins. Not undoable. `404` when not the caller's.
- `GET /api/habits?archived=1` → the caller's archived habits (for the Archived list and Restore).
- `404` when the habit is not the caller's. Check-ins for an archived habit → `404` too.

## Reflections

An entry object is
```json
{"day":"2026-11-14","mood":4,"went_well":"…","was_hard":null,"tomorrow":"…","updated_at":"2026-11-14T20:15:00Z"}
```
`mood` is 1–5 or `null`; the three texts are strings or `null`.

### `PUT /api/entries/:day`
Body `{"mood":4,"went_well":"…","was_hard":"…","tomorrow":"…"}`; any field may be omitted or `null`. Saving replaces the whole entry (omitted = cleared).
- `200 {"entry":{…}}`
- `400 {"error":"Add at least one answer."}` when mood and all texts are empty.
- `400 {"error":"Pick a mood from 1 to 5."}` for a mood outside 1–5 or not an integer.

## Day view

### `GET /api/day/:day`
```json
{
  "day": "2026-11-14",
  "habits": [{"id":3,"name":"Read","done":true,"streak":12,"prev_streak":0}],
  "entry": null,
  "yesterday_tomorrow": "Call Mom",
  "last_active": "2026-11-12"
}
```
- `habits`: active habits in `sort` order. `streak` is counted for that day.
- `entry`: the entry object above, or `null` if nothing is saved.
- `yesterday_tomorrow`: the previous day's `tomorrow` text, or `null`.
- `prev_streak`: when the habit is not done that day and its streak is 0 (the day before was missed), the length of the run that ended just before it; else `0`. Feeds the `streak ended` line (3 or more).
- `last_active`: latest day before `day` with a check-in or a saved reflection, or `null`. Feeds the `welcome back` line (2 or more full days away).

## History

### `GET /api/history?from=YYYY-MM-DD&to=YYYY-MM-DD`
Inclusive range, at most 42 days, `from` ≤ `to`; otherwise `400 {"error":"Pick a range of up to 6 weeks."}`.
```json
{
  "days": [{"day":"2026-11-13","mood":4,"entry":true,"done":3,"total":3}]
}
```
- One item per day that has an entry or at least one check-in. Missing days mean "nothing saved".
- `mood` is `null` when the day has check-ins but no entry mood. `entry` is `true` when a reflection exists (with or without a mood).
- `done` counts check-ins for habits active now; `total` is the number of habits active now. The UI draws the ring when `total > 0 && done === total`. (Known shortcut in the PRD.)

### `GET /api/insights?today=YYYY-MM-DD`
`today` is the browser's local date (same validation as `day`). One call feeds the whole Insights view; the browser derives the best weekday, the This month stats and milestones from it. The Habits-over-time bars (Day, Week or Month, any period since sign-up) come from `GET /api/history` called in chunks of up to 42 days, because that card can show any month or year.
```json
{
  "entries": 41,
  "days": [{"day":"2026-11-13","mood":4,"entry":true,"done":3,"total":3}],
  "habits": [{"id":3,"name":"Read","last30":87,"done30":26,"span30":30,"best_streak":14,"streak":5}]
}
```
- `entries`: count of days with a saved reflection, all time (the browser shows the empty state under 7).
- `days`: the 84 days ending on `today`, same item shape and rules as `/api/history` (missing day = nothing saved). 84 days covers 8 weeks plus the 12-week best-weekday sentence.
- `habits`: active habits in `sort` order. `last30` is the percent (0–100, rounded) of the 30 days ending on `today` with a check-in, counting only days on or after the habit's `created_at`; `done30` and `span30` are the numerator and denominator behind it (`span30` is under 30 for a habit younger than 30 days: the window starts on the later of today−29 and the habit's creation day); `best_streak` is the longest run of consecutive check-in days ever; `streak` is the current one (same rule as `/api/day`).
- Free-plan check (B6): one user, 12 habits, 3 years of data is about 13,000 check-in rows. Compute `best_streak` in SQL or one pass over `(habit_id, day)` ordered rows; if CPU time is a problem, cap the scan at the last 400 days and say so here.

## Export

### `GET /api/export`
`200`, `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="jurnala-export-YYYY-MM-DD.csv"` (server UTC date; this is the one place the server picks a date, and it only names a file). UTF-8 with BOM. Never JSON.

One row per day that has a saved reflection, oldest first. Columns: `date,mood,went_well,hard,tomorrow`, then one `1`/`0` column per habit (header = habit name, archived habits included, in `sort` order). `mood` is 1–5, or empty. Cells that contain a comma, quote or newline are quoted (`"` doubled). A cell starting with `=`, `+`, `-`, `@`, tab or CR gets a leading `'` so spreadsheets do not run it as a formula.
```csv
date,mood,went_well,hard,tomorrow,Read,Walk
2026-11-14,4,"Shipped it, finally",,Rest,1,0
```
Never includes `pw_hash`, `pw_salt`, sessions, or login attempts. The number of data rows must equal the user's count of `entries` (checked in B6 and again in B10). Known limit: a day with check-ins but no reflection is not in the file; the full backup is `wrangler d1 export`.

## Health

### `GET /api/health`
`200 {"ok":true}`. No auth.

## Status codes in one place

| Code | When |
|---|---|
| 200 / 201 / 204 | Success |
| 400 | Invalid input (messages above) |
| 401 | No session, expired session, wrong credentials |
| 403 | Origin or content type rejected |
| 404 | Unknown route, or a resource that is not the caller's |
| 409 | 12-habit limit |
| 429 | Login rate limit |
| 500 | `{"error":"Something went wrong. Try again."}`; log the cause server-side without request bodies |
