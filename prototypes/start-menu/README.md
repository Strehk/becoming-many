# Start menu study

Ten working loading screens and start menus for Becoming Many, from conventional
to experimental, so one direction can be chosen before anything enters the
application. This folder is a standalone static design prototype: nothing in
`src/` imports it, and Vite's application build does not include it.

## What every variant does

- Simulated loading with stages, then "click to continue" (which also unlocks
  audio, as the experience itself needs a gesture).
- Menu: Begin, Settings, Credits.
- Begin leads to the choice of Desktop, VR headset or Phone. VR availability is
  detected through WebXR; the phone option requests motion-sensor permission and
  the particles then follow the device's tilt. The launch screen marks where the
  experience would start.
- Settings (language, volume, subtitles, graphics quality, invert look, reduce
  motion) are stored in `localStorage` and shared by all variants. Quality and
  motion change the particle count and speed; volume drives the interface sounds.
- Type is Rubik, the end-credits face. Colours come from the authored level
  recipes: Start / White World for the opening, Connections for the finale.

## Structure

| Path | Responsibility |
| --- | --- |
| `index.html` | Gallery of all variants. |
| `shared/menu-flow.js` | Screens, loading, settings, copy (DE/EN), mode detection, sounds, keyboard, switcher. |
| `shared/particles.js` | WebGL point and line renderer with the Start level's dust-grain shading, palette, helpers. |
| `shared/input.js` | Smoothed look offset from mouse, touch or gyro. |
| `shared/variants.js` | Names and notes of the ten variants. |
| `shared/base.css`, `shared/screens.css` | Rubik, screen switching, generated blocks, default secondary screens. |
| `NN-name/` | One variant: its markup, styling and particle behaviour. |

## Running

Serve the folder with any static server, for example:

```bash
bunx vite prototypes/start-menu --port 4377
```

Inside a variant, `[` and `]` switch variants, `R` restarts, `H` hides the
switcher and `Esc` goes back. `?skip` jumps past loading; `?bare` hides the
switcher. Motion-sensor access on phones requires HTTPS.
