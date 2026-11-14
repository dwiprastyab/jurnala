import { useEffect, useState } from 'react'
import { api, setUnauthorizedHandler, type User } from './api'
import { useTheme } from './theme'
import { Scene } from './components/Scene'
import { Nav, type Screen } from './components/Nav'
import { SignIn } from './screens/SignIn'
import { Today } from './screens/Today'

export default function App() {
  const { hour } = useTheme()
  const [user, setUser] = useState<User | null | undefined>(undefined) // undefined = checking
  const [screen, setScreen] = useState<Screen>('today')

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    api.me().then((r) => setUser(r.user), () => setUser(null))
  }, [])
  useEffect(() => { document.documentElement.classList.toggle('out', !user) }, [user])

  const signOut = () => api.logout().finally(() => setUser(null))
  return (
    <>
      <Scene />
      {user && <Nav screen={screen} current onGo={setScreen} onBrand={() => {}} quote={false} />}
      <main className="app">
        {user === undefined ? null : !user ? <SignIn onIn={(u) => { setScreen('today'); setUser(u) }} /> : screen === 'today' ? (
          <Today user={user} hour={hour} onGo={setScreen} />
        ) : (
          <section className="screen narrow">
            <div className="head"><div><h1>{screen[0].toUpperCase() + screen.slice(1)}</h1><p className="muted">Not built yet.</p></div></div>
            <button className="btn quiet" type="button" onClick={signOut}>Sign out</button>
          </section>
        )}
      </main>
    </>
  )
}
