import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { api, type DayData, type HistoryDay, type User } from '../api'
import { addDays, addMonths, daysInMonth, localDay, longDateY, monthOf, monthTitle, MONTH_ABBR, weekdayMon } from '../day'
import { Chevron, Cross, Pencil } from '../icons'
import { MOODS } from '../mood'
import { Insights, prefetchInsights } from './Insights'
import { Md } from '../components/Rich'

const wideQuery = '(min-width:700px)'
const col = (v: string) => ({ '--c': v }) as CSSProperties

export function History({ user, onEdit }: { user: User; onEdit: (day: string) => void }) {
  // shortcut: today is fixed while the screen is open; reload after midnight
  const [today] = useState(() => localDay())
  const first = user.created_at ? localDay(new Date(user.created_at)) : today
  const [month, setMonth] = useState(monthOf(today))
  const [sel, setSel] = useState<string | null>(() => (matchMedia(wideQuery).matches ? today : null)) // wide: the panel opens on today, as in the prototype
  const [view, setView] = useState<'cal' | 'ins'>('cal')
const [leaving, setLeaving] = useState<'cal' | 'ins' | null>(null) // the pane sliding out; both panes exist while it runs
const sheetFrom = useRef<{ top: number; left: number; width: number; height: number } | null>(null)
const slideFrom = useRef<{ top: number; left: number; width: number; height: number } | null>(null)
const go = (next: 'cal' | 'ins') => {
if (next === view || leaving) return
if (next === 'cal' && !sel) auto.current = true
if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setView(next)
const el = document.getElementById(view)!, r = el.getBoundingClientRect(), par = el.offsetParent!.getBoundingClientRect()
slideFrom.current = { top: r.top - par.top, left: r.left - par.left, width: r.width, height: r.height }
const sh = sheet.current; sheetFrom.current = sh?.open && view === 'cal' ? (() => { const q = sh.getBoundingClientRect(); return { top: q.top - par.top, left: q.left - par.left, width: q.width, height: q.height } })() : null
setLeaving(view); setView(next)
}
// Calendar is the left option: going to Insights the content slides left to right; back, right to left. 1400 ms.
useLayoutEffect(() => {
if (!leaving || !slideFrom.current) return
const from = document.getElementById(leaving)!, to = document.getElementById(view)!, root = document.documentElement
const dir = view === 'ins' ? -1 : 1, W = from.offsetParent!.clientWidth + 32, o: KeyframeAnimationOptions = { duration: 1400, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'both' }
const f = slideFrom.current
root.classList.add('vs')
Object.assign(from.style, { position: 'absolute', top: f.top + 'px', left: f.left + 'px', width: f.width + 'px', height: f.height + 'px', maxHeight: 'none', margin: '0' })
const out = from.animate([{ transform: 'none' }, { transform: `translateX(${-dir * W}px)` }], o)
to.animate([{ transform: `translateX(${dir * W}px)` }, { transform: 'none' }], o)
// wide: the day panel is a second card; it travels with the calendar, as in the prototype
const sh = sheet.current, sr = sheetFrom.current
if (sh && matchMedia(wideQuery).matches && sel) {
if (view === 'cal') { sh.style.transition = 'none'; sh.open = true; sh.animate([{ transform: `translateX(${dir * W}px)`, opacity: 0 }, { opacity: 0, offset: .9 }, { transform: 'none', opacity: 1 }], o) }
else if (sr) {
Object.assign(sh.style, { transition: 'none', position: 'absolute', top: sr.top + 'px', left: sr.left + 'px', width: sr.width + 'px', height: sr.height + 'px', maxHeight: 'none', margin: '0' })
sh.animate([{ transform: 'none', opacity: 1 }, { opacity: 0, offset: .1 }, { transform: `translateX(${-dir * W}px)`, opacity: 0 }], o)
}
}
let done = false
const end = () => { if (done) return; done = true; root.classList.remove('vs'); setLeaving(null) }
out.finished.then(end, () => {})
return () => { [from, to, sheet.current].forEach((x) => x?.getAnimations().forEach((a) => a.cancel())); from.removeAttribute('style'); const sh = sheet.current
    // leaving the calendar: close the panel in this same commit, or it shows for one frame at its old spot before the effect above closes it
    if (sh && view !== 'cal' && sh.open) { sh.style.transition = 'none'; sh.close(); requestAnimationFrame(() => requestAnimationFrame(() => sh.removeAttribute('style'))) } else sh?.removeAttribute('style')
    root.classList.remove('vs'); end() }
}, [leaving]) // eslint-disable-line react-hooks/exhaustive-deps
  const [picker, setPicker] = useState(false)
  const auto = useRef(true) // until the person picks a day, the panel follows the default
  const [py, setPy] = useState(Number(today.slice(0, 4)))
  const [days, setDays] = useState<Map<string, HistoryDay>>(new Map())
  const [err, setErr] = useState('')
  const [n, setN] = useState(0) // bump to refetch the month
  const [wide, setWide] = useState(() => matchMedia(wideQuery).matches)
  const sheet = useRef<HTMLDialogElement>(null)
  const shown = useRef<string | null>(null) // the day the panel last showed

  useEffect(() => prefetchInsights(today, first), []) // eslint-disable-line react-hooks/exhaustive-deps
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

  // wide: the panel always shows a day: today, or yesterday when today has nothing saved yet
  useEffect(() => {
    if (!wide || !auto.current || month !== monthOf(today) || !days.size && !err) return
    const y = addDays(today, -1)
    setSel(!days.get(today)?.entry && y >= first ? y : today)
  }, [days, wide, view]) // eslint-disable-line react-hooks/exhaustive-deps

  const minMonth = monthOf(first), maxMonth = monthOf(today)
  const goDay = useCallback((day: string) => { auto.current = false; setSel(day); setMonth(monthOf(day)) }, [])

  // The sheet is a modal on phones and a panel beside the grid from 700px.
  useEffect(() => {
    const d = sheet.current
    if (!d) return
    if (!sel || (view !== 'cal' && leaving !== 'cal')) {
      if (d.open) {
        // wide: the card already slid away; it vanishes at once, with no fade at the old spot (the prototype's card.close())
        if (wide) { d.style.transition = 'none'; requestAnimationFrame(() => requestAnimationFrame(() => d.removeAttribute('style'))) }
        d.close()
      }
      return
    }
    const picked = shown.current !== sel; shown.current = sel
    if (d.open) {
      // another day picked while the panel is open: the content fades up, as in the prototype
      if (picked && wide && !leaving && !matchMedia('(prefers-reduced-motion: reduce)').matches) d.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.22, 1, .36, 1)' })
      return
    }
    if (wide) d.open = true // not show(): it would pull focus off the grid
    else d.showModal()
  }, [sel, view, wide, leaving])

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!sel || view !== 'cal' || e.defaultPrevented) return
      if (e.key === 'Escape' && wide) { auto.current = false; setSel(null) }
    }
    addEventListener('keydown', on)
    return () => removeEventListener('keydown', on)
  }, [sel, view, wide])

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
                      aria-label={`${longDateY(key)}${pre ? ', before you joined' : mood ? `, ${MOODS[mood - 1]}, ${x!.done} of ${x!.total} habits done` : future ? '' : x?.entry ? ', reflection without a mood' : ', no reflection'}`}
                      onClick={() => { auto.current = false; setSel(key) }}><i>{Number(key.slice(8))}</i></button>
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

      <dialog key={wide ? 'panel' : 'modal'} className="glass" id="sheet" ref={sheet} aria-labelledby="sheet-date" onClose={() => { if (view === 'cal') setSel(null) }}>
        {sel && <DaySheet key={sel} day={sel} onEdit={() => onEdit(sel)} onClose={() => sheet.current?.close()} />}
      </dialog>

      {(view === 'ins' || leaving === 'ins') && <Insights today={today} first={first} />}
    </section>
  )
}

