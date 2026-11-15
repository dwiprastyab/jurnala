# Jurnala v1 — Product Requirements

## Problem

The Owner wants one calm place to close the day: tick off habits, answer the same few questions every evening, and be done in under two minutes.

## User

One person (the Owner), mostly on a phone, mostly in the evening.

## Features

### 1. Sign in and sign out
Email and password. The account is created by the admin script. A wrong email or a wrong password shows the same message: `That email or password isn't right.` After 5 failed attempts in 15 minutes: `Too many attempts. Try again in 15 minutes.`

### 2. Today
- A greeting that follows the local time: `Good morning, <name>`, `Good afternoon, <name>`, `Good evening, <name>`, and the date.
- If yesterday's reflection has a "tomorrow" answer, it shows at the top: `Yesterday you said` followed by the answer.
- The list of active habits. One tap ticks or unticks a habit for the day. Each habit shows its streak: `12-day streak`, or nothing when the streak is 0.
- The reflection card (below).
- A one-line encouragement under the habits when a streak milestone is hit or every habit is done (see feature 8). It fades after 8 seconds.
- When every habit is ticked and the reflection is saved: `That's today. See you tomorrow.`

### 3. Daily reflection
Four inputs, always in this order. Each is optional, but at least one must be filled: saving an empty form shows `Add at least one answer.` and saves nothing.

| # | Prompt | Input |
|---|---|---|
| 1 | `How did today feel?` | One tap on a 5-step scale of drawn faces (`design/mood/`): `Rough`, `Low`, `Okay`, `Good`, `Great`. Each face has a short description (table below) shown as a tooltip on hover and keyboard focus, and, for touch, as a line under the faces once a face is chosen (`Good: A good day. More ups than downs.`). Linked to the button with `aria-describedby`. The word also shows in the accessible label. |
| 2 | `What went well today?` | Rich text (below) |
| 3 | `What was hard today?` | Rich text |
| 4 | `What's one thing for tomorrow?` | Rich text |

