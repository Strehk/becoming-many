# Thermal Perception

This module contains the Level 05 thermal response as a composable unlit
material effect family.

The effect shows heat directly as a false-color ramp, but only inside an
authored radius around the viewer: the vertex stage writes the camera-space
radial distance (rotation-invariant, exactly like Echo Depth, so no camera
position uniform or per-frame update exists), and the fragment stage feathers
the six-stop palette ramp back into the underlying carried color at the radius
edge. The warmth value 0..1 comes from a different source per consumer:
Terrain samples elevation plus zone conditions on the CPU into a per-vertex
`thermalWarmth` attribute during row streaming (water reads cold and colder
with depth; dry ground warms with elevation, forest, and slope); Vegetation
and Rocks hash their quantized instance world position into a stable
variation around an authored base warmth, so a plant keeps its temperature
across restreaming; Animals carry one constant near-hot warmth because being
alive means giving off heat. Grass has no material-effect hook (raw shader)
and is excluded, as it is from Echo Depth.

One shared uniform set (intensity, radius, feather, ramp stops, palette) is
merged into every patched program, so all consumers respond to one sense
intensity. The composition root applies the terrain variant through
`TerrainMaterialEffect` (whose optional `warmthAt` sampler triggers the
attribute) and the other variants through the shared `UnlitMaterialEffect`
contract; this module never imports a sibling module. All variants patch
through the shared `applyShaderPatch` helper — the composition root orders
thermal first in each effect list so it wins the final surface color over the
carried echo ramp (first-applied executes last; see
`src/utils/asset-loader/material-shader-patch.ts`).

Not part of this version: a runtime intensity driver (the preset authors
intensity statically and the composition root skips the effect entirely at
intensity zero), temporal heat variation or heat trails (the field is fully
static), and any additional thermal camera or duplicate render pass.
