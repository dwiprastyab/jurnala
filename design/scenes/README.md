# Scenes

Four vector backgrounds, one per time of day. Exported from the approved Claude Design board (v7). Each file is a standalone SVG (viewBox 800×400, about 23–64 KB) with its own CSS animations and `prefers-reduced-motion` rule inside.

| File | Phase | Hours | Subject |
|---|---|---|---|
| `dawn.svg` | dawn | 05–09 | Sun rising behind layered mountains and mist |
| `day.svg` | day | 09–16 | Park with a lake, ducks and ducklings, a motorboat angler (48 s loop), water lilies, trees, natural grass to the bottom edge, drifting clouds, lilac/periwinkle palette (original city kept as `day-city.svg`) |
| `dusk.svg` | dusk | 16–19 | Sun setting over the sea, glittering reflection |
| `night.svg` | night | 19–05 | Milky Way over a hill, city glowing in the valley |

## How to use

- Load them as `<img>`, never inline: CSS animations still run in an `<img>`, and the page stays small. Put them in `public/scenes/` so Static Assets serves them.
- Anchor: `object-fit: cover; object-position: 100% 50%` for dawn, day and dusk (the sun and sky details sit on the right); `50% 50%` for night.
- Size: the scene is a 460px-tall band pinned to the top of the viewport, with a bottom mask fade (`mask-image: linear-gradient(#000 80%, transparent)`). Colour behind the band: dawn `#7E6AAE`, day `#2E3B5E`, dusk `#3C2B57`, night `#05060F`.
- Only the active phase's `<img>` is visible. The others stay mounted with `visibility: hidden` so the 1.2 s cross-fade works. A hidden image keeps animating in some browsers; remove the inactive `<img>` from the DOM after the fade if CPU matters.
- `day.svg` was hand-built (generator is not kept); the others come from the design board. If a scene changes, change it in the design board and re-export.
- The files have no photographic content, so there is no licence to track.

See `layout.css` for the layer, scroll and glass rules the approved board uses.
