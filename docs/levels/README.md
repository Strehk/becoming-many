# Level Guide

The narrative levels in **Becoming Many** are continuous world states, not separate scenes. This guide keeps the implemented source preset separate from the planned narrative sequence.

## Current Source Preset

Nine sparse presets currently exist under `src/levels`:

- `white-world.level.ts` defines the narrative White World without Terrain.
- `scent.level.ts` is the Scent World base experiment: no rendered surface
  modules, the test overlay, the White World air layer, scent streamed from
  every plant of an invisible plant population, and the invisible ground flag
  that clamps flight above the shared world surface.
- `echo.level.ts` is the Echolocation level: rendered Terrain, Vegetation, and
  Rocks whose materials are decorated by the shared Echo Depth effect, showing
  the world through the level-03 distance ramp.
- `motion.level.ts` is the Motion Perception level: the carried Echo world
  plus persistent fly swarms whose movement prints fading motion trails
  through the Motion Sense module.
- `thermal.level.ts` is the Thermal Perception level: the carried Motion world
  plus warm animals and the radius-bounded false-color heat view of the
  Thermal Perception effect family.
- `magnetic.level.ts` is the Magnetic Field Perception level: the carried
  Thermal world plus directional ground field lines and the northern sky glow
  of the Magnetic Sense module.
- `connections.level.ts` is the Connections level: the carried Magnetic world
  plus the pulsing mycelium web of the Mycelium module blended over it.
- `test.level.ts` is the diagnostic development preset and adds Terrain plus the
  Zone Visualizer for landscape work.
- `designTest.level.ts` is the active visual-design preset and adds authored
  semantic colors to the landscape modules.

The White World, Scent, and Test presets use these presentation values:

- white background (`0xffffff`)
- point size `0.075`
- horizontal and vertical drift amplitudes of `0.12` and `0.24` metres

Their current capacity differs deliberately:

- White World uses a 128-metre view distance and 192 particles per volume.
- Scent uses a 128-metre view distance and 192 particles per volume.
- Test Level uses a 180-metre view distance and 80 particles per volume.
- Design Test uses a 180-metre view distance and 80 particles per volume.

The Test and Design Test presets additionally activate:

- generated Terrain with one continuous carved river
- deterministic water, meadow, forest, and shrub-slope zones
- one distinct diagnostic color for every zone
- zone-driven trees, bushes, and rocks
- Deer, Stag, Fox, and Rat with a four-actor visibility budget
- level-authored grass height and density for meadow and shrub-slope zones
- level-authored Vegetation and Rock instances per hectare for each land zone

Test uses the Zone Visualizer and Magnetic Sense for diagnostics. Design Test
uses authored semantic colors instead.

The Scent preset additionally activates:

- the unchanged White World air-particle layer as the neutral depth baseline
- the invisible ground: the continuous world terrain restricts flight without
  being rendered
- the invisible vegetation: the decided shared plant densities grow the
  population the scent radiates from, while no model loads and nothing draws
- scent from every plant in the streamed world, its family setting the
  signature color, the particle count, the emission volume in fractions of
  the plant's own height, and how far its scent lifts
- six plant families — conifer, deciduous, birch, bush, flowering bush, and
  dead wood — plus four animal species, ten signatures in all: plants on the
  cool half of the 02 palette, animals on the warm half
- one fixed streamed pool in one opaque draw call, sized for the densest
  chunk the vegetation grid can produce and recycled at chunk edges while
  traveling
- the shared turning wind: its direction swings 44 degrees either side of its
  mean and its strength gusts, both on one seamless 240-second loop, and each
  scent layer leans on it by its own authored reach
- per-particle drift phases and amplitudes, so a plant's scent churns instead
  of sliding as one block, and per-print bearings, so an animal's route frays
  open at its old end

The Echo preset additionally activates:

- generated Terrain with its plain material at full opacity
- zone-driven Vegetation and Rocks with base colors authored from the dark
  end of the 03 palette and Test Level densities
- the clipmap grass field, which grows from here down the whole narrative
  chain and takes the same sense effects as every other surface. The older
  `grass` module stays parked; its cost under Thermal Perception is still
  unmeasured, and so is the field that replaced it here
- the shared Echo Depth material effect: one camera-distance palette ramp
  from near-dark silhouettes into the warm off-white haze background,
  patched into the Terrain, Vegetation, and Rock materials without
  additional geometry, scene passes, or draw calls; every surface always
  shows only its depth-ramp color
