# 06 — Magnetic Field Perception

## Current Experience

Magnetic Perception begins at 4:39 and layers a directional sky signal over the
carried Thermal world. A camera-following opaque dome grades the sky and forms
shimmering concentrations at the magnetic poles.

The current effect is sky-only. It does not draw ground field lines and does not
patch Terrain, Grass, or any sibling material.

## Runtime Ownership

[`magnetic.level.ts`](../../../src/levels/magnetic.level.ts) authors field
direction, elevation, strength, and palette. Magnetic Sense owns the dome,
shader resources, update, and disposal. The effect uses one draw call and no
secondary render pass.

## Current Risks

The current dome requires physical headset measurement as part of the complete
show. Any ground counterpart would be a new product feature, not restoration of
current behavior, and requires its own issue and performance budget.
