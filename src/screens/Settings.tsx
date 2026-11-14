import { useState } from 'react'
import { flushSync } from 'react-dom'
import { api, type User } from '../api'
import { localDay } from '../day'
import type { PhaseSetting, Theme } from '../theme'

type Props = {
  user: User; theme: Theme; setTheme: (t: Theme) => void
  setting: PhaseSetting; setSetting: (p: PhaseSetting) => void; onSignOut: () => Promise<void>
}

export function Settings({ user, theme, setTheme, setting, setSetting, onSignOut }: Props) {
  const [msg, setMsg] = useState('')

  // Theme switch wipes across the screen where the browser supports view transitions, and not at all under reduced motion.
  function pick(t: Theme) {
    if (t === theme) return
    const root = document.documentElement
    const swap = () => flushSync(() => setTheme(t))
    if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return swap()
    root.classList.toggle('wipe-l', t === 'scenes')
    document.startViewTransition(swap).finished.finally(() => root.classList.remove('wipe-l'))
  }

  async function exportCsv() {
    setMsg('')
    try {
      const blob = await api.exportCsv()
      const a = Object.assign(document.createElement('a'), { download: `jurnala-export-${localDay()}.csv`, href: URL.createObjectURL(blob) })
      a.click(); URL.revokeObjectURL(a.href)
    } catch (e) { setMsg((e as Error).message) }
  }

  return (
    <section className="screen narrow">
      <div className="head"><div><h1>Settings</h1><p className="muted">{user.email}</p></div></div>
      <div className="glass stack">
        <h2>Appearance</h2>
        <div className="settings-row">
          <span id="bg-label">Background</span>
          <div className="seg" role="group" aria-labelledby="bg-label" id="theme-seg">
            <button type="button" aria-pressed={theme === 'scenes'} onClick={() => pick('scenes')}>Scenes</button>
            <button type="button" aria-pressed={theme === 'classic'} onClick={() => pick('classic')}>Classic</button>
          </div>
        </div>
        <label className="settings-row">Preview time of day
          <select className="field" value={setting} onChange={(e) => setSetting(e.target.value as PhaseSetting)}>
            <option value="auto">Auto (your clock)</option>
            <option value="dawn">Dawn 05–09</option>
            <option value="day">Day 09–16</option>
            <option value="dusk">Dusk 16–19</option>
            <option value="night">Night 19–05</option>
          </select>
        </label>
        <p className="muted small">Auto follows your clock. Saved on this device.</p>
        <hr />
        <div>
          <h2>Your data</h2>
          <p className="muted small">One CSV file, one row per day with a reflection: date, mood, the three answers, and a 1 or 0 for each habit. Archived habits are included. Days with check-ins but no reflection are not.</p>
        </div>
        <button className="btn quiet" type="button" onClick={exportCsv}>Export my data (CSV)</button>
        {msg && <p role="alert">{msg}</p>}
        <hr />
        <button className="btn quiet" type="button" onClick={() => onSignOut().catch((e) => setMsg((e as Error).message))}>Sign out</button>
      </div>
    </section>
  )
}
