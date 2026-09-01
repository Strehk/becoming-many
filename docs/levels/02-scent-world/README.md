<!--
Purpose: Document the Scent World level (02) as designed and as built.
Context: Scent is the first sense level after the White World baseline.
Responsibility: Keep narrative intent, the exact preset, and open decisions in one place.
Boundary: The Level Guide owns the cross-level sequence; modules own their implementations.
-->

# 02 — Scent World

## Narrative Intent and Experience Goal

Make scent spatially visible without revealing its sources. Distinct floating
scent clouds form a coarse spatial map through color, motion, density, and
particle behavior. Color enters the previously neutral world through scent
signatures; plants, animals, terrain, and all other source objects remain
invisible.

## Entry, Exit, and Timeline Cues

- Enters from the color-less White World baseline; the world position and
  flight state continue unchanged.
- Exits toward Echolocation: scent particles fade and unload while world
  position remains stable.
- The timeline driver (audio clock / schedule) is unresolved — see
  `docs/direction/open-decisions.md` §2. Until then the sense intensity is
  authored statically in the preset.

## Visual and Audio Direction

Palette (see [moodboard](mood/moodboard.png)):
`#F6EEE0` `#B8E0E1` `#9DD2C8` `#D1C1D7` `#FDA39D` `#FDBB54`

The background departs from that first stop. The moodboard reserves the pale
`#F6EEE0` for it and the level ran on it; it runs on white now. The Scent
World is entered from the colour-less White World, which is white, and the
level's whole premise is that colour arrives through the scent signatures
alone — a warm base tone is itself a colour, and it quietly spent the one
thing the level had to give. Every signature also reads a little harder
against white. The moodboard stop is therefore recorded and unused.

Scent reads as opaque, round, softly fading points that rise and sway above
their invisible sources. Each source family keeps one clearly distinguishable
signature color. No audio counterpart exists yet.

Ten signatures carry the world, and the split runs along one line before any
species reads: the rooted plants take the cool half of the palette, the
moving bodies the warm half.

Two stops are the moodboard verbatim, both warm: `#FDBB54` for the deer and
`#FDA39D` for the fox. `#EF8F3C` and `#D8919C` are those two carried down
for the heavier and the smaller animal.

The six plant signatures have left the moodboard. They were first authored
on its cool stops — `#9DD2C8`, `#B8E0E1`, `#D1C1D7` and three tones carried
along their hues — and against the warm background of the time they held.
Against white they read as dust rather than as scent, so each was deepened
on its own hue: saturation up by half, lightness down a fifth. `#55D1BA`
conifer, `#6ADADD` deciduous, `#B185C2` birch, `#50BE81` undergrowth,
`#A865C7` blossom, `#B2A17F` dead wood. The direction the moodboard set —
cool, related, one signature per family — survives; its exact values do
not, and the moodboard stops for the plants are recorded and unused.

## Exact Typed Preset and Active Modules

- Preset: `src/levels/scent.level.ts` (base experiment, `testUi: true`,
  no rendered surface modules).
- Fields: `scentParticles: ScentParticlesParameters`, the unchanged White
  World `airParticles` values, `invisibleGround: true`, and
  `invisibleVegetation` on `LevelPreset`.
- The invisible ground clamps flight one metre above the continuous shared
  world surface and now also hides what stands behind it. It is streamed as a
  depth-only occluder: the surface writes depth and no color, so "terrain
  remains invisible" holds exactly while a ridge stops showing the far side
  of itself through itself. Without it the scent read as one horizontal smear
  out to the far plane rather than as a map of anything. The occluder is
  coarse — 8 segments per side against the 32 a drawn surface uses — because
  it only has to carry ridges and valley edges; a fine ripple may let a
  single particle show through where a drawn surface would have hidden it.
- The invisible vegetation does the same for the plants: the decided shared
  densities grow the population the scent radiates from, while no model is
  loaded and nothing is drawn. Scent is bound to those plants, so the level
  keeps its intent — the sources stay invisible — without the scent floating
  free of anything.
- Active modules: Scent Particles (`src/modules/scent-particles/`) and Air
  Particles (the level 01 layer carried over as the neutral depth baseline),
  plus the test overlay. Every plant in the streamed world emits: its family
  sets the color, the particle count, the emission volume in fractions of the
  plant's own height, and how far its scent lifts. Level 02 carries no
  animals, so the trail layer is authored but not allocated here; it first
  runs in level 05.

## Asset and Shader Requirements

- No external assets.
- Three module-owned GLSL ES 3.00 files:
  `scent-particle-motion.vert.glsl` (rise, sway, life-cycle fade, intensity),
  `scent-trail-motion.vert.glsl` (print ageing, widening drift, fade), and
  `scent-particle-circle.frag.glsl` (circular point clipping).

