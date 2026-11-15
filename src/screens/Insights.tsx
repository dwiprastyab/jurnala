import { useEffect, useState, type MouseEvent, type FocusEvent } from 'react'
import { api, type HistoryDay, type InsightsData } from '../api'
import { addDays, diffDays, monthTitle } from '../day'
import { Medal } from '../icons'
import { MOODS } from '../mood'
import { bestWeekday, milestones, MIN_ENTRIES, monthStats, pct, periodMessage, periods, rangeOf, series, streakStats, type Group } from '../insights'

// Hover, focus or click on a [data-tip] item swaps its card's caption; leaving restores it.
const tipOf = (e: { target: EventTarget }) => (e.target as HTMLElement).closest?.<HTMLElement>('[data-tip]') ?? null
const card = (t: HTMLElement) => t.closest('.ic')!.querySelector<HTMLElement>('.cap')!
const show = (e: MouseEvent | FocusEvent) => { const t = tipOf(e); if (t) card(t).textContent = t.dataset.tip! }
const hide = (e: MouseEvent | FocusEvent) => {
  const t = tipOf(e)
  if (t && !t.contains(e.relatedTarget as Node | null)) { const c = card(t); c.textContent = c.dataset.d! }
}

// /api/history takes at most 42 days per call, so a long range is fetched in chunks.
async function historyRange(from: string, to: string): Promise<HistoryDay[]> {
  const jobs: Promise<{ days: HistoryDay[] }>[] = []
  for (let a = from; diffDays(a, to) <= 0; a = addDays(a, 42)) jobs.push(api.history(a, diffDays(addDays(a, 41), to) > 0 ? to : addDays(a, 41)))
  return (await Promise.all(jobs)).flatMap((r) => r.days)
}

// Last results, so the pane is already full when it slides in (no "Loading…" flash); they are refetched on every open.
const seen = new Map<string, unknown>()
const chartKey = (g: Group, key: string, first: string, today: string) => `c:${g}:${key}:${first}:${today}`
const chartRange = (g: Group, key: string, first: string, today: string) => { const [a, z] = rangeOf(g, key); return historyRange(diffDays(a, first) < 0 ? first : a, diffDays(z, today) > 0 ? today : z) }
export function prefetchInsights(today: string, first: string) {
  api.insights(today).then((r) => seen.set('i:' + today, r), () => {})
  const k = today.slice(0, 7)
  chartRange('week', k, first, today).then((r) => seen.set(chartKey('week', k, first, today), r), () => {})
}

// Fixed bars for the locked preview; the field names match what series() returns.
const GHOST = [35, 60, 45, 75, 55, 85, 50].map((p, i) => ({ start: String(i), p, label: '', tip: '', done: 0, poss: 0, live: false }))

