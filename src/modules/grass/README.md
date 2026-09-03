# Grass

This module contains the dedicated grass layer, including bounded grass
distribution, rendering resources, and grass movement.

It consumes World Surface facts and owns its grass resources. Trees, bushes,
and other vegetation remain in the vegetation module unless a later measured
boundary justifies moving them.

## Current Behavior

- One 64-metre `ChunkWindow` keeps a fixed camera-centred pool plus one preload
  ring. Its radius comes from the module's own 64-metre range, not the level
  view distance, so a far-seeing level cannot widen the grass window; a level
  that sees less far still bounds it.
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
- The shaders carry the three.js chunk anchors `<common>`, `<project_vertex>`,
  and `<color_fragment>`. That is the whole material-effect hook: a sense
  patches this `ShaderMaterial` through `applyShaderPatch` exactly as it
  patches a built-in pass. The vertex stage hands its world-space tuft
  placement to `<project_vertex>` as `transformed`, which yields the
  `mvPosition` every effect measures against.

Grass does not query Vegetation or Rivers, and it imports no sense module. The
composition root decides which effects decorate the grass material: Echo Depth
and the Vegetation variant of Thermal Perception, because grass is the same
living plant matter as the bushes it grows between. Only the `test` and
`design-test` presets author grass at present and neither authors a sense, so
that material-effect combination is currently covered by tests rather than an
authored preset. Grass imports the immutable
`WORLD_WIND` configuration from `src/world/wind.ts`, as every wind-reactive
component must.
