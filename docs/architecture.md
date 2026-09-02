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
├── benchmark/
│   ├── benchmark-report.ts
│   ├── benchmark-route.ts
│   ├── benchmark-run.ts
│   └── benchmark-settings.ts
├── conductor/
│   ├── conductor-keys.ts
│   ├── conductor-main.ts
│   ├── conductor-page.ts
│   ├── conductor-settings.ts
│   ├── conductor-state.ts
│   ├── cue-inspector.ts
│   ├── m5-panel.ts
│   ├── panel-buttons.ts
│   ├── show-actions.ts
│   ├── show-timeline.ts
│   ├── stage-panel.ts
│   ├── status-strip.ts
│   ├── stream-button.ts
│   ├── time-format.ts
│   └── transport-panel.ts
├── control/
│   ├── desktop-controls.ts
│   ├── flight-ground-clearance.ts
│   ├── flight-reset.ts
│   └── m5-flight.ts
├── dramaturgy/
│   ├── narration-catalog.ts
│   ├── narration-schedule.ts
│   ├── piece-schedule.ts
│   ├── schedule-layout.ts
│   └── show-clock.ts
├── flash/
│   ├── flash-main.ts
│   ├── flash-page.ts
│   ├── flash.css
│   └── serial-setup.ts
├── m5/
│   ├── auto-neutralize.ts
│   ├── control-frame.ts
│   ├── control-safety.ts
│   ├── control-smoothing.ts
│   ├── control-source.ts
│   ├── m5-adapter.ts
│   ├── m5-settings.ts
│   ├── protocol.ts
│   └── state-frames.ts
├── world-surface/
│   ├── height-field.ts
│   ├── surface-settings.ts
│   ├── world-surface.ts
│   ├── zone-field.ts
│   └── zone-settings.ts
├── levels/
│   ├── level-runtime.ts
│   ├── connections.level.ts
│   ├── designTest.level.ts
│   ├── echo.level.ts
│   ├── level-catalog.ts
│   ├── magnetic.level.ts
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
│   ├── grass-clipmap/
│   ├── magnetic-sense/
│   ├── motion-sense/
│   ├── mycelium/
│   ├── paths/
│   ├── rivers/
│   ├── rocks/
│   ├── scent-particles/
│   ├── scent-sources.ts
│   ├── static-population.ts
│   ├── terrain/
│   ├── thermal-perception/
│   ├── zone-visualizer/
│   └── vegetation/
├── sound/
│   ├── audio-timebase.ts
│   └── narration-player.ts
├── station/
│   ├── deployment-config.ts
│   └── station-settings.ts
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
    ├── vr-entry-button.ts
    ├── wind.ts
    ├── world-settings.ts
    ├── world-runtime.ts
    └── xr-session.ts

station/
├── m5-sim.ts
└── station-server.ts

firmware/
└── m5/
    ├── platformio.ini
    └── src/

public/
├── animals/
├── audio/
├── firmware/
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
│   ├── connection-nodes.test.ts
│   ├── echo-depth.test.ts
│   ├── grass-clipmap.test.ts
│   ├── grass.test.ts
│   ├── magnetic-sense.test.ts
│   ├── motion-sense.test.ts
│   ├── mycelium.test.ts
│   ├── scent-particles.test.ts
│   ├── static-populations.test.ts
│   ├── terrain.test.ts
│   ├── thermal-perception.test.ts
│   └── zone-visualizer.test.ts
├── benchmark/
│   ├── benchmark-report.test.ts
│   └── benchmark-route.test.ts
├── test-ui/
│   └── frame-metrics.test.ts
├── utils/
    └── asset-loader.test.ts
└── world/
    ├── chunk-system.test.ts
    ├── stream-queue.test.ts
    └── volume-chunk-window.test.ts
```

Air Particles, Animals, Grass, Rocks, Terrain, Vegetation, Magnetic Sense,
Mycelium, and Zone Visualizer contain runtime implementations. Zone Visualizer
supplies Terrain's optional base presentation; Magnetic Sense owns its own
sky dome and decorates no other material. Their integration and the remaining landscape
contracts are defined in
[Landscape Module Contracts](landscape-modules.md).

## Composition and Frame Flow

`src/main.ts` is the minimal browser entry. It selects the Connections
preset by default and
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
  → update desktop controls, or replay the benchmark route
  → update active modules
  → process bounded stream jobs
  → render once
```

Three.js owns the loop through `renderer.setAnimationLoop()`, so desktop and
WebXR rendering use the same frame path.

