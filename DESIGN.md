# Jurnala — Design

Two references, both approved:

- **Scenes (default theme):** the live board https://claude.ai/artifact/NeCzjFJPkNC1BATiBCQX3y (Today, History, Settings) and the standalone SVGs in `design/scenes/` (see `design/scenes/README.md`, reference CSS in `design/scenes/layout.css`).
- **Classic (optional theme):** `design/mockup.html`. It is also the reference for every component (rows, mood picker, nav, motion CSS).

Where this file and a reference disagree, the reference wins. Copy CSS custom properties; do not re-derive them.

## Idea: coming home at dusk

A full-screen vector scene follows the local clock. Frosted glass cards sit on top. The app looks different in the morning and at night without any new content. The scene is the one bold element; everything on top of it stays quiet.

## Themes and phases

Two attributes on `<html>`:

- `data-theme="scenes" | "classic"`. Default `scenes`.
- `data-phase="dawn" | "day" | "dusk" | "night"`. From the local hour: dawn 05–09, day 09–16, dusk 16–19, night otherwise.

Both live in `src/theme.ts` (replaces the old `sky.ts`). Settings can force a phase ("Preview time of day"). Stored per device in `localStorage`: `jurnala-theme` (`scenes` | `classic`) and `jurnala-phase` (`auto` | a phase; default `auto`). Wrap every read and write in try/catch and fall back to the defaults. Sync other tabs with the `storage` event. Re-check the clock every minute while the phase is `auto`. Nothing about the theme goes to the server.

## Scenes theme

| Phase | Hours | Subject | File |
|---|---|---|---|
| `dawn` | 05–09 | Sun rising over mountains | `scenes/dawn.svg` |
| `day` | 09–16 | Calm city park with a lake, ducks, lilies, trees, picnic spot | `scenes/day.svg` |
| `dusk` | 16–19 | Sunset over the sea | `scenes/dusk.svg` |
| `night` | 19–05 | Milky Way over a hill above a city | `scenes/night.svg` |

Copy `design/scenes/*.svg` to `public/scenes/`. Do not edit the SVGs by hand.

**Layers.** One fixed full-screen wrapper holds all four scenes as `<img>` (animations inside an SVG still run when loaded this way). Only the active layer is visible: others get `opacity:0`, `visibility:hidden`. Changing phase cross-fades 1.2 s (`--ease`). Keep inactive layers mounted so the fade works. Every file is 23–64 KB, so no lazy loading is needed.

**Scene band.** The image is 460px tall at the top of the screen, `object-fit: cover`, with a bottom mask fade (`linear-gradient(#000 80%, transparent)`). `object-position`: `100% 50%` for dawn, day and dusk (keeps the sun/skyline in view on phones), `50% 50%` for night. Below the band the page shows a flat base colour per phase: dawn `#7E6AAE`, day `#2E5240`, dusk `#3C2B57`, night `#05060F`. Set it on the wrapper so there is never a flash of white.

**Scroll.** The scene does not move. Content scrolls over it inside an absolutely positioned scroller. The page header (greeting and date, or the screen title) sits in the sky area: left-aligned, max 290px wide, at least 300px tall, content bottom-aligned. A `topscrim` (330px, dark gradient) and a soft `text-shadow` on the h1 and the line under it keep that text readable.

**Glass tokens (one dark set for all four phases).**

| Token | Value |
|---|---|
| `--ink` | `#FBF7F0` |
| `--muted` | `#ECE8F4` |
| `--glass` | `rgb(20 16 48 / .40)`; day `rgb(20 16 56 / .55)`; dawn `rgb(20 16 56 / .46)` |
| `--line` | `rgb(255 255 255 / .22)` |
| `--field` | `rgb(255 255 255 / .10)` |
| `--solid` (no-transparency fallback) | `#1F1B45` |
| `--glow` (ticked habit) | `#FFD9A0` |
| `--btn-bg` / `--btn-ink` | `#FBF7F0` / `#2A2440` |

Day and dawn glass is more opaque because those scenes are bright behind the card.

