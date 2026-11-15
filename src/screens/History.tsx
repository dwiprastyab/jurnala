import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { api, type DayData, type HistoryDay, type User } from '../api'
import { addDays, addMonths, daysInMonth, localDay, longDateY, monthOf, monthTitle, MONTH_ABBR, weekdayMon } from '../day'
import { Chevron } from '../icons'
import { MOODS } from '../mood'
import { Reflection } from '../components/Reflection'
import { Insights } from './Insights'

const wideQuery = '(min-width:700px)'
const col = (v: string) => ({ '--c': v }) as CSSProperties

export function History({ user }: { user: User }) {
  // shortcut: today is fixed while the screen is open; reload after midnight
  const [today] = useState(() => localDay())
  const first = user.created_at ? localDay(new Date(user.created_at)) : today
  const [month, setMonth] = useState(monthOf(today))
  const [sel, setSel] = useState<string | null>(null)
  const [view, setView] = useState<'cal' | 'ins'>('cal')
const [leaving, setLeaving] = useState<'cal' | 'ins' | null>(null) // the pane sliding out; both panes exist while it runs
const slideFrom = useRef<{ top: number; left: number; width: number } | null>(null)
const go = (next: 'cal' | 'ins') => {
if (next === view || leaving) return
if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setView(next)
const el = document.getElementById(view)!, r = el.getBoundingClientRect(), par = el.offsetParent!.getBoundingClientRect()
slideFrom.current = { top: r.top - par.top, left: r.left - par.left, width: r.width }
setLeaving(view); setView(next)
}
// Calendar is the left option: going to Insights the content slides left to right; back, right to left. 1400 ms.
useLayoutEffect(() => {
if (!leaving || !slideFrom.current) return
const from = document.getElementById(leaving)!, to = document.getElementById(view)!, root = document.documentElement
const dir = view === 'ins' ? -1 : 1, W = from.offsetParent!.clientWidth + 32, o: KeyframeAnimationOptions = { duration: 1400, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'both' }
const f = slideFrom.current
root.classList.add('vs')
Object.assign(from.style, { position: 'absolute', top: f.top + 'px', left: f.left + 'px', width: f.width + 'px', margin: '0' })
const out = from.animate([{ transform: 'none' }, { transform: `translateX(${-dir * W}px)` }], o)
to.animate([{ transform: `translateX(${dir * W}px)` }, { transform: 'none' }], o)
let done = false
const end = () => { if (done) return; done = true; root.classList.remove('vs'); setLeaving(null) }
out.finished.then(end, () => {})
return () => { [from, to].forEach((x) => x.getAnimations().forEach((a) => a.cancel())); from.removeAttribute('style'); root.classList.remove('vs'); end() }
}, [leaving]) // eslint-disable-line react-hooks/exhaustive-deps
  const [picker, setPicker] = useState(false)
  const [py, setPy] = useState(Number(today.slice(0, 4)))
  const [days, setDays] = useState<Map<string, HistoryDay>>(new Map())
  const [err, setErr] = useState('')
  const [n, setN] = useState(0) // bump to refetch the month
  const [wide, setWide] = useState(() => matchMedia(wideQuery).matches)
  const sheet = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const q = matchMedia(wideQuery), on = () => setWide(q.matches)
    q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])

  useEffect(() => {
    let live = true
    setErr('')
    api.history(`${month}-01`, `${month}-${String(daysInMonth(month)).padStart(2, '0')}`).then(
      (r) => live && setDays(new Map(r.days.map((d) => [d.day, d]))),
      (e) => live && setErr(e.message),
    )
    return () => { live = false }
  }, [month, n])

  const minMonth = monthOf(first), maxMonth = monthOf(today)
  const goDay = useCallback((day: string) => { setSel(day); setMonth(monthOf(day)) }, [])
  const stepDay = useCallback((by: number) => {
    if (!sel) return
    const t = addDays(sel, by)
    if (t >= first && t <= today) goDay(t)
  }, [sel, first, today, goDay])

  // The sheet is a modal on phones and a panel beside the grid from 700px.
  useEffect(() => {
    const d = sheet.current
    if (!d) return
    if (!sel || view !== 'cal') { if (d.open) d.close(); return }
    if (d.open) return
    if (wide) d.open = true // not show(): it would pull focus off the grid
    else d.showModal()
  }, [sel, view, wide])

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!sel || view !== 'cal' || e.defaultPrevented) return
      const t = e.target as HTMLElement
      if (e.key === 'Escape' && wide) setSel(null)
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !t.closest('input, textarea, select, [contenteditable]')) stepDay(e.key === 'ArrowLeft' ? -1 : 1)
    }
    addEventListener('keydown', on)
    return () => removeEventListener('keydown', on)
  }, [sel, view, wide, stepDay])

  const lead = weekdayMon(`${month}-01`)
  const cells = Array.from({ length: daysInMonth(month) }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)

  return (
    <section className="screen history">
      <div className="head">
        <div><h1>History</h1><p className="muted">Every day since you joined</p></div>
        <div className="seg" role="group" aria-label="View" data-on={view}>
          <button type="button" aria-pressed={view === 'cal'} onClick={() => go('cal')}>Calendar</button>
          <button type="button" aria-pressed={view === 'ins'} onClick={() => go('ins')}>Insights</button>
        </div>
      </div>

      {view === 'cal' || leaving === 'cal' ? (
        <div className="glass stack" id="cal">
          <div className="cal-head">
            <button className="icon-btn" type="button" aria-label="Previous month" disabled={month <= minMonth} onClick={() => setMonth(addMonths(month, -1))}><Chevron d="M15 6l-6 6 6 6" /></button>
            <button className="cal-title" type="button" aria-expanded={picker} aria-controls="picker" aria-live="polite" onClick={() => { setPy(Number(month.slice(0, 4))); setPicker(!picker) }}>
              {monthTitle(month)} <Chevron d="M6 9l6 6 6-6" />
            </button>
            <button className="icon-btn" type="button" aria-label="Next month" disabled={month >= maxMonth} onClick={() => setMonth(addMonths(month, 1))}><Chevron d="M9 6l6 6-6 6" /></button>
          </div>
          {picker && (
            <div className="picker" id="picker">
              <div className="years">
                <button className="icon-btn" type="button" aria-label="Previous year" disabled={py <= Number(minMonth.slice(0, 4))} onClick={() => setPy(py - 1)}><Chevron d="M15 6l-6 6 6 6" /></button>
                <span aria-live="polite">{py}</span>
                <button className="icon-btn" type="button" aria-label="Next year" disabled={py >= Number(maxMonth.slice(0, 4))} onClick={() => setPy(py + 1)}><Chevron d="M9 6l6 6-6 6" /></button>
              </div>
              <div className="months">
                {MONTH_ABBR.map((name, m) => {
                  const key = `${py}-${String(m + 1).padStart(2, '0')}`
                  return <button key={key} type="button" aria-pressed={key === month} disabled={key < minMonth || key > maxMonth} onClick={() => { setMonth(key); setPicker(false) }}>{name}</button>
                })}
              </div>
              <label>Go to a date <input className="field" type="date" min={first} max={today} onChange={(e) => { if (e.target.value) { goDay(e.target.value); setPicker(false) } }} /></label>
            </div>
          )}
          {!picker && (
            <div className="stack" id="cal-body">
              {err && <p role="alert">{err} <button className="btn text" type="button" onClick={() => setN(n + 1)}>Try again</button></p>}
              <div className="grid" id="grid">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((w, i) => <span key={i} className="wd" aria-hidden="true">{w}</span>)}
                {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
                {cells.map((key) => {
                  const x = days.get(key), pre = key < first, future = key > today, mood = x?.mood ?? null
                  const full = !!x && x.total > 0 && x.done === x.total
                  return (
                    <button key={key} type="button" className="day" disabled={pre || future}
                      data-pre={pre || undefined} data-future={future || undefined} data-full={full || undefined}
                      data-mood={mood ?? undefined} style={mood ? col(`var(--mood-${mood})`) : undefined}
                      aria-current={key === today ? 'date' : undefined} aria-pressed={key === sel}
                      aria-label={`${longDateY(key)}${pre ? ', before you joined' : mood ? `, mood ${MOODS[mood - 1]}` : future ? '' : ', nothing saved'}`}
                      onClick={() => setSel(key)}><i>{Number(key.slice(8))}</i></button>
                  )
                })}
              </div>
              <div className="legend" id="legend">
                {MOODS.map((m, i) => <span key={m}><i style={col(`var(--mood-${i + 1})`)} />{m}</span>)}
                <span><i className="dot" />Every habit done</span>
              </div>
              {month !== maxMonth && <button className="btn text" type="button" onClick={() => setMonth(maxMonth)}>Back to this month</button>}
            </div>
          )}
        </div>
      ) : null}

      <dialog className="glass" id="sheet" ref={sheet} aria-labelledby="sheet-date" onClose={() => setSel(null)}>
        {sel && <DaySheet key={sel} day={sel} first={first} today={today} onStep={stepDay} onClose={() => sheet.current?.close()} onSaved={() => setN((v) => v + 1)} />}
      </dialog>

      {(view === 'ins' || leaving === 'ins') && <Insights today={today} first={first} />}
    </section>
  )
}

