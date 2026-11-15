import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { api, setUnauthorizedHandler, type User } from './api'
import { useTheme } from './theme'
import { quoteOfDay } from './quote'
import { Scene } from './components/Scene'
import { Nav, type Screen } from './components/Nav'
import { Eye } from './icons'
import { SignIn } from './screens/SignIn'
import { Today } from './screens/Today'
import { History } from './screens/History'
import { Habits } from './screens/Habits'
import { Settings } from './screens/Settings'

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const root = document.documentElement
const cards = () => [...(document.querySelector('.screen')?.children ?? [])].filter((el) => el.getClientRects().length) as HTMLElement[]
const curTab = () => [...document.querySelectorAll<HTMLElement>('#nav [aria-current]')].find((b) => b.offsetParent)

// Cards fly to the current tab (out) or come back from it (in).
async function fly(out: boolean) {
  const els = cards(), tab = curTab()
  if (calm() || !els.length || !tab) return []
  const t = tab.getBoundingClientRect()
  const anims = els.map((el, i) => {
    const r = el.getBoundingClientRect()
    const gone = { transform: `translate(${t.left + t.width / 2 - r.left - r.width / 2}px, ${t.top + t.height / 2 - r.top - r.height / 2}px) scale(.12)`, opacity: 0 }
    const here = { transform: 'none', opacity: 1 }
    return el.animate(out ? [here, gone] : [gone, here], { duration: out ? 500 : 800, delay: i * (out ? 60 : 80), easing: out ? 'cubic-bezier(.5,0,.75,.2)' : 'cubic-bezier(.22,1,.36,1)', fill: out ? 'forwards' : 'backwards' })
  })
  // The timeout stops a stalled animation (hidden tab) from leaving `busy` set and the tabs dead.
  await Promise.race([Promise.all(anims.map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 2500))])
  return anims
}

export default function App() {
  const t = useTheme()
  const [user, setUser] = useState<User | null | undefined>(undefined) // undefined = checking
  const [screen, setScreen] = useState<Screen>('today')
  const [editDay, setEditDay] = useState<string | null>(null) // a past day opened from History, shown on Today
  const [mode, setMode] = useState<'off' | 'scene' | 'quote'>('off')
  const busy = useRef(false)
  const modeRef = useRef(mode)
  modeRef.current = mode

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    api.me().then((r) => setUser(r.user), () => setUser(null))
  }, [])
  useEffect(() => { root.classList.toggle('out', !user) }, [user])
  useEffect(() => {
    root.classList.toggle('viewing', mode !== 'off')
    root.classList.toggle('q', mode === 'quote')
  }, [mode])
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && modeRef.current !== 'off') leave() }
    addEventListener('keydown', esc)
    return () => removeEventListener('keydown', esc)
  })

  async function enter(m: 'scene' | 'quote') {
    if (busy.current) return
    busy.current = true
    if (modeRef.current === 'off') { const a = await fly(true); flushSync(() => setMode(m)); a.forEach((x) => x.cancel()) } else setMode(m)
    busy.current = false
  }
  async function leave() {
    if (busy.current) return
    busy.current = true
    flushSync(() => setMode('off'))
    await fly(false)
    busy.current = false
  }
  async function go(s: Screen, day: string | null = null) {
    if (busy.current) return
    if (s === screen) return modeRef.current === 'off' ? enter('scene') : leave()
    if (modeRef.current !== 'off') { flushSync(() => setMode('off')); scrollTo(0, 0); setEditDay(day); return setScreen(s) }
    busy.current = true
    const a = await fly(true)
    flushSync(() => { setScreen(s); setEditDay(day) }); scrollTo(0, 0); a.forEach((x) => x.cancel())
    await fly(false)
    busy.current = false
  }
  async function signOut() {
    if (busy.current) return
    busy.current = true
    const done = () => { flushSync(() => { setUser(null); setMode('off') }) }
    try { await api.logout() } catch (e) { busy.current = false; throw e } // keep the user signed in: the cookie is still valid
    if (calm()) { done(); busy.current = false; return }
    const out = [...document.querySelectorAll<HTMLElement>('.screen > :not(dialog), #nav, #view-scene')]
    const k = [{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: 'translateY(14px) scale(.98)', filter: 'blur(4px)' }]
    await Promise.all(out.map((e, i) => e.animate(k, { duration: 280, delay: i * 40, easing: 'cubic-bezier(.4,0,.8,.4)', fill: 'forwards' }).finished.catch(() => {})))
    done(); setScreen('today')
    document.getElementById('signin-form')?.animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 120, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' })
    busy.current = false
  }

  return (
    <>
      <Scene />
      {user && <Nav screen={screen} current={mode !== 'quote'} onGo={go} onBrand={() => (mode === 'off' ? enter('quote') : mode === 'scene' ? setMode('quote') : undefined)} quote={mode === 'quote'} />}
      <main className="app">
        {user && <div className="quote" id="quote" role="status"><p>{quoteOfDay()}</p></div>}
        {user === undefined ? null : !user ? <SignIn onIn={(u) => { setScreen('today'); setUser(u) }} /> :
          screen === 'today' ? <Today key={editDay ?? 'now'} user={user} hour={t.hour} day={editDay} onGo={go} onBack={() => setEditDay(null)} /> :
          screen === 'history' ? <History user={user} onEdit={(d) => go('today', d)} /> :
          screen === 'habits' ? <Habits /> :
          <Settings user={user} theme={t.theme} setTheme={t.setTheme} setting={t.setting} setSetting={t.setSetting} onSignOut={signOut} />}
      </main>
      {user && (
        <>
          <button className="icon-btn view" id="view-scene" type="button" aria-pressed={mode !== 'off'} aria-label="View scene" onClick={() => (mode === 'off' ? enter('scene') : leave())}><Eye /></button>
        </>
      )}
    </>
  )
}