- the unchanged White World air-particle layer and the unchanged Scent World
  layer carried over, because senses layer instead of swapping; the scent now
  radiates from the very trees and bushes the level draws, keeping its
  02-palette signatures against the grayscale depth ramp
- no animals

The Motion preset additionally activates:

- everything the Echo preset activates, carried over unchanged (background,
  depth ramp, air, and scent included), because senses layer instead of
  swapping
- twelve persistent fly swarms of sixty flies each on player-centred distance
  rings (5–65 metres), simulated as bounded buzzing boids that re-anchor
  after eighty metres of travel and never dip below their ground clearance
- three invisible bird flocks circling the traveler on 30–90-metre air
  rings, each bird three points (body plus two flapping wingtips) — only
  their traces are real
- one motion-trail ring buffer per actor class printing one particle per
  moving point per frame; printed particles fade and drift outward GPU-only
  over fourteen frames
- ink-dark specks and indigo fly trails from the level-04 dark palette
  stops, cyan bird traces from the reserved accent; three added draw calls
  in total
- no animals

The Thermal preset additionally activates:

- everything the Motion preset activates, carried over unchanged, because
  senses layer instead of swapping
- Animals with echo-palette fur colors so they sit inside the carried
  grayscale outside the thermal radius
- the shared Thermal Perception material-effect family: the six-stop
  false-color heat view inside a 30-metre viewer radius with a 10-metre
  feather, patched into the Terrain, Vegetation, Rock, and Animal materials

The Magnetic preset additionally activates:

- everything the Thermal preset activates, carried over unchanged, because
  senses layer instead of swapping
- the Magnetic Sense sky dome: one opaque camera-following draw carrying the
  whole sense — a sky graded from the carried haze at the horizon to a pale
  blue zenith, with a grainy, iridescent radical-pair shimmer condensing into
  a tight patch at the magnetic north point and a mirrored one at the
  southern counter-pole, ported from the previous version of the piece. The
  ground stays untouched; the carried thermal view and echo ramp keep it
  verbatim

The Connections preset additionally activates:

- everything the Magnetic preset activates, carried over unchanged, because
  senses layer instead of swapping
- the streamed root mat buried inside a 30-metre viewer radius, read
  through a ground that opens where no grass covers it: every edge a
  bundle of three fine meandering filaments with periodic knot junctions
  hallucinated in the fragment shader, plus node glows, connecting the
  deterministic positions of trees and bushes, forest clearings, and
  rocks to the module's own seeded soil points, colored per source class
  from the level-07 palette with amber pulses traveling the cords;
  exactly two added transparent draw calls from fixed pools
- the repository's first Web Worker, module-owned, computing the kNN plus
  minimum-spanning-tree topology off the frame path over the module's 7×7
  window of 32-metre chunks

The level does not contain asset URLs, model names, seeds, candidate spacing,
or weighted variants. Those stable content definitions belong to the concrete
modules and load only when their module is enabled.

The current runtime adds no fog, lights, audio, or state transition to this
level. Vegetation, Rocks, and Animals are development modules in Test Level;
they remain absent from White World.

## Planned Shared Rules

- The user keeps the same world position and flight state through narrative levels 01–07.
- The terrain and world coordinates remain continuous.
- Each level is a typed preset that changes base parameters and module configurations.
- Compatible states may overlap during transitions.
- Upcoming modules prefetch and load before they become visible.
- Finished modules deactivate, unload, and release all owned resources.
- The audio clock drives narrative cues; the operator controls entry into and exit from VR.
- Every level must pass its standalone PICO performance gate before integration.

## Moodboards and Palettes

These moodboards interpret this guide. If an image conflicts with a level description, the written level description is authoritative.

The images were created for this project with OpenAI Image Gen on 2026-08-21. Two watercolor sheets supplied by the project owner were used only as medium and layout references.

