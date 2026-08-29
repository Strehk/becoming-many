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
program, so all consumers respond to one sense intensity. `createEchoDepth`
returns two variants of that one ramp — `terrain` and `surfaces` — and the
composition root gives the first to Terrain (through `TerrainMaterialEffect`)
and the second to Vegetation, Rocks, and Grass (through the shared
`UnlitMaterialEffect` contract); this module never imports a sibling module.

The water exception is the one thing that separates the two variants. A level
may author `waterColor`, and where the river holds water Terrain then shows
that tone instead of its depth color. It is not a flat print over the ramp:
the water tone fades into the haze across the same last ramp segment as every
other surface, so a distant river dissolves into the fog rather than staying a
saturated thread at the horizon. Terrain alone can carry it — nothing else in
the world has a river running across it — so the `terrain` variant declares
`needsSurfaceWater`, reads the streamed per-vertex measure, and tests the sign
of its interpolated value with one `step` rather than a branch. Without an
authored color both variants compile the identical program, no attribute is
streamed, and levels that want the river as the carved shape the ramp already
draws pay nothing.

Where water is stays with World Surface, which owns the shoreline. This module
only asks for the measure and decides what color it paints there.

Not part of this version: a runtime intensity driver (blocked on the open
runtime-coordination decision — the preset authors intensity statically, and
the composition root skips the effect entirely at intensity zero so its GPU
work is skipped), an audio counterpart, and any post-processing pass. A cyan
rim accent on near forms was implemented and removed on 2026-08-25 because
near geometry must keep the pure depth color.
