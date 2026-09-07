# World Surface

This folder defines deterministic physical facts at absolute world coordinates.
It supplies ground/surface height, continuous zone conditions and influences,
and hard habitat membership from the same conditions. It has no
camera, chunks, lifecycle, materials, colors, or Three.js resources.

`world-surface.ts` is the only public runtime boundary:

```text
groundYAt(x, z)  → solid ground, including a carved river bed
surfaceYAt(x, z) → ground or the water surface above it
zoneConditionsAt(x, z) → continuous river, water, slope, and region facts
zoneAt(x, z)           → hard ZoneId for habitats and diagnostics
zoneInfluencesAt(x, z) → continuous land-zone weights; all zero under water
```

`height-field.ts` owns terrain and river calculations. `zone-field.ts` samples
conditions, hard classification and continuous influences in the same priority.
`surface-settings.ts` contains physical shape values; `zone-settings.ts`
contains zone identities, thresholds and shared transition widths.

Zones do not belong to chunks or terrain vertices. Every consumer evaluates
the same absolute world coordinates. Grass derives coverage and static models
derive density/variant probabilities from the same influences. Animal habitats
and diagnostic Terrain retain the hard classification. Content values remain
with their modules; World Surface does not decide which plants exist.

Render modules decide how these facts look. Terrain, rivers, vegetation, and
other modules must not add competing world-shape or zone-placement rules.