**Day scene (current).** Lilac/periwinkle palette so it sits in the same family as dawn and dusk: sky `#8FA0E6` → `#BFD3F0` → `#F1F3EA`, lake `#B8D6EA` → `#4C80A0`, greens hue-shifted toward blue-green and desaturated, a faint lilac haze over the whole group. Natural grass runs to the bottom edge (no water reaches it). A modern angler fishes from a motorboat that shuttles in and out on a 48 s loop (catch, jump, release); ducks swim slowly, turn at the ends and the ducklings trail the mother. Under reduced motion all of it freezes in a sane static pose.

**The sun and moon do not move in Scenes.** They are part of the picture. Only the phase changes. (Classic keeps the clock-driven orb.)

## Classic theme

Exactly `design/mockup.html`: a CSS gradient sky per phase, one orb on the right edge whose height follows the clock (`--orb-y`, 6%–32% of the viewport; highest at midday and midnight), a soft halo, faint SVG grain, a few stars at night. It uses the light/dark token table below, not the Scenes set. Orb size: 96px (60px at night) on phones, 132px (76px at night) from 700px up. Text never sits on the orb: on phones text on the sky keeps 88px free on the right; on tablet the orb stays below the top bar.

| Phase | Gradient (top → bottom) | Glass | Text |
|---|---|---|---|
| `dawn` | `#F6C6A8` → `#D9B4C6` → `#B9A8E0` | light | dark |
| `day` | `#9CC9F0` → `#BFDDF6` → `#DCEBFA` | light | dark |
| `dusk` | `#904C5C` → `#5B4B8A` → `#2F2A5E` | dark | light |
| `night` | `#141B3C` → `#1F2046` → `#2A2550` | dark | light |

| `--orb` | dawn `#FFE9CF` | day `#FBFDFF` | dusk `#AE6062` | night `#7C7AA8` |
|---|---|---|---|---|

| Token (Classic) | Light phases (dawn, day) | Dark phases (dusk, night) |
|---|---|---|
| `--ink` | `#2A2440` | `#FBF7F0` |
| `--muted` | `#3F3956` | `#ECE8F4` |
| `--glass` | `rgb(255 255 255 / .38)` | `rgb(20 16 48 / .40)` |
| `--glass-line` | `rgb(255 255 255 / .55)` | `rgb(255 255 255 / .16)` |
| `--field` | `rgb(255 255 255 / .45)` | `rgb(255 255 255 / .08)` |
| `--solid` | `#F3EEF5` | `#262250` |
| `--glow` | `#F0A23B` | `#FFD9A0` |
| `--btn-bg` / `--btn-ink` | `#2A2440` / `#FBF7F0` | `#FBF7F0` / `#2A2440` |

Dusk starts at `#904C5C` and its halo is `#9A5258` because lighter oranges fail contrast with white text.

## Shared tokens

Mood 1–5: `#7C8DB5`, `#9DB4C8`, `#C9C2B0`, `#F2C894`, `#FFB37A`. Mood is never shown by colour alone: the picker shows the word, read mode names it, History cells and the day sheet name it.

## Glass rules

- Card: `background: var(--glass)`, `backdrop-filter: blur(24px) saturate(140%)`, 1px border `--line` (`--glass-line` in Classic), soft shadow.
- At most two glass layers stacked (card, then a sheet over it).
- Inputs and long text sit on glass. Short lines sit directly on the scene: greeting and date, screen titles and subtitles, `Yesterday you said`, the closing line.
- Text contrast at least 4.5:1 in every phase, on the scene and on glass. **Not yet measured for Scenes** — measure in task B8 (method below) and fix tokens, not the SVGs.
- `prefers-reduced-transparency: reduce` → cards use `--solid`, no blur.
- `prefers-reduced-motion: reduce` → no animations and no transitions at all, including inside the scene SVGs (each file already carries its own rule) and the 1.2 s cross-fade.

## Layouts

| Width | Navigation | Content |
|---|---|---|
| Phone, under 700px | Fixed glass pill at the bottom: `Today`, `History`, `Habits`. Settings opens from the gear icon on Today. | One column, max 480px. The day sheet is a modal that rises from the bottom. |
| Tablet, 700–1099px | Top bar: `Jurnala` on the left, tabs on the right, including `Settings`. | Today uses two columns, journal left (6fr) and habits right (5fr); History uses 5fr 6fr. The day sheet is a panel beside the calendar. Habits and Settings are 560px wide. |
| Desktop, 1100px and up | Fixed left rail, 232px: `Jurnala`, tabs, `Settings` pinned to the bottom. | Same two columns, max 1080px. Sign in has no rail. |