## Performance Budget and Measured Evidence

- One fixed streamed plant pool. Its capacity is the worst case the source
  can produce: the vegetation candidate grid is 8 metres, so a 64-metre chunk
  holds at most 64 plants, and 49 resident chunk slots × 64 plants × the
  largest authored particle count size the buffers. At the current dense
  trial values (70 particles for the largest family) that is 219,520 points
  in one opaque draw call — against 17,640 for the four-cloud layer this
  replaced.
- The dense values are a trial, and they are measurably expensive. Every
  family carries a moderate alternative beside it in `shared-level-values.ts`,
  and `particlesPerPlant` is the one lever that changes the cost.
- Measured with `bun run benchmark --profile quick` on one machine under
  SwiftShader software rendering, so the numbers compare runs against each
  other and say nothing about a headset. Median frame time of the isolated
  Scent Level: **5.90 ms** for the four-cloud layer this replaced, **7.20 ms**
  at the moderate values, **14.10 ms** at 40 particles for the largest
  family, and **14.80 ms** at the 70 authored now. On the Connections level,
  where scent is one layer among many, the moderate values are inside the
  run-to-run noise (94.00 ms before, 93.00 ms) and both dense settings cost
  about three per cent (96.60 ms and 96.40 ms).
- The cost is therefore not linear in the particle count. Going from 17,640
  points to 125,440 cost eight milliseconds; going on to 219,520 cost less
  than one. Whatever the first jump paid for, it was not the points, so
  `particlesPerPlant` is a cheaper lever than its arithmetic suggests — and
  the reason the first jump was expensive is worth finding before the
  headset measurement.
- The dense values are therefore authored against the performance rule in
  AGENTS.md, deliberately and on request, to be looked at before they are
  decided. Switching a family to its moderate value is one number.
- The Air Particles layer adds its one streamed draw call, and the depth-only
  ground occluder adds one per resident chunk slot: about 51 draw calls and
  6,272 triangles once the window is fully resident, against the two draw
  calls and no triangles this level drew before it had a floor. Measured on
  one route frame, the occluder removes 17.7 per cent of the visible scent
  pixels — that share was the far side of ridges showing through them. The
  measured counters confirm it: the trail adds exactly one draw call, one
  geometry, and one program to thermal, magnetic, and connections, and
  nothing changes anywhere else.
- Ordinary frames update one time uniform per layer; crossing a chunk boundary
  rewrites only the recycled edge slots through the shared stream queue.
- Opaque points avoid the transparent-overdraw limit named in the Level Guide.
  Fill rate, not point count, is the risk at these densities.
- The standalone PICO 4 / 90 FPS gate is not yet measured.

## Decisions, Risks, and Open Questions

- Decided: every plant and every animal smells, and the signature is per
  family rather than per model. This resolves the open art decision this
  document previously carried ("whether shrubs or animals should also
  smell").
- Scent is bound to the deterministic Vegetation placement, so it agrees with
  the trees the later levels render. The one documented disagreement is the
  river bank: the rendered module rejects a plant whose scaled model
  footprint touches the channel, and that radius needs the loaded asset,
  so the scent source uses the same 2.5-metre stand-in the Connections
  anchors use.
- Animal scent is a printed trail that stays where the animal walked, not a
  cloud carried with the body. The reference project's `MovementRouteAtlas`
  is not carried over: these animals wander freely in an endless streamed
  world rather than following precomputed closed routes.
- The Level Guide intent that scent moves through the shared wind field is
  implemented. `src/world/wind.ts` now samples a turning wind: the direction
  swings 44 degrees either side of its mean and the strength gusts, both
  built from whole harmonics of one 240-second loop so the wrap is seamless.
  Each scent layer scales that one wind by its own authored reach — 1.4 m
  across a particle life for plants, 6 m for an animal trail — so both lean
  the same way while a plant stays findable and a route does not.
- Grass reads the mean wind direction once when its material is created and
  does not yet follow the turn. No narrative level renders grass, so this is
  recorded rather than fixed here.
- Air particles stay an unrestricted volume: candidates below the invisible
  ground are not clipped, because no rendered surface contradicts them.
- Scent particles do not fade into the echo haze with distance. From level 03
  they stay fully saturated to the far plane and are then clipped, while
  every other surface has already dissolved into mist.
- Air particles are still not clipped against the ground, but the occluder
  now hides the ones below it, so the unrestricted volume no longer shows.
- The runtime intensity driver is blocked on open-decisions §2.
- Open art decisions: particle shape/scale/lifetime refinement, emission
  volume refinement per family, reaction to flight proximity.
