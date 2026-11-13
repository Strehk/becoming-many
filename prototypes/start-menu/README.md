# Start menu study

Six working loading screens and start menus for Becoming Many, so one
direction can be chosen before anything enters the application. Three follow
the earlier beta menu (E-Mus/becoming-many-beta, `src/experience/start-menu.ts`
and `menu-theme.ts`), three try something new.

## Constraints

- No colour in the interface: black, white and greys only.
- Rubik, the end-credits face, is the only typeface.
- The particles are not imitated. Every variant runs the real White World:
  `createAirParticlesModule` with the recipe from `src/levels/white-world.level.ts`,
  the real `createWhiteVeil`, the show's `StreamQueue` settings, glide speed and
  veil timing, on a renderer configured like the World Runtime.

## What every variant does

- Simulated loading with stages, then a continue gesture (which also unlocks
  audio, as the experience itself needs a gesture).
- Menu: Begin, Settings, Credits, with the beta's hint line under the list.
- Begin leads to the choice of Desktop, VR headset or Phone. VR availability is
  detected through WebXR; the phone option requests motion-sensor permission and
  the view then follows the device's tilt. Entering fades the world to white like
  the show's handoff; the launch screen marks where the experience would start.
- Settings (language, volume, subtitles, graphics, invert look, reduce motion)
  are stored in `localStorage` and shared by all variants. Graphics changes the
  render resolution, reduce motion slows drift and glide, volume drives the
  interface sounds.

## Structure

| Path | Responsibility |
| --- | --- |
| `index.html` | Gallery of all variants. |
| `shared/air-world.js` | The real White World: renderer, camera, air module, veil, glide, look. |
| `shared/menu-flow.js` | Screens, loading, settings, copy (DE/EN), mode detection, sounds, keyboard, switcher. |
| `shared/input.js` | Smoothed look offset from mouse, touch or gyro. |
| `shared/variants.js` | Names and notes of the variants. |
| `shared/base.css`, `shared/screens.css` | Rubik, screen switching, the beta's monochrome menu language. |
| `NN-name/` | One variant: its markup, styling and choreography. |

Nothing in `src/` imports this folder; it only borrows `src/` modules.

## Running

The variants import TypeScript and GLSL from `src/`, so serve them with Vite:

```bash
bunx vite prototypes/start-menu --port 4377
```

Inside a variant, `[` and `]` switch variants, `R` restarts, `H` hides the
switcher and `Esc` goes back. `?skip` jumps past loading; `?bare` hides the
switcher. Motion-sensor access on phones requires HTTPS.