export function Insights({ today, first }: { today: string; first: string }) {
  const [d, setD] = useState<InsightsData | null>((seen.get('i:' + today) as InsightsData) ?? null)
  const [err, setErr] = useState('')
  const load = () => { setErr(''); api.insights(today).then((r) => { seen.set('i:' + today, r); setD(r) }, (e) => setErr(e.message)) }
  useEffect(load, [today]) // eslint-disable-line react-hooks/exhaustive-deps

  // Habits-over-time: Day / Week inside one month, Month inside one year.
  const [g, setG] = useState<Group>('week')
  const [period, setPeriod] = useState(today.slice(0, 7))
  const key = g === 'month' ? period.slice(0, 4) : period
  const [chartDays, setChartDays] = useState<HistoryDay[] | null>((seen.get(chartKey(g, key, first, today)) as HistoryDay[]) ?? null)
  const [chartErr, setChartErr] = useState('')
  useEffect(() => {
    let live = true
    setChartErr(''); setChartDays((seen.get(chartKey(g, key, first, today)) as HistoryDay[]) ?? null)
    chartRange(g, key, first, today).then((r) => { seen.set(chartKey(g, key, first, today), r); live && setChartDays(r) }, (e) => live && setChartErr(e.message))
    return () => { live = false }
  }, [g, key, first, today])

  if (err) return <div className="ins" id="ins"><p className="glass" role="alert">{err} <button className="btn text" type="button" onClick={load}>Try again</button></p></div>
  if (!d) return <div className="ins" id="ins"><p className="glass muted" role="status">Loading…</p></div>
  // Under a week of entries the same cards show as a dimmed preview, so the pane keeps its height and says what is coming.
  const locked = d.entries < MIN_ENTRIES
  const tip = (t: string) => (locked ? {} : { tabIndex: 0, 'data-tip': t })

  const n = d.habits.length
  const { current, best } = streakStats(d.habits)
  const bestH = d.habits.find((h) => h.best_streak === best), curH = d.habits.find((h) => h.streak === current)
  const mb = locked ? 0 : best // Milestones read as unreached while the stats show a dash
  const ms = monthStats(d.days, today)
  const wd = bestWeekday(d.days, today, n, first)
  const bars = locked ? GHOST : chartDays ? series(chartDays, g, key, today, n, first) : []
  const msg = periodMessage(g, bars.filter((b) => !b.live).map((b) => b.p))
  const months = periods(first, today)
  const years = [...new Set(months.map((m) => m.slice(0, 4)))]
  const avg = ms.avgMood ? `Average mood so far: ${MOODS[ms.avgMood - 1]}.` : ''
  const ev = { onMouseOver: show, onFocus: show, onClick: show, onMouseOut: hide, onBlur: hide }

  return (
    <div className={`ins${locked ? ' locked' : ''}`} id="ins" {...ev}>
      {locked && (
        <div className="glass ic">
          <div className="ic-head"><h2>Insights unlock at {MIN_ENTRIES} entries</h2></div>
          <p className="cap muted small">{d.entries} of {MIN_ENTRIES} entries so far. Save a mood each day to unlock them.</p>
          <span className="meter" role="progressbar" aria-label="Entries so far" aria-valuemin={0} aria-valuemax={MIN_ENTRIES} aria-valuenow={d.entries} style={{ '--p': Math.round(d.entries / MIN_ENTRIES * 100) } as React.CSSProperties}><i /></span>
        </div>
      )}
      <div className="glass ic">
        <div className="ic-head"><h2>This month</h2></div>
        <div className="ic-body">
          <div className="stats">
            <div className="stat" {...tip(`Your longest streak running right now${curH && current ? `: ${curH.name}, ${current} days in a row` : ''}. A streak counts consecutive days a habit was done, up to today.`)}><b>{locked ? '–' : current}</b><span className="muted small">Current streak</span></div>
            <div className="stat" {...tip(`Your longest streak ever${bestH && best ? `: ${bestH.name}, ${best} days in a row` : ''}.`)}><b>{locked ? '–' : best}</b><span className="muted small">Best streak</span></div>
            <div className="stat" {...tip(`You saved a mood on ${ms.wrote} of ${ms.dayOfMonth} days so far this month (${pct(ms.wrote, ms.dayOfMonth)}%).`)}><b>{locked ? '–' : ms.wrote}</b><span className="muted small">Days written</span></div>
          </div>
          <Cap text={locked ? 'Streaks and days written will show here.' : `${avg} ${wd ? `Your best day for habits is ${wd}.` : ''}`.trim()} />
        </div>
      </div>
      <div className="glass ic">
        <div className="ic-head"><h2>Habits over time</h2></div>
        <div className="ic-filters">
          <div className="seg sm" role="group" aria-label="Group by">
            {(['day', 'week', 'month'] as const).map((x) => <button key={x} type="button" aria-pressed={g === x} onClick={() => { setG(x); if (x !== 'month' && period.length === 4) setPeriod(today.slice(0, 7)) }}>{x[0].toUpperCase() + x.slice(1)}</button>)}
          </div>
          <select className="field" aria-label="Period" value={g === 'month' ? key : period} onChange={(e) => setPeriod(e.target.value)}>
            {(g === 'month' ? years : months).map((v) => <option key={v} value={v}>{g === 'month' ? v : monthTitle(v)}</option>)}
          </select>
        </div>
        <Cap cls="prompt" text={locked ? 'Your habit chart will show here.' : chartErr || (chartDays ? msg || `Habits done per ${g}.` : 'Loading…')} />
        <div className="chart">
          <div className="yax" aria-hidden="true"><span>100%</span><span>50%</span><span>0%</span></div>
          <div className="ic-body hscroll">
            {bars.map((w) => (
              <div key={w.start} className={`bar g-${g}`} {...tip(`${w.tip}: ${w.done} of ${w.poss} habit check-ins done (${w.p}%).${w.live ? ' Still in progress.' : ''}`)}>
                <span className="plot"><span className="fill" style={{ '--p': w.p } as React.CSSProperties} /></span>
                <span className="lbl">{g !== 'day' || +w.label === 1 || +w.label % 5 === 0 || w.live ? w.label : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="glass ic">
        <div className="ic-head"><h2>Each habit</h2></div>
        <Cap text={locked ? 'Each habit over the last 30 days will show here.' : 'Last 30 days, and the longest streak ever.'} />
        <div className="ic-body">
          {d.habits.map((h) => (
            <div key={h.id} className="hrow" {...tip(`${h.name}: done ${h.done30} of the last ${h.span30} days. Current streak ${h.streak} days, best ${h.best_streak} days.`)}>
              <span>{h.name}</span><span className="muted small">{locked ? '–' : `${h.last30}% · best ${h.best_streak} days`}</span>
              <span className="meter" style={{ '--p': locked ? 0 : h.last30 } as React.CSSProperties}><i /></span>
            </div>
          ))}
        </div>
      </div>
      <div className="glass ic">
        <div className="ic-head"><h2>Milestones</h2></div>
        <Cap text={locked ? 'Your best streak will show here.' : `Your best streak: ${best} days.`} />
        <div className="ic-body"><div className="miles">
          {milestones(mb).map((m) => (
            <span key={m.n} className="chip" tabIndex={0} data-got={m.reached || undefined} role="img" aria-label={m.reached ? `${m.n}-day streak, reached` : `${m.n}-day streak, ${m.left} more days to go`}
              data-tip={m.reached ? `Reached: your best streak hit ${m.n} days.` : `${m.left} more days of a streak to reach ${m.n}. Your best so far is ${mb}.`}>
              <span className="medal"><Medal n={m.n} /></span><span className="tx"><b>{m.n} days</b></span>
            </span>
          ))}
        </div></div>
      </div>
    </div>
  )
}

// The caption's default text lives in data-d so a hover can swap it and leaving can restore it.
function Cap({ text, cls = 'muted small' }: { text: string; cls?: string }) {
  return <p className={`cap ${cls}`} aria-live="polite" data-d={text} ref={(el) => { if (el && !el.matches(':hover, :focus-within')) el.textContent = text }} />
}
