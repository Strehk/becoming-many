# Modules

This folder contains unloadable, feature-oriented world and experience
modules.

Resource-owning modules follow the shared synchronous MVP lifecycle `load`,
`activate`, `update`, `deactivate`, and `unload`. They own their resources,
expose narrow contracts, and must not import concrete sibling modules. A pure
diagnostic module may expose only a mapping when it has no resources or frame
work. The composition root in `levels/level-runtime.ts` creates only the
features enabled by the selected preset.

Loaded modules may submit small procedural jobs to the shared World Engine
stream queue. A module still owns the generated data and fixed resource pool;
the queue only limits when work runs. Level Runtime preloads configured GLTFs
before starting World Runtime. Future-level prefetch and distance priorities
remain future extensions; the queue implements only the current
Terrain-before-content dependency.

Terrain renders `WorldSurface` ground heights and owns its geometry plus the
selected presentation material. Grass owns a separate fixed instanced field and
uses World Surface only for deterministic root height and water exclusion.
Grass Clipmap is a second grass implementation beside it and the one the
narrative levels use from echolocation on: it places nothing on the CPU and
samples the same World Surface into a camera-following texture instead. It
carries the same chunk anchors, so the senses reach it unchanged. Retiring
the older module is a decision that still waits on a measurement.
Vegetation and Rocks own separate zone rules while sharing a compact multi-part
instancing mechanism. Animals own their cloned actors and bounded animation.

`zone-visualizer` is a test-only presentation input for Terrain. It classifies
interpolated continuous zone conditions in the fragment shader without
creating a second mesh, draw call, texture, or runtime lifecycle.

`magnetic-sense` is a self-contained world module. It owns one
camera-following opaque dome whose fragment shader grades the sky and
condenses a radical-pair shimmer at the magnetic poles — the previous
version's sky mode, ported and hardcoded. It decorates no other module's
material and does not import or recolor Grass.

`echo-depth` is a composable material effect and the first with
several consumers: the composition root creates one instance and applies it
to Terrain, Vegetation, and Rocks through the shared `UnlitMaterialEffect`
contract in `src/utils/asset-loader/material-effect.ts`. It replaces surface
color with the level-03 camera-distance ramp and never imports a sibling
module.

`motion-sense` owns the level-04 motion language: a bounded boid simulation
of persistent fly swarms, invisible circling bird flocks (perception-only
point actors), and one motion-trail ring buffer per actor printing their
movement. The CPU writes only the newest ring slot per frame; fading,
outward drift, and collapse derive GPU-only from one frame uniform. Each
actor feeds its ring through the module's `MotionPointSource` seam, where
further moving actors can join; the module never imports a sibling.

`thermal-perception` is the third composable material effect and the first
with per-consumer warmth sources: one shared radius-and-palette uniform set
decorates Terrain (a CPU-sampled per-vertex warmth attribute from elevation
and zone conditions), Vegetation and Rocks (a stable hashed per-instance
warmth), and Animals (one constant living-body warmth). The false-color
ramp exists only inside the authored viewer radius, measured as the
camera-space view distance, and feathers back into the carried base color.
All material effects patch through the shared
`src/utils/asset-loader/material-shader-patch.ts` helper; the composition
root orders thermal first so it wins the final surface color. The module
never imports a sibling.

`mycelium` owns the level-07 Connections sense: a pulsing web of instanced
cord ribbons and node glows (two fixed-pool transparent draw calls,
motion-trail precedent) alpha-blended over the unchanged carried world,
connecting deterministic world anchors inside a viewer-centred radius. Topology runs in the
repository's first module-owned Web Worker, off the frame path. Anchors
cross module boundaries only through the shared `ConnectionNodeSource` /
`ConnectionActorSource` contracts in `connection-nodes.ts` — the static
counterpart to motion-sense's `MotionPointSource` seam: vegetation and rocks
replay their deterministic placements, the scent module keeps the forest
clearing positions the finished web links, animals expose live visible-actor
positions, and the composition root wires the enabled providers. The module
never imports a sibling.

`scent-particles` consumes the same kind of seam for the opposite reason.
Scent belongs to the things that carry it, so `scent-sources.ts` names the
plant-family vocabulary and the live-actor shape: Vegetation replays its
placements as scent sources including which model stands where and how tall
it is, Animals report their visible bodies with their species, and the
composition root wires both. Neither module knows the other exists.

Landscape modules share only stable contracts: `WorldModule` for lifecycle,
`WorldSurface` for read-only facts, `WORLD_WIND` and `getWorldWind()` for the shared turning wind,
`ChunkAssignment` for finite spatial ownership, and `StreamJob` for bounded
preparation. Each concrete module keeps its own non-global parameters,
deterministic placement, fixed resource pool, rendering, and disposal. Concrete
sibling modules never import each other.
