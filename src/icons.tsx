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

const MEDALS: Record<number, string> = {
  7: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  14: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 .3 1.2 1 2 2 2-.5-3 0-6 1-8z"/>',
  30: '<circle cx="12" cy="9" r="5"/><path d="M8.5 13.5L7 21l5-3 5 3-1.5-7.5"/>',
  60: '<path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  100: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8M10 18h4"/>',
  180: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
}
export const Medal = ({ n }: { n: number }) => <Svg d={MEDALS[n]} />
export const BoldIcon = () => <Svg d='<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>' />
export const ItalicIcon = () => <Svg d='<path d="M19 4h-9M14 20H5M15 4 9 20"/>' />
export const EmojiIcon = () => <Svg d='<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9.5h.01M15 9.5h.01"/>' />
export const ExpandIcon = () => <Svg d='<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>' />
export const CollapseIcon = () => <Svg d='<path d="M20 4l-6 6M14 10h6M14 10V4M4 20l6-6M10 14H4M10 14v6"/>' />
