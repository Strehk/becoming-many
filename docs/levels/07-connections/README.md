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
connected system (see `script/en.md`, "Finale": "you begin to see
connections that were invisible before... For a moment — you become many").
A pulsing root system lies in the opened soil beneath the carried world,
connecting the same deterministic world positions the earlier senses
established — trees and bushes, the level-02 scent sources, and rocks —
through a mat of seeded soil points dense enough to read as a real root
system. The living animals do not join it: a root system is what stands
still and grows, and a body walking over it is not part of it.

## Entry, Exit, and Timeline Cues

- Enters from Magnetic Field Perception: the field lines, sky glow, heat
  view, motion trails, and depth ramp stay exactly as they were; the web
  joins the world.
- Exits toward the Overload and Return script beats: modules fade and
  unload in a controlled sequence before the operator returns the
  presentation to passthrough.
- The timeline driver (audio clock / schedule) is unresolved — see
  `docs/direction/open-decisions.md` §2. Until then the sense intensity is
  authored statically in the preset and this level runs standalone as the
  browser entry's default preset; no cross-level transition machinery
  exists yet.

## Visual and Audio Direction

Palette (see [moodboard](mood/moodboard.png)):
`#F2E3D3` `#683B5A` `#292E55` `#A5BDC3` `#D06780` `#E39E54`

Decided art direction (2026-09-02): the visitor sees the root system
under the earth through a ground that opens where nothing grows on it.
The guide's "layer opacity may reveal structures below the terrain" idea
is settled literally, but at **two** opacities rather than one. Bare
earth opens far enough to read the mat through it; ground the grass field
covers stays nearly solid, because a lawn has to keep looking like a lawn
and the opaque blades standing on it already hide most of what is below —
the cords show only between them, which is the weakened reading grass
should give. Three earlier answers were built and dropped: opaque purple
soil tones that darkened the ground to *suggest* depth (2026-08-31), a
dithered soil that read as a pixel screen, and an evenly translucent one
that washed out the whole surface including the meadow. A fourth, leaving
the ground untouched and compositing the mat over the finished world with
depth testing off, keeps the surface perfect but lets cords paint over
tree trunks and cannot use grass to weaken anything. The strands are alpha-blended over whatever the carried senses show
beneath them (thermal colors near, echo grayscale farther out, the
magnetic shimmer overhead), visible inside a 30-metre viewer radius that
dissolves across its last 12 metres.

Reach before density, the rule the grass module recorded: the mat is
carried at the density of the `../experiments/wurzeln` experiment, which a
horizon-wide web cannot afford, so it is a zone the visitor walks inside
rather than a web seen across the valley. It grows with proximity, and growth means
more roots: every cord and node carries a stable threshold and comes out
once the density its own camera distance allows reaches it, so the mat
fills in around whoever walks into it and thins to about a third of
itself at the rim. The topology itself is seeded once and stays put.

Each topology edge renders as a bundle of three fine meandering filaments
(roughly two-centimetre strands, four times the sparse web's, because a
root has to be legible at walking distance) that split mid-cord and rejoin at their
anchors, over a wobbling centerline — so the web looks far denser than
its actual node and edge counts without any extra instances or draw
calls. Periodic bright knots along the cords stand in for junction nodes
that do not exist in the topology. Strands carry their hub's class
signature, sink toward the authored depth tone (plum `#683B5A`) at their
midpoints — so a strand reads bone at its anchors and dusk in the middle,
the shading that makes a flat ribbon read as a round root going down —
and dim by their coverage ratio below pixel resolution instead of
widening. Amber (`#E39E54`) light pulses travel along them at
1.5 m/s — far slower than the 8 m/s magnetic pulses: nutrients, not
signals. The speed dropped with the reach so that one crossing still takes
the twenty seconds that make it read as a crawl.
Node glows mark the sources: gray-blue (`#A5BDC3`) for vegetation, rose
(`#D06780`) for scent emitters, navy
(`#292E55`) for rocks, and bone (`#F2E3D3`) for the seeded soil mat.
Real mycelium is white, and against thermal's cold half (`#0E0628`
through `#1C6C8B`), echo's grey, and the green grass above it, bone is
the strongest contrast the palette has. Edges inherit the color of their
heavier hub endpoint, and soil carries the lightest weight of the five
classes so hubs stay on the world's real elements. The background
stays the carried haze `#F1F1F1`; a warm dawn shift toward the palette's
cream is a dramaturgy question, not a preset value. No audio counterpart
exists yet.

