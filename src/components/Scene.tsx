import { useMemo } from 'react'

// Night sky: 220 stars from a seeded generator, so the pattern is the same on every load. Two layers twinkle out of step.
function stars() {
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const layers: string[][] = [[], []]
  for (let n = 0; n < 220; n++)
    layers[n % 2].push(`${(rnd() * 100).toFixed(1)}vw ${(rnd() * 100).toFixed(1)}vh 0 ${rnd() < 0.18 ? '.6px' : '0'} rgb(255 255 255 / ${(0.35 + rnd() * 0.65).toFixed(2)})`)
  return layers.map((l) => l.join(','))
}

export function Scene() {
  const s = useMemo(stars, [])
  return (
    <>
      <div className="bgwrap" aria-hidden="true">
        {(['dawn', 'day', 'dusk', 'night'] as const).map((p) => (
          <div key={p} className={`layer s-${p}`}><img src={`/scenes/${p}.svg`} alt="" /></div>
        ))}
        <div className="scrim" />
      </div>
      <div className="sky" aria-hidden="true">
        <div className="stars"><i style={{ boxShadow: s[0] }} /><i style={{ boxShadow: s[1] }} /></div>
        <div className="orb" /><div className="blob" />
      </div>
    </>
  )
}
