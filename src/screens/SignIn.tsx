import { useState } from 'react'
import { api, type User } from '../api'

export function SignIn({ onIn }: { onIn: (u: User) => void }) {
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true); setErr('')
    try { onIn((await api.login(String(f.get('email')), String(f.get('password')))).user) }
    catch (x) { setErr((x as Error).message); setBusy(false) }
  }
  return (
    <section className="screen signin">
      <div className="head"><h1>Welcome to Jurnala</h1></div>
      <form className="glass stack" id="signin-form" onSubmit={submit}>
        <label>Email <input className="field" name="email" type="email" autoComplete="username" required /></label>
        <label>Password <input className="field" name="password" type="password" autoComplete="current-password" required /></label>
        <p className="muted" role="alert">{err}</p>
        <button className="btn" type="submit" disabled={busy}>Sign in</button>
      </form>
    </section>
  )
}