## Exact Typed Preset and Active Modules

- Preset: `src/levels/connections.level.ts` (`testUi: true`, 128-metre
  view distance, background `0xF1F1F1` carried from the chain).
- Fields: everything from `magnetic.level.ts` copied unchanged (terrain,
  vegetation, rocks, animals, air, scent, echo depth, motion, thermal,
  magnetic), plus `connections: ConnectionsParameters` (intensity 1,
  30-metre web radius, 1.5 m/s pulse speed, per-source records with the
  palette node colors and weights 1 / 1 / 0.25 / 0.2 for vegetation
  / rocks / soil (animals omitted), depth plum `#683B5A`, pulse amber
  `#E39E54`).
- Active modules: everything the Magnetic level activates, plus the
  Connections web world module (`src/modules/mycelium/`): the streamed
  cord and node pools, the seeded soil mat, and the module-owned topology
  worker. The module also publishes one terrain material effect, the
  worker. The module also publishes one terrain material effect, the
  ground opening; the rest of the carried surface stack is untouched. The
  composition root skips the sense entirely at intensity zero, and each
  source class joins only when both its preset module block and its
  `sources` entry exist.
- Node sources cross module boundaries through the shared
  `ConnectionNodeSource` / `ConnectionActorSource` contracts in
  `src/modules/connection-nodes.ts`: vegetation and rocks replay their
  deterministic placements (`vegetation-nodes.ts`, `rock-nodes.ts`),
  scent exposes its emitter anchors (`scent-emitter-anchors.ts`). The
  live actor contract stays in place but this level authors no animal
  source, so no cord ever reaches a moving body.

## Asset and Shader Requirements

- No new external assets.
- Six module-owned GLSL ES 3.00 files. Four on the web's own
  `ShaderMaterial`s: `network-edges.vert/.frag` (a subdivided
  camera-facing ribbon envelope with a sine-wobbled centerline,
  vertex-collapse beyond the radius, a proximity growth ramp, and up to
  three procedural filaments, knots, and the traveling pulse band drawn
  inside the envelope per fragment) and `network-nodes.vert/.frag`
  (pixel-capped attenuated point glows with a bright core and soft halo).
  Two more patch the carried terrain through the published effect
  contract: `soil-opening.vert/.frag`, which scale the ground's alpha
  between its bare and its grass-covered value. The effect declares a
  `coverAt` sampler and Terrain streams it per vertex, beside the thermal
  warmth it already streams the same way; the composition root wires it
  to the grass field's own `getGrassZoneCoverage`, so the zones are never
  derived a second time.
- The repository's first Web Worker: `topology.worker.ts`, owned by the
  module (created on load, terminated on unload), relaying one typed
  transferable message per chunk through the pure kNN +
  minimum-spanning-tree math of `network-topology.ts` — extracted
  principles from the `../experiments/wurzeln` project, without its
  traffic-reinforcement simulation. A reply for a slot that has since
  been reassigned is discarded by its revision.
- The mat's own points: `soil-nodes.ts` seeds deterministic per-chunk
  soil positions under the world surface, hashed as the grass field
  hashes its cells, because the world's anchors alone are an order of
  magnitude too sparse for the experiment's density.

## Performance Budget and Measured Evidence

