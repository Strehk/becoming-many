# World Streaming

This document describes the current reusable streaming foundation and its five
implemented consumers: deterministic Air Particles, generated Terrain,
instanced Grass, Vegetation, and Rocks.

## Current Data Flow

```text
camera world position
  → spatial window assigns fixed slots
  → module creates small StreamJobs
  → StreamQueue advances valid jobs within its frame budget
  → module updates its owned buffer
  → world runtime renders once
```

The shared system coordinates space and time. Content remains inside the
module that owns its CPU and GPU resources.

## One Aligned Grid

The smallest shared chunk is 16 metres. Larger sizes double it:

```text
level 0:  16 m
level 1:  32 m
level 2:  64 m
level 3: 128 m
```

Every size therefore meets on the same world-grid lines. Modules choose a
level instead of inventing unrelated chunk dimensions.

## Fixed Spatial Windows

`ChunkWindow` keeps a finite X/Z square for surfaces. `VolumeChunkWindow`
keeps a finite X/Y/Z cube for volumetric content:

```text
chunks per side = radius × 2 + 1
surface slots   = chunks per side²
volume slots    = chunks per side³
```

The slot count is fixed when a window is created. Updates return an empty
shared result while the center remains inside the same chunk. After a boundary
crossing, a surface window reports only the incoming edge and a volume window
reports only the incoming square face.

Positive modulo maps both positive and negative world coordinates onto the
same finite slot pool. Each changed assignment contains:

- reusable slot index
- absolute chunk coordinates
- corresponding world-space origin
- monotonically increasing slot revision

The revision lets delayed work call `isCurrent()`. A stale job cannot publish
data after its slot has been reassigned.

## Bounded Stream Queue

The world runtime owns one `StreamQueue` and advances it once per frame before
rendering. Its current configuration is:

```text
budget:   0.5 ms per frame
capacity: 256 pending jobs
```

These are provisional implementation values, not measured PICO settings.

Every job provides:

- a stable resource key
- an optional numeric priority
- an `isCurrent()` guard
- one `runStep()` operation

Submitting a newer job with the same key replaces the older pending job. Each
job runs at most one step per queue update; unfinished jobs return to the end
of the queue. The deadline is checked between steps, so modules must keep each
step genuinely small. JavaScript work already in progress cannot be interrupted.

Lower priority numbers run first. Terrain uses the single foundational priority;
ordinary content keeps the default. This is dependency ordering, not a general
distance or quality scheduler.

## Air Particles Consumer

Air Particles use 64-metre chunk level 2 volumes. With the Test Level's current
180-metre view distance:

```text
visible radius:  ceil(180 / 64) = 3 chunks
preload ring:    1 chunk
resident radius: 4 chunks
resident window: 9 × 9 × 9 = 729 slots
```

Each slot derives 80 particle positions from its absolute X/Y/Z coordinates.
The deterministic hash recreates a volume when revisited, while neighboring
volumes do not expose a repeated pattern. All 58,320 candidates live inside
one fixed `THREE.Points` object with fixed position and visibility buffers.

When Terrain is active, Level Runtime passes the same
`WorldSurface.surfaceYAt(x, z)` query used by landscape consumers. A candidate
must remain at least 0.5 metres above that visible surface. Underground
candidates stay in their fixed ranges but the vertex shader moves them outside
clip space before rasterization. This preserves constant capacity without
concentrating rejected particles along the ground. White World omits the
surface query and keeps its complete volumetric field.

Initial loading fills the complete buffers before the first render. Crossing a
horizontal or vertical boundary queues only the incoming square face. Each
completed job rewrites one contiguous slot range and marks only that range for
GPU upload. No geometry, material, or typed array is allocated while moving.

One outer preload ring ensures a recycled slot is prepared before entering the
camera range. If the queue reaches its defensive capacity, this inexpensive
deterministic generation runs synchronously so the visible window cannot
develop a hole.

One shared time uniform drives a small vertex-shader drift with a distinct
phase per particle. Animation therefore adds no per-frame position-buffer
upload and keeps the consumer at one draw call.

## Terrain Consumer

Terrain uses chunk level 2: 64-metre chunks. The Test Level 180-metre view
distance produces a fixed radius of three and therefore a 7×7 pool of 49 mesh
slots. Each mesh has 32 segments per side, or 2,048 triangles.

The World Surface exists independently from chunks and exposes ground,
visible-surface, continuous-zone-condition, and hard-zone queries at absolute
X/Z coordinates. Neighboring terrain chunks sample the same border coordinates
and therefore receive identical values.

