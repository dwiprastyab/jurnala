import { useEffect, useRef, useState } from 'react'
import { api, type Entry } from '../api'
import { Cross, Pencil, Tick } from '../icons'
import { MoodPicker } from './Mood'
import { Editor } from './Rich'

type Texts = { went_well: string; was_hard: string; tomorrow: string }
const PROMPTS: [keyof Texts, string, string, boolean?][] = [
  ['went_well', 'What went well today?', 'A few words are enough.'],
  ['was_hard', 'What was hard today?', 'Write it down, then let it go.'],
  ['tomorrow', "What's one thing for tomorrow?", 'Keep it small.', true],
]
const toTexts = (e: Entry | null): Texts => ({ went_well: e?.went_well ?? '', was_hard: e?.was_hard ?? '', tomorrow: e?.tomorrow ?? '' })

type Props = { day: string; entry: Entry | null; title?: string; said?: string | null; onSaved: (e: Entry) => void; bare?: boolean }

// One component for Today and for the day sheet in History. Parent passes key={day} so state resets per day.
export function Reflection({ day, entry, title = "Today's reflection", said, onSaved, bare }: Props) {
  const [mode, setMode] = useState<'read' | 'edit'>(entry ? 'read' : 'edit')
  const [mood, setMood] = useState<number | null>(entry?.mood ?? null)
  const [t, setT] = useState<Texts>(toTexts(entry))
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const first = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const focus = useRef<'first' | 'btn' | null>(null)
  const saved = entry !== null

  useEffect(() => {
    if (focus.current === 'first') first.current?.focus()
    if (focus.current === 'btn') btn.current?.focus()
    focus.current = null
  }, [mode])

  const dirty = mood !== (entry?.mood ?? null) || PROMPTS.some(([k]) => t[k] !== toTexts(entry)[k])
  const reset = () => { setMood(entry?.mood ?? null); setT(toTexts(entry)); setMsg(''); setAsking(false); focus.current = 'btn'; setMode('read') }
  const cancel = () => (dirty ? setAsking(true) : reset())

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'read') { focus.current = 'first'; setMode('edit'); setMsg(''); return }
    if (busy) return
    if (mood === null && !PROMPTS.some(([k]) => t[k].trim())) { setMsg('Add at least one answer.'); return }
    setBusy(true); setMsg('')
    try {
      const r = await api.saveEntry(day, { mood, ...t })
      onSaved(r.entry)
      setT(toTexts(r.entry)); setMood(r.entry.mood)
      focus.current = 'btn'; setMode('read'); setMsg('Saved.')
    } catch (err) { setMsg((err as Error).message) } finally { setBusy(false) }
  }

  const read = mode === 'read'
  const label = read ? 'Edit reflection' : saved ? 'Save changes' : 'Save reflection'
  return (
    <form className={bare ? 'stack' : 'glass stack'} id="reflection" data-mode={mode} onSubmit={submit} onKeyDown={(e) => { if (e.key === 'Escape' && saved && !read) { e.stopPropagation(); e.preventDefault(); cancel() } }} noValidate>
      <h2>{title}</h2>
      {said && <div className="said"><p className="muted small">Yesterday you said</p><p className="prompt">{said}</p></div>}
      <div className="rbody">
        {!(read && mood === null) && ( // read mode shows only what was filled in
          <fieldset className="moods" disabled={read}>
            <legend className="prompt">How did today feel?</legend>
            <MoodPicker value={mood} onPick={setMood} />
          </fieldset>
        )}
        {PROMPTS.map(([k, q, ph, small], i) => (read && !t[k] ? null : (
          <Editor key={k} id={k} label={q} value={t[k]} onChange={(v) => setT((o) => ({ ...o, [k]: v }))} readOnly={read} ph={read ? '' : ph} small={small} rteRef={i === 0 ? first : undefined} />
        )))}
      </div>
      {asking && (
        <div className="row" role="alertdialog" aria-label="Discard changes?">
          <p className="prompt">Discard changes?</p>
          <button className="btn" type="button" onClick={reset}>Discard</button>
          <button className="btn quiet" type="button" onClick={() => { setAsking(false); first.current?.focus() }}>Keep editing</button>
        </div>
      )}
      <div className="row">
        <button className="btn ib" ref={btn} type="submit" data-tip={label} aria-label={label} disabled={busy}>{read ? <Pencil /> : <Tick />}</button>
        {!read && saved && <button className="btn quiet ib" type="button" data-tip="Cancel changes" aria-label="Cancel changes" onClick={cancel}><Cross /></button>}
        <p className="muted" id="saved" role="status">{msg}</p>
      </div>
    </form>
  )
}