| Level | Moodboard | Palette |
|---|---|---|
| 00 — Test Level | Not added | `#F7EEE4` `#DFE4E5` `#BEC7CB` `#AEC8C5` `#354B63` `#F1B464` |
| 01 — White World | [View](01-white-world/mood/moodboard.png) | `#F8F2E8` `#F4F0ED` `#EAEAEA` `#E4DFE0` `#E3DCE0` `#E4E0DC` |
| 02 — Scent World | [View](02-scent-world/mood/moodboard.png) | `#F6EEE0` `#B8E0E1` `#9DD2C8` `#D1C1D7` `#FDA39D` `#FDBB54` |
| 03 — Echolocation | [View](03-echolocation/mood/moodboard.png) | `#0E1017` `#0D1730` `#3C4782` `#3FA7E2` `#CBD9E5` `#F6F0E9` |
| 04 — Motion Perception | [View](04-motion-perception/mood/moodboard.png) | `#212133` `#312758` `#45577A` `#10BEDB` `#E3DFDD` `#F3952D` |
| 05 — Thermal Perception | [View](05-thermal-perception/mood/moodboard.png) | `#2E1386` `#0C47D1` `#2EB4E8` `#D5198A` `#FB5F16` `#FCCE43` |
| 06 — Magnetic Field Perception | [View](06-magnetic-field-perception/mood/moodboard.png) | `#151935` `#1140A4` `#69BDE1` `#CDDBE2` `#A394C3` `#F9B33C` |
| 07 — Connections | [View](07-connections/mood/moodboard.png) | `#F2E3D3` `#683B5A` `#292E55` `#A5BDC3` `#D06780` `#E39E54` |

The hexes above record what each moodboard image contains. Where an authored
ramp departs from its moodboard, the level's own README carries the deviation
and the reason: level 02 leaves its pale stop `#F6EEE0` unused and runs on
white so the only colour in the world arrives through the scent itself, and
deepens its cool plant stops on their own hues because the moodboard values
read as dust against that white; and
level 05 darkens the coldest anchor `#2E1386` to `#0E0628` along its own hue,
so its thermal ramp has a black floor.

## Planned Level Specifications

## 00 — Test Level

### Intent

Teach the user how to fly with ICAROS before the narrative experience begins.

### Visual Direction

- A simple, calm training space with clear orientation and scale cues.
- Only elements needed to understand movement and control are visible.
- Feedback remains environmental and avoids a complex interface.

### Modules

- training environment
- flight input
- minimal orientation cues

### Transition

The operator enters the Test Level from passthrough and advances to White World when training is complete. Whether flight position and velocity carry into White World remains an open experience decision.

### Performance Direction

Keep this state minimal so input behavior and motion comfort can be assessed without unrelated rendering load.

### Open Art Decisions

- training tasks and completion criteria
- training environment and orientation cues
- transition behavior into White World
- final ICAROS input mapping

## 01 — White World

### Intent

Begin the narrative in an almost entirely white world. This first state establishes openness, atmosphere, and the sensation of air while offering almost no recognizable spatial structure.

### Visual Direction

- A bright, low-contrast world dominated by white and neutral tones.
- Terrain appears as soft silhouettes inside atmospheric depth.
- Fog hides the streaming boundary and reduces distant detail.
- Minimal air particles provide motion and depth cues.
- Vegetation remains absent or extremely restrained.

### Modules

- lighting
- fog
- minimal air particles
- terrain

### Transition

The operator advances from the Test Level. White World establishes the narrative baseline before the transition into Scent introduces color and floating scent signals without changing the flight path.

### Performance Direction

This is the baseline state. It should use the lowest practical geometry and shader cost while prewarming the first visible modules.

### Open Art Decisions

- exact white palette and contrast range
- fog model and visibility distance
- amount of visible terrain detail
- onboarding and transition duration

## 02 — Scent World

### Intent

Make scent spatially visible without revealing its sources. Distinct floating scent clouds form a coarse spatial map through color, motion, density, and particle behavior.

### Visual Direction

- Color enters the previously neutral world through scent signatures.
- Only scent points and diffuse scent clouds are visible.
- Plants, animals, terrain, and all other source objects remain invisible.
- Scent originates from the plants and animals themselves, and moves through the shared wind field.
- Source families use a coherent palette with clearly distinguishable signatures: plants take the cool half of the level palette, animals the warm half.

### Modules

- scent fields
- scent particles
- wind

### Transition

Scent fields load before their opacity rises. During the transition to Echolocation, scent particles fade and unload while world position remains stable.

### Performance Direction

Particles use fixed-capacity GPU buffers and as few draw calls as possible. Density is limited by transparent overdraw, not only by particle count.

### Open Art Decisions

- particle shape, scale, lifetime, and flow
- emission-volume refinement per plant family
- whether scent reacts to flight proximity

Decided: every plant and every animal emits, one signature per family rather
than per model, and animal scent is a trail that stays where the animal
walked. See [02-scent-world](02-scent-world/README.md).

## 03 — Echolocation

### Intent

Add clearly perceptible depth through distance-dependent visibility. The result of echolocation is shown directly; individual visible echo waves are explicitly excluded.

