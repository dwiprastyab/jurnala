import { FACES, MOODS, MOOD_TIPS } from '../mood'

export const MoodFace = ({ n }: { n: number }) => <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" dangerouslySetInnerHTML={{ __html: FACES[n - 1] }} />

// Static face drawings from src/mood.ts, never user input.
export function MoodPicker({ value, onPick, idp = 'tip' }: { value: number | null; onPick: (n: number) => void; idp?: string }) {
  return (
    <>
      <div className="scale">
        {MOODS.map((m, i) => (
          <div className="mw" key={m}>
            <button className="mood" type="button" aria-pressed={value === i + 1} aria-describedby={`${idp}${i}`} style={{ '--c': `var(--mood-${i + 1})` } as React.CSSProperties} onClick={() => onPick(i + 1)}>
              <MoodFace n={i + 1} />{m}
            </button>
            <span className="tip" role="tooltip" id={`${idp}${i}`}>{MOOD_TIPS[i]}</span>
          </div>
        ))}
      </div>
      <p className="muted small" id="mood-desc" role="status">{value ? `${MOODS[value - 1]}: ${MOOD_TIPS[value - 1]}` : ''}</p>
    </>
  )
}
