<!--
Purpose: Document the Echolocation level (03) as designed and as built.
Context: Echolocation is the second sense level, following Scent World.
Responsibility: Keep narrative intent, the exact preset, and open decisions in one place.
Boundary: The Level Guide owns the cross-level sequence; modules own their implementations.
-->

# 03 — Echolocation

## Narrative Intent and Experience Goal

Give the world clearly perceptible depth ("Bat — Depth"): the first question
is not *what is that* but *how far is that*. The result of echolocation is
shown directly through distance-dependent visibility; individual visible echo
waves are explicitly excluded. The base world becomes dark and visually
reduced, and terrain, vegetation, and rocks emerge purely through their
distance to the viewer.

## Entry, Exit, and Timeline Cues

- Enters from Scent World: scent particles fade and unload while world
  position and flight state remain stable.
- Exits toward Motion Perception: motion cues may begin during the exit so
  moving plants and animals lead naturally into the next state.
- The timeline driver (audio clock / schedule) is unresolved — see
  `docs/direction/open-decisions.md` §2. Until then the sense intensity is
  authored statically in the preset and this level runs standalone from
  `src/main.ts`; no cross-level transition machinery exists yet.

## Visual and Audio Direction

Palette (see [moodboard](mood/moodboard.png)):
`#0E1017` `#0D1730` `#3C4782` `#3FA7E2` `#CBD9E5` `#F6F0E9`

Decided art direction (2026-08-25): aerial-perspective depth mapping in the
spirit of the moodboard, authored as a grayscale ramp that keeps the
moodboard palette's luminance steps, the two far stops since lifted above
theirs (see the 2026-08-30 decision below):
`#101010` `#171717` `#494949` `#959595` `#E2E2E2` `#F7F7F7`

Near geometry reads as near-black silhouettes and recedes through gray into
an off-white haze that equals the background color, so distant geometry
dissolves completely. Every surface shows only its depth-ramp color: there
are no proximity accents, so approaching a tree darkens it toward the near
color instead of lighting it up. Individual visible echo waves or ping
ripples are excluded by the level intent. No audio counterpart exists yet.

## Exact Typed Preset and Active Modules

- Preset: `src/levels/echo.level.ts` (`testUi: true`, 128-metre view
  distance, background `0xF7F7F7` equal to the ramp haze stop).
- Fields: `terrain` (plain material, full opacity), `grass`, `vegetation`,
  and `rocks` (dark-palette base colors, Test Level densities), the
  unchanged White World `airParticles` values, the unchanged Scent World
  `scentParticles` values, and `echoDepth: EchoDepthParameters` (intensity
  1, ramp from 6 to 120 metres, the fixed level palette).