No horizontal scroll at any width from 320px up. Leave bottom padding so the bottom pill never covers the last card.

## Shape and space

- Radius by role: cards 24px, fields and rows 14px, navigation and buttons fully round.
- Spacing in multiples of 4px.
- Touch targets at least 44px (calendar cells may be 43px wide on a 375px phone). Visible keyboard focus: 2px `--ink` outline.

## Type

- `Newsreader` for the brand, the greeting, screen titles and the reflection prompts (prompts in italic).
- `Figtree` for everything else, 16px body.
- Self-host both as woff2 in production (the mockup loads them from Google Fonts for convenience).
- Sentence case everywhere. No all-caps labels.

## Screens

Navigation changes per width; see Layouts.

1. **Sign in** — `Welcome to Jurnala`, email, password, `Sign in`.
2. **Today** — greeting and date; `Yesterday you said`; habits; reflection card (read or edit); closing line.
3. **History** — month calendar, legend, day sheet.
4. **Habits** — icon-only controls, each with a hover/focus tooltip and an `aria-label`: grip (`Drag to reorder`, also Arrow Up/Down when focused), pencil (`Rename`), archive box (`Archive`), round plus (`Add habit`). Below the card list: `Archived` section, rows with restore (`Restore`) and trash (`Delete permanently`, inline confirm). Rows reorder by drag (pointer events, works on touch).
5. **Settings** — ONE glass card: Appearance, rule, Your data (`Export my data (CSV)`), rule, `Sign out`.

**App shell (700px and up).** The page never scrolls: `body` is 100dvh, the header is static, and each card scrolls inside itself. Phone (<700px) scrolls the page; the header is sticky with a faint blurred backdrop that fades out at the bottom edge. Page headers have no box.

**CSV export.** One row per day with an entry. Columns: `date,mood,went_well,hard,tomorrow` plus one 1/0 column per habit, archived included. Quote cells that need it; defuse formula prefixes (`= + - @`, tab, CR) with a leading `'`. File `jurnala-export-YYYY-MM-DD.csv`, UTF-8 with BOM. Never JSON.

### Reflection card: read and edit

- **Edit mode** (no saved reflection, or after `Edit`): the four prompts from `docs/PRD.md` in order. Prompt labels in Newsreader italic. Mood picker is five round buttons, each showing a face from `design/mood/` (`1-rough` … `5-great`, 48×48 viewBox, filled in the mood colour, features in `#2A2440`). Inline them as SVG, not `<img>`, so focus and selected states can style them. The chosen face scales up with `--spring` and its word appears under the row; unchosen faces are dimmed to 80% (the 70% first drawn looked muddy on the dark glass). No emoji anywhere: faces render the same on every device. Read mode shows the chosen face small (24px) next to its word. Do not edit the SVGs; report problems to the Owner. Text areas grow with content, 4,000-character limit (show a counter only past 3,600). Actions are icon-only 40px round buttons in the card's top-right corner (tick = save, cross = cancel; label shown on hover/focus as a tooltip that opens downward, and in `aria-label`). Same rule app-wide: Edit, Close and Back are icon buttons with a hover label; text buttons stay for Export my data (CSV), Sign out, tabs, the segmented switch and the sign-in form. Fields are at least 52px tall at 760px viewport height.
- **Read mode**: mood dot + word on one line, then each filled answer as a small muted label over the text. Empty answers are not shown. One `Edit` button, top right of the card. Saved reflections are never shown as disabled inputs.
- **Today layout details**: on 700px and up the greeting and the card titles stay fixed while each card body scrolls. A reflection field grows with its text up to 7 lines, then scrolls; the expand control makes one field fill the whole card. Typing `- ` or `1. ` at the start of a line continues the list on Enter (Enter on an empty item ends it). Edit is an icon button, not text.
- **Switching**: the card keeps its height while content cross-fades (240 ms) so the page does not jump. `Saved.` fades in under the card for a few seconds after a save, then stays out of the way. Focus moves as described in the PRD.