**Rich text editor (prototype):** each answer is a formatted field, not a plain textarea. Tools top right of each answer: `Bold`, `Italic`, `Emoji` (a 16-emoji popover) and `Expand` (the field grows into a centred panel over a dimmed page, 380 ms; `Collapse`, a click outside or `Esc` closes it). Typing `- `, `* ` or `1. ` at the start of a line starts a bullet or numbered list. Paste is always plain text. The answer is stored as limited markdown, never HTML: `**bold**`, `*italic*`, `- ` bullets and `N. ` numbers (`\` escapes a literal `*`, `\` or leading `- `). Nothing else is formatted; the limit of 4,000 characters counts the markdown markers.

**Two modes (approved):**
- **Edit mode** — the form. A day with no saved reflection always opens as an empty form with `Save`. After saving: `Saved.`
- **Read mode** — after saving, and whenever a day already has a reflection. Shows the mood (colour dot + word) and only the answers that were filled, with one `Edit` button. Nothing is editable in read mode.
- `Edit` opens the form pre-filled; `Save` becomes `Save changes` and a `Cancel` button appears. Focus moves to the first text field, and back to `Edit` after saving or cancelling.
- `Cancel` or `Esc` with no changes returns to read mode. With unsaved changes it asks `Discard changes?` with `Discard` and `Keep editing`.
- The same two modes apply to any past day opened from History.

Why these four:
- Prompt 2 comes from the "Three Good Things" exercise (Seligman et al., 2005), the only one here with research behind it. The rest are common practice, not tested findings.
- Prompt 3 gives hard things a place without judging them.
- Prompt 4 ends the day with one small intention, and Today shows it back the next morning. That is the reason to open the app again.
- Mood makes History readable at a glance.
- Four, not five: every extra question lowers the chance the reflection is filled in every day.

| Face | Description |
|---|---|
| Rough | `A heavy day. Most things felt hard.` |
| Low | `A bit down or drained. Not your best day.` |
| Okay | `Neither good nor bad. A plain, steady day.` |
| Good | `A good day. More ups than downs.` |
| Great | `A really good day. You felt light, proud, or happy.` |

One reflection per day. Saving again replaces it. Text limit: 4,000 characters per answer.

### 4. History
A month calendar (weeks start on Monday). The title shows the month; `Previous month` and `Next month` buttons move one month. The month can go back as far as the month the user signed up (earlier days are always empty) and never past the current month. Tapping the title opens a picker: a year stepper (sign-up year to this year), twelve month buttons (out-of-range months disabled) and a date field to jump to one day. `Back to this month` appears when another month is shown. After a year or more of use the user can flash back to any month or day.

- One cell per day. The day number sits inside a circle: filled in the mood colour when a reflection exists, empty when nothing was saved. A small dot under the number means every habit was ticked. Days before sign-up are dimmed and cannot be opened. Today has an outline. Future days cannot be opened.
- Legend under the grid: the five mood colours with their words, and `Every habit done` with the dot. Colour is never the only signal: each cell's accessible label names the day, the mood and the habits (`Friday, 6 November 2026, Good, 3 of 4 habits done`, `…, no reflection` or `…, before you joined`).
- Tapping a day opens the day sheet, a read-only summary: the date, a line with the mood and how many habits were done (`Good. 3 of 4 habits done.` or `Every habit done.`), and the three answers as formatted text. A day with nothing saved says `Nothing saved for this day.` The sheet does not list habits and has no `Previous day` / `Next day` and no arrow keys.
- The sheet has two icon buttons: `Edit this day` and `Close` (`Esc` also closes). `Edit this day` closes the sheet and opens Today for that day: the title is the day's date, the line under it reads `You are editing a past day.`, the full habit list and reflection form are there (so a past day's habits can be ticked there), and a `Back to today` icon button returns to the real today.
- Phones: the sheet rises from the bottom as a modal. From 700px it is a panel beside the calendar (see `DESIGN.md`).

### 5. Habits
Add, rename, reorder by drag and drop (or Arrow Up/Down on the grip), archive. All controls are icon-only with tooltips (`Add habit`, `Rename`, `Archive`, `Drag to reorder`). At most 12 active habits. Names are at most 60 characters. Archived habits disappear from Today and keep their past check-ins. An `Archived` list under the habits shows each with `Restore` and `Delete permanently`; delete asks for confirmation inline (`Delete "X" and all its check-ins? This cannot be undone.`) and wipes that habit's check-ins. Active habits have no delete. Empty state: `Start with one small thing.`

### 6. Settings
- **Appearance** (saved on this device only, in the browser; not synced between devices, not stored on the server):
  - `Background`: `Scenes (default)` — landscapes that change with the time of day — or `Classic` — a soft gradient with a sun or moon that follows the clock.
  - `Preview time of day`: a select with `Auto (your clock)`, `Dawn 05–09`, `Day 09–16`, `Dusk 16–19`, `Night 19–05`. `Auto` follows the clock and is the default. The others force a phase on this device, which is also how to look at a scene outside its hours. No helper line.
- `Export my data (CSV)` downloads one CSV file: a row per day with a reflection, plus a 1/0 column per habit. Days with check-ins but no reflection are not included; the full backup is `wrangler d1 export`.
- `Sign out`.

### 7. Insights (second view in History)
History has a `Calendar | Insights` switch. Insights shows only after 7 or more days with an entry; before that the four cards show as a dimmed preview under a progress card (`Insights unlock at 7 entries`). Four cards:
- **This month**: current streak, best streak, days written, average mood; and, from 28 days of data, `Your best day for habits is Monday.`
- **Habits over time**: share of habits done, as bars on a 0–100% axis. A `Day | Week | Month` switch picks the bar size, and a `Period` select picks what to show: Day and Week show one calendar month (a week belongs to the month of its Monday), Month shows one year. The select lists sign-up to now, newest first. The exact percentage shows on hover, focus or tap (and in the caption line), plus a message about the finished bars (feature 8, with "day", "week" or "month" in the wording). The newest bar is the current period so far and is not counted in the message.
- **Each habit**: last-30-day percentage with a meter (a habit younger than 30 days is counted from its first day, so `done of the last N days` uses N under 30), and best streak ever.
- **Milestones**: 7, 14, 30, 60, 100, 180 and 365 days of best streak, a medal icon when reached. Each chip shows the number in bold (`30 days`); the accessible label adds `reached` or `14 to go`.
Numbers are always written out; colour or bar height is never the only signal. The 80% and 50% thresholds below are proposals, to be tuned after real use.

### 8. Encouragement (text only)
No points, levels, XP, confetti or sound, and the app never blames the user. Streak rule stays as in "Streak rule"; no grace days.

| When | Message |
|---|---|
| First check-in ever | `A start is the hardest part. You made it.` |
| A habit reaches 3 days | `Three days in a row. It's becoming a habit.` |
| 5 days | `Five days straight. Keep going.` |
| 7 days | `One full week. That's real.` |
| 14 days | `Two weeks of showing up.` |
| 30 days | `Thirty days. This is who you are now.` |
| Every habit done today | `Every habit done. Rest well.` |
| Saving a day with mood Rough or Low | `A hard day still counts. Be kind to yourself.` |
| A streak of 3 or more just ended | `The streak ended, but you didn't. Tomorrow we start again, a little wiser.` |
| Opening the app after 2 or more days away | `Welcome back. That's the hardest step.` |
| Last finished bar 100% | `A perfect week. Well earned.` ("day" or "month" when grouped that way) |
| 2 bars in a row at 80% or more | `Two good weeks in a row. The pattern is forming.` |
| 4 bars in a row at 80% or more | `Four weeks of steady effort. Be proud of that.` |
| Last finished bar under 50% | `A slow week happens. Don't lose heart. Tomorrow we build a better day.` |
| Last finished bar 50–79%, or one good bar (my additions, not yet approved) | `A steady week. Every bit counts.` / `A good week. Keep it going.` |

One line at a time, shown once per trigger. Messages on Today fade after 8 seconds; the period message lives in Insights.

### 9. Background by time of day
Every screen sits on a full-screen vector scene that follows the local clock: dawn 05–09 (sun over mountains), day 09–16 (city), dusk 16–19 (sunset over the sea), night 19–05 (Milky Way over a hill above a city). The scene is fixed; content scrolls over it. Scenes animate gently (clouds, stars, water, window lights) and stop entirely for `prefers-reduced-motion`. Changing phase cross-fades over 1.2 s. The greeting follows the same clock: morning = dawn, afternoon = day, evening = dusk and night. Visual rules: `DESIGN.md`. Assets: `design/scenes/`.

## Streak rule

A habit's streak is the number of consecutive days with a check-in, counting back from the viewed day. If the viewed day is not ticked yet, counting starts from the day before, so an unticked today does not reset the streak until the day is over.

## Not in v1

Public sign-up, self-service password reset, reminders or notifications, PWA or offline use, weekly or custom habit schedules, attachments, images or links, any formatting beyond bold, italic and lists, account deletion (required before any second user).

## Success measures

- An entry exists for 14 days in a row.
- Filling in one day takes under 2 minutes.
- The isolation test passes.
- The CSV export has one row per entry: its row count equals the production `entries` count.

## Known limits accepted for v1

- A wrong phone clock or travel across time zones shifts which date an entry lands on.
- History's "every habit ticked" dot compares against the habits active now, not the habits active on that day.
- Appearance settings do not follow the Owner to another device or browser.
- In the `Scenes` theme the sun and moon are part of the picture and do not move with the clock; only the phase changes. The `Classic` theme keeps the clock-driven orb.
