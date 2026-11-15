import { useEffect, useLayoutEffect, useRef, useState, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { BoldIcon, CollapseIcon, EmojiIcon, ExpandIcon, ItalicIcon } from '../icons'
import { format, parse, type Block, type Seg } from '../md'

const EMOJI = ['😊', '😌', '😔', '😤', '😴', '🙏', '❤️', '🔥', '☀️', '🌧️', '💪', '🎉', '✨', '🌱', '☕', '📖']
const MAX = 4000

// ---- markdown <-> DOM. Only createElement/textContent: user text never goes through innerHTML. ----
function segNode(g: Seg): Node {
  let n: Node = document.createTextNode(g.t)
  if (g.i) { const e = document.createElement('i'); e.append(n); n = e }
  if (g.b) { const e = document.createElement('b'); e.append(n); n = e }
  return n
}

function fill(el: HTMLElement, md: string) {
  el.replaceChildren()
  if (!md) return
  let list: HTMLElement | null = null
  for (const b of parse(md)) {
    if (b.k === 'p') {
      list = null
      const d = document.createElement('div')
      if (b.segs.length) d.append(...b.segs.map(segNode)); else d.append(document.createElement('br'))
      el.append(d)
      continue
    }
    if (!list || list.nodeName !== b.k.toUpperCase()) {
      list = document.createElement(b.k)
      if (b.n && b.n > 1) list.setAttribute('start', String(b.n))
      el.append(list)
    }
    const li = document.createElement('li')
    li.append(...b.segs.map(segNode))
    list.append(li)
  }
}

function segs(n: Node, f: { b?: boolean; i?: boolean }, out: Seg[]) {
  if (n.nodeType === 3) {
    const t = (n.textContent ?? '').replace(/[ \n]/g, ' ')
    if (t) out.push({ t, ...(f.b && { b: true }), ...(f.i && { i: true }) })
    return
  }
  if (!(n instanceof HTMLElement) || n.nodeName === 'BR') return
  const st = n.style
  const g = {
    b: f.b || n.nodeName === 'B' || n.nodeName === 'STRONG' || st.fontWeight === 'bold' || Number(st.fontWeight) >= 600,
    i: f.i || n.nodeName === 'I' || n.nodeName === 'EM' || st.fontStyle === 'italic',
  }
  n.childNodes.forEach((c) => segs(c, g, out))
}

const merge = (s: Seg[]) => s.reduce<Seg[]>((a, g) => {
  const l = a[a.length - 1]
  if (l && !l.b === !g.b && !l.i === !g.i) l.t += g.t; else a.push({ ...g })
  return a
}, [])

function read(root: HTMLElement): string {
  const out: Block[] = []
  let cur: Seg[] | null = null
  const flush = () => { if (cur) out.push({ k: 'p', segs: merge(cur) }); cur = null }
  const walk = (parent: Node) => parent.childNodes.forEach((n) => {
    if (n.nodeName === 'BR') { if (cur) flush(); else out.push({ k: 'p', segs: [] }); return }
    if (n.nodeName === 'UL' || n.nodeName === 'OL') {
      flush()
      const start = Number((n as HTMLElement).getAttribute('start')) || 1
      let idx = 0
      n.childNodes.forEach((li) => { const s: Seg[] = []; segs(li, {}, s); out.push({ k: n.nodeName === 'UL' ? 'ul' : 'ol', n: start + idx++, segs: merge(s) }) })
    } else if (n instanceof HTMLElement && (n.nodeName === 'DIV' || n.nodeName === 'P')) {
      flush()
      if (n.querySelector('ul,ol,div')) walk(n)
      else { const s: Seg[] = []; segs(n, {}, s); out.push({ k: 'p', segs: merge(s) }) }
    } else segs(n, {}, (cur ??= []))
  })
  walk(root)
  flush()
  return format(out)
}

const caretEnd = (el: HTMLElement) => {
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(false)
  const s = getSelection(); s?.removeAllRanges(); s?.addRange(r)
}
const edRect = () => { const w = Math.min(720, innerWidth - 32), h = Math.min(innerHeight * 0.7, 560); return { left: (innerWidth - w) / 2, top: (innerHeight - h) / 2, width: w, height: h } }
const px = (r: { left: number; top: number; width: number; height: number }) => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' })
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches

// Read-only rendering of stored markdown (day sheet).
export function Md({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { if (ref.current) fill(ref.current, text) }, [text])
  return <div className="md" ref={ref} />
}

type Props = { id: string; label: string; value: string; onChange: (v: string) => void; readOnly?: boolean; ph?: string; small?: boolean; rteRef?: Ref<HTMLDivElement> }

export function Editor({ id, label, value, onChange, readOnly, ph, small, rteRef }: Props) {
  const [open, setOpen] = useState(false)
  const [dim, setDim] = useState(false)
  const [emo, setEmo] = useState(false)
  const [fmt, setFmt] = useState({ b: false, i: false })
  const [rte, setRte] = useState<HTMLDivElement | null>(null)
  const ed = useRef<HTMLDivElement>(null)
  const spacer = useRef<HTMLDivElement>(null)
  const from = useRef<DOMRect | null>(null)
  const good = useRef(value)
  const [h, setH] = useState(0)

  // fill on mount (also after the portal move) and when the value changes from outside (reset, save)
  useLayoutEffect(() => {
    if (!rte) return
    if (read(rte) !== value) fill(rte, value)
    good.current = value
  }, [rte, value])

  const setRef = (el: HTMLDivElement | null) => {
    setRte(el)
    if (typeof rteRef === 'function') rteRef(el); else if (rteRef) (rteRef as { current: HTMLDivElement | null }).current = el
  }

  // grow into the centred panel (the node moves to <body> through a portal, so the glass card cannot trap position:fixed)
  useLayoutEffect(() => {
    if (!open || !ed.current) return
    const to = edRect(), f = from.current
    Object.assign(ed.current.style, px(to))
    if (f && !calm()) ed.current.animate([px(f), px(to)], { duration: 380, easing: 'cubic-bezier(.22,1,.36,1)' })
    requestAnimationFrame(() => setDim(true))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // the field node is new after moving to/from <body>: focus the new one
  const refocus = useRef(false)
  useLayoutEffect(() => { if (rte && refocus.current) { refocus.current = false; rte.focus(); caretEnd(rte) } }, [rte])

  function expand(on: boolean) {
    const el = ed.current
    if (!el || on === open) return
    if (on) { from.current = el.getBoundingClientRect(); setH(from.current.height); refocus.current = true; setOpen(true); return }
    setDim(false)
    const done = () => { refocus.current = true; setOpen(false) }
    const to = spacer.current?.getBoundingClientRect()
    if (!to || calm()) return done()
    el.animate([px(el.getBoundingClientRect()), px(to)], { duration: 380, easing: 'cubic-bezier(.22,1,.36,1)' }).onfinish = done
  }

  useEffect(() => {
    if (readOnly || !rte) return
    const sync = () => { if (document.activeElement === rte) setFmt({ b: document.queryCommandState('bold'), i: document.queryCommandState('italic') }) }
    // typing "- ", "* " or "1. " at the start of a line turns it into a list
    const before = (e: InputEvent) => {
      if (e.data !== ' ' || e.inputType !== 'insertText') return
      const sel = getSelection()
      if (!sel || !sel.isCollapsed || !sel.anchorNode || sel.anchorNode.parentElement?.closest('li')) return
      let b: Element | null = sel.anchorNode.nodeType === 1 ? (sel.anchorNode as Element) : sel.anchorNode.parentElement
      b = b?.closest('div') ?? rte
      if (!rte.contains(b)) b = rte
      const rg = document.createRange(); rg.selectNodeContents(b); rg.setEnd(sel.anchorNode, sel.anchorOffset)
      const m = rg.toString().match(/^(?:([-*•])|(\d{1,3})\.)$/)
      if (!m) return
      e.preventDefault(); sel.removeAllRanges(); sel.addRange(rg); document.execCommand('delete')
      document.execCommand(m[1] ? 'insertUnorderedList' : 'insertOrderedList')
      if (m[2] && +m[2] > 1) getSelection()?.anchorNode?.parentElement?.closest('ol')?.setAttribute('start', m[2])
    }
    // paste as plain text, so nothing foreign enters the journal
    const paste = (e: ClipboardEvent) => {
      e.preventDefault()
      const lines = (e.clipboardData?.getData('text/plain') ?? '').replace(/\r/g, '').split('\n')
      lines.forEach((l, i) => { if (i) document.execCommand('insertParagraph'); if (l) document.execCommand('insertText', false, l) })
    }
    document.addEventListener('selectionchange', sync)
    rte.addEventListener('beforeinput', before)
    rte.addEventListener('paste', paste)
    return () => { document.removeEventListener('selectionchange', sync); rte.removeEventListener('beforeinput', before); rte.removeEventListener('paste', paste) }
  }, [rte, readOnly])

  function input() {
    if (!rte) return
    const md = read(rte)
    if (md.length > MAX) { fill(rte, good.current); caretEnd(rte); return } // keep the 4,000-character limit
    if (!md) rte.replaceChildren() // lets the placeholder show
    good.current = md
    onChange(md)
  }

  const exec = (c: string) => { rte?.focus(); document.execCommand(c); input() }
  const tool = (k: string, text: string, icon: React.ReactNode, onClick: () => void, pressed?: boolean) => (
    <button className="tool" type="button" data-k={k} aria-label={text} data-tip={text} aria-pressed={pressed} aria-expanded={k === 'e' ? emo : undefined}
      onMouseDown={(e) => e.preventDefault()} onClick={onClick}>{icon}</button>
  )

  const body = (
    <div ref={ed} className={`ed${readOnly ? ' ro' : ''}${open ? ' open glass' : ''}`}
      onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); expand(false) } }}>
      <div className="ed-top">
        <span className="prompt" id={`q-${id}`}>{label}</span>
        {!readOnly && (
          <div className="ed-tools">
            <div className="ed-fmt">
              {tool('b', 'Bold', <BoldIcon />, () => exec('bold'), fmt.b)}
              {tool('i', 'Italic', <ItalicIcon />, () => exec('italic'), fmt.i)}
              {tool('e', 'Emoji', <EmojiIcon />, () => setEmo(!emo))}
            </div>
            {tool('x', open ? 'Collapse' : 'Expand', open ? <CollapseIcon /> : <ExpandIcon />, () => expand(!open))}
          </div>
        )}
      </div>
      {emo && (
        <div className="emo">
          {EMOJI.map((m) => <button key={m} type="button" aria-label={m} onMouseDown={(e) => e.preventDefault()} onClick={() => { rte?.focus(); document.execCommand('insertText', false, m); setEmo(false); input() }}>{m}</button>)}
        </div>
      )}
      <div ref={setRef} className="field rte" data-size={small ? 's' : undefined} data-ph={ph}
        contentEditable={!readOnly} suppressContentEditableWarning
        {...(readOnly ? {} : { role: 'textbox', 'aria-multiline': true, 'aria-labelledby': `q-${id}` })}
        onInput={input} />
    </div>
  )
  if (!open) return body
  return (
    <>
      <div className="ed-spacer" ref={spacer} style={{ height: h }} />
      {createPortal(<><div className={`ed-dim${dim ? ' on' : ''}`} onClick={() => expand(false)} />{body}</>, document.body)}
    </>
  )
}