### History: month calendar and day sheet

- Header: a `Calendar | Insights` segmented switch top right. In the calendar card: month title (Newsreader, with a chevron, a button that opens the picker), `Previous month` and `Next month` icon buttons (44px, labelled). Next is disabled on the current month; Previous is disabled in the sign-up month.
- Picker (replaces the grid while open): year stepper bounded by sign-up year and this year; 12 month buttons, out-of-range ones disabled; a native date field with min = sign-up day and max = today for jumping to one day. `Back to this month` link under the grid when another month is shown.
- Grid: 7 columns, weekday letters M T W T F S S, 5–6 rows, cells 48px. The day number sits inside a 36px circle: filled in the mood colour with dark text when a reflection exists, a faint outline when not. A small dot under the number = all habits ticked (replaces the earlier ring). Today = a 2px ring. Days before sign-up and future days are dimmed and not buttons. Days outside the month are blank.
- Legend under the grid: the five mood swatches with their words, and the dot with `Every habit done`.
- Each cell is a button whose label reads `Friday, 6 November, mood Good` or `Friday, 6 November, nothing saved`.
- **Day sheet** (phone: modal `<dialog>` rising from the bottom with a backdrop; 700px and up: a panel beside the calendar). Contents top to bottom: header with `Previous day`, the date, `Next day`, `Close` (phone); habit list as `done` / `not done` rows (read-only in the sheet — ticking happens on Today, to keep one place for it); reflection card in read mode with `Edit`; or `Nothing saved for this day.` with `Write about this day`.
- Keyboard: `Esc` closes (phone); ← → step days; focus returns to the calendar cell that opened the sheet.
- Open question for the Owner, not built: letting the sheet tick habits for past days. v1 says read-only; revisit if it annoys.

### Insights

Four glass cards (one column on phone; two columns from 700px, the same width as the two-column Today). Numbers are always written; bar height and colour never carry a value alone.
- **This month**: three stats (current streak, best streak, days written) in Newsreader numerals over a muted caption, then the average-mood line and, from 28 days of data, the best-weekday sentence.
- Each card has a fixed header (title, plus the Day | Week | Month switch and the Period select on Habits over time) and a body that scrolls inside the card, so the Insights page itself does not scroll from 700px.
- Every item (stat, bar, habit row, milestone chip) is focusable and, on hover, focus or tap, rewrites its card's caption line (`.cap`) with a detail sentence; leaving restores the default caption. Details live in `data-tip`, not in the DOM tooltip.
- **Habits over time**: a `Day | Week | Month` group (`seg sm`) and a `Period` select. Day and Week show one month (a week belongs to the month of its Monday); Month shows one year. Bars up to 36px wide scrolling sideways (right-aligned, starts at the newest). A Y axis (`100%`, `50%`, `0%`) with three faint gridlines replaces the percentage written above each bar. The exact figure appears in the card's caption line and in a small blurred tooltip on hover, focus or tap.
- **Each habit**: name, `87% · best 14 days`, a thin meter; list scrolls vertically.
- **Milestones**: 7, 14, 30, 60, 100, 180, 365 days; reached ones show a medal icon (SVG, not emoji), the others read `30 days · 14 to go`; list scrolls vertically.
- **Switching** Calendar ↔ Insights slides the pane (and the open day card) sideways; reduced motion: instant.
- Empty state before 7 entries: `Insights appear after a week of entries.` in one card.
- No chart library: inline SVG or CSS only.

### Encouragement

A single `.cheer` line (Newsreader italic, 20px, `role="status"`) under the habit card on Today. It appears on a trigger, fades after 8 seconds, and never stacks. Messages and triggers: `docs/PRD.md` feature 8. No confetti, no sound, no points, no red. A failed day gets the same calm voice as a good one.

### Mood tooltips

Each face sits in a wrapper with a bubble (`.tip`, `role="tooltip"`) above it. It shows on hover and on `:focus-visible`; `--tx` keeps the bubble inside the viewport at the row's edges. Hover does not exist on touch, so choosing a face also writes `Good: A good day. More ups than downs.` in the line under the row (`#mood-desc`, `role="status"`). Texts: `docs/PRD.md` feature 3.

