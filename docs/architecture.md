# Architecture

This document describes the current workspace architecture. See
[Current Status](current-status.md) for the runnable result and verification
state. Product and system expansion belongs in the roadmap and specialized
planning documents.

## Principles

Implementation conventions are defined in the
[Engineering Standards](engineering-standards.md).

- Build the smallest measurable MVP.
- Keep one render loop and one composition root.
- Keep permanent engine mechanisms separate from unloadable content modules.
- Share data through small strict TypeScript contracts.
- Keep all authored configuration in typed TypeScript files (settings,
  presets, module definitions); no JSON, YAML, or environment configuration.
- Add abstractions only when a current feature requires them.
- Treat `src/` and `public/` as the canonical source and asset roots.

## Canonical Project Structure

```text
src/
├── main.ts
├── style.css
├── vite-env.d.ts
├── control/
│   └── desktop-controls.ts
├── world-surface/
│   ├── height-field.ts
│   ├── surface-settings.ts
│   ├── world-surface.ts
│   ├── zone-field.ts
│   └── zone-settings.ts
├── levels/
│   ├── level-runtime.ts
│   ├── designTest.level.ts
│   ├── echo.level.ts
│   ├── motion.level.ts
│   ├── scent.level.ts
│   ├── test.level.ts
│   ├── thermal.level.ts
│   └── white-world.level.ts
├── modules/
│   ├── air-particles/
│   ├── animals/
│   ├── atmosphere/
│   ├── echo-depth/
│   ├── grass/
│   ├── magnetic-sense/
│   ├── motion-sense/
│   ├── mycelium/
│   ├── paths/
│   ├── rivers/
│   ├── rocks/
│   ├── scent-particles/
│   ├── static-population.ts
│   ├── terrain/
│   ├── thermal-perception/
│   ├── zone-visualizer/
│   └── vegetation/
├── sound/
├── utils/
│   ├── asset-loader/
│   ├── sound-loader/
│   └── texture-loader/
└── world/
    ├── chunk-system.ts
    ├── chunk-candidates.ts
    ├── module-runtime.ts
    ├── stream-queue.ts
    ├── volume-chunk-window.ts
    ├── webxr-entry.ts
    ├── wind.ts
    ├── world-settings.ts
    └── world-runtime.ts

public/
├── animals/
├── audio/
├── rocks/
├── textures/
└── trees/

tests/
├── control/
│   └── flight-ground-clearance.test.ts
├── world-surface/
│   └── world-surface.test.ts
├── levels/
│   └── level-presets.test.ts
├── modules/
│   ├── air-particles.test.ts
│   ├── animals.test.ts
│   ├── echo-depth.test.ts
│   ├── grass.test.ts
│   ├── magnetic-sense.test.ts
│   ├── motion-sense.test.ts
│   ├── scent-particles.test.ts
│   ├── static-populations.test.ts
│   ├── terrain.test.ts
│   ├── thermal-perception.test.ts
│   └── zone-visualizer.test.ts
├── test-ui/
│   └── frame-metrics.test.ts
├── utils/
    └── asset-loader.test.ts
└── world/
    ├── chunk-system.test.ts
    ├── stream-queue.test.ts
    └── volume-chunk-window.test.ts
```

Air Particles, Animals, Grass, Rocks, Terrain, Vegetation, Magnetic Sense, and
Zone Visualizer contain runtime implementations. Zone Visualizer supplies
Terrain's optional base presentation; Magnetic Sense decorates that material.
Their integration and the remaining landscape contracts are defined in
[Landscape Module Contracts](landscape-modules.md).

## Composition and Frame Flow

`src/main.ts` is the minimal browser entry. It selects the Magnetic Field
Perception preset and
passes it to `level-runtime.ts`, the single composition root. The Level Runtime
interprets the preset, preloads only configured GLTF assets, starts the
permanent World Runtime, creates enabled modules, and connects controls.

```text
main.ts
  → select level data
  → start level runtime

level runtime
  → preload configured assets
  → start world runtime
  → apply level values
  → create and activate enabled modules
  → connect desktop controls

each frame
  → update desktop controls
  → update active modules
  → process bounded stream jobs
  → render once
```

Three.js owns the loop through `renderer.setAnimationLoop()`, so desktop and
WebXR rendering use the same frame path.

## Ownership

### `world-runtime.ts`

Owns the permanent Three.js scene, perspective camera, WebGL renderer, timer,
resize handling, module runtime, stream queue, WebXR entry, and animation loop.
It knows neither the selected level nor concrete content modules.

### `world-settings.ts`

Owns the permanent renderer and stream-queue tuning values used by the World
Runtime. Global MSAA is explicit here and remains disabled until physical PICO
measurement justifies enabling it.

### `webxr-entry.ts`

Enables `renderer.xr` and adds Three.js `VRButton`. The current session mode is
`immersive-vr`.

### `module-runtime.ts`

Tracks loaded modules as inactive or active and runs the synchronous lifecycle:

```text
load → activate → update → deactivate → unload
```

Concrete modules create and dispose their own resources. The runtime does not
know what a module renders.

### `chunk-system.ts`

Maps an unbounded X/Z grid onto a fixed number of reusable slots. It reports
absolute chunk coordinates, world origins, and assignment revisions. It does
not generate content or create Three.js resources.

### `stream-queue.ts`

Runs small cooperative jobs within a fixed per-frame deadline. It replaces
older pending work for the same key and rejects jobs whose assignment is no
longer current. One foundational priority lets Terrain complete before ordinary
content jobs. The queue still knows nothing about chunks or rendering.

