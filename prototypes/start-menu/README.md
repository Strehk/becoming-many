# Start menu study

Ten working loading screens and start menus for Becoming Many, so one
direction can be chosen before anything enters the application. 01-03 draw
their figures with particles of their own; 04-10 borrow the White World's own
air particles for everything. 07-10 are the latest round.

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
  the wind layer's band and gust as a bed, a dry sonar call with one close
  return on hover, each control on its own degree of the pentatonic-minor scale on A and
  its own echo distance, and held tones in the organ's nine-second hall when
  choosing and entering. The graph starts on the first click or key, as the
  browser requires a gesture.
- Menu: Begin, Settings, Credits, with a hint line under the list. Begin leads
  to the choice of Desktop, VR headset or Phone. VR availability is detected
  through WebXR; the phone option requests motion-sensor permission. Entering
  fades the world to white like the show's handoff.
- Settings (language, volume, subtitles, graphics, invert look, reduce motion)
  are stored in `localStorage` and shared by all variants.

## The air variants (04-06)

They follow the rules of the arrow tutorial (E-Mus/becoming-many-tutorial):
a sign is not drawn in front of the world, it is a passing order inside it.

- Every figure, the title and the pointer are made of the very particles that
  give the white its depth. A particle is hidden in the Air Particles cloud and
  drawn, at the identical spot and size, in a stand-in cloud that can move; it
  flies into the figure and later flies back home, where it is handed back.
  Particles are never spawned, faded or coloured differently.
- Figures recruit nearest first and leave most of the dust on screen in place,
  so the air visibly thins where a figure forms but keeps its depth. Like the
  escort arrow, figures travel with the visitor in front of the eye.
- The title writes itself from left to right. Each particle, once landed,
  swells into ink until the dots merge into the exact Rubik glyphs; then the
  set type takes over without a fade. The title keeps the air's colour, and its
  particles stay borrowed while it stands. Leaving the menu bursts the type at
  once into its particles, which are thrown outward and fly home.
- The assembling has its own sound: grains landing from left to right as the
  particles do, a breath of air drawing together under them, and root and
  fifth settling in the organ's hall when the type stands. Like all sound it
  needs a first click or key; a click during loading is enough.
- Loading never runs faster than 0-100 % in 2.6 s, and a sense stays named at
  least 2.2 s without holding the percentage back, so a quick load names fewer
  senses instead of flashing. Try `?load=1` to simulate a fast connection.
- Pointer: 04 is a swarm that catches particles from the space it sweeps and
  sheds them at rest; 05 is a ring of air with the dust parting around it, and
  a click sends a sonar pulse through it; 06 draws a trace rooted in the space
  and underlines the hovered entry with air. On phones these appear while a
  finger touches.

## The wafting variants (07-09)

Built on 04 after feedback: the loading figure never builds and shows no
percentage. The air gathers within half a second into a figure that keeps
moving like a loading sign (a spinner of dust, a murmuration, a figure eight)
for as long as loading takes, so a load of one second reads as well as one of
twenty; loading is paced to at least 3.4 s. One line under it says what
reality is still putting together ("Bäume werden gepflanzt …"). The pointer is
a normal pointer; a click flings a few particles out of its tip in
every direction, with a sound to match: a short breath of air opening
outward and a scatter of tiny grains flying off to either side. They are
borrowed from air out of sight, so nothing appears
from nowhere, and they fly home out of sight again. The centred menu has no
walking marker: a hovered entry only darkens. The way in (Desktop, VR
headset, Phone) stands as three equal columns, each with its icon, name and
status underneath, stacked on phones. Under the title stands the latest
GitHub release, linked to its notes, instead of a subtitle. The menu carries
four times the White World's air density on desktop (2.2 on phones) so the
middle distance is never empty; this applies to every variant.

The credits (all variants) stand in three columns, each with a small label:
the people, with their websites and GitHub profiles; the cooperation with the
Futurium and HTW Berlin; and the open-source repository. In 07-09 they stand
under the menu's own title, which stays in place for them.

## The spinner (10)

Same menu, pointer and credits as 07-09, but loading shows a plain ring
without particles and one line under it. The particles appear only when
loading completes, gathering out of the air into the title.

## Particle spinners (11-13)

Like 10, but the spinner itself, a little larger, is made of a hundred or
so borrowed air particles: the plain ring's breathing arc (11), a ring of ten clusters whose
lit one swells and leans toward the eye (12), or three small rings turning in
tilted planes (13). When loading completes, the air sets off from outside
while the spinner keeps turning; the spinner opens late, spreads over the
whole word and lands together with the air.

## Test switches

The variant bar (bottom right; `H` hides it) has two switches, remembered
across variants: the simulated load time (normal, or 0.5 to 16 s; loading is
still paced so it never takes less than about 3.4 s) and the credits layout:
columns, a single-column roll, a colophon with labels on the left, or one
sentence. `?load=<seconds>` in the address does the same for one page.

## Structure

| Path | Responsibility |
| --- | --- |
| `index.html` | Gallery of all variants. |
| `shared/air-world.js` | The real White World: renderer, camera, air module, veil, glide, steering. |
| `shared/title-swarm.js` | Particles that look like the air, flying into formations; glyph sampling. |
| `shared/formations.js` | Loading figures: ring, horizon, one figure per sense. |
| `shared/title-choreography.js` | Particles into the title and back, hand-over to the set type. |
| `shared/air-borrow.js` | Borrowing air particles: stand-ins, flights, giving them back. |
| `shared/air-figure.js` | A figure of borrowed air: recruit, reshape, hand over, release. |
| `shared/air-title.js`, `shared/air-ink.js` | Air into the title and the ink morph into the set type. |
| `shared/air-cursor.js` | Swarm, wake and trail pointers made of air (04-06). |
| `shared/air-burst.js` | A click flings particles out of the pointer (07-09). |
| `shared/version.js` | The latest GitHub release under the title (07-09). |
| `shared/air-loaders.js` | Wafting loading figures: circling, flock, endless (07-09). |
| `shared/air-variant.js` | Wiring shared by 04-09. |
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
switcher; `?load=<seconds>` sets the simulated load time. Motion-sensor access on phones requires HTTPS.
