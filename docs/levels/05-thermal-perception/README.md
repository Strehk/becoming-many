# 05 — Thermal Perception

## Current Experience

Thermal Perception keeps the Motion world and adds animals plus a local
false-colour heat view. The heat effect follows the viewer inside a 35-metre
radius and feathers back to the carried surface colour over 12 metres. The cue
begins at 3:50.

Terrain, Vegetation, Rocks, Animals, and clipmap grass provide different warmth
inputs to one ordered material effect. The world outside the radius remains the
carried Echolocation/Motion presentation.

## Runtime Ownership

[`thermal.level.ts`](../../../src/levels/thermal.level.ts) is the source of truth
for the palette and surface parameters. Thermal Perception owns shared uniforms
and material-patch behavior; providers supply only their consumer-specific
warmth data through contracts.

## Current Risks

- Issue #32 owns measurement and reduction of the fragment-shader cost.
- Thermal plus narrative clipmap grass has no physical PICO acceptance.
- Material patch failure handling is tracked in issue #20.

Do not copy the extensive typed tunables into documentation; comments next to
the values explain their visual intent and measurement history.
