# Architecture

This document describes the current implementation. Product direction and open
deployment choices live under [direction](direction/README.md).

## Runtime Surfaces

The build has four browser entries:

- `index.html` loads `src/main.ts`: the complete rehearsal show only.
- `test.html` loads `src/test-main.ts`: standalone levels, benchmarks,
  headset diagnostics, and direct-M5 development.
- `conductor.html` loads `src/conductor/conductor-main.ts`: the operator surface
  with the show running in the same page.
- `flash.html` loads `src/flash/flash-main.ts`: Web Serial firmware setup for the
  M5 controller.

`station/station-server.ts` is a separate Bun process. It serves `dist/`,
`/config`, and `/health`; it is not bundled into the application and owns no
show state.

## Composition and Frame Flow

`src/levels/level-runtime.ts` is the startup and frame-coordination root. A
static request contains one independent `LevelPreset`; a show request contains
the separate construction-only `ShowComposition` and narrow `ShowLevelState`
map. The runtime loads the required assets, starts `src/world/world-runtime.ts`,
applies the opening presentation, delegates concrete construction to
`src/levels/level-composition.ts`, activates the returned module list, and
connects controls and optional show following. Presentation is applied before
any module derives a fixed spatial window from the camera.

Test UI sampling and overlay creation are entry-owned optional dependencies.
Legacy Grass and Zone Visualizer implementations load only for the standalone
presets that author them; the rehearsal show does not fetch those chunks.

The single frame loop is owned by World Runtime:

```text
timer and viewer rig
→ controls and show state
→ active module updates
→ bounded stream-queue work
→ one render
```

Modules never create a private animation loop. The code that creates a Three.js
or browser resource owns its complete disposal.

## Source Ownership

```text
src/
├── benchmark/       deterministic in-page route and report data
├── conductor/       operator page, panels, snapshots, and actions
├── control/         desktop and M5 flight mapping and constraints
├── dev/             opt-in diagnostics and rehearsal controls
├── dramaturgy/      show clock, schedule, cue layout, and level timing
├── flash/           M5 Web Serial setup page
├── levels/          typed presets, startup coordination, and world composition
├── m5/              untrusted controller protocol and polling adapter
├── modules/         unloadable visual and world content
├── sound/           narration playback and the audio timebase
├── station/         browser-side deployment facts
├── test-ui/         browser-only frame metrics and diagnostic overlay
├── test-main.ts     standalone level and benchmark browser entry
├── utils/           narrow shared technical utilities
├── world/           permanent runtime, XR, chunks, and scheduling
└── world-surface/   deterministic read-only height and zone facts
```

README-only folders under `src/modules` and `src/utils` reserve named extension
boundaries. They contain no implementation and remain explicitly documented as
such.

## Permanent World

`src/world/world-runtime.ts` creates the scene, viewer rig and child camera,
WebGL2 renderer, XR control, module runtime, and stream queue. Renderer creation
requests an XR-compatible WebGL2 context from the start.

`src/world/viewer-rig.ts` separates locomotion from local camera pose. Desktop
look and WebXR tracking own the camera; desktop or M5 flight moves the rig. The
combined world-space viewpoint is published to modules.

`src/world/module-runtime.ts` runs the explicit module lifecycle:

```text
load → activate → update → deactivate → unload
```

`src/world/chunk-system.ts` and `volume-chunk-window.ts` map an infinite logical
grid onto fixed recyclable slots. `stream-queue.ts` advances cooperative jobs
within one shared frame budget and rejects stale work by stable resource keys
and assignment revisions.

`src/world/wind.ts` provides deterministic global wind samples. Consumers own
their visual response but do not define competing global wind state.

## World Facts and Content

`src/world-surface` is a pure deterministic query boundary. It owns height and
continuous zone conditions but no scene objects or lifecycle. Content modules
receive it as a read-only contract.

`src/modules` owns the rendered or simulated content. Current categories are:

- streamed geometry and populations: Terrain, Vegetation, Rocks, Animals,
  legacy Grass, and Grass Clipmap;
- point and network systems: Air Particles, Scent Particles, Motion Sense, and
  Mycelium/Connections;
- material or presentation effects: Echo Depth, Thermal Perception, World Fade,
  and the test-only Zone Visualizer;
- self-contained perception rendering: Magnetic Sense, which owns only its sky
  dome and does not patch sibling materials.

Concrete modules do not import siblings. Cross-module information uses narrow
contracts such as `WorldSurface`, `UnlitMaterialEffect`, `MotionPointSource`,
`ScentSource`, and `ConnectionNodeSource`; the composition root performs the
wiring in `src/levels/level-composition.ts`.

## Levels and Show

Files in `src/levels/*.level.ts` are typed startup recipes: each owns its
presentation values and spreads the sense layers up to its rung, in ladder
order. The layers live in `src/levels/sense-layers.ts` and are built from the
authored blocks in `src/levels/authored/`, where every configuration value
exists once. A level names layers, never another level. `test` and
`design-test` remain diagnostic presets with values of their own.

`show-composition.ts` spreads every layer into the complete module and asset
union the default page creates once. `SHOW_LEVEL_STATES` contains only presentation facts
that can change while that world is running. `PIECE_SCHEDULE` and the show
clock select those states, drive sense intensities and background transitions,
synchronize narration, and fade in the end credits at the authored
`creditsAtSeconds`. The schedule's opening state is also applied before module
construction so fixed spatial pools use its authored view distance. A requested
standalone level or benchmark does not start a show, so neither builds the
credits panel.

## Station and Control Boundaries

The Conductor imports the public level/runtime contracts and commands the show
through `src/conductor/show-actions.ts`. It reads a snapshot each frame rather
than holding a second copy of show time.

The M5 boundary treats HTTP payloads as untrusted. `src/m5` parses control
frames, applies smoothing and safety rules, and exposes a small adapter to the
composition root. Remaining host-reset, liveness, identity, and calibration
gaps are tracked issues.

Deployment settings supplied by the Bun server are parsed by
`src/station/deployment-config.ts`. A configured fact is deployment authority;
without `/config`, browser pages fail soft to development defaults.

## Configuration and Assets

Authored settings, definitions, and presets are TypeScript. Environment
variables configure the station process only. JSON under `public/` records
asset provenance and firmware metadata, not authored runtime configuration.

Static GLTF definitions are loaded before World Runtime starts and passed into
the modules that own their instanced or cloned resources. Asset provenance is
recorded under `public/*/manifest.json` and [docs/assets](assets/).
