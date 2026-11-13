# Start menu study

Three working loading screens and start menus for Becoming Many, so one
direction can be chosen before anything enters the application.

## Constraints

- No colour in the interface: black, white and greys only.
- Rubik is the only typeface (Heavitas is out; the project goes open source).
- The particles are not imitated. Every variant runs the real White World:
  `createAirParticlesModule` with the recipe from `src/levels/white-world.level.ts`,
  the real `createWhiteVeil`, the show's `StreamQueue` settings, on a renderer
  configured like the World Runtime. On desktop the squares are drawn 1.8 times
  their authored size so they stay visible on a large screen.

## What every variant does

- Loading shows a percentage and the sense being prepared, in the order the
  show introduces them: air, scent, echolocation, motion, thermal perception,
  magnetic field, connections.
- Particles carry the loading figure (a ring, one figure per sense, or a
  horizon). At 100 % every particle flies into the title "Becoming Many"; once
  they have landed, the set Rubik type takes over and they fade into it.
  Leaving the menu dissolves the title into the air; returning gathers it again.
- The visitor already glides at 40 % of the show's glide speed. The pointer, or
  the phone's tilt, bends the heading slightly with a small bank; it does not
  steer freely yet.
- Sound comes from the drone organ's composition (`src/sound/drone-organ`):
  the wind layer's band and gust as a bed, the sonar's call and echo room on
  hover, each control on its own degree of the pentatonic-minor scale on A and
  its own echo distance, and held tones in the organ's nine-second hall when
  choosing and entering. The graph starts on the first click or key, as the
  browser requires a gesture.
- Menu: Begin, Settings, Credits, with a hint line under the list. Begin leads
  to the choice of Desktop, VR headset or Phone. VR availability is detected
  through WebXR; the phone option requests motion-sensor permission. Entering
  fades the world to white like the show's handoff.
- Settings (language, volume, subtitles, graphics, invert look, reduce motion)
  are stored in `localStorage` and shared by all variants.

## Structure

| Path | Responsibility |
| --- | --- |
| `index.html` | Gallery of all variants. |
| `shared/air-world.js` | The real White World: renderer, camera, air module, veil, glide, steering. |
| `shared/title-swarm.js` | Particles that look like the air, flying into formations; glyph sampling. |
| `shared/formations.js` | Loading figures: ring, horizon, one figure per sense. |
| `shared/title-choreography.js` | Particles into the title and back, hand-over to the set type. |
| `shared/menu-sound.js` | Wind, sonar and hall from the drone organ's composition. |
| `shared/menu-flow.js` | Screens, loading and senses copy (DE/EN), settings, mode detection, keyboard, switcher. |
| `shared/input.js` | Smoothed look offset from mouse, touch or gyro. |
| `shared/variants.js` | Names and notes of the variants. |
| `shared/base.css`, `shared/screens.css` | Rubik, screen switching, the monochrome menu language. |
| `NN-name/` | One variant: its markup, layout and loading figure. |

Nothing in `src/` imports this folder; it only borrows `src/` modules.

## Running

The variants import TypeScript and GLSL from `src/`, so serve them with Vite:

```bash
bunx vite prototypes/start-menu --port 4377
```

Inside a variant, `[` and `]` switch variants, `R` restarts, `H` hides the
switcher and `Esc` goes back. `?skip` jumps past loading; `?bare` hides the
switcher. Motion-sensor access on phones requires HTTPS.
