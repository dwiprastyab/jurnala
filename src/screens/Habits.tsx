import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { api, type Habit } from '../api'
import { Archive, Cross, Grip, Pencil, Plus, Restore, Tick, Trash } from '../icons'

const MAX = 12
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches

export function Habits() {
  const [list, setList] = useState<Habit[] | null>(null)
  const [arch, setArch] = useState<Habit[]>([])
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState<{ text: string; undo?: () => void } | null>(null)
  const [renaming, setRenaming] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [asking, setAsking] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [dragId, setDragId] = useState<number | null>(null)
  const ul = useRef<HTMLUListElement>(null)
    const focusId = useRef<number | null>(null)
  const ref = useRef<Habit[]>([])
  ref.current = list ?? []

  const load = useCallback(() => {
    setErr('')
    return Promise.all([api.habits(), api.habits(true)]).then(([a, b]) => { setList(a.habits); setArch(b.habits) }, (e) => setErr(e.message))
  }, [])
  useEffect(() => { load() }, [load])

  // FLIP, as in the prototype: every row and block glides from where it was to where it is now; new ones fade in.
  const root = useRef<HTMLElement>(null)
  const pos = useRef<Map<string, DOMRect> | null>(null)
  useLayoutEffect(() => {
    const els = [...(root.current?.querySelectorAll<HTMLElement>('li[data-id], .add, #arch-wrap') ?? [])]
    const next = new Map(els.map((e) => [e.dataset.id ? 'h' + e.dataset.id : e.id || 'add', e.getBoundingClientRect()]))
    const prev = pos.current
    if (prev && !calm()) els.forEach((e) => {
      const k = e.dataset.id ? 'h' + e.dataset.id : e.id || 'add', a = prev.get(k), b = next.get(k)!
      if (!a) e.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' })
      else if (a.left !== b.left || a.top !== b.top) e.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' })
    })
    pos.current = list ? next : null // the first paint of the lists is not animated
    if (focusId.current !== null) { ul.current?.querySelector<HTMLElement>(`[data-grip="${focusId.current}"]`)?.focus(); focusId.current = null }
  })

  const fail = (e: unknown) => setMsg({ text: (e as Error).message })
  const persistSort = (id: number, sort: number) => api.patchHabit(id, { sort }).catch((e) => { fail(e); load() })

  function move(id: number, to: number) {
    const cur = ref.current, from = cur.findIndex((h) => h.id === id)
    if (from < 0 || to < 0 || to >= cur.length || from === to) return false
    const next = cur.slice(); next.splice(to, 0, next.splice(from, 1)[0]); setList(next)
    return true
  }
  const onKey = (e: KeyboardEvent, id: number) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const to = ref.current.findIndex((h) => h.id === id) + (e.key === 'ArrowUp' ? -1 : 1)
    setRenaming(null)
    if (move(id, to)) { focusId.current = id; persistSort(id, to) }
  }
  const onMove = (e: PointerEvent) => {
    if (dragId === null || !ul.current) return
    const lis = [...ul.current.querySelectorAll<HTMLElement>('li[data-id]')]
    const over = lis.find((li) => Number(li.dataset.id) !== dragId && e.clientY > li.getBoundingClientRect().top && e.clientY < li.getBoundingClientRect().bottom)
    if (over) move(dragId, ref.current.findIndex((h) => h.id === Number(over.dataset.id)))
  }
  const endDrag = () => {
    if (dragId === null) return
    persistSort(dragId, ref.current.findIndex((h) => h.id === dragId)); setDragId(null)
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    if (ref.current.length >= MAX) return setMsg({ text: 'You have 12 habits. Archive one to add another.' })
    try { const r = await api.addHabit(n); setList([...ref.current, r.habit]); setName(''); setMsg(null) } catch (x) { fail(x) }
  }
  async function rename(e: React.FormEvent, h: Habit) {
    e.preventDefault()
    const n = draft.trim()
    if (!n) return
    try { const r = await api.patchHabit(h.id, { name: n }); setList(ref.current.map((x) => (x.id === h.id ? r.habit : x))); setRenaming(null); setMsg(null) } catch (x) { fail(x) }
  }
  async function archive(h: Habit) {
    const i = ref.current.findIndex((x) => x.id === h.id)
    try {
      await api.patchHabit(h.id, { archived: true })
      setMsg({
        text: `Archived "${h.name}".`,
        undo: async () => { try { await api.patchHabit(h.id, { archived: false }); await api.patchHabit(h.id, { sort: i }); setMsg(null); load() } catch (x) { fail(x) } },
      })
      load()
    } catch (x) { fail(x) }
  }
  async function restore(h: Habit) {
    if (ref.current.length >= MAX) return setMsg({ text: 'You have 12 habits. Archive one to restore another.' })
    try { await api.patchHabit(h.id, { archived: false }); setMsg(null); load() } catch (x) { fail(x) }
  }
  async function del(h: Habit) {
    try {
      await api.deleteHabit(h.id); setMsg({ text: `Deleted "${h.name}" permanently.` })
      // the row (or the whole Archived block, if it was the last) fades and folds shut; the rest follows it up
      const el = arch.length > 1 ? root.current?.querySelector<HTMLElement>(`.arch li[data-id="${h.id}"]`) : root.current?.querySelector<HTMLElement>('#arch-wrap')
      if (el && !calm()) {
        const px = el.offsetHeight + 'px'; el.style.overflow = 'hidden'
        await el.animate([{ opacity: 1, height: px, minHeight: px }, { opacity: 0, height: '0px', minHeight: '0px' }], { duration: 300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).finished.catch(() => {})
      }
      setAsking(null); await load()
    } catch (x) { fail(x) }
  }

  return (
    <section className="screen narrow" ref={root}>
      <div className="head"><div><h1>Habits</h1><p className="muted">Small things, done daily</p></div></div>
      <div className="glass stack">
        <h2>Your habits</h2>
        {err && <p role="alert">{err} <button className="btn text" type="button" onClick={load}>Try again</button></p>}
        {!list && !err && <p className="muted" role="status">Loading…</p>}
        {list && (
          <ul className="manage" ref={ul} onPointerMove={onMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
            {list.map((h) => renaming === h.id ? (
              <li key={h.id}>
                <form className="row" style={{ flex: 1 }} onSubmit={(e) => rename(e, h)} onKeyDown={(e) => { if (e.key === 'Escape') setRenaming(null) }}>
                  <input className="field" maxLength={60} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Habit name" autoFocus />
                  <button className="mini" type="submit" data-tip="Save name" aria-label="Save name"><Tick /></button>
                  <button className="mini" type="button" data-tip="Cancel" aria-label="Cancel rename" onClick={() => setRenaming(null)}><Cross /></button>
                </form>
              </li>
            ) : (
              <li key={h.id} data-id={h.id} className={dragId === h.id ? 'dragging' : undefined}>
                <button className="mini grip" type="button" data-grip={h.id} data-tip="Drag to reorder" aria-label={`Reorder ${h.name}. Drag, or press the up and down arrow keys.`}
                  onKeyDown={(e) => onKey(e, h.id)}
                  onPointerDown={(e) => { setRenaming(null); setDragId(h.id); e.currentTarget.setPointerCapture(e.pointerId) }}><Grip /></button>
                <span className="name">{h.name}</span>
                <button className="mini" type="button" data-tip="Rename" aria-label={`Rename ${h.name}`} onClick={() => { setDraft(h.name); setRenaming(h.id) }}><Pencil /></button>
                <button className="mini" type="button" data-tip="Archive" aria-label={`Archive ${h.name}`} onClick={() => archive(h)}><Archive /></button>
              </li>
            ))}
          </ul>
        )}
        {list && list.length === 0 && <p className="muted">Start with one small thing.</p>}
        <form className="add" onSubmit={add}>
          <input className="field" maxLength={60} placeholder="New habit" aria-label="New habit name" required value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn round" type="submit" data-tip="Add habit" aria-label="Add habit"><Plus /></button>
        </form>
        <p className="muted small" role="status" hidden={!msg}>{msg?.text}{msg?.undo && <> <button className="btn text" type="button" onClick={msg.undo}>Undo</button></>}</p>
        {arch.length > 0 && (
          <div id="arch-wrap">
            <h2 className="arch-h">Archived</h2>
            <p className="muted small">Hidden from Today. Their past check-ins stay in History and the CSV.</p>
            <ul className="manage arch">
              {arch.map((h) => asking === h.id ? (
                <li key={h.id} data-id={h.id}>
                  <span className="ask">Delete "{h.name}" and all its check-ins? This cannot be undone.</span>
                  <button className="mini danger" type="button" data-tip="Delete permanently" aria-label={`Confirm: delete ${h.name} permanently`} onClick={() => del(h)}><Tick /></button>
                  <button className="mini" type="button" data-tip="Cancel" aria-label="Cancel delete" onClick={() => setAsking(null)}><Cross /></button>
                </li>
              ) : (
                <li key={h.id} data-id={h.id}>
                  <span className="name">{h.name}</span>
                  <button className="mini" type="button" data-tip="Restore" aria-label={`Restore ${h.name}`} onClick={() => restore(h)}><Restore /></button>
                  <button className="mini danger" type="button" data-tip="Delete permanently" aria-label={`Delete ${h.name} permanently`} onClick={() => setAsking(h.id)}><Trash /></button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
