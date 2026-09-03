<!--
Purpose: Document the current Magnetic Sense module.
Context: Level 06 layers one directional sky signal over the carried world.
Responsibility: Explain the dome, runtime drivers, cost boundary, and ownership.
Boundary: The module patches no sibling material and creates no render pass.
-->

# Magnetic Sense

This module contains the magnetic-field perception (level 06). The whole
sense lives on one camera-following sky dome: `createMagneticSense`
validates the preset, derives the field axis and the noise drift, creates
the shared axis, intensity, horizon, and time uniforms, and returns the
dome module (`magnetic-sky.ts`) beside two runtime drivers. `setIntensity`
fades the whole sense — shimmer and iridescence together — and
`setSkyBackground` keeps the opaque dome's horizon on the live background
while a show lerps the clear color between world states, so the sky never
splits from the fogged distance.

The authored dome values live in `magnetic-sense-settings.ts`; field axis,
elevation, intensity, and palette come from the level preset. There is no mode
registry or module-specific UI.

What the shader draws: a pale sky graded from the carried level haze at
the horizon to a light blue zenith, and a grainy radical-pair pattern that
condenses into a tight patch at the magnetic north point, with a mirrored
one at the southern counter-pole. The grain drifts on a fixed heading,
breathes slowly, and carries an iridescent overlay inside the pole zones.
Between the poles the sky stays quiet, because the ported pattern strength
away from the poles is zero.

That quiet ring is also what keeps the sense affordable. The pattern comes
from four octaves of value noise — the most expensive fragment work in the
frame — so the shader takes one coherent early-out and skips the noise
wherever the pole zone cannot reach a displayable value. The branch is
deliberate and spatially coherent, unlike the per-pixel branching the
performance rules warn about; the noise loop itself is unrolled.

The shader uses `#include <colorspace_fragment>` so its output follows the
renderer color-space conversion like other world materials.

The dome is one opaque back-side sphere (120 m radius, 32×16 segments)
with `depthWrite` off and `renderOrder` −1: it draws first and every later
opaque fragment paints over it. One draw call, no transparency, no extra
render pass.

The pole palette and field axis are preset-authored; every shape and motion
value is module-owned. Level Runtime adds the sense as a world module and
nothing else. It patches no material and reaches neither Terrain nor Grass.