### Visual Direction

- The base world becomes dark or visually reduced.
- Terrain and vegetation emerge through depth-dependent visibility.
- Distance determines how terrain, vegetation, and objects are represented.
- Existing geometry changes appearance through shared materials and uniforms.
- Depth cues must remain comfortable during fast flight.

### Modules

- terrain
- required vegetation silhouettes
- depth perception

### Transition

Color and scent recede while depth response becomes dominant. Motion cues may begin during the exit so moving plants and animals lead naturally into the next state.

### Performance Direction

Prefer material changes over duplicate geometry or additional scene passes. A post-processing solution is allowed only if measurement proves it affordable on PICO.

### Decided Art Direction

Aerial-perspective depth mapping, decided 2026-08-25 and implemented in
`src/modules/echo-depth/`: near geometry reads as near-black silhouettes
and recedes into an off-white haze that equals the background color. The
ramp is currently authored grayscale (`#101010` to `#F7F7F7`), keeping the
moodboard palette's luminance steps below its two lightened far stops; the indigo moodboard tones remain the
documented reference. Every surface always shows only its depth-ramp
color; a cyan rim accent on near forms was tried and removed the same day
because approaching geometry must darken, not light up. See
[03 — Echolocation](03-echolocation/README.md) for the exact preset.

### Open Art Decisions

- ramp stop tuning and rim strength against real headset contrast
- whether a pale near-field air-particle layer should return as an
  optic-flow comfort cue

## 04 — Motion Perception

### Intent

Inspired by frogs and motion-sensitive insects, make movement the primary way the world becomes visible. Static elements largely disappear while moving forms remain as fleeting silhouettes.

### Visual Direction

- Moving animals and vegetation receive the strongest visibility.
- Static elements recede without removing spatial orientation completely.
- Moving forms appear as silhouettes, temporary contours, or afterimages.
- Shared wind motion connects grass, bushes, and trees.
- Animal movement remains sparse and readable.
- Visibility responds smoothly and avoids flicker at motion thresholds.

### Modules

- motion perception
- animals
- grass, bushes, and trees as required
- shared wind

### Transition

Depth-driven visibility yields to motion-driven visibility. Thermal values can appear first on moving animals before spreading to terrain and vegetation.

### Performance Direction

Motion must be derived from shared shader values or compact instance data. Avoid per-object frame updates and large active animal populations.

### Decided Art Direction

World motion alone controls visibility (decided 2026-08-27): the sense is
carried by moving actors rather than by dimming static modules or reacting
to user movement. Implemented in `src/modules/motion-sense/` as persistent
boid fly swarms and invisible circling bird flocks (procedural point birds,
decided 2026-08-28), each printing a motion-trail ring buffer; the world
itself carries the Echolocation grayscale unchanged. Flies and their trails
use the ink-dark bm-base contrast language authored from the level-04 dark
stops (`#212133`, `#312758`); bird traces use the cyan accent `#10BEDB`
reserved for them. See
[04 — Motion Perception](04-motion-perception/README.md) for the exact
preset.

### Open Art Decisions

- upgrading the point birds to bm-base's rigged wing-vertex sampling
  (wing-silhouette traces, flap-only intensity)
- how long motion remains visible (trail length and fade curve tuning)
- whether the fly trails adopt the cyan accent instead of ink-dark indigo
- whether static elements should additionally recede beyond the carried
  depth ramp
- balance between wind motion and animal motion once wind-driven vegetation
  or animals join the level

## 05 — Thermal Perception

### Intent

Inspired by snakes, reveal the world through temperature differences. Living and non-living structures become distinguishable, with warm animals appearing prominently like prey.

### Visual Direction

- A controlled false-color palette replaces normal surface color.
- Animals provide strong, localized heat signatures.
- Terrain carries broad cool and warm gradients.
- Vegetation receives stable temperature variation from world fields.
- Thermal boundaries blend continuously across the landscape.

### Modules

- thermal perception
- animals
- terrain
- required vegetation

### Transition

Thermal values first attach to moving forms, then become the dominant world representation. They later fade as large-scale directional magnetic patterns become visible.

### Performance Direction

Reuse existing geometry. Compute thermal color through shared uniforms, procedural fields, and compact instance attributes without an additional thermal camera or duplicate render pass.

### Decided Art Direction

