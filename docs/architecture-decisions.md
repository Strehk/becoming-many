<!--
Purpose: Record confirmed architecture decisions for Becoming Many.
Context: Separate durable decisions from sketches, proposals, and current status reporting.
Responsibility: Preserve constraints that guide implementation.
Boundary: The running architecture is documented in architecture.md.
-->

# Architecture Decisions

The [current architecture](architecture.md) describes what is implemented.
This file records decisions that constrain current and upcoming work.

## Applied Decisions

### WebGL2 and GLSL Rendering Stack

- The rendering stack is Three.js on WebGL2 with raw GLSL ES 3.00 shaders in
  dedicated `*.vert.glsl` / `*.frag.glsl` files, as the engineering standards
  require.
- WebGPU and TSL were evaluated and rejected (2026-08-25). Do not add
  `three/webgpu`, TSL, or WGSL code paths; TSL reference material is rewritten
  as GLSL when extracted.

### One Composition Root and Render Loop

- `src/main.ts` only selects level data and starts the Level Runtime.
- `src/levels/level-runtime.ts` creates enabled modules and connects controls.
- The permanent world runtime owns one `renderer.setAnimationLoop()`.
- Modules never start their own render loop.

### Narrow Ownership

- The World Engine owns execution mechanisms: rendering, time, lifecycle,
  chunk assignments, and bounded scheduling.
- Levels contain data only.
- Modules own their concrete CPU and GPU resources.
- Device input remains outside the World Engine.
- Chunk assignment, job scheduling, and rendering stay independent.

### Minimal Streaming Foundation

- All module chunk sizes are power-of-two multiples of the 16-metre base grid.
- Flat X/Z and volumetric X/Y/Z windows recycle fixed slot pools instead of
  growing the scene.
- Slot revisions invalidate delayed work.
- The shared queue knows neither chunk content nor Three.js.
- Terrain uses one foundational queue priority because generated content must
  not publish before its supporting ground. Distance priorities, prefetching,
  asynchronous loading, and workers still require a concrete measured need.

### World Surface Before Rendering

- `src/world-surface` defines deterministic ground, visible-surface, and zone
  facts without chunks, lifecycle, camera state, materials, or narrative levels.
- `WorldSurface` exposes separate height, surface, continuous-zone-condition,
  and hard-zone queries so consumers pay only for the facts they need.
- Hard zones derive from continuous absolute-coordinate conditions. Chunks and
  terrain vertices never define zone boundaries.
- Physical surface settings and zone thresholds live separately; neither owns
  colors or other visual properties.
- Terrain queries only solid ground height and owns its material. Future
  render modules own their colors and consume surface or zone facts directly.
- Concrete content modules never import concrete sibling modules.

### Layered Landscape Modules

- World Surface is the shared read-only source for physical and zone facts.
- Chunk windows assign finite areas but never decide what content belongs there.
- Each landscape module owns its deterministic placement rules, authored
  parameters, fixed resources, presentation, and complete lifecycle.
- Every wind-reactive component imports the immutable `WORLD_WIND` configuration
  from `src/world/wind.ts`; components do not define separate wind values.
- Rivers consume the existing river path and water facts instead of generating
  a parallel river model.
- Vegetation, Grass, and Rocks remain separate because their density, geometry,
  animation, and performance profiles differ.
- Animals consume shared world facts rather than concrete landscape modules.
- Shared placement infrastructure is introduced only after at least two
  implemented consumers demonstrate the same operation and contract.

### Any Module Shader May Be a Material-Effect Target

Decided 2026-08-30, when Grass rejoined the narrative levels.

- A sense effect targets the three.js chunk anchors `<common>`,
  `<project_vertex>`, and `<color_fragment>` — not a material class. A module
  that writes its own `ShaderMaterial` opts into every sense by carrying those
  anchors in its GLSL and handing `<project_vertex>` a `transformed` position;
  `applyShaderPatch` then decorates it exactly as it decorates a built-in
  pass, including the shared uniform objects that a future intensity driver
  will reach every consumer through.
- The alternative was rejected: a module must not import a sibling sense's
  GLSL and paste the response into its own shader. The composition root stays
  the only place that knows which sense decorates which surface.
- A module with no per-instance transform reuses the nearest existing
  consumer variant rather than gaining its own. Grass takes the Vegetation
  heat variant — same band, same warmth, same uniforms — because it is the
  same living plant matter as the bushes it grows between. A new variant needs
  a measured visual reason, not a structural difference.
- Modules keep their own base color. It is what shows below full sense
  intensity, so it is authored from the same palette the sense ramps through.

