# Echo Depth

This module contains the Level 03 echolocation response as a composable
unlit material effect.

The effect shows the result of echolocation directly through
distance-dependent visibility; individual visible echo waves are explicitly
excluded (see `docs/levels/README.md` §03). It patches its consumers'
existing `MeshBasicMaterial` passes: the vertex stage writes the camera-space
radial distance (rotation-invariant, so nothing swims during headset turns),
and the fragment stage maps that distance onto the authored five-stop palette
ramp. Every surface shows only its depth-ramp color — there are no proximity
accents, rims, or highlights, so approaching geometry darkens toward the near
color instead of lighting up. One uniform set is shared by every patched
program, so all consumers respond to one sense intensity. The composition
root applies the same effect instance to Terrain (through
`TerrainMaterialEffect`) and to Vegetation and Rocks (through the shared
`UnlitMaterialEffect` contract); this module never imports a sibling module.

Not part of this version: a runtime intensity driver (blocked on the open
runtime-coordination decision — the preset authors intensity statically, and
the composition root skips the effect entirely at intensity zero so its GPU
work is skipped), an audio counterpart, and any post-processing pass. A cyan
rim accent on near forms was implemented and removed on 2026-08-25 because
near geometry must keep the pure depth color.