`main.ts` also reads two runtime requests from the URL. `?level=<name>` opens
any preset from `levels/level-catalog.ts`, and `?benchmark[=<profile>]` hands
the World Runtime a `FrameControl` that replaces the wall clock, drives the
camera along a fixed route, and records every finished frame. Both are runtime
requests, not authored configuration.

## Ownership

### `world-runtime.ts`

Owns the permanent Three.js scene, perspective camera, WebGL renderer, timer,
resize handling, module runtime, stream queue, WebXR entry, and animation loop.
It knows neither the selected level nor concrete content modules.

`FrameControl` is the optional measurement seam. When present it supplies the
fixed timestep, a virtual clock for the stream queue, and a callback that runs
after each render — the only point where `renderer.info` still describes the
frame that just finished. Absent, the loop behaves exactly as before.

### `world-settings.ts`

Owns the permanent renderer and stream-queue tuning values used by the World
Runtime. Global MSAA is explicit here and remains disabled until physical PICO
measurement justifies enabling it.

### `xr-session.ts` and `vr-entry-button.ts`

`xr-session.ts` enables `renderer.xr` and owns the `immersive-vr` session
lifecycle behind `XrSessionControl` — start, stop, and a subscription over
availability (re-checked on `devicechange`) and session state. It travels on
`RunningLevel.xr`. `vr-entry-button.ts` mounts the rehearsal page's plain
entry button on that contract; the conductor page mounts its Start/Stop
Stream button on the same one.

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

Defines the authored `WORLD_WIND` mean direction, strength, and speed, the
swing its direction wanders through, and the gust its strength breathes with.
`getWorldWind(seconds)` samples the wind at one moment as a pure function of
time, built from whole harmonics of one loop so the wrap is seamless. Every
wind-reactive component reads this shared source instead of defining
component-local wind values. It creates no runtime resources or mutable
state: consumers own their own wind clock.

### `dramaturgy/`

Owns show time. `show-clock.ts` derives it from an injected monotonic timebase
— never accumulated frame deltas — and provides play, pause, seek, and time
scale. `narration-schedule.ts` holds the baked schedule contract and the pure
`narrationCueAt` lookup; `piece-schedule.ts` is the authored data;
`narration-catalog.ts` names the recordings and their measured lengths;
`schedule-layout.ts` measures a schedule into cue slots, recording lengths, and
headroom, and is the one place that arithmetic lives.
No browser API, so all of it is under `bun test`.

### `sound/`

Owns how the piece is heard. `audio-timebase.ts` owns the one `AudioContext`
and supplies its `currentTime` as the show clock's timebase, resuming on the
first gesture. `narration-player.ts` holds one preloaded element per cue for
the session's language and follows the clock. It never decides when a cue
plays.

### `control/`

Desktop controls own pointer lock, keyboard state, and direct camera movement.
`flight-reset.ts` returns the flight to a level's start pose for the conductor;
like ground clearance, it has no effect inside an XR session, where Three.js
writes the camera pose from the headset every frame. Input handling remains
outside the World Engine.

### `station/` and `station/station-server.ts`

Owns the deployment-config contract, and nothing else: no show state, no
schedule. `deployment-config.ts` reads the facts a station server was started
with (`/config`, failing soft to `{}`); `station-settings.ts` holds the
server's default port for the server and the Vite proxy. The server is a Bun
process at the repository root, run by `bun run station`, serving `dist/`,
`/config`, and `/health`; it exports nothing and nothing bundles it.

### `conductor/`

Owns the station window at `conductor.html` — the page that hosts the show
in-process behind a small stage view, plus the show transport, the schedule
timeline and its scrub, the status strip, the stream and restart controls, and
the resets. It reads schedule data and never authors it, and holds no show
time of its own: every frame reads the show clock fresh. The world enters
through one contract — `startLevel`/`RunningLevel`, the level catalog, and the
XR session contract — never through `world/` internals or concrete
`modules/`.

### `levels/`

Level files export a named `level` constant satisfying the sparse
`LevelPreset` contract. They contain data only and create no runtime resources.
`level-runtime.ts` is the separate composition root that interprets one preset
and connects it to permanent and unloadable runtime parts.
`level-catalog.ts` names every preset so a run can select one at startup; it is
data only and holds the default the browser entry opens.

### `benchmark/`

