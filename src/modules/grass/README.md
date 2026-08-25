# Grass

This module contains the dedicated grass layer, including bounded grass
distribution, rendering resources, and grass movement.

It consumes World Surface facts and owns its grass resources. Trees, bushes,
and other vegetation remain in the vegetation module unless a later measured
boundary justifies moving them.

## Implemented MVP

- One 64-metre `ChunkWindow` keeps a fixed camera-centred pool plus one preload
  ring.
- Absolute grid cells create deterministic roots. `groundYAt()` supplies their
  ground position. The level can set density and blade height independently for
  meadow and shrub-slope zones. Omitting a zone creates no grass there; water
  and both forest zones are never grass zones.
- The largest configured density defines the fixed candidate capacity. Lower
  zone densities deterministically reject candidates without reallocating the
  GPU buffer.
- One `InstancedBufferGeometry` contains two crossed triangles per tuft and one
  compact `vec4` per candidate. The fourth value carries deterministic
  variation and the meadow or shrub-slope height class.
- Recycled chunks rewrite one contiguous instance range through cooperative row
  jobs. Ordinary frames update only the wind-time uniform.
- The module owns its geometry, typed buffer, material, animation, capacity,
  visibility, and disposal.

Grass does not query Vegetation or Rivers. It imports the immutable `WORLD_WIND`
configuration from `src/world/wind.ts`, as every wind-reactive component must.