function DaySheet({ day, onEdit, onClose }: { day: string; onEdit: () => void; onClose: () => void }) {
  const [d, setD] = useState<DayData | null>(null)
  const [err, setErr] = useState('')
  const load = () => { setErr(''); api.day(day).then(setD, (e) => setErr(e.message)) }
  useEffect(load, [day]) // eslint-disable-line react-hooks/exhaustive-deps
  const e = d?.entry, mood = e?.mood ?? null
  const done = d?.habits.filter((h) => h.done).length ?? 0
  const sub = [mood ? `${MOODS[mood - 1]}.` : '', d?.habits.length ? (done === d.habits.length ? 'Every habit done.' : `${done} of ${d.habits.length} habits done.`) : ''].filter(Boolean).join(' ')
  const answers: [string, string | null | undefined][] = [['What went well today?', e?.went_well], ['What was hard today?', e?.was_hard], ["What's one thing for tomorrow?", e?.tomorrow]]

  return (
    <>
      <h2 id="sheet-date">{longDateY(day)}</h2>
      {err && <p role="alert">{err} <button className="btn text" type="button" onClick={load}>Try again</button></p>}
      {!d && !err && <p className="muted" role="status">Loading…</p>}
      {d && (
        <>
          <p className="muted" id="sheet-sub">{e ? sub : ['Nothing saved for this day.', sub].filter(Boolean).join(' ')}</p>
          <dl id="sheet-body">
            {answers.filter(([, v]) => v).map(([q, v]) => <Fragment key={q}><dt>{q}</dt><dd><Md text={v!} /></dd></Fragment>)}
          </dl>
        </>
      )}
      <div className="row" style={{ marginTop: 20 }}>
        <button className="btn ib" type="button" data-tip="Edit this day" aria-label="Edit this day" onClick={onEdit}><Pencil /></button>
        <button className="btn quiet ib" id="sheet-close" type="button" data-tip="Close" aria-label="Close" onClick={onClose}><Cross /></button>
      </div>
    </>
  )
}
