<!--
Purpose: Document the Magnetic Field Perception level (06) as designed and as built.
Context: Magnetic Field Perception is the fifth sense level, following Thermal Perception.
Responsibility: Keep narrative intent, the exact preset, and open decisions in one place.
Boundary: The Level Guide owns the cross-level sequence; modules own their implementations.
-->

# 06 — Magnetic Field Perception

## Narrative Intent and Experience Goal

Expose a stable field direction that exists independently of gaze and
flight path ("Migratory Bird"). Migratory birds fly thousands of
kilometres without a map, in part because they sense the magnetic field of
the Earth — some researchers think certain birds can almost see it, as a
shimmer laid over everything, showing them where north is (see
`script/en.md`, "The Magnetic Field"). Here that global orientation
becomes deep-blue field lines running through the ground, with light
pulses traveling toward a glowing point on the horizon that never moves.

## Entry, Exit, and Timeline Cues

- Enters from Thermal Perception: the heat view, motion trails, and depth
  ramp stay exactly as they were; the ground field lines and the northern
  sky glow join the world.
- Exits toward Connections: the magnetic field later resolves into local
  relationships and network flow.
- The timeline driver (audio clock / schedule) is unresolved — see
  `docs/direction/open-decisions.md` §2. Until then the sense intensity is
  authored statically in the preset and this level runs standalone from
  `src/main.ts`; no cross-level transition machinery exists yet. The
  guide's "thermal color reduces so the magnetic signal remains legible"
  cue is deferred to that driver: this preset carries thermal verbatim at
  full intensity ("senses layer, never swap"), and the stripes read
  outside the 30-metre thermal radius.

## Visual and Audio Direction

Palette (see [moodboard](mood/moodboard.png)):
`#151935` `#1140A4` `#69BDE1` `#CDDBE2` `#A394C3` `#F9B33C`

Decided art direction (2026-08-31): the field stays monochromatic blue.
Deep blue `#1140A4` carries the terrain-draped base lines at 20% opacity
and the sky glow; pale gray-blue `#CDDBE2` carries the narrow pulses that
travel along the lines toward the field direction. The sky cue is a
camera-following dome that shows the carried haze background (`#F1F1F1`)
everywhere except a soft deep-blue glow low on the horizon toward the
field direction — the same direction the ground pulses flow toward, so the
near field and the far cue always agree. The world mood stays the carried
pale haze; the moodboard's night-sky blues color only the field itself.
No audio counterpart exists yet.

## Exact Typed Preset and Active Modules

- Preset: `src/levels/magnetic.level.ts` (`testUi: true`, 128-metre view
  distance, background `0xF1F1F1` carried from the chain).
- Fields: everything from `thermal.level.ts` copied unchanged (terrain,
  vegetation, rocks, animals, air, scent, echo depth, motion, thermal),
  plus `magnetic: MagneticSenseParameters` (intensity 1, field direction
  0° from north, 8-metre line spacing, 0.35-metre line width, 0.1-metre
  pulse width, 20% line opacity, 8 m/s flow speed, line and sky glow
  `#1140A4`, pulse `#CDDBE2`). Line dimensions start from the proven Test
  Level diagnostic values and remain tunable against real headset
  contrast.
- Active modules: everything the Thermal level activates, plus Magnetic
  Sense (`src/modules/magnetic-sense/`) with two consumers sharing one
  field-direction and intensity uniform set: the terrain stripe material
  effect (ordered between thermal and echo depth, so thermal wins inside
  its radius and the stripes print over the echo ramp outside it) and the
  sky dome world module. The composition root skips the sense entirely at
  intensity zero.

## Asset and Shader Requirements

- No new external assets.
- Four module-owned GLSL ES 3.00 files: `magnetic-sense.vert.glsl` /
  `magnetic-sense.frag.glsl` (world-space stream coordinate, height-warped
  stripes, `fwidth` edge stabilization, pulses clipped inside lines)
  patched into Terrain's existing material through the shared
  `applyShaderPatch` helper, and `magnetic-sky.vert.glsl` /
  `magnetic-sky.frag.glsl` (analytic horizon glow by view-direction
  elevation and azimuth) on the dome's own `ShaderMaterial`.
- The dome mesh follows the full camera position each frame, so the
  horizon band stays at eye level at any flight altitude. The world uses
  absolute coordinates throughout (no floating origin exists), so the
  guide's floating-origin coherence bullet needs no compensation.

## Performance Budget and Measured Evidence

- Terrain stripes add no geometry, texture, light, transparent layer, or
  draw call; they ride the existing opaque terrain pass.
- The sky cue adds exactly one draw call: an opaque 120-metre back-side
  dome (32×16 segments) with `depthWrite` off and `renderOrder` −1, drawn
  first so every later opaque fragment paints over it. No transparency,
  bloom, physical light, or extra render pass.
- Per-fragment dome cost: two smoothsteps, one normalize, one pow, one
  mix.
- No hardware desktop measurement has been recorded for this level yet.
- The standalone PICO 4 / 90 FPS gate is not yet measured; no 72 Hz or
  90 Hz headset claim is approved.

## Decisions, Risks, and Open Questions

- Contract promotion (decided 2026-08-31): `magnetic` is a top-level
  preset field like the other senses, no longer nested in the terrain
  preset; colors moved from module constants into the preset.
- Shared uniforms (decided 2026-08-31): one direction object and one
  intensity object reach both the terrain patch and the sky material, so
  a future dramaturgy driver steers the whole sense through single
  values.
- Thermal carried verbatim (decided 2026-08-31): the chain inherits
  thermal at full intensity; reducing it is a dramaturgy-driver question,
  not a preset override.
- The Test Level keeps its own diagnostic magnetic block (warm orange
  colors) and gains the sky dome as a direction diagnostic.
- Open art decisions: line opacity, pulse width, and flow timing against
  real headset contrast; sky glow strength, elevation span, and azimuthal
  width; when and how far thermal reduces once a dramaturgy driver
  exists; relationship between flight direction and perceived
  orientation.