- The web adds exactly two draw calls: one instanced ribbon mesh (fixed
  9,604-edge pool: four rows reserved for animal links, then 384 rows per
  built chunk) and one point cloud (fixed 9,408-node pool, 192 rows per
  gathered chunk). Every chunk owns one contiguous range it rewrites
  alone, the grass field's discipline, so writing an entering chunk
  cannot disturb a resident one; rows a chunk does not fill collapse in
  the vertex stage. Cords carry 8 longitudinal segments
  rather than the sparse web's 25 — the dense mat's cords are short — so
  the larger pool is 153,664 triangles against the sparse web's 204,800. The
  ground opening adds no draw call; it moves the terrain into the
  transparent pass and scales the alpha of a material that was already
  drawn. The web takes render order -1 so the soil blends over it. The
  cost is that terrain no longer hides the web behind a hill — trees,
  rocks, animals, and grass blades still do, through ordinary depth
  testing — and that bare ground blends toward the carried background
  wherever no cord covers it. Unverified on the headset. Both web meshes are transparent with
  `depthWrite` off and `depthTest` on (motion-trail precedent): the thin
  strands keep the blended overdraw small, and hills, rocks, and animals
  still occlude the web correctly.
- Topology is built per chunk, not per window, and runs entirely off the
  frame path in the worker. A chunk's cords are a pure function of its
  own nodes and its eight neighbours', both pure functions of world
  coordinates, so a chunk built once is built the same way forever:
  crossing a boundary adds ground at the rim and recomputes nothing that
  is already on screen. The gather window (7×7 of 16-metre chunks) keeps
  one ring more ground than the build window (5×5) draws, so no chunk is
  ever built with a partial neighbourhood; the outer ring's nodes are
  never nearer than 32 metres and the web radius masks them. Cross-chunk
  cords are claimed by the chunk holding the lexicographically first
  endpoint, so a seam is drawn exactly once. One crossing rebuilds five
  chunks at roughly 0.9 million distance evaluations, against the 22
  million a whole-window rebuild cost — unmeasured on the headset, and
  the first thing to measure.
- Both windows stream at `SURFACE_STREAM_PRIORITY`, with Terrain. On the
  default priority the stream queue runs every surface job before any
  mat job and starves it entirely while surface work lasts, which is how
  entering ground came to arrive after the visitor had walked onto it.
- Cords carry the clock second they were written and fade in over 0.6
  seconds. Only genuinely new ground runs that ramp, because resident
  chunks are never rewritten.
  Rapid window crossings collapse into the latest gather through
  stream-queue key replacement.
- Overflow beyond the fixed pools drops lowest-weight edges (spanning
  edges always survive) and logs one warning per generation.
- No hardware desktop measurement has been recorded for this level yet.
- The standalone PICO 4 / 90 FPS gate is not yet measured; no 72 Hz or
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
- Depth reading: the web is genuinely buried. World anchors hang 0.02
  metres under their own object so a tree meets its roots, and seeded
  soil points spread from 0.35 to 3.85 metres down, biased toward the
  surface so the mat thins with depth rather than filling a slab. The
  sells the depth is the ground's own opened alpha, the geometry's
  parallax, and the depth tint at the cord midpoints.
- Web radius 30 metres (decided 2026-09-02): inside the 120-metre echo
  far distance and validated against the 32-metre topology-window
  coverage so strands can never pop at an unstreamed edge. It no longer
  exceeds the 30-metre thermal radius — reach was traded for density.
- Vegetation riverbank approximation: the rendered module rejects trees
  whose scaled model footprint touches the river channel; the node
  source uses a fixed 2.5-metre stand-in because model radii need loaded
  assets. A rare node without a tree can appear at riverbanks.
- Per-chunk building settled the rerouting risk the whole-window design
  carried: resident chunks are not recomputed, so spanning edges inside
  the visible radius cannot move when a boundary is crossed. Pulse
  phases stay hashed from quantized world endpoints, and the per-edge
  fade-in keyed to upload time — the follow-up this document had already
  named — is implemented for the ground that genuinely is new.
- The spanning guarantee is now per chunk: no node of a chunk is left
  isolated, and chunks are joined by their claimed seam cords. There is
  no global minimum spanning tree any more. At this density the
  difference is not visible — a global tree over points 1.4 metres apart
  is local anyway — but it is one fewer guarantee than the sparse web
  made.
- Open art decisions: web radius and fade band against real headset
  contrast and the transparent fill-rate measurement; pulse density,
  speed, and glow widths; whether the reserved plum returns as an
  underground cue; the warm background shift and the end-of-piece fade
  sequence (both waiting for the dramaturgy driver).
