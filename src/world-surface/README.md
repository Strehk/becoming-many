# World Surface

This folder defines deterministic physical facts at absolute world coordinates.
It answers four questions: ground height, visible surface height, continuous
zone conditions, and the hard zone derived from those conditions. It has no
camera, chunks, lifecycle, materials, colors, or Three.js resources.

`world-surface.ts` is the only public runtime boundary:

```text
groundYAt(x, z)  → solid ground, including a carved river bed
surfaceYAt(x, z) → ground or the water surface above it
zoneConditionsAt(x, z) → continuous river, water, slope, and region facts
zoneAt(x, z)           → hard ZoneId derived from those same conditions
```

`height-field.ts` owns terrain and river calculations. `zone-field.ts` samples
continuous conditions and applies the hard classification priority.
`surface-settings.ts` contains physical shape values; `zone-settings.ts`
contains zone identities and thresholds.

Zones do not belong to chunks or terrain vertices. Every consumer evaluates
the same absolute world coordinates. A renderer may interpolate conditions
between vertices, while an asset module may classify each candidate position
directly through `zoneAt()`.

Render modules decide how these facts look. Terrain, rivers, vegetation, and
other modules must not add competing world-shape or zone-placement rules.