The heat view is radius-bounded and static (decided 2026-08-28),
implemented in `src/modules/thermal-perception/`: the documented six-stop
palette maps cold to hot inside a 30-metre viewer radius that feathers
back into the carried echo grayscale. Temperature is expressive but
physically motivated — water coldest and colder with depth, dry ground
warmer with elevation, forest and slope holding extra warmth — sampled per
terrain vertex, hashed per vegetation and rock instance, and constant
near-hot on animals, which join the world here as the strongest
signatures. See [05 — Thermal Perception](05-thermal-perception/README.md)
for the exact preset.

### Open Art Decisions

- physical versus expressive temperature mapping tuning against real
  headset contrast
- radius and feather width against the dramaturgy
- temporal variation and heat trails

## 06 — Magnetic Field Perception

### Intent

Inspired by migratory birds, expose a stable field direction that exists independently of gaze and flight path. Magnetic lines run through the ground; a later sky element may reinforce the same direction.

### Visual Direction

- Transparent field lines remain anchored in the ground and follow the terrain.
- Narrow light pulses inside those lines make the field direction readable.
- The selected ground presentation remains visible between and below the lines.
- A later sky element may add a long-distance orientation cue.
- The representation stays coherent across long flights and floating-origin shifts.
- Earlier thermal color reduces so the magnetic signal remains legible.

### Modules

- magnetic sense
- terrain
- optional sky cue

### Transition

Thermal contrast fades while the ground field establishes global orientation. It recedes as local relationships and networks become visible in the final state.

### Performance Direction

Keep the sky analytical and opaque on its single dome draw; avoid line geometry, transparent overlays, physical lights, bloom, and extra render passes. Keep the expensive noise off the sky it cannot reach.

### Decided Art Direction

The field lives entirely in the sky (decided 2026-09-01, replacing the
blue ground lines decided 2026-08-31), implemented in
`src/modules/magnetic-sense/`: one opaque camera-following dome carrying
the previous version's radical-pair shimmer, ported and hardcoded. It
grades from the carried level haze at the horizon to a pale blue zenith,
and a grainy, iridescent pattern condenses into a tight patch at the
magnetic north point with a mirrored one at the southern counter-pole. The
ground carries no magnetic paint at all, so the carried thermal view and
echo ramp keep it verbatim; the guide's "thermal color reduces" cue waits
for the dramaturgy driver. See
[06 — Magnetic Field Perception](06-magnetic-field-perception/README.md)
for the exact preset.

### Open Art Decisions

- how the ported sky sits against the carried haze and the pale world of
  the earlier levels, against real headset contrast
- whether the southern counter-pole should stay visible at all
- when and how far the carried thermal intensity reduces once a dramaturgy
  driver exists
- relationship between flight direction and perceived orientation

## 07 — Connections

### Intent

Add no further biological sense. Instead, reveal relationships within the already perceived world so individual elements become parts of a larger connected system.

### Visual Direction

- Mycelium and root structures connect visible resources in the landscape.
- Connections emerge from the same deterministic world positions as their sources.
- Layer opacity may reveal structures below the terrain.
- Earlier perception languages may return selectively as a final synthesis.
- The network remains local and streamed rather than generating an unlimited global graph.

### Modules

- mycelium and roots
- world connections
- required terrain, vegetation, and animals
- selected earlier perception modules

### Transition

The magnetic field resolves into local relationships and network flow. At the end, modules fade and unload in a controlled sequence before the operator returns the presentation to passthrough.

### Performance Direction

Use bounded, pooled network geometry tied to the active world window. Generate topology outside the frame hot path and avoid one scene object per connection.

### Decided Art Direction

**A buried root system read through a ground that opens where nothing
grows on it (decided 2026-09-02).** This supersedes the 2026-08-31
decision that the web must not change the carried world, and it is the
third answer tried: an evenly translucent soil washed the whole surface
out, a dithered soil read as a pixel screen, and compositing the mat over
an untouched world let cords paint over tree trunks. What is kept splits
the difference the surface itself already makes.

The ground carries **two opacities**. Bare earth opens far enough to read
the mat through it. Ground the grass field covers stays nearly solid — a
lawn has to keep looking like a lawn — and the opaque blades standing on
it hide most of what is below, so the cords show only between them. That
weakened reading costs nothing; it falls out of the blades' own depth.
Which is which comes from the grass module's own coverage table, streamed
per terrain vertex, not from a second guess at its zones.

Implemented in `src/modules/mycelium/`:

