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
becomes exactly that: a grainy, iridescent shimmer standing in the sky
where north is, condensing the closer the gaze comes to the magnetic axis
and dissolving into quiet sky away from it.

## Entry, Exit, and Timeline Cues

- Enters from Thermal Perception: the heat view, motion trails, and depth
  ramp stay exactly as they were, and the ground is not touched at all; the
  sky itself changes and the northern shimmer joins the world above them.
- Exits toward Connections: the magnetic field later resolves into local
  relationships and network flow.
- The timeline driver (audio clock / schedule) is unresolved — see
  `docs/direction/open-decisions.md` §2. Until then the sense intensity is
  authored statically in the preset and this level runs standalone from
  `src/main.ts`; no cross-level transition machinery exists yet. The
  guide's "thermal color reduces so the magnetic signal remains legible"
  cue is deferred to that driver: this preset carries thermal verbatim at
  full intensity ("senses layer, never swap"). Since the field moved to the
  sky it never competes with the heat view for the same pixels anyway.

## Visual and Audio Direction

Palette (see [moodboard](mood/moodboard.png)):
`#151935` `#1140A4` `#69BDE1` `#CDDBE2` `#A394C3` `#F9B33C`

Decided art direction (2026-09-01, replacing the one decided 2026-08-31):
the sky is the previous version's, ported. That build offered nine
blendable sky visualisations of magnetoreception; its saved state had one
of them active, the radical-pair shimmer (`birdspec`), and that is what
level 06 now shows. The camera-following dome grades from the carried
haze (`#F1F1F1`) at the horizon to a pale blue zenith, and a grainy
pattern condenses into a tight patch at the magnetic north point with a
mirrored one at the southern counter-pole — dark grain toward north, near
white toward south, an iridescent overlay breathing over both. Between
the poles the sky stays quiet.

Two consequences, both decided rather than overlooked: the level-06
moodboard palette (`#151935` `#1140A4` `#69BDE1` `#CDDBE2` `#A394C3`
`#F9B33C`) no longer governs this level, because the ported pole colors
are black and white; and the ground carries no magnetic paint at all —
until 2026-09-01 blue lines were draped over the terrain. No audio
counterpart exists yet.

## Exact Typed Preset and Active Modules

- Preset: `src/levels/magnetic.level.ts` (`testUi: true`, 128-metre view
  distance, background `0xF1F1F1` carried from the chain).
- Fields: everything from `thermal.level.ts` copied unchanged (terrain,
  vegetation, rocks, animals, air, scent, echo depth, motion, thermal),
  plus `magnetic: MagneticSenseParameters` — intensity 1, field direction
  0° from north, field elevation 7.5°, and three colors: north `#000000`,
  south `#FFFFFF`, zenith `#C4D7F6`. The direction and inclination are the
  values the previous version last had saved. The zenith hex is the sRGB
  encoding of its linear literal, so the conversion lands on the same
  color.
- Everything else about the look is module-owned and hardcoded in
  `magnetic-sense-settings.ts`: grain frequency 30, pole strength 2.85,
  pole-width exponent 20, contrast 1, iridescence 0.7, breathing 1, drift
  60° from north at 0.4 with a 0.25 vertical part, anisotropy 1. The
  previous version exposed each of these as a dev-console slider; here the
  finished look is fixed.
- Active modules: everything the Thermal level activates, plus Magnetic
  Sense (`src/modules/magnetic-sense/`) as one world module owning the sky
  dome. It appears in no material-effect list and touches neither Terrain
  nor Grass. The composition root skips the sense entirely at intensity
  zero.

## Asset and Shader Requirements

- No new external assets.
- Two module-owned GLSL ES 3.00 files on the dome's own `ShaderMaterial`:
  `magnetic-sky.vert.glsl` forwards the local vertex as a view direction,
  and `magnetic-sky.frag.glsl` carries the whole sense — the sky gradient,
  four octaves of value noise, the pole-zone falloff, the grain palette,
  and the iridescent overlay. The previous version's shader is TSL on
  `three/webgpu`; it is rewritten as GLSL here, as the WebGL2 decision
  requires, with its noise, thresholds, and phase offsets unchanged and its
  fbm loop unrolled. The shader ends with `#include <colorspace_fragment>`,
  so the dome converts on output like every other material.
- The dome mesh follows the full camera position each frame, so the
  horizon band stays at eye level at any flight altitude. The world uses
  absolute coordinates throughout (no floating origin exists), so the
  guide's floating-origin coherence bullet needs no compensation.

## Performance Budget and Measured Evidence

- The sense costs exactly one draw call: an opaque 120-metre back-side
  dome (32×16 segments) with `depthWrite` off and `renderOrder` −1, drawn
  first so every later opaque fragment paints over it. No geometry beyond
  that dome, no texture, transparency, bloom, physical light, or extra
  render pass — and since 2026-09-01 no Terrain fragment work either.
- The four-octave noise is the expensive part: 32 hashed sines per shaded
  fragment. It runs only inside the two pole cones, behind one coherent
  early-out on the pole zone. The open sky costs one normalize, one dot,
  one `pow`, one `sin`, two mixes, and two smoothsteps.
- That early-out is a deliberate exception to the no-dynamic-branch rule.
  It is justified because the branch follows large contiguous screen
  regions rather than alternating per pixel, and because the dome is drawn
  first and therefore shaded across the whole viewport with no early-z
  rejection available.
- No draw call was added or removed by the move from ground to sky.
- No hardware desktop measurement has been recorded for this level yet.
- The standalone PICO 4 / 90 FPS gate is not yet measured; no 72 Hz or
  90 Hz headset claim is approved.

## Decisions, Risks, and Open Questions

- Ported sky (decided 2026-09-01): the field left the ground and the sky
  became the previous version's `birdspec` shimmer, hardcoded from its
  saved state. The terrain stripe effect and its two GLSL files are
  deleted. This reverses the 2026-08-31 art direction on the author's
  instruction, and with it the moodboard palette for this level.
- Preset surface (decided 2026-09-01): the level authors the field axis,
  the intensity, and three colors; every shape and motion value is
  module-owned. This narrows the 2026-08-31 contract promotion, because
  the ported look is finished art rather than a level knob.
- Contract promotion (decided 2026-08-31): `magnetic` is a top-level
  preset field like the other senses, no longer nested in the terrain
  preset.
- Shared uniforms: one axis object, one intensity object, and one time
  object reach the dome material by identity, so a future dramaturgy
  driver steers the whole sense through single values. The intensity fades
  the shimmer back into the plain sky.
- Thermal carried verbatim (decided 2026-08-31): the chain inherits
  thermal at full intensity; reducing it is a dramaturgy-driver question,
  not a preset override.
- The Test Level keeps its own diagnostic magnetic block: warm orange at
  the north point against a white counter-pole, so which end of the axis
  is which reads at a glance.
- Fidelity against the previous version is verified by code and by its
  saved parameter values, not by a side-by-side render; `bm-base` needs an
  install and a WebGPU browser to run. A visual comparison is still open.
- Open art decisions: how the ported sky sits against the carried haze and
  the pale world of the earlier levels; whether the southern counter-pole
  should stay visible at all; when and how far thermal reduces once a
  dramaturgy driver exists; relationship between flight direction and
  perceived orientation.