### Scene view

Page headers (`.head`) have no box; see App shell above.

**Scene mode.** Works in both themes (Classic shows the sky, the stars and the orb). Clicking the active tab (Today, History, Habits, Settings) again minimizes its cards into the tab with the same fly animation; clicking it once more brings them back. The eye button and the `Jurnala` brand also enter it. Classic night draws 220 stars. Cards fly to the current tab with a stagger, then only `Jurnala`, the tabs and the eye remain; the scene slowly zooms and the scrim lightens. Clicking the brand also shows the quote of the day as the header (30 original lines, picked by date, same all day); clicking it again, the eye, `Esc` or a tab leaves it. A tab click reveals that tab's cards flying back out of the tab, one by one. On phones the brand shows only in scene mode. Hidden in Classic. Reduced motion: instant.

The scene fills 100dvh on tablet and desktop (it used to stop at the top of the content). A round eye button (`View scene`, `aria-pressed`) sits bottom right on every layout, above the phone nav. Pressing it hides the nav and all cards so the landscape is the whole screen; pressing it again or `Esc` brings them back. Changing screen also exits it. Not shown in Classic, which has no landscape.

### Sign in layout

From 700px the form sits in the left column (420px) so the sun and horizon on the right stay uncovered. On phones it stays one centred column.

### Settings: Appearance

- `Background` (the only place to switch it; there is no switcher on other screens) — a two-option segmented control (radio group): `Scenes` with a small phase thumbnail, `Classic` with a small gradient thumbnail. Selecting applies immediately, cross-fading.
- `Preview time of day` — a five-option segmented control: `Auto`, `Dawn`, `Day`, `Dusk`, `Night`. Helper line: `Auto follows your clock. Saved on this device.`
- Native selects (month/year pickers) use a custom chevron, not the browser arrow.
- Both controls are radio groups with real `<input type="radio">` and visible focus. Arrow keys move within the group.

## Motion

Motion only answers an action or the clock. Two curves: `--ease: cubic-bezier(.22,1,.36,1)` for movement, `--spring: cubic-bezier(.3,1.6,.5,1)` for the tick and the mood dot. Copy the exact rules from the mockup.

| What | How |
|---|---|
| Press on any control | `scale(.96)`, 150 ms |
| Ticking a habit | Circle fills 200 ms, springs 300 ms, the check mark draws 280 ms |
| Mood pick | The chosen dot scales up with `--spring`, 300 ms |
| Navigation | The active marker slides to the new tab, 350 ms |
| Changing screens | Fade plus 6px rise, 240 ms |
| Read ↔ edit | Content cross-fades 240 ms, card height held |
| Calendar month change | Grid fades 240 ms |
| Day sheet (phone) | Fades and rises in 280 ms, out 200 ms, with the backdrop |
| Day panel (tablet, desktop) | Content fades 240 ms when another day is picked |
| Habits list: add, move, archive, restore | Each row glides to its new place (FLIP, 380 ms); archive and restore fly between the two lists; new rows fade in 260 ms |
| Habits list: delete permanently | Row (or the whole Archived block) fades and folds shut, 300 ms; the rest follows it up |
| Sign out | Cards, tabs and the eye sink 14px and fade with blur, 280 ms, 40 ms stagger; then the sign-in card rises 18px, 480 ms, after a 120 ms beat. Input is ignored while it runs. Reduced motion: instant |
| `Saved.` and the closing line | Fade in 400 ms |
| Scene or sky phase change | 1.2 s cross-fade |
| Switching theme (Scenes ↔ Classic) | Soft wipe, no hard cut |
| Calendar ↔ Insights | Pane and day card slide sideways together |
| Inside the scenes | Slow drifting clouds, twinkling stars, water shimmer, window lights; already in the SVGs |

- Hover styles only under `@media (hover: hover)`.
- `@property`, `@starting-style` and View Transitions are progressive enhancements: without them the change is instant and everything still works. Do not add a library to polyfill them.
- A rule on `.glass` sets `transition`; a more specific selector is needed to animate a glass element (see `dialog.glass` in the mockup).
- Inactive scene layers are `visibility:hidden` after the fade, which also stops their animations from costing paint time.
- No confetti, no sound, no entrance animations on scroll.