### Grass Carries Its Own Range

Decided 2026-08-30, applying the 2026-08-24 audit's P1 finding.

- Grass sets its visible range as a module constant (64 metres) instead of
  deriving it from the level view distance, bounded by `camera.far` so a
  nearer-seeing level still wins. The resident window is 5 x 5 chunks and
  304,200 triangles instead of 9 x 9 and 985,608.
- Range and preload are the first lever, density the last: the authored zone
  densities are unchanged, and the preload ring stays so recycled chunks fill
  in before they are seen.
- A per-module range is not yet a general contract. Terrain, Vegetation, and
  Rocks still follow the level view distance; each further split needs its own
  measured need, as the audit records.

### Independent Grass and Composable Magnetic Stripes

- Grass owns one fixed streamed instance field and consumes only World Surface
  height and hard-zone facts. Magnetic Sense never imports or recolors Grass,
  and Grass imports no sense module in return.
- Magnetic Sense renders analytical ground lines through Terrain's existing
  material pass. Terrain remains the geometry and material lifecycle owner.
- Magnetic Sense is a material effect, not a ground presentation. It preserves
  the selected Terrain base color outside its stripes, so Zone Visualizer and
  future ground presentations remain independently selectable.
- Magnetic base lines blend at 20% opacity. Narrow bright pulses remain clipped
  inside those line boundaries in the same opaque material pass. Physical
  lights, transparent overlays, bloom, and additional terrain geometry remain
  outside the MVP.
- Since level 06, line, pulse, and sky glow colors are preset-authored like
  every other sense palette, and `magnetic` is a top-level `LevelPreset`
  field beside `echoDepth`, `motion`, and `thermal`.

### Magnetic Sky Cue and Contract Promotion (2026-08-31)

- One `createMagneticSense` call returns both consumers as
  `{ terrain, sky }`. The field-direction and intensity uniform objects are
  created once and shared by identity, so a future dramaturgy driver steers
  the whole sense through single values.
- The sky cue is an analytic opaque dome instead of a transparent overlay or
  bloom: a back-side sphere with `depthWrite` off and `renderOrder` −1 draws
  first, every later opaque fragment paints over it, and the intensity fade
  mixes the glow back into the level haze inside the fragment shader. One
  added draw call, no extra render pass.
- The dome follows the full camera position each frame; the world uses
  absolute coordinates (no floating origin), so no shift compensation
  exists or is needed.
- The sky glow centres on the same `+fieldDirection` the ground pulses
  travel toward, so the near field and the far cue always agree.
- The composition root skips the sense entirely at intensity zero, matching
  Echo Depth, Motion, and Thermal.

### Module-Owned Web Worker for Connection Topology (2026-08-31)

- The Connections web topology (kNN plus minimum spanning tree over up to
  512 nodes) is O(n²) and runs in the repository's first Web Worker instead
  of stream-queue steps. The Mycelium module owns the worker completely:
  created on `load`, terminated on `unload`, reached only through the typed
  transferable messages in `topology-messages.ts`. No global worker
  infrastructure, registry, or shared channel exists.
- The pure math lives worker-free in `network-topology.ts`, so Bun tests
  cover it directly; the worker entry only relays one request. Tests inject
  a synchronous fake through the narrow `TopologyPort` seam and never
  construct a real worker.
- Staleness is judged by an aggregate window generation the module owns
  (per-slot chunk revisions cannot version a graph spanning all slots);
  replies for an outdated generation are discarded, mirroring the
  chunk-window currentness rule. Anchor gathering stays on the main thread
  as bounded stream-queue steps, one 32-metre chunk per step, with the
  stream queue's same-key replacement as the regather debounce.
- The worker scope is typed locally in `topology.worker.ts`; the conflicting
  `WebWorker` TypeScript lib is not added beside `DOM`.
- Node anchors cross module boundaries only through the shared
  `ConnectionNodeSource` / `ConnectionActorSource` contracts in
  `src/modules/connection-nodes.ts`; providers replay their own
  deterministic placement math and never import Mycelium.

## Approved Navigation Boundary

### Input and Navigation

The next navigation refactor will keep this narrow flow:

```text
device adapter → normalized input → navigation state → world update
```

- Desktop and ICAROS adapters translate device data into one input contract.
- Navigation produces position, orientation, and velocity.
- Terrain queries, collisions, streaming, and content logic remain outside
  navigation.
- Runtime and world modules do not branch on the active input device.

A separate XR view-state contract remains undecided and should not be added as
part of this refactor.
