# Landscape Modules

This document summarizes the current ownership boundaries for landscape
content. Detailed implementation belongs in each module README and source.

## Shared Direction

Stable world facts flow into modules; modules do not write back into them:

```text
WorldSurface + chunk assignments + StreamQueue + wind
→ module-owned placement/generation
→ module-owned rendering and disposal
```

Concrete modules never import siblings. When one module needs information from
another, a narrow neutral contract is defined and wired by Level Runtime.

## Current Modules

- **Terrain** renders deterministic World Surface height in recycled meshes and
  accepts ordered material effects.
- **Vegetation** and **Rocks** own separate definitions and placement rules over
  shared compact static-population machinery. Their remaining duplication is
  tracked in issue #41.
- **Grass Clipmap** is the narrative grass path from Echolocation onward. It
  uses fixed anchors, a shared instance buffer, GPU culling, and a sampled
  height texture.
- **Grass** is the older CPU-placement implementation used by diagnostics. It
  remains until issue #13 chooses one owner from current measurements.
- **Animals** owns ten bounded cloned actors, visibility, movement, animation,
  and the live source contracts used by senses.
- **Air Particles** and **Scent Particles** own fixed points buffers and
  recyclable slots.
- **Motion Sense** owns its bounded point actors and trail rings.
- **Connections/Mycelium** owns topology generation, render pools, and the
  consumer side of neutral connection-anchor contracts.

## Cross-Module Contracts

- `WorldSurface` exposes read-only ground and zone queries.
- `WorldModule` defines load/activate/update/deactivate/unload lifecycle.
- `ChunkAssignment` and `StreamJob` carry bounded spatial and scheduling work.
- `UnlitMaterialEffect` applies composable shader effects without importing the
  effect owner.
- scent, motion, animal-body, and connection-node source contracts expose only
  the data a consumer needs.

Provider-specific placement, rendering, and settings stay inside the provider.
The composition root assembles lists of enabled providers.

## Reserved Extension Boundaries

`src/modules/atmosphere`, `src/modules/paths`, and `src/modules/rivers` currently
contain README files only. They reserve clear ownership for possible small
future additions but claim no runtime behavior. Any implementation requires a
concrete issue and must reuse the existing surface, streaming, lifecycle, and
performance contracts before introducing a new system.

## Acceptance

Every module change must retain bounded capacity, deterministic world placement
where applicable, explicit lifecycle/disposal, no sibling imports, and focused
contract tests. Performance-sensitive changes also require comparable benchmark
evidence and eventual physical PICO validation.
