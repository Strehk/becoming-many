# Air Particles

This module renders the sparse particles that make movement through the White
World visible.

The implementation has four deliberately small responsibilities:

- `air-particles-settings.ts` defines the level-authored contract and keeps the
  few internal streaming constants discoverable.
- `air-particles.ts` connects the effect to module lifecycle, the camera-facing
  volume window, and the shared stream queue.
- `air-particle-cloud.ts` owns deterministic particle positions, surface
  visibility, fixed Three.js buffers, partial GPU uploads, and disposal.
- `air-particle-material.ts` owns the Points material, GPU motion, and the
  optional circle shader variant.

This is a concrete separation between coordination and rendering data. There
is no additional manager, generic particle framework, or private render loop.

## Level parameters

One `AirParticlesParameters` contract groups the authored controls:

- `density.particlesPerChunk` sets the fixed particle capacity per resident
  volume slot.
- `appearance` sets color, size in metres, and optional shape. Omitting shape
  keeps the default square `PointsMaterial` fragment path.
- `motion` sets horizontal and vertical drift amplitudes in metres plus one
  shared speed multiplier.

Setting `appearance.shape` to `circle` selects a separate opaque fragment
shader variant. Three.js compiles that fragment work only for circle materials;
the default square path contains no shape branch or texture lookup.

## How the endless volume works

The module derives particle positions from absolute X/Y/Z chunk coordinates.
The result is deterministic: revisiting a volume returns the same particles,
while neighboring volumes do not reveal a copied pattern.

`VolumeChunkWindow` keeps one finite cube around the camera. Its 64-metre
chunks use the same aligned base grid as Terrain. The window radius follows the
level's camera range and adds one preload ring. Flying across a horizontal or
vertical boundary recycles only one square face of that cube.

The field continues forever, but memory does not grow while the player travels.
Each volume assignment reuses one fixed range in the particle buffers.

## Surface boundary

When a level activates Terrain, Level Runtime passes the shared
`WorldSurface.surfaceYAt(x, z)` query to Air Particles. Every generated
candidate is classified against that surface plus a 0.5-metre clearance.
Candidates below it stay in the fixed buffer but are moved outside clip space
by the vertex shader, so they create no fragments and are not pushed into an
artificial dense layer along the ground.

White World does not activate Terrain and therefore keeps an unrestricted air
volume without exposing an invisible landscape through particle placement.

## Why there is only one draw

A larger preparation window must not create one draw call per chunk. The
module therefore combines every chunk slot into one fixed-capacity
`THREE.Points` geometry and one material.

Each slot owns contiguous position and visibility ranges. When the player
crosses a volume boundary, only ranges on the recycled face receive new data.
Three.js marks those ranges for dynamic GPU upload; no geometry or material is
allocated during flight.

The Points object skips object-level frustum culling because its bounds move
with the recycled window. The level camera distance still clips individual
points, while one combined object keeps the rendering cost to one draw call.

## Streaming lifecycle

Initial slot positions are filled during `load`, before the first render.
Later face updates enter the shared stream queue. Their assignment revisions
prevent delayed work from updating a slot that has already moved elsewhere.

The module owns creation, visibility, buffer updates, and disposal through the
shared module lifecycle. It does not own camera movement, the render loop, or
the global frame-time budget.

## Material animation

Air Particles move only in the vertex shader. TypeScript advances one shared
time uniform; the shader derives a different phase from every particle's world
position. This preserves one draw call and avoids rewriting resident particle
positions every frame.
