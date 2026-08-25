<!--
Purpose: Record confirmed architecture decisions for Becoming Many.
Context: Separate durable decisions from sketches, proposals, and current status reporting.
Responsibility: Preserve constraints that guide implementation.
Boundary: The running architecture is documented in code-architecture.md.
-->

# Architecture Decisions

The [current architecture](code-architecture.md) describes what is implemented.
This file records decisions that constrain current and upcoming work.

## Applied Decisions

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

### Independent Grass and Composable Magnetic Stripes

- Grass owns one fixed streamed instance field and consumes only World Surface
  height and hard-zone facts. Magnetic Sense never imports or recolors Grass.
- Magnetic Sense renders analytical ground lines through Terrain's existing
  material pass. Terrain remains the geometry and material lifecycle owner.
- Magnetic Sense is a material effect, not a ground presentation. It preserves
  the selected Terrain base color outside its stripes, so Zone Visualizer and
  future ground presentations remain independently selectable.
- Magnetic base lines blend at 20% opacity. Narrow bright pulses remain clipped
  inside those line boundaries in the same opaque material pass. Physical
  lights, transparent overlays, bloom, and additional terrain geometry remain
  outside the MVP.

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
