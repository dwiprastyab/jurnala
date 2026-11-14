import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export type Screen = 'today' | 'history' | 'habits' | 'settings'
const TABS: [Screen, string, string?][] = [['today', 'Today'], ['history', 'History'], ['habits', 'Habits'], ['settings', 'Settings', 'wide-only']]

type Props = { screen: Screen; current: boolean; onGo: (s: Screen) => void; onBrand: () => void; quote: boolean }

export function Nav({ screen, current, onGo, onBrand, quote }: Props) {
  const tabs = useRef<HTMLDivElement>(null)
  const [ind, setInd] = useState<{ w: number; h: number; x: number; y: number } | null>(null)
  const [ready, setReady] = useState(false)

  const measure = () => {
    const b = tabs.current?.querySelector<HTMLElement>('[aria-current]')
    setInd(b && b.offsetParent ? { w: b.offsetWidth, h: b.offsetHeight, x: b.offsetLeft, y: b.offsetTop } : null)
  }
  useLayoutEffect(measure, [screen, current])
  useEffect(() => {
    addEventListener('resize', measure)
    document.fonts.ready.then(() => { measure(); requestAnimationFrame(() => setReady(true)) })
    return () => removeEventListener('resize', measure)
  }, [])

  return (
    <nav className={`nav${ready ? ' ready' : ''}`} id="nav" aria-label="Main">
      <button className="brand" id="brand" type="button" aria-pressed={quote} aria-label="Jurnala. Show today's quote over the scene" onClick={onBrand}>Jurnala</button>
      <div className="tabs glass" ref={tabs}>
        <span className="ind" hidden={!ind} style={ind ? { width: ind.w, height: ind.h, transform: `translate(${ind.x}px, ${ind.y}px)` } : undefined} />
        {TABS.map(([k, label, cls]) => (
          <button key={k} type="button" data-go={k} className={cls} aria-current={current && screen === k ? 'page' : undefined} onClick={() => onGo(k)}>{label}</button>
        ))}
      </div>
    </nav>
  )
}
