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
Vegetation and Rocks own separate zone rules while sharing a compact multi-part
instancing mechanism. Animals own their cloned actors and bounded animation.

`zone-visualizer` is a test-only presentation input for Terrain. It classifies
interpolated continuous zone conditions in the fragment shader without
creating a second mesh, draw call, texture, or runtime lifecycle.

`magnetic-sense` is a composable Terrain material effect. It overlays
world-space stripes and flowing light packets while preserving the selected
base ground color outside those stripes. It does not import or recolor Grass.

`echo-depth` is the second composable material effect and the first with
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

Landscape modules share only stable contracts: `WorldModule` for lifecycle,
`WorldSurface` for read-only facts, `WORLD_WIND` for the immutable global wind,
`ChunkAssignment` for finite spatial ownership, and `StreamJob` for bounded
preparation. Each concrete module keeps its own non-global parameters,
deterministic placement, fixed resource pool, rendering, and disposal. Concrete
sibling modules never import each other.
