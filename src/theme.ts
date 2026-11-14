import { useEffect, useState } from 'react'

export type Theme = 'scenes' | 'classic'
export type Phase = 'dawn' | 'day' | 'dusk' | 'night'
export type PhaseSetting = 'auto' | Phase

export const phaseFor = (h: number): Phase => (h < 5 ? 'night' : h < 9 ? 'dawn' : h < 16 ? 'day' : h < 19 ? 'dusk' : 'night')
export const greetFor = (h: number) => (h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 17 ? 'Good afternoon' : 'Good evening')
export const SAMPLE_HOUR: Record<Phase, number> = { dawn: 7, day: 13, dusk: 18, night: 21 }

/** The hour (fractional) the UI should act on: the clock for auto, a sample hour for a forced phase. */
export const hourFor = (setting: PhaseSetting, now = new Date()) =>
  setting === 'auto' ? now.getHours() + now.getMinutes() / 60 : SAMPLE_HOUR[setting]

/** Classic only: vertical orb position in %. Sun rises 05, sets 19; the moon takes the night. */
export const orbY = (hour: number) => {
  const t = hour >= 5 && hour < 19 ? (hour - 5) / 14 : ((hour + 5) % 24) / 10
  return (6 + (1 - Math.sin(Math.PI * t)) * 26).toFixed(1) + '%'
}

// localStorage can throw (private windows, blocked storage), so the app must work without it.
export const store = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* in-memory only */ } },
}
export const readTheme = (): Theme => (store.get('jurnala-theme') === 'classic' ? 'classic' : 'scenes')
export const readPhase = (): PhaseSetting => {
  const v = store.get('jurnala-phase')
  return v === 'dawn' || v === 'day' || v === 'dusk' || v === 'night' ? v : 'auto'
}

/** Applies theme and phase to <html>, keeps tabs in sync, and re-checks the clock every minute in auto. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readTheme)
  const [setting, setSettingState] = useState<PhaseSetting>(readPhase)
  const [hour, setHour] = useState(() => hourFor(readPhase()))

  useEffect(() => {
    const tick = () => setHour(hourFor(setting))
    tick()
    if (setting !== 'auto') return
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [setting])

  useEffect(() => {
    const r = document.documentElement
    r.dataset.theme = theme
    r.dataset.phase = phaseFor(hour)
    if (theme === 'classic') r.style.setProperty('--orb-y', orbY(hour))
    else r.style.removeProperty('--orb-y')
  }, [theme, hour])

  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.key === 'jurnala-theme') setThemeState(readTheme())
      if (e.key === 'jurnala-phase') setSettingState(readPhase())
    }
    addEventListener('storage', on)
    return () => removeEventListener('storage', on)
  }, [])

  const setTheme = (t: Theme) => { store.set('jurnala-theme', t); setThemeState(t) }
  const setSetting = (p: PhaseSetting) => { store.set('jurnala-phase', p); setSettingState(p) }
  return { theme, setTheme, setting, setSetting, hour }
}