### `wind.ts`

Defines the immutable `WORLD_WIND` direction, strength, and speed. Every
wind-reactive component imports this shared configuration instead of defining
component-local wind values. It creates no runtime resources or mutable state.

### `control/`

Desktop controls own pointer lock, keyboard state, and direct camera movement.
Input handling remains outside the World Engine.

### `levels/`

Level files export a named `level` constant satisfying the sparse
`LevelPreset` contract. They contain data only and create no runtime resources.
`level-runtime.ts` is the separate composition root that interprets one preset
and connects it to permanent and unloadable runtime parts.

### `world-surface/`

Defines deterministic physical surface facts without chunks, lifecycle,
camera, materials, or level state. `WorldSurface` exposes `groundYAt()`,
`surfaceYAt()`, `zoneConditionsAt()`, and `zoneAt()`. The hard `ZoneId` is
always derived from continuous river, water, slope, and forest-region values.
Terrain can therefore sample only ground height when no optional presentation
module needs zone conditions.

`surface-settings.ts` contains physical height and river values.
`zone-settings.ts` contains zone identities and thresholds. `height-field.ts`
calculates physical heights; `zone-field.ts` samples continuous conditions and
derives hard zones. Visual properties remain in consuming modules.

### `modules/`

Resource-owning modules are unloadable feature owners. Air Particles generate
deterministic positions per X/Y/Z volume inside fixed particle buffers and use
the shared surface-height query to hide underground candidates. Grass generates
deterministic roots with level-authored density and height per supported zone
inside one fixed instanced buffer. Terrain
renders World Surface ground through a fixed view-dependent mesh pool. Vegetation and Rocks
combine level-authored zone densities with module-owned assets, variants, seeds,
and placement rules. They share only the small static-candidate math and compact
multi-part GPU buffers.
Animals own a small animated population and habitat-constrained movement. Zone
Visualizer supplies diagnostic colors; Magnetic Sense overlays world-space
stripes in the same material pass and owns the camera-following sky-glow
dome. Visible water remains a separate Rivers
responsibility. Concrete sibling implementations do not import each other.

### `utils/asset-loader/`

`gltf-assets.ts` loads explicit ID/URL requests and deduplicates URLs within
each module's request set.
`static-model.ts` converts one named Mesh or Group into all of its instancing
parts while preserving authored transforms. `instanced-model-pool.ts` stores
fixed chunk-slot matrices and compacts accepted instances before GPU upload.
It is shared by Vegetation and Rocks because the identical low-level mechanism
is proven twice; zone and placement policy remain module-owned.

## Current Contracts

| Contract | Purpose |
| --- | --- |
| `LevelPreset` | Optional level presentation and module parameters |
| `TerrainPresentationPreset` | Optional Zone Visualizer base presentation |
| `TerrainPresentation` | Material plus optional sampled conditions and frame update |
| `TerrainMaterialEffect` | Effect that decorates and optionally updates the Terrain material, with an optional per-vertex warmth sampler |
| `WORLD_WIND` | Shared immutable wind direction, strength, and speed |
| `GrassPreset` | Level-authored density and blade height per supported grass zone |
| `MagneticSenseParameters` | Magnetic direction, line, pulse, opacity, flow, intensity, and palette values |
| `MagneticSenseEffects` | Terrain stripe effect and sky-dome module sharing one field uniform set |
| `ScentParticlesParameters` | Level-authored scent palette, per-chunk emitter density, pool size, and drift values |
| `MotionSenseParameters` | Level-authored motion intensity, swarm pool, appearance, and trail values |
| `MotionPointSource` | World-position stream a moving actor exposes for motion-trail printing |
| `ThermalPerceptionParameters` | Level-authored thermal intensity, viewer radius, feather, palette, and warmth values |
| `StaticPopulationPreset` | Level-authored instances per hectare for enabled land zones |
| `StaticPopulationDefinition` | Module-owned candidate grid, seed, assets, sizes, and zone variants |
| `AnimalsDefinition` | Module-owned species assets, habitats, movement, radius, and visibility budget |
| `GltfAssets` | Loaded GLTF sources keyed by explicit authored IDs |
| `WorldSurfaceSettings` | Physical height and river values |
| `ZoneSettings` | Zone identities and hard classification thresholds |
| `ZoneConditions` | Continuous river, water, slope, and region facts at one position |
| `WorldSurface` | Absolute X/Z queries for physical and zone facts |
| `WorldContext` | Scene, camera, renderer, lifecycle, and queue passed during setup |
| `WorldModule` | Shared synchronous module lifecycle |
| `ChunkAssignment` | Fixed slot, absolute chunk coordinate, origin, and revision |
| `VolumeChunkAssignment` | Fixed slot, absolute X/Y/Z volume, origin, and revision |
| `StreamJob` | Stable key, currentness check, and one bounded work step |
| `DesktopControls` | One per-frame desktop movement update |

## Architectural Boundaries

- `main.ts` knows only the selected level and `startLevel()`.
- `level-runtime.ts` is the only file that composes concrete modules and controls.
- The World Engine owns execution mechanisms, not experience content.
- Levels provide values; modules own resources and behavior.
- Shared contracts carry facts across ownership boundaries; module-specific
  generation and presentation remain inside the module.
- Chunk coordinates, work scheduling, and rendering remain separate concerns.
- No module starts a private render loop.
- No global event bus or generic service registry is present.
- Tests live outside `src/` and mirror the production ownership areas.