Terrain publishes only `groundY`, including the carved river bed. A level may
supply one base presentation plus material effects. Zone Visualizer adds a
continuous-condition `vec4`; Magnetic Sense uses existing world positions and
adds no vertex attribute. Its stripes preserve the Zone Visualizer color below
them. Both reuse the same meshes and draw calls. A future Rivers consumer can
query `surfaceYAt()` without recalculating the river path or modifying ground.

Initial chunks are filled before the terrain becomes visible. A recycled chunk
then uses one queue step per vertex row. Fixed staging arrays hold the new
heights until all 33 rows are ready; only then is the mesh moved and published.
A visible mesh is never partially regenerated. Assignment revisions reject
work that lost ownership of its slot.

Terrain jobs use the foundational stream priority. Their incoming edge is fully
published before Vegetation, Rocks, Grass, or particles continue ordinary queued
work, so content cannot appear without its recycled ground.

## Grass Consumer

Grass uses 64-metre surface chunks plus one preload ring. At the current view
distance its 9×9 window owns 81 contiguous ranges inside one
`InstancedBufferGeometry`. The test density creates 6,084 candidates per slot,
492,804 candidates total, and two triangles per candidate.

Each absolute grid cell produces a stable jittered root. Grass samples
`groundYAt()` and applies the level's density and height for each supported
hard zone: meadow and shrub slope. Water, either forest, and omitted zones have
no visible grass. Initial ranges are
filled before the first render; recycled ranges are written one row per queue
step and uploaded only after the complete replacement is ready. Grass reads
direction, strength, and speed from the shared `WORLD_WIND` configuration. Wind
remains shader-only and changes no instance buffer during ordinary frames.

## Supported Module Uses

The existing assignments support two module-local strategies:

1. **Repeat:** Build one local pattern and place it at each assigned origin.
   No current module needs this simplest strategy.
2. **Generate:** Derive new content from absolute chunk coordinates and write
   it into the assigned slot. Air Particles use a coordinate hash; Terrain
   samples continuous World Surface ground heights; Grass samples ground and
   hard-zone facts into one fixed instanced range. Vegetation and Rocks derive
   stable candidates and compact accepted model matrices by chunk slot.

Vegetation and Rocks discard an outgoing committed slot immediately when its
assignment changes. This prevents static objects from remaining visible after
Terrain has recycled the ground beneath them. The foundational queue priority
also prevents their replacement from appearing before the incoming Terrain slot
is complete.

The shared chunk system does not contain a mode switch. This keeps particle,
terrain, vegetation, and animal decisions out of permanent infrastructure.

## Generated-Content Rules

The Terrain consumer establishes these current rules:

- derive repeatable results from absolute world coordinates and a seed
- retain fixed resource capacity while slots move
- split generation into small queue steps
- preload outside the maximum visible range
- reject obsolete work through assignment revisions
- keep chunk boundaries invisible in the generated result

Candidate density, LOD, and asset instancing should be introduced only by
concrete measured consumers, not as a generic framework in advance.

Vegetation and Rocks use this spatial and temporal foundation while retaining
separate placement and resource ownership. Animals use absolute world facts but
keep a much smaller behavior-owned population. Rivers remains the next planned
surface consumer. See [Landscape Module Contracts](landscape-modules.md).

## Deferred Until Measured

- distance or time-to-arrival job priorities
- asynchronous module lifecycle and future-level asset prefetching
- Web Workers or worker pools
- relevance fields and nested density levels
- floating-origin shifts
- runtime adaptive quality
- general-purpose spatial registries or pooling frameworks
- transparent LOD crossfades

## Automated Coverage

The current tests verify:

- aligned chunk sizes and fixed slot counts
- initial assignments and edge-only recycling
- negative world coordinates
- revision invalidation
- queue capacity, key replacement, stale work, multi-frame jobs, and deadlines
- deterministic candidate grids and compact multi-part static populations
- one fixed Air Particles object, geometry, and typed arrays through recycling
- deterministic, non-identical Air Particles layouts in neighboring volumes
- vertical face recycling and revision invalidation
- exclusion of Air Particles below the sampled visible surface
- deterministic ground, river carving, water surfaces, and zone identities
- rolling high ground, deep valleys, calm lowlands, and gentle local relief
- a fixed view-dependent Terrain mesh pool and cooperative row completion through recycling
- identical heights along shared Terrain chunk borders
- identical zone conditions along shared Terrain chunk borders
- rejection of partially generated work after rapid slot reassignment
- solid-ground rendering below the separately exposed water surface
- deterministic Grass roots, forest exclusion, and zone-specific heights
- one fixed Grass mesh, partial recycled ranges, shader-only wind, and disposal
- visibility lifecycle, scene cleanup, and GPU resource disposal

Visual seam review, browser frame timing, long-flight memory stability, and
physical Windows-to-PICO PCVR performance remain runtime acceptance work.
