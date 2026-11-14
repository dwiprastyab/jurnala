# design/

The approved visual design. These files win over the prose in [`../DESIGN.md`](../DESIGN.md) when they disagree.

| Path | What |
|---|---|
| `mockup.html` | Clickable front-end mockup (vanilla HTML, CSS and JS, one file). Classic theme, all component CSS, fake data. |
| `scenes/` | Four time-of-day SVGs (dawn, day, dusk, night), `day-city.svg`, `layout.css`, and a README with the usage rules. Default theme. |
| `mood/` | The five drawn mood faces. |
| `favicon/` | Icons. |

## Preview

```sh
cd design
python3 -m http.server 8912
# open http://localhost:8912/mockup.html
```

Serve it over HTTP; do not open the file directly, because the scenes load as `<img>` from relative paths.

- Sign in with any values. Nothing is sent anywhere.
- Settings switches the background (`Scenes` or `Classic`) and previews each time of day.
- Try it at phone width and at 700 px and wider; the History day sheet changes layout there.

## Rules

- Product copy is English.
- Scenes are loaded as `<img>`, never inlined. See `scenes/README.md`.
- The mockup is a reference, not production code. The real app is built in React (tasks B8–B9).