- Active modules: Terrain, Grass, Vegetation, and Rocks, plus Air Particles
  and Scent Particles carried over as accumulated earlier senses ("senses
  layer, never swap"), and the test overlay. Scent clouds keep their 02-palette
  signature colors and now anchor above the rendered ground; the composition
  root never applies Echo Depth to them, so the sense does not recolor a
  sibling. The root creates one `EchoDepthEffect` (`src/modules/echo-depth/`)
  and applies the same instance to Terrain (through `TerrainMaterialEffect`)
  and to the Grass material and every Vegetation and Rock part material
  (through the shared `UnlitMaterialEffect` contract).
- Decided 2026-08-30: Grass is no longer excluded. Its own shader now carries
  the three.js chunk anchors (`<common>`, `<project_vertex>`, and
  `<color_fragment>`), so the same patch that decorates a built-in material
  pass reaches it unchanged. Blades therefore recede into the haze with
  everything around them instead of holding one flat color at every
  distance. Grass took its own 64-metre range in the same step; see
  [performance.md](../../performance.md).
- Excluded by intent: Animals (motion belongs to level 04).

## Asset and Shader Requirements

- No external assets beyond the trees and rocks already owned by the
  Vegetation and Rocks definitions.
- Two module-owned GLSL ES 3.00 files: `echo-depth.vert.glsl` (camera-space
  radial distance) and `echo-depth.frag.glsl` (four-segment palette ramp and
  intensity mix). The effect patches existing `MeshBasicMaterial` passes; it
  adds no geometry, texture, scene pass, or draw call.

## Performance Budget and Measured Evidence

- The depth response is pure material work: one varying plus four
  `smoothstep` and five `mix` operations per fragment, no texture samples.
- Terrain, Vegetation, and Rocks reuse their existing fixed pools at the
  128-metre view distance; the Air and Scent Particle layers add one streamed
  draw call each with their known Scent World budgets. The draw-call shape
  stays at or below the Test Level's measured 61 calls because the effect
  itself adds none.
- The far ramp distance (120 m) sits below the view distance (128 m), so
  chunk streaming pop-in happens inside the haze where geometry has already
  dissolved into the background color.
- Camera-space radial distance is rotation-invariant: the ramp does not swim
  during headset turns, and the monotonic smoothstep ramp avoids banding
  strobe during fast flight.
- Rendering smoke (2026-08-25, headless Chromium on the SwiftShader software
  rasterizer, including the carried-over air and scent layers): the level
  renders the intended aerial-perspective treatment with zero console errors
  or warnings, roughly 22–30 draw calls, and 1.2–2.2 million rendered
  triangles in settled and post-flight views. Frame rates under software
  rasterization are not meaningful and are deliberately not recorded.
- No hardware desktop measurement has been recorded for this level yet.
- The standalone PICO 4 / 90 FPS gate is not yet measured; no 72 Hz or 90 Hz
  headset claim is approved.

## Decisions, Risks, and Open Questions

- A cyan rim accent on near forms was implemented and removed on 2026-08-25:
  nearby trees lit up on approach, but every surface must always show only
  its depth-ramp color. The removal also dropped the effect's only use of
  normals, so Terrain's deleted `normal` attribute needs no special
  handling.
- The `applyTo` shader-patch idiom was deliberately parallel to Magnetic
  Sense. When Thermal Perception arrived as the third material effect
  (2026-08-28), the wrap-and-inject block was extracted into the shared
  `src/utils/asset-loader/material-shader-patch.ts` helper, which also
  documents the first-applied-wins anchor ordering.
- Vegetation and Rock base colors are visible only below full intensity; they
  are authored from the dark palette end so a future intensity ramp fades
  between related tones.
- The runtime intensity driver is blocked on open-decisions §2; a future
  driver must deactivate the effect rather than merely zero the uniform,
  because only the composition-root skip removes the GPU work.
- The ramp is authored grayscale (decided 2026-08-25); the indigo moodboard
  palette remains the documented reference and can return by editing only
  the preset colors.
- Lighter horizon (decided 2026-08-30): the two far stops rose from `#D7D7D7`
  and `#F1F1F1` to `#E2E2E2` and `#F7F7F7`, so they now sit above the
  luminance of the moodboard stops they were derived from. The haze is what
  the world ends in, and at its old value the horizon read as a grey wall
  closing the distance rather than as the world thinning out of sight. They
  moved as a pair on purpose: lightening only the stop the world dissolves
  into would have left the band before it as a visible step short of the
  horizon. Every stop below them is untouched, so near geometry still reads
  as near-black silhouette and the ramp still walks the palette's luminance
  order. This reaches levels 04 and 05 as well — the echo ramp is carried
  verbatim by both, there is no per-level override, and `sharedEchoHazeColor`
  is also each of those levels' background color.
- Open art decisions: ramp stop tuning against real headset contrast;
  whether the carried-over dark air motes should adopt a pale gray tone for
  legibility against dark near forms; whether scent intensity should be
  reduced here to express "color and scent recede" from the Level Guide
  transition; whether the moodboard's indigo and cyan tones return once the
  grayscale base is approved.