## App icon

Source: `design/favicon/favicon.svg` (64×64, rounded square: dusk sky gradient `#3C2B57`→`#7E6AAE`, glowing sun `#FFD9A0` on a dark horizon). It stays readable at 16px (checked). `square.svg` is the same without rounded corners; `apple-touch-icon.png` (180×180) is rendered from it, and `favicon-32.png` from the rounded one. Copy these into `public/` and link them in `index.html`: `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`, a 32px PNG fallback, and `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`. The icon is fixed and does not change with the theme or time of day. No `.ico` and no web manifest in v1 (no PWA).

## Measuring contrast (task B8)

For each phase (four) and each theme (two): screenshot Today and History at 390px with Playwright, sample the background colour behind (a) the h1 and the line under it, (b) the muted helper lines, (c) glass body text, (d) the legend. Compute the WCAG ratio against `--ink` / `--muted`. Record the worst ratio per phase in this file under "Measured contrast". Below 4.5:1 → darken `--glass`, `--topscrim` or the text-shadow, then re-measure. Do not alter the scene SVGs.

### Measured contrast

Method: real rendered pixels. Per run, one screenshot with all text transparent (background plus text-shadow only) and one normal; text pixels are found by the difference, the text colour is composited with its alpha, and the WCAG ratio is taken per glyph pixel. Groups: h1, the line under it, muted helper lines, glass body text (h2, prompts, habit names, fields, moods). Worst ratio over all groups, per theme and phase, measured with the Playwright MCP against `npm run dev`, 2026-11-15.

**Today (task B8), widths 390 and 1440, signed-in demo data:**

| Theme / phase | Worst ratio | Where it is worst |
|---|---|---|
| Scenes dawn | 4.83 | glass body text at 1440 |
| Scenes day | 5.72 | glass body text at 1440 |
| Scenes dusk | 5.31 | glass body text at 390 |
| Scenes night | 6.80 | glass body text at 1440 |
| Classic dawn | 6.54 | muted line under h1 at 1440 |
| Classic day | 6.31 | muted line under h1 at 1440 |
| Classic dusk | 4.88 | muted line under h1 at 1440 |
| Classic night | 9.75 | glass body text at 390 |

First pass failed (lowest values before the fix): Scenes dawn sub line 2.58, Scenes day h1 3.70 and sub line 1.69 at 390; Classic dawn h1 3.85 and sub 2.85; at 1440 Scenes day glass 4.03 and sub 2.55, Scenes night h1 4.19. Fixes, all in `src/index.css` (scene SVGs untouched): darker top scrim, a double text-shadow on Scenes `h1` and `.head p`, a dark backing bar behind the page header on Scenes (phones: stronger on day; from 700px: a rounded bar), a light header bar on Classic dawn like Classic day, glass 0.68 on Scenes day and 0.54 on Scenes dawn. Then re-measured: every group at or above 4.5:1. The 390 re-run of Scenes day glass was done at the old 0.55 value (6.04); the later 0.68 can only raise it.

**History, Settings and Habits (task B9), width 390, Scenes and Classic, all four phases, 2026-11-15:**

| Screen | Worst ratio | Where it is worst |
|---|---|---|
| History (incl. legend, weekday row, enabled day numbers) | 5.39 | Scenes dawn, month title |
| Settings (incl. helper lines, segmented control, buttons) | 5.47 | Scenes dawn, glass body text |
| Habits (incl. list, Archived heading, rename and confirm lines) | 5.59 | Scenes dawn, glass body text |

Legend worst: 7.32 (Classic dawn). Day numbers worst: 7.35 (Scenes dawn). No fix was needed for B9. Day cells that are disabled (before sign-up, or in the future) are dimmed to 30% on purpose and are not measured: WCAG exempts inactive controls, and the accessible label says why ("before you joined").

Not measured: the day sheet and the discard dialog, text over the scene while it animates (SVG animation inside `<img>` cannot be sampled frame by frame; one frame per run), Insights, and widths other than 390 for these three screens.

## Copy

All product copy is in `docs/PRD.md` and the mockup. Errors say what happened and what to do; they do not apologise.
