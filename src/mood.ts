export const MOODS = ['Rough', 'Low', 'Okay', 'Good', 'Great']
export const MOOD_TIPS = ['A heavy day. Most things felt hard.', 'A bit down or drained. Not your best day.', 'Neither good nor bad. A plain, steady day.', 'A good day. More ups than downs.', 'A really good day. You felt light, proud, or happy.']
// Same drawings as design/mood/*.svg, with the fill taken from --c so the colour tokens stay the single source.
const F = (inner: string) => `<circle cx="24" cy="24" r="22" fill="var(--c)"/><g stroke="#2A2440" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`
const EYES = '<circle cx="17" cy="21" r="1.6" fill="#2A2440" stroke="none"/><circle cx="31" cy="21" r="1.6" fill="#2A2440" stroke="none"/>'
export const FACES = [
  F(`<path d="M13 19l7-3M35 19l-7-3"/>${EYES}<path d="M17 34q7-7 14 0"/>`),
  F(`${EYES}<path d="M18 32q6-4 12 0"/>`),
  F(`${EYES}<path d="M18 31h12"/>`),
  F(`${EYES}<path d="M16 29q8 8 16 0"/>`),
  F('<path d="M13 22q4-6 8 0M27 22q4-6 8 0"/><path d="M15 28q9 12 18 0z" fill="#2A2440"/>'),
]
