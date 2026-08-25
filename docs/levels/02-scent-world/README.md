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

Scent reads as opaque, round, softly fading points that rise and sway above
their invisible sources. Each source family keeps one clearly distinguishable
signature color. No audio counterpart exists yet.

## Exact Typed Preset and Active Modules

- Preset: `src/levels/scent.level.ts` (base experiment, `testUi: true`,
  no rendered surface modules).
- Fields: `scentParticles: ScentParticlesParameters`, the unchanged White
  World `airParticles` values, and `invisibleGround: true` on `LevelPreset`.
- The invisible ground clamps flight one metre above the continuous shared
  world surface ("terrain remains invisible" while movement respects it); it
  creates no module and renders nothing.
- Active modules: Scent Particles (`src/modules/scent-particles/`) and Air
  Particles (the level 01 layer carried over as the neutral depth baseline),
  plus the test overlay. Scent sources stream with travel: every resident
  64-metre chunk deterministically spawns up to two emitters where the zone
  facts grow forest, anchored 1–2 m above the invisible ground as flat clouds
  (one-metre vertical extent), one palette signature each, 192 particles per
  emitter.

## Asset and Shader Requirements

- No external assets.
- Two module-owned GLSL ES 3.00 files: `scent-particle-motion.vert.glsl`
  (rise, sway, life-cycle fade, intensity) and
  `scent-particle-circle.frag.glsl` (circular point clipping).

## Performance Budget and Measured Evidence

- One fixed streamed scent pool: 49 resident chunk slots × 2 emitters × 192
  particles = 18,816 points in one opaque draw call (7 × 7 slot window from
  the 128-metre view distance plus one preload layer).
- The Air Particles layer adds its one streamed draw call (White World values,
  128-metre view distance, 192 particles per volume): two draw calls total.
- Ordinary frames update one time uniform per layer; crossing a chunk boundary
  rewrites only the recycled edge slots through the shared stream queue.
- Opaque points avoid the transparent-overdraw limit named in the Level Guide.
- The standalone PICO 4 / 90 FPS gate is not yet measured.

## Decisions, Risks, and Open Questions

- Wind-field coupling is deliberately deferred; the Level Guide intent
  ("clouds move through the shared wind field") is not yet implemented.
- Air particles stay an unrestricted volume: candidates below the invisible
  ground are not clipped, because no rendered surface contradicts them.
- Emitters stream with travel but do not move while placed; scent fields and
  moving emitters (route-atlas technique from the reference projects) are
  later steps.
- Source zones are module-owned (conifer and deciduous forest); meadow, shrub
  slope, and water carry no scent yet. Whether shrubs or animals should also
  smell is an open art decision.
- The runtime intensity driver is blocked on open-decisions §2.
- Open art decisions: source-to-color mapping, particle shape/scale/lifetime
  refinement, cloud scale and overlap, reaction to flight proximity.