function DaySheet({ day, first, today, onStep, onClose, onSaved }: { day: string; first: string; today: string; onStep: (n: number) => void; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<DayData | null>(null)
  const [err, setErr] = useState('')
  const [writing, setWriting] = useState(false)
  const load = () => { setErr(''); api.day(day).then(setD, (e) => setErr(e.message)) }
  useEffect(load, [day]) // eslint-disable-line react-hooks/exhaustive-deps
  const mood = d?.entry?.mood ?? null
  const done = d?.habits.filter((h) => h.done).length ?? 0

  return (
    <>
      <h2 id="sheet-date">{longDateY(day)}</h2>
      {err && <p role="alert">{err} <button className="btn text" type="button" onClick={load}>Try again</button></p>}
      {!d && !err && <p className="muted" role="status">Loading…</p>}
      {d && (
        <div className="stack">
          <p className="muted" id="sheet-sub">
            {mood ? `${MOODS[mood - 1]}. ` : ''}{d.habits.length ? (done === d.habits.length ? 'Every habit done.' : `${done} of ${d.habits.length} habits done.`) : ''}
          </p>
          {d.habits.length > 0 && (
            <dl id="sheet-body">
              {d.habits.map((h) => <div key={h.id} className="row"><dt>{h.name}</dt><dd>{h.done ? 'done' : 'not done'}</dd></div>)}
            </dl>
          )}
          {d.entry || writing ? (
            <Reflection bare day={day} entry={d.entry} title="Reflection" onSaved={(entry) => { setD({ ...d, entry }); onSaved() }} />
          ) : (
            <>
              <p className="muted">Nothing saved for this day.</p>
              <button className="btn" type="button" onClick={() => setWriting(true)}>Write about this day</button>
            </>
          )}
        </div>
      )}
      <div className="row" style={{ marginTop: 20 }}>
        <button className="btn quiet" type="button" disabled={day <= first} onClick={() => onStep(-1)}>Previous day</button>
        <button className="btn quiet" type="button" disabled={day >= today} onClick={() => onStep(1)}>Next day</button>
        <button className="btn quiet" id="sheet-close" type="button" onClick={onClose}>Close</button>
      </div>
    </>
  )
}
