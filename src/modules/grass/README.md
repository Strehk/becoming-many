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
- Capacity scales linearly with the largest authored density, and the single
  mesh sets `frustumCulled = false`, so every slot in the window is submitted
  every frame whatever the camera faces. Rejected candidates still cost a vertex
  invocation before the cull discards them.
- Grass keeps its own reach rather than following the level view distance, and
  uses 32-metre chunks so the window hugs the camera. Thin blades alias into
  shimmer long before the horizon, so streaming them that far buys nothing and
  costs everything. At the current 64-metre reach the window is 49 chunks and 14
  tufts per square metre is about 0.7 million tufts, 1.4 million triangles, and
  an 11 MB instance buffer. Following a 128-metre view distance with 64-metre
  chunks instead cost 1.2 million tufts and 19 MB at less than half the density.
- This clears a desktop GPU comfortably and still does not fit a PICO 4 frame;
  grass needs distance culling or an LOD before that target is measured.
- One `InstancedBufferGeometry` contains two crossed triangles per tuft and one
  compact `vec4` per candidate. The fourth value carries deterministic
  variation and the meadow or shrub-slope height class.
- A tuft's base width is a fixed fraction of its own height, so blade slimness
  is module code and not level configuration: raising the authored height alone
  makes a tuft proportionally wider, never slimmer. The triangles taper to a
  point with no tip width and no curve along their length, so a tuft reads as a
  spike; giving it a blade silhouette would mean replacing the triangle with a
  tapered, curved quad.
- The authored blade height is the tallest tuft, not the average: the shader
  scales each one by a deterministic 0.4..1.0 factor.
- Recycled chunks rewrite one contiguous instance range through cooperative row
  jobs. Ordinary frames update only the wind-time uniform.
- The module owns its geometry, typed buffer, material, animation, capacity,
  visibility, and disposal.

## Sense hook

Grass owns hand-written shaders rather than a three.js material, but it carries
the shared injection anchors (`common`, `project_vertex`, `color_fragment`), so
a material effect decorates it exactly as it decorates Vegetation or Animals.
Two extras make that work: the material declares the conventional `diffuse`
uniform holding the tuft's representative tone, and the vertex stage publishes
`grassBladeProgress` and `grassSway` at the injection point so a sense can read
where it is on the blade and how hard it is currently leaning without learning
anything about wind. Rejected candidates are culled branchlessly at the end
rather than by an early return, because an early return would skip an injected
call and leave its varyings unwritten.

Grass does not query Vegetation or Rivers. It imports the immutable `WORLD_WIND`
configuration from `src/world/wind.ts`, as every wind-reactive component must.
