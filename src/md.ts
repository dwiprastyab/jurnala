// Journal text is stored as limited markdown, never HTML: **bold**, *italic*, "- " bullets, "1. " numbers, one line per "\n".
// "\" escapes "\" and "*" (and a leading "- " or "1. " that is plain text). Everything else is literal text.
export type Seg = { t: string; b?: boolean; i?: boolean }
export type Block = { k: 'p' | 'ul' | 'ol'; n?: number; segs: Seg[] }

const LIST = /^(?:[-*•] |(\d{1,3})\. )/

function inline(s: string): Seg[] {
  const out: Seg[] = []
  let b = false, i = false, t = ''
  const push = () => { if (t) out.push({ t, ...(b && { b }), ...(i && { i }) }); t = '' }
  for (let p = 0; p < s.length; p++) {
    const c = s[p]
    if (c === '\\' && p + 1 < s.length) t += s[++p]
    else if (c === '*' && s[p + 1] === '*') { push(); b = !b; p++ }
    else if (c === '*') { push(); i = !i }
    else t += c
  }
  push()
  return out
}

export function parse(md: string): Block[] {
  return (md || '').split('\n').map((line) => {
    const m = line.match(LIST)
    if (!m) return { k: 'p', segs: inline(line) }
    return { k: m[1] ? 'ol' : 'ul', ...(m[1] && { n: Number(m[1]) }), segs: inline(line.slice(m[0].length)) }
  })
}

function text(segs: Seg[]): string {
  let b = false, i = false, s = ''
  for (const g of segs) {
    if (!g.t) continue
    if (!!g.b !== b) { s += '**'; b = !!g.b }
    if (!!g.i !== i) { s += '*'; i = !!g.i }
    s += g.t.replace(/[\\*]/g, '\\$&')
  }
  return s + (b ? '**' : '') + (i ? '*' : '')
}

export function format(blocks: Block[]): string {
  let num = 0
  const lines = blocks.map((x) => {
    let s = text(x.segs)
    if (x.k === 'ul') { num = 0; return `- ${s}` }
    if (x.k === 'ol') { num = num ? num + 1 : x.n ?? 1; return `${num}. ${s}` }
    num = 0
    if (/^(-|•) /.test(s) || /^\* /.test(s)) s = '\\' + s
    else s = s.replace(/^(\d{1,3})\. /, '$1\\. ')
    return s
  })
  while (lines.length && !lines[lines.length - 1]) lines.pop()
  return lines.join('\n')
}
