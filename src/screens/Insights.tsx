import { useEffect, useState, type MouseEvent, type FocusEvent } from 'react'
import { api, type InsightsData } from '../api'
import { shortDate } from '../day'
import { Medal } from '../icons'
import { MOODS } from '../mood'
import { bestWeekday, milestones, MIN_ENTRIES, monthStats, pct, streakStats, weekBars, weekMessage } from '../insights'

// Hover, focus or click on a [data-tip] item swaps its card's caption; leaving restores it.
const tipOf = (e: { target: EventTarget }) => (e.target as HTMLElement).closest?.<HTMLElement>('[data-tip]') ?? null
const card = (t: HTMLElement) => t.closest('.ic')!.querySelector<HTMLElement>('.cap')!
const show = (e: MouseEvent | FocusEvent) => { const t = tipOf(e); if (t) card(t).textContent = t.dataset.tip! }
const hide = (e: MouseEvent | FocusEvent) => {
  const t = tipOf(e)
  if (t && !t.contains(e.relatedTarget as Node | null)) { const c = card(t); c.textContent = c.dataset.d! }
}

export function Insights({ today, first }: { today: string; first: string }) {
  const [d, setD] = useState<InsightsData | null>(null)
  const [err, setErr] = useState('')
  const load = () => { setErr(''); api.insights(today).then(setD, (e) => setErr(e.message)) }
  useEffect(load, [today]) // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <div className="ins" id="ins"><p className="glass" role="alert">{err} <button className="btn text" type="button" onClick={load}>Try again</button></p></div>
  if (!d) return <div className="ins" id="ins"><p className="glass muted" role="status">Loading…</p></div>
  if (d.entries < MIN_ENTRIES) return <div className="ins" id="ins"><div className="glass"><p>Insights appear after a week of entries.</p></div></div>

  const n = d.habits.length
  const { current, best } = streakStats(d.habits)
  const bestH = d.habits.find((h) => h.best_streak === best), curH = d.habits.find((h) => h.streak === current)
  const ms = monthStats(d.days, today)
  const wd = bestWeekday(d.days, today, n, first)
  const bars = weekBars(d.days, today, n, first)
  const msg = weekMessage(bars.filter((b) => !b.live).map((b) => b.p))
  const avg = ms.avgMood ? `Average mood so far: ${MOODS[ms.avgMood - 1]}.` : ''
  const ev = { onMouseOver: show, onFocus: show, onClick: show, onMouseOut: hide, onBlur: hide }

  return (
    <div className="ins" id="ins" {...ev}>
      <div className="glass ic">
        <div className="ic-head"><h2>This month</h2></div>
        <div className="ic-body">
          <div className="stats">
            <div className="stat" tabIndex={0} data-tip={`Your longest streak running right now${curH && current ? `: ${curH.name}, ${current} days in a row` : ''}. A streak counts consecutive days a habit was done, up to today.`}><b>{current}</b><span className="muted small">Current streak</span></div>
            <div className="stat" tabIndex={0} data-tip={`Your longest streak ever${bestH && best ? `: ${bestH.name}, ${best} days in a row` : ''}.`}><b>{best}</b><span className="muted small">Best streak</span></div>
            <div className="stat" tabIndex={0} data-tip={`You saved a mood on ${ms.wrote} of ${ms.dayOfMonth} days so far this month (${pct(ms.wrote, ms.dayOfMonth)}%).`}><b>{ms.wrote}</b><span className="muted small">Days written</span></div>
          </div>
          <Cap text={`${avg} ${wd ? `Your best day for habits is ${wd}.` : ''}`.trim()} />
        </div>
      </div>
      <div className="glass ic">
        <div className="ic-head"><h2>Habits over time</h2></div>
        <Cap cls="prompt" text={msg || 'Habits done per week.'} />
        <div className="chart">
          <div className="yax" aria-hidden="true"><span>100%</span><span>50%</span><span>0%</span></div>
          <div className="ic-body hscroll">
            {bars.map((w) => (
              <div key={w.start} className="bar g-week" tabIndex={0} data-tip={`Week of ${shortDate(w.start)}: ${w.done} of ${w.poss} habit check-ins done (${w.p}%).${w.live ? ' Still in progress.' : ''}`}>
                <span className="plot"><span className="fill" style={{ '--p': w.p } as React.CSSProperties} /></span>
                <span className="lbl">{shortDate(w.start)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="glass ic">
        <div className="ic-head"><h2>Each habit</h2></div>
        <Cap text="Last 30 days, and the longest streak ever." />
        <div className="ic-body">
          {d.habits.map((h) => (
            <div key={h.id} className="hrow" tabIndex={0} data-tip={`${h.name}: done ${Math.round(h.last30 * 0.3)} of the last 30 days. Current streak ${h.streak} days, best ${h.best_streak} days.`}>
              <span>{h.name}</span><span className="muted small">{h.last30}% · best {h.best_streak} days</span>
              <span className="meter" style={{ '--p': h.last30 } as React.CSSProperties}><i /></span>
            </div>
          ))}
        </div>
      </div>
      <div className="glass ic">
        <div className="ic-head"><h2>Milestones</h2></div>
        <Cap text={`Your best streak: ${best} days.`} />
        <div className="ic-body"><div className="miles">
          {milestones(best).map((m) => (
            <span key={m.n} className="chip" tabIndex={0} data-got={m.reached || undefined} role="img" aria-label={`${m.n} days, ${m.reached ? 'reached' : `${m.left} to go`}`}
              data-tip={m.reached ? `Reached: your best streak hit ${m.n} days.` : `${m.left} more days of a streak to reach ${m.n}. Your best so far is ${best}.`}>
              <span className="medal"><Medal n={m.n} /></span><span className="tx"><b>{m.n} days</b>{!m.reached && <span className="muted small"> · {m.left} to go</span>}</span>
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
