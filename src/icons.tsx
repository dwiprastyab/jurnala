// Static SVG path strings from design/mockup.html; never built from user input.
const Svg = ({ d, size = 20, sw = 1.8 }: { d: string; size?: number; sw?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: d }} />
)
const dots = [[9, 6], [15, 6], [9, 12], [15, 12], [9, 18], [15, 18]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1" fill="currentColor"/>`).join('')
export const Grip = () => <Svg d={dots} />
export const Pencil = () => <Svg d='<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>' />
export const Restore = () => <Svg d='<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>' />
export const Trash = () => <Svg d='<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>' />
export const Archive = () => <Svg d='<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11h14V8M10 12h4"/>' />
export const Tick = () => <Svg d='<path d="M5 12.5l4.5 4.5L19 7.5"/>' />
export const Cross = () => <Svg d='<path d="M6 6l12 12M18 6L6 18"/>' />
export const Plus = () => <Svg d='<path d="M12 5v14M5 12h14"/>' />
export const Back = () => <Svg d='<path d="M15 6l-6 6 6 6"/>' />
export const Eye = () => <Svg d='<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>' />
export const Gear = () => <Svg d='<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>' />
export const Chevron = ({ d, size = 18 }: { d: string; size?: number }) => <Svg d={`<path d="${d}"/>`} size={size} sw={2} />
export const Check = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2A2440" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path pathLength={1} d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)