- **Reach before density**, the rule the grass module recorded. A mat at
  the experiment's density cannot also span the horizon — the same
  density across the old 88-metre radius would be roughly 25,000 nodes
  against a per-chunk pool, on O(n²) topology — so the sense keeps a
  **30-metre radius** and fills it properly. It is a zone the visitor
  walks inside, not a web seen across the valley.
- **The module seeds its own soil mat.** The world's anchors are far too
  sparse for that density, so deterministic per-chunk soil points carry
  it, hashed per chunk exactly as grass hashes its cells. The standing
  world-element classes still participate — trees and bushes, the
  level-02 scent emitters, and rocks — and now hang just under their own
  objects, so a tree meets its roots. Animals are deliberately absent: a
  root system is what stands still and grows, and a body walking over it
  is not part of it. Soil is the lightest-weighted class of the four, so
  hubs stay on the world's real elements.
- **Bone, sinking to plum.** Real mycelium is white, and against
  thermal's cold half (`#0E0628` through `#1C6C8B`), echo's grey, and
  green grass it is the strongest contrast the palette has. Cord
  midpoints sink toward plum, which is the shading that makes a flat
  ribbon read as a round root going down. The pulses moved to amber:
  cream pulses on cream strands would be no pulses at all.
- **Growth is proximity, and growth means more roots.** Every cord and
  node carries a stable threshold and comes out once the density its own
  camera distance allows reaches it, so the mat fills in around whoever
  walks into it and thins to about a third of itself at the rim. The
  experiment's traffic-reinforcement simulation and its growth-over-time
  animation both remain out.
- **Built per chunk, so nothing reroutes underfoot.** A chunk's cords are
  a pure function of its own nodes and its eight neighbours', so a chunk
  built once is built the same way forever and crossing a boundary only
  adds ground at the rim. A second, wider gather window guarantees no
  chunk is ever built with a partial neighbourhood. New ground fades in
  over 0.6 seconds. This replaced a whole-window rebuild that recomputed
  every cord on every crossing, arrived late because the stream queue
  starved it behind Terrain, and popped.
- Unchanged: kNN plus minimum-spanning-tree topology in a module-owned
  Web Worker, cream light pulses traveling the cords (slowed to 1.5 m/s
  so the crossing still reads as a crawl at the smaller reach), edges
  inheriting their heavier hub's color, and the carried magnetic world at
  full intensity ("senses layer, never swap"). Earlier languages return
  by remaining present, and any reduction waits for the dramaturgy
  driver.

**The known cost:** the ground no longer hides the web behind a hill,
because the terrain's depth arrives after the web is drawn. Trees, rocks,
animals, and grass blades do still occlude it. Bare ground also blends
toward the carried background wherever no cord covers it, which is what
keeps `soilBareOpacity` from going lower. Unverified on the headset.

See [07 — Connections](07-connections/README.md) for the exact preset.

### Open Art Decisions

- web radius and fade band against real headset contrast and the
  transparent fill-rate measurement
- the two ground opacities against real headset contrast: how far bare
  soil can open before it reads as a hole rather than as earth, and how
  solid a lawn has to stay. With strand width, `growthFarFraction`, and
  the depth tint, these are the knobs to judge on device first
- strand width, depth-tint strength, and the rim density fraction against
  real headset contrast — tuned so far against the desktop preview only
- the dense mat's measured cost on the headset. The experiment ran at
  18 ms p95 on a desktop against this project's 11.11 ms budget at 90 Hz,
  so the node and edge pools are sized from argument, not measurement
- pulse density, speed, and glow widths
- the warm background shift toward the palette's cream
- final audio and offboarding transition

## Level Folders

Active art direction is stored beside each level:

```text
docs/levels/
├── README.md
├── 01-white-world/mood/moodboard.png
├── 02-scent-world/
│   ├── README.md
│   └── mood/moodboard.png
├── 03-echolocation/
│   ├── README.md
│   └── mood/moodboard.png
├── 04-motion-perception/
│   ├── README.md
│   └── mood/moodboard.png
├── 05-thermal-perception/
│   ├── README.md
│   └── mood/moodboard.png
├── 06-magnetic-field-perception/
│   ├── README.md
│   └── mood/moodboard.png
└── 07-connections/
    ├── README.md
    └── mood/moodboard.png
```

Each level `README.md` should contain:

- narrative intent and experience goal
- entry, exit, and timeline cues
- visual and audio direction
- exact typed preset and active modules
- asset and shader requirements
- performance budget and measured evidence
- decisions, risks, and open questions

Store mood images in the level's `mood/` folder. Record source, creator, license, and intended influence beside every external reference.