Owns the replayed measurement mode and is inert unless the entry is opened
with `?benchmark`. It authors one camera route, substitutes the wall clock and
the stream-queue budget for frame-driven equivalents, and records
`renderer.info` after each render. Counters from a run repeat exactly; frame
times from it are measurements bound to one machine.

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
Visualizer supplies diagnostic colors; Magnetic Sense owns one
camera-following dome that carries the whole field — a graded sky with a
radical-pair shimmer condensing at the magnetic poles, in a single opaque
draw, ported from the previous version of the piece. Mycelium owns the Connections sense: two fixed-pool transparent web
draw calls blended over the unchanged carried world, and the repository's
first module-owned Web Worker,
which computes the O(n²) web topology off the frame path (created on load,
terminated on unload, stale replies discarded by generation). Its node
anchors cross module boundaries only through the shared
`ConnectionNodeSource` contracts in `connection-nodes.ts`, which the
composition root wires from the enabled providers. Scent Particles uses the
same kind of seam for the opposite reason: scent belongs to the things that
carry it, so `scent-sources.ts` names the plant-family vocabulary and the
live-actor shape. Vegetation replays its placements as scent sources with
the model and height at each position, Animals report their visible bodies
with their species, and the composition root wires both. Visible water
remains a separate Rivers
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
| `TerrainPresentation` | Material plus optional sampled conditions, drawn resolution, and frame update |
| `TerrainMaterialEffect` | Effect that decorates and optionally updates the Terrain material, with an optional per-vertex warmth sampler |
| `WORLD_WIND` | Shared authored wind mean direction, strength, speed, swing, and gust |
| `WorldWindSample` | The unit direction and strength blowing at one sampled moment |
| `GrassPreset` | Level-authored density and blade height per supported grass zone |
| `GrassClipmapPreset` | Level-authored density, full-density radius, blade dimensions, and palette of the clipmap field |
| `ThermalPerceptionEffects` | One heat response per consumer: terrain, vegetation, rocks, grass, and animals |
| `MagneticSenseParameters` | Magnetic field axis (direction and inclination), intensity, and pole palette |
| `MagneticSenseModuleHandle` | The Magnetic Sense sky module plus its strength and background drivers |
| `ScentParticlesParameters` | Level-authored scent signature, emission volume, and density per plant family and animal species, plus shared appearance and drift values |
| `PlantScentSource` | Deterministic per-chunk plants one module exposes to the scent sense, with family and height |
| `ScentActorBody` | Live position, height, and species of one scent-emitting actor |
| `MotionSenseParameters` | Level-authored motion intensity, swarm pool, appearance, and trail values |
| `MotionPointSource` | World-position stream a moving actor exposes for motion-trail printing |
| `ThermalPerceptionParameters` | Level-authored thermal intensity, viewer radius, feather, palette, and warmth values |
| `ConnectionsParameters` | Level-authored connections intensity, web radius, pulse motion, per-source records, and palette |
| `ConnectionNodeSource` | Deterministic per-chunk anchors one module exposes to the Connections web |
| `ConnectionActorSource` | Live world positions of a bounded moving population |
| `ConnectionTopologyRequest` / `ConnectionTopologyResult` | Typed transferable messages between Mycelium and its topology worker |
| `AnimalsModuleHandle` | The Animals world module plus its visible-actor position stream |
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
| `RunningLevel` | A started level's show, flight reset, frame metrics, and XR session, returned by `startLevel()` |
| `RunningShow` | A running show's clock, language, and audio state |
| `ShowActions` | The operator's typed command surface over the show the page hosts |
| `CueSlot` | One cue's slot, recording length, and headroom in a chosen language |

## Architectural Boundaries

- `main.ts` knows only the selected level, `startLevel()`, and whether a station
  was requested.
- `level-runtime.ts` is the only file that composes concrete modules and controls.
- The World Engine owns execution mechanisms, not experience content.
- Levels provide values; modules own resources and behavior.
- Shared contracts carry facts across ownership boundaries; module-specific
  generation and presentation remain inside the module.
- Chunk coordinates, work scheduling, and rendering remain separate concerns.
- No module starts a private render loop.
- Dramaturgy owns show time, Sound owns playback, and they meet only in
  `level-runtime.ts` through one cue-lookup contract.
- No global event bus or generic service registry is present. The station link
  is not one: it is a cross-process transport with a closed message union, one
  owner per side, and no topics, registration, or lookup.
- The conductor page reads the schedule and commands the clock; it never becomes
  a second schedule authority, and the show length is not put on the wire.
- Tests live outside `src/` and mirror the production ownership areas.
