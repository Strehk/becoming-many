<!--
Purpose: Define the implementation boundary for current and next landscape modules.
Context: Terrain, Zone Visualizer, and Grass established deterministic surface queries and bounded streaming.
Responsibility: Keep consistent contracts for Rivers, Vegetation, Grass, Rocks, and Animals.
Boundary: Implemented behavior is explicit; remaining sections describe planned integration.
-->

# Landscape Module Contracts

Terrain, Air Particles, Grass, Vegetation, Rocks, Animals, Zone Visualizer, and
Magnetic Sense have runtime implementations today. The module guidance below
records their shared boundaries and the remaining Rivers integration.

## One Direction of Dependency

Landscape information flows from stable facts into module-owned presentation:

```text
surface settings + zone settings
              ↓
         WorldSurface
              ↓
  height and zone queries at absolute X/Z coordinates
              ↓
     module-local placement or geometry
              ↓
 fixed CPU/GPU pool owned by the concrete module
              ↓
       shared Three.js render loop
```

Modules never write back into World Surface and never import concrete sibling
modules. Level Runtime creates them and passes only the contracts they need.

## Shared Contracts

Landscape modules reuse these existing boundaries:

| Contract | Module use |
| --- | --- |
| `LevelPreset` | Enables a module and provides its sparse authored parameters. |
| `WorldModule` | Provides `load`, `activate`, `update`, `deactivate`, and `unload`. |
| `WorldSurface` | Provides deterministic physical and zone facts at absolute world coordinates. |
| `ChunkAssignment` | Assigns one absolute X/Z area to one reusable module-owned slot. |
| `StreamJob` | Splits preparation into bounded, replaceable, revision-safe work steps. |

`WorldSurface` remains the only shared landscape query boundary:

- `groundYAt(x, z)` places content on solid ground.
- `surfaceYAt(x, z)` includes visible water and supports above-surface movement.
- `zoneConditionsAt(x, z)` provides continuous river, water, slope, and region
  values for density or rendering decisions.
- `zoneAt(x, z)` provides one hard `ZoneId` when an MVP only needs inclusion or
  exclusion.

A new shared query should be added only when a concrete module cannot express
its requirement through these facts. A consumer-specific setting or placement
rule does not belong in World Surface.

## Common Module Shape

Each streamed landscape module should follow the same implementation sequence:

1. Keep level-authored appearance or density in a small preset. Keep stable
   content identity, seed, candidate capacity, and asset variants in the
   concrete module definition.
2. Receive dependencies through one explicit options object.
3. Derive deterministic content from absolute coordinates and that module-owned
   seed.
4. Use chunks only to decide what finite area must be resident.
5. Keep one fixed resource pool attached to reusable slots.
6. Split expensive preparation into small `StreamJob` steps.
7. Commit a slot only after its complete replacement is ready, then combine
   completed slots into at most one module upload per frame.
8. Dispose every owned Three.js and event resource during `unload()`.

Vegetation and Rocks proved two small reusable operations: deterministic
acceptance and weighted model selection for a level-authored zone density, plus
compacting multi-part model matrices into fixed `InstancedMesh` buffers.
Transforms and zone interpretation stay in each concrete module. Do not
introduce a biome manager, entity-component system, generic population runtime,
or cross-module event bus for these MVPs.

## Module Boundaries

### Rivers

Rivers should be the visual consumer of river facts already calculated by
World Surface.

- Consume `groundYAt()`, `surfaceYAt()`, and continuous river conditions.
- Own visible water geometry, material, animation, chunk slots, and disposal.
- Reuse the existing river path and carved bed; never calculate a second path.
- Keep water separate from Terrain so each material and lifecycle stays clear.
- Start with one bounded, opaque, unlit water representation. Add transparency,
  reflections, or flow textures only after PICO measurement allows them.

### Vegetation

Vegetation owns trees and bushes, but not grass. Its MVP is implemented.

- Consume ground height and hard zone identities for deterministic placement.
- Own loaded tree and shrub assets, instance transforms, materials, capacities,
  culling, and disposal.
- Use a fixed compact `InstancedMesh` pool per required model part.
- Derive candidates from absolute coordinates so revisiting a chunk recreates
  the same plants and shared borders cannot produce duplicates.
- Let the level author instances per hectare by zone. Keep asset identity,
  species weights, candidate capacity, seed, scale, and footprint rules inside
  Vegetation.
- Add GPU wind only after static placement and target-device cost are verified;
  when added, consume `WORLD_WIND` from `src/world/wind.ts`.

### Grass

Grass is implemented separately because its instance count, rendering, and
animation costs are fundamentally different from trees and bushes.

- It consumes ground height and hard zones. The level authors density and blade
  height independently for meadow and shrub-slope zones. Missing zones, water,
  and both forest zones receive none.
- It owns blade geometry, instance data, material, wind animation, capacity,
  visibility, and disposal.
- It consumes the shared `WORLD_WIND` configuration instead of defining local
  direction, strength, or speed values.
- One fixed instanced representation replaces individual Three.js objects.
- Slot changes rewrite instance data; normal frames update only wind time.
- Its range is a module constant, so the level view distance sets the reach of
  Terrain, Vegetation, and Rocks but not of Grass.
- Its shaders carry the three.js chunk anchors, so senses decorate the grass
  material through the shared patch contract. Grass imports no sense module;
  the composition root chooses its effects.

### Rocks

Rocks implement the deterministic placement pattern while retaining their own
authored distribution and asset variants.

- Consume ground height and hard zone identities for placement and water exclusion.
- Own validated rock assets, instance transforms, materials, capacities, and disposal.
- Use fixed instancing for repeated variants and stable absolute-coordinate seeds.
- Let the level author rock instances per hectare by zone. Keep asset variants,
  candidate capacity, seed, scale, and transform rules inside Rocks.
- Avoid runtime mesh simplification; prepare and validate mobile-sized assets offline.

### Animals

Animals remain independent because animation and behavior have different
lifecycle and frame-time requirements from static landscape instances. The MVP
uses an authored count per configured species and a nearest-visible budget.

- Consume surface height and zones for spawn and movement constraints.
- Own models, animation mixers, bounded behavior state, activation distance,
  spatial audio attachments, and disposal.
- Start with a small fixed population and activate expensive animation only near
  the player.
- Divide the bounded player area into deterministic territories, select the
  nearest species-compatible habitat, and keep transient behavior module-owned.
- Derive visible actor orientation from nearby `surfaceYAt()` samples so body
  tilt follows the ground without coupling Animals to Terrain geometry.
- Do not query Vegetation, Grass, Rocks, or Rivers directly. If animals later
  need habitat information, extend a shared render-free world contract first.

## Remaining Implementation Order

1. **Rivers:** complete the existing physical surface with visible water.
2. **Terrain textures:** consume zone conditions without replacing World
   Surface or the fixed Terrain mesh pool.
3. **PICO validation:** measure the combined landscape before adding LOD, wind,
   more actors, or denser assets.

## Acceptance for Every Module

Before starting the next module, verify that the current one:

- produces identical content when an absolute chunk is revisited
- has no visible discontinuity or duplicate ownership at chunk borders
- keeps CPU and GPU capacity bounded during a long flight
- rejects obsolete work through assignment revisions
- creates no private render loop and performs no unbounded per-frame allocation
- unloads without retained scene objects or undisposed GPU resources
- passes focused contract tests, strict TypeScript, Biome, build, and Fallow
- records browser evidence and a physical PICO result before performance approval
