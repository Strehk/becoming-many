<!--
Purpose: Document the Connections level (07) as designed and as built.
Context: Connections is the final level, following Magnetic Field Perception.
Responsibility: Keep narrative intent, the exact preset, and open decisions in one place.
Boundary: The Level Guide owns the cross-level sequence; modules own their implementations.
-->

# 07 — Connections

## Narrative Intent and Experience Goal

Add no further biological sense. Instead, reveal relationships within the
already perceived world so individual elements become parts of a larger
connected system (see `docs/narration/en.md`, "Finale": "you begin to see
connections that were invisible before... For a moment — you become many").
A pulsing mycelium web blends over the unchanged carried world, connecting
the same deterministic world positions the earlier senses established —
trees and bushes, the level-02 scent sources, rocks, and the living
animals.

## Entry, Exit, and Timeline Cues

- Enters from Magnetic Field Perception: the sky glow, heat view, motion
  trails, and depth ramp stay exactly as they were; the web joins the world.
- Exits toward the Overload and Return script beats: senses fade and their
  runtime gates close while the one preloaded composition remains resident.
- The default show uses the implemented audio-clock schedule and shared fades.
  The complete preset remains available as a showless `?level=connections`
  development run with statically authored full intensity.

## Visual and Audio Direction

Palette (see [moodboard](mood/moodboard.png)):
`#F2E3D3` `#683B5A` `#292E55` `#A5BDC3` `#D06780` `#E39E54`

Decided art direction (2026-08-31): the web overlays the carried world
without changing it. An earlier variant darkened the near terrain into
opaque soil tones; the project owner rejected the purple ground the same
day, so the guide's "layer opacity may reveal structures below the
terrain" idea is settled as: no terrain change at all — the web alone
carries the sense. The strands are alpha-blended over whatever the
carried senses show beneath them (thermal colors near, echo grayscale
farther out, the magnetic shimmer overhead), visible inside an 88-metre viewer
radius that dissolves across its last 12 metres.

Each topology edge renders as a bundle of three fine meandering filaments
(roughly five-millimetre strands) that split mid-cord and rejoin at their
anchors, over a wobbling centerline — so the web looks far denser than
its actual node and edge counts without any extra instances or draw
calls. Periodic bright knots along the cords stand in for junction nodes
that do not exist in the topology. Strands carry their hub's class
signature, lighten toward the authored depth tone (currently white) at
their midpoints, and dim by their coverage ratio below pixel resolution
instead of widening. Cream (`#F2E3D3`) light pulses travel along them at
4 m/s — slower than the 8 m/s magnetic pulses: nutrients, not signals.
Node glows mark the sources: gray-blue (`#A5BDC3`) for vegetation, rose
(`#D06780`) for scent emitters, amber (`#E39E54`) for animals, navy
(`#292E55`) for rocks. Edges inherit the color of their heavier hub
endpoint. The palette's plum (`#683B5A`) is currently unused; it remains
reserved for a future underground or dramaturgy cue. The background
stays the carried haze `#F1F1F1`; a warm dawn shift toward the palette's
cream is a dramaturgy question, not a preset value. No audio counterpart
exists yet.

## Exact Typed Preset and Active Modules

- Preset: `src/levels/connections.level.ts` (`testUi: true`, 128-metre
  view distance, background `0xF1F1F1` carried from the chain).
- Fields: everything from `magnetic.level.ts` copied unchanged (terrain,
  vegetation, rocks, animals, air, scent, echo depth, motion, thermal,
  magnetic), plus `connections: ConnectionsParameters` (intensity 1,
  88-metre web radius, 4 m/s pulse speed, per-source records with the
  palette node colors and weights 1 / 1 / 0.5 / 0.25 for vegetation /
  scent emitters / animals / rocks, depth white, pulse `#F2E3D3`).
- Active modules: everything the Magnetic level activates, plus the
  Connections web world module (`src/modules/mycelium/`): the streamed
  cord and node pools plus the module-owned topology worker. No terrain
  material effect exists; the carried surface stack is untouched. The
  composition root skips the sense entirely at intensity zero, and each
  source class joins only when both its preset module block and its
  `sources` entry exist.
- Node sources cross module boundaries through the shared
  `ConnectionNodeSource` / `ConnectionActorSource` contracts in
  `src/modules/connection-nodes.ts`: vegetation and rocks replay their
  deterministic placements (`vegetation-nodes.ts`, `rock-nodes.ts`),
  scent exposes its emitter anchors (`scent-emitter-anchors.ts`), and
  animals expose live visible-actor positions through
  `AnimalsModuleHandle`.

## Asset and Shader Requirements

- No new external assets.
- Four module-owned GLSL ES 3.00 files on the web's own
  `ShaderMaterial`s: `network-edges.vert/.frag` (a subdivided
  camera-facing ribbon envelope with a sine-wobbled centerline,
  vertex-collapse beyond the radius, and three procedural filaments,
  knots, and the traveling pulse band drawn inside the envelope per
  fragment) and `network-nodes.vert/.frag` (pixel-capped attenuated
  point glows with a bright core and soft halo).
- The repository's first Web Worker: `topology.worker.ts`, owned by the
  module (created on load, terminated on unload), relaying typed
  transferable messages through the pure kNN + minimum-spanning-tree
  math of `network-topology.ts` — extracted principles from the
  `../experiments/wurzeln` project, without its traffic-reinforcement
  simulation. Stale replies are discarded by generation, mirroring the
  chunk-window currentness rule.

## Performance Budget and Measured Evidence

- The web adds exactly two draw calls: one instanced ribbon mesh (fixed
  4096-edge pool, the first four rows reserved for animal links) and one
  point cloud (fixed 1280-node pool). Both are transparent with
  `depthWrite` off and `depthTest` on (motion-trail precedent): the thin
  strands keep the blended overdraw small, and hills, rocks, and animals
  still occlude the web correctly.
- Topology is O(n²) and runs entirely off the frame path in the worker;
  gathering replays deterministic module math one chunk per bounded
  stream step across the module's own 7×7 window of 32-metre chunks.
  Rapid window crossings collapse into the latest gather through
  stream-queue key replacement.
- Overflow beyond the fixed pools drops lowest-weight edges (spanning
  edges always survive) and logs one warning per generation.
- No hardware desktop measurement has been recorded for this level yet.
- The Windows-to-PICO PCVR 90 Hz gate is not yet measured; no 72 Hz or
  90 Hz headset claim is approved.

## Decisions, Risks, and Open Questions

- Worker decision (decided 2026-08-31): topology runs in a module-owned
  Web Worker rather than in stream-queue steps — see
  `docs/architecture-decisions.md`.
- No terrain change (decided 2026-08-31, superseding the same-day soil
  reveal): the sense is carried entirely by the alpha-blended web; the
  Mycelium module patches no material and owns no terrain effect. This
  is the first sense rendered with real transparency; the motion trails
  set the precedent, and the thin strand geometry bounds the overdraw.
- Depth reading: cords sit 0.05 metres above the ground with normal
  depth testing; "roots and mycelium" is sold by the ground-hugging
  placement and the navy midpoint depth tint. At grazing view angles the
  cords may read as surface paint; `edgeLiftMeters` and the tint
  strength are the tunables.
- Web radius 88 metres (decided 2026-08-31): far past the 30-metre
  thermal radius and inside the 120-metre echo far distance, validated
  against the 96-metre topology-window coverage so strands can never pop
  at an unstreamed edge.
- Vegetation riverbank approximation: the rendered module rejects trees
  whose scaled model footprint touches the river channel; the node
  source uses a fixed 2.5-metre stand-in because model radii need loaded
  assets. A rare node without a tree can appear at riverbanks.
- Whole-window regeneration can reroute spanning edges inside the
  visible radius when crossing chunk boundaries; pulse phases are hashed
  from quantized world endpoints so they survive regeneration. If edge
  pops read badly on device, the documented follow-up is a per-edge
  fade-in keyed to upload time.
- Open art decisions: web radius and fade band against real headset
  contrast and the transparent fill-rate measurement; pulse density,
  speed, and glow widths; whether the reserved plum returns as an
  underground cue; the warm background shift and the end-of-piece fade
  sequence (both waiting for the dramaturgy driver).
