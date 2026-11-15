import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type DayData, type User } from '../api'
import { Check, Gear } from '../icons'
import { localDay, longDate } from '../day'
import { greetFor } from '../theme'
import { Reflection } from '../components/Reflection'
import { cheerForMood, cheerForTick, cheerOnOpen } from '../cheer'

export function Today({ user, hour, onGo }: { user: User; hour: number; onGo: (s: 'settings') => void }) {
  // shortcut: the day is fixed when the screen opens; reload the page after midnight, upgrade when it matters
  const [day] = useState(() => localDay())
  const [d, setD] = useState<DayData | null>(null)
  const [err, setErr] = useState('')

  const [cheer, setCheer] = useState('')
  const cheerTimer = useRef(0)
  const say = (m: string) => { clearTimeout(cheerTimer.current); setCheer(m); if (m) cheerTimer.current = window.setTimeout(() => setCheer(''), 8000) }
  useEffect(() => () => clearTimeout(cheerTimer.current), [])

  const load = useCallback(() => { setErr(''); api.day(day).then((r) => { setD(r); say(cheerOnOpen(r)) }, (e) => setErr(e.message)) }, [day])
  useEffect(load, [load])

  async function tick(id: number) {
    if (!d) return
    const h = d.habits.find((x) => x.id === id)!
    const set = (done: boolean, streak: number) => setD((p) => p && { ...p, habits: p.habits.map((x) => (x.id === id ? { ...x, done, streak } : x)) })
    set(!h.done, h.streak)
    try {
      const r = await api.checkin(id, day, !h.done); set(r.done, r.streak)
      say(cheerForTick(r.done, r.streak, d.habits.every((x) => (x.id === id ? r.done : x.done)), r.first))
    }
    catch (e) { set(h.done, h.streak); setErr((e as Error).message) }
  }

  const allDone = !!d && d.habits.length > 0 && d.habits.every((h) => h.done)
  return (
    <section className="screen today">
      <div className="head">
        <div>
          <h1 id="greeting">{greetFor(hour)}, {user.name}</h1>
          <p className="muted" id="date">{longDate(day)}</p>
        </div>
        <button className="icon-btn gear" type="button" aria-label="Settings" onClick={() => onGo('settings')}><Gear /></button>
      </div>
      {err && <p className="glass" role="alert">{err} <button className="btn text" type="button" onClick={load}>Try again</button></p>}
      {!d && !err && <p className="glass muted" role="status">Loading…</p>}
      {d && (
        <>
          <div className="col">
            <div className="glass stack">
              <h2>Today's habits</h2>
              {d.habits.length === 0 ? <p className="muted">Start with one small thing. Add a habit under Habits.</p> : (
                <ul className="habits" id="habits">
                  {d.habits.map((h) => (
                    <li key={h.id}>
                      <button className="habit" type="button" aria-pressed={h.done} onClick={() => tick(h.id)}>
                        <span className="tick"><Check /></span><span className="name">{h.name}</span>
                        <span className="streak muted small">{h.streak ? `${h.streak}-day streak` : ''}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="prompt cheer" id="cheer" role="status" hidden={!cheer}>{cheer}</p>
          </div>
          <Reflection key={day} day={day} entry={d.entry} said={d.yesterday_tomorrow} onSaved={(entry) => { setD({ ...d, entry }); say(cheerForMood(entry.mood)) }} />
          <p className="prompt" id="closing" hidden={!(allDone && d.entry)}>That's today. See you tomorrow.</p>
        </>
      )}
    </section>
  )
}
