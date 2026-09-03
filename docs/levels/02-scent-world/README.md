# 02 — Scent World

## Current Experience

Scent is the first coloured layer after White World. The rendered ground and
plants remain absent, but their deterministic World Surface and vegetation
placements still exist as source facts. Coloured signatures therefore appear
to radiate from a world the visitor cannot yet see.

White World Air Particles remain present. The visitor retains flight position,
and invisible ground continues to provide clearance.

## Runtime Ownership

[`scent.level.ts`](../../../src/levels/scent.level.ts) enables the shared air and
scent presets plus invisible ground and vegetation. Scent Particles owns one
bounded points system and consumes neutral source contracts supplied by
Vegetation and Animals through Level Runtime. It does not import those modules.

The narration cue begins at 1:22. Exact particle budgets, palettes, scatter,
lifetimes, and source mappings live in typed source settings rather than this
document.

## Current Risks

- Issue #26 tracks work that scales particle preparation to actual source
  volume.
- Issue #27 tracks duplicated scent-source contract shapes.
- Shared-wind behavior and physical PICO cost remain part of the project-wide
  performance and stability gates.
