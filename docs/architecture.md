# Architecture

This document describes the current implementation. Product direction and open
operational choices live under [direction](direction/README.md). The binding
[target architecture](target-architecture.md) specifies approved changes that are
not yet implemented. Windows-PCVR over USB-C is the installation target.

## Runtime Surfaces

Vite uses `src/ui/` as its root. HTML references `/entry/` scripts, resolved by
Vite to `src/entry` in development and build. Three HTML documents retain their public routes:

- `index.html` loads `src/entry/experience.entry.ts`: the complete rehearsal show
  by default, or standalone levels, benchmarks, headset diagnostics, and direct-M5
  development when an explicit request selects that mode.
- `conductor.html` loads `src/entry/conductor.entry.ts`: the operator surface
  with the show running in the same page.
- `flash.html` loads `src/entry/flash.entry.ts`: Web Serial firmware setup for the
  M5 controller.

`station/station-server.ts` is a separate Bun process. It serves `dist/`,
`/config`, and `/health`; it is not bundled into the application and owns no
show state.

## Current UI and engine boundary

The experience Engine runs in the browser: Level Runtime, Show, World, M5,
flight controls, audio and content. Station is the separate backend; moving
policy out of Conductor does not move rendering or Show state to that server.

Entry resolves deployment/browser choices and starts/cancels one Run. Conductor
page/panels own only DOM, gestures and observations. Show exposes direct transport
and language commands; its clock stays internal. Rehearsal's `window.show`
console surface uses those same commands (for example `window.show.seekTo(90)`).
Run exposes the current `resetShowAndFlight` operation and narrow M5/XR
capabilities; UI cannot consume controller edges or unload those children.
The shared XR button lives in `src/ui/shared/`; session mechanics stay in World.

Each HTML document links `src/ui/app.css` and declares its authored controls,
SVGs and templates. Page/panel TypeScript binds events, clones repeated controls
and updates observations. Conductor and Rehearsal share transport scrubbing
and time formatting; no runtime markup parser or framework is added.
Timeline/M5 geometry uses SVG attributes; closed technician tools are inert.
The [target diagrams](target-architecture.md#3-target-structure) show deployment,
lifetime ownership, command contracts and frame order.

## Enforced imports

`.fallowrc.jsonc` separates browser entries, UI, Station backend and the existing
Engine owners. UI can import pure presentation queries and owner types, but
cannot construct a Run, Show or World. Engine cannot import UI/entries; Station
imports only platform-neutral contracts from `shared/`, never browser source. The lazy diagnostic module loader has its own narrow entry-tool rule.
`tests/levels/ui-boundary.test.ts` checks actual public capability types;
`level-runtime-boundary.test.ts` keeps concrete content construction out of Run.

## Composition and Frame Flow

`src/levels/level.runtime.ts` owns startup, frame coordination and awaited Run termination. A
static request contains one independent `LevelPreset`; a Show uses the Connections
preset plus its narrow `ShowLevelState` map. The runtime loads the required assets, creates a stopped World in
`src/world/world-runtime.ts`,
applies the opening presentation, delegates concrete construction to
`src/levels/level-composition.ts`, activates the returned module list, and
awaits World-owned GPU preparation for Show, connects controls and optional
show following, then starts the single loop. Presentation is applied before
any module derives a fixed spatial window from the camera.

`Run.unload()` stops the loop and starts input/audio/XR cleanup,
awaits pending preparation and children, ends modules in reverse order, releases
borrowed GLTF sources, then releases World and its WebGL context. The declared
canvas remains in the page. Failed/cancelled starts
use the same path; Composition cleans earlier factory handles on failure.
Entries cancel pending starts and own their DOM/listeners. A persisted `pagehide`
keeps the same visit; final page exit ends it. Visitor restart policy remains open.

Standalone-level and Conductor entries own and read their DOM-free frame samplers from
`src/diagnostics/` directly. The standalone-level entry creates and
ends its overlay, updates it through the existing optional frame callback, and
reads World's read-only draw counters. Run holds no UI or sampler contract.
Zone Visualizer loads only for standalone presets that request zone presentation.
All Grass-bearing levels use the same Grass Clipmap construction.

The single frame loop is owned by World Runtime:

```text
timer
→ optional entry diagnostics, then input, show and ground constraints
→ publish the viewer viewpoint
→ active module updates
→ bounded stream-queue work
→ one render
```

Modules never create a private animation loop. The code that creates a Three.js
or browser resource owns its complete disposal.

## Source Ownership

```text
shared/              platform-neutral deployment and route contracts
station/             Bun file/config/health backend
src/
├── entry/           browser startup, deployment loading and standalone-level module loading
├── ui/              three HTML documents, app.css and surface controllers
│   ├── conductor/   operator panels and view state
│   ├── rehearsal/   show transport
│   ├── diagnostics/ metrics overlay and headset diagnostics
│   ├── flash/       device setup form and bounded log
│   └── shared/      reused DOM bindings, scrubbing, time and XR controls
├── diagnostics/     DOM-free bounded frame metrics
├── benchmark/       deterministic in-page route and report data
├── control/         desktop and M5 flight mapping and constraints
├── dramaturgy/      show clock, schedule, cue layout and level timing
├── levels/          typed presets, startup coordination and world composition
├── m5/              controller protocol, HTTP runtime and serial setup adapter
├── modules/         unloadable visual and world content
├── sound/           narration, audio timebase and drone organ
├── utils/           narrow shared technical utilities
├── world/           permanent runtime, XR, chunks and scheduling
└── world-surface/   deterministic read-only height and zone facts
```

README-only folders under `src/modules` and `src/utils` reserve named extension
boundaries. They contain no implementation and remain explicitly documented as
such.

## Permanent World

`src/world/world-runtime.ts` creates the scene, viewer rig and child camera,
WebGL2 renderer, XR control, module runtime, and stream queue. Renderer creation
requests an XR-compatible WebGL2 context from the start. Entry passes the
page-declared canvas and viewport through Run; World borrows both and owns
context creation, viewport resize observation and GPU disposal. Hidden operator
viewports retain a usable render size and resize when revealed. Texture canvases
remain private rendering resources at their content owners.

`src/control/desktop-controls.runtime.ts` owns pointer capture and held keys;
keyboard navigation only captures events while pointer lock is active. Both
Desktop and `m5-flight.runtime.ts` retain their reusable math buffers per Run.
The shared view pitch correction is authored at `src/world/viewer-rig.ts`, not
in flight settings; Run and Composition pass it to World, Start and Credits.

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
and assignment revisions. Scent retains rejected jobs in its fixed slots; invalid
assignments become invisible immediately and only complete current writes publish.
There is no synchronous fill after queue rejection.

`src/world/wind.ts` provides deterministic global wind samples. Consumers own
their visual response but do not define competing global wind state.

## World Facts and Content

`src/world-surface` is a pure deterministic query boundary. It owns height and
conditions, hard habitat classification and shared continuous zone influences,
with no scene objects or lifecycle. Grass maps those influences to coverage;
static populations map them to density and deterministic variant selection.
Rocks and Vegetation share fixed-slot loading, row publication, queued recycling,
visibility and disposal in `static-population.ts`. Their factories supply only
model construction and transforms; colors, effects and Vegetation clearance
stay local. This is one implementation for two current consumers, with no
registry or configurable lifecycle.

`src/modules` owns the rendered or simulated content. Current categories are:

- streamed geometry and populations: Terrain, Vegetation, Rocks, Animals,
  and Grass Clipmap;
- point and network systems: Air Particles, Scent Particles, Motion Sense, and
  Mycelium/Connections;
- material or presentation effects: Echo Depth, Thermal Perception, World Fade,
  and the test-only Zone Visualizer;
- self-contained perception rendering: Magnetic Sense, which owns only its sky
  dome and does not patch sibling materials.

Shared material patches validate every active injection anchor after the base
compile hook, before changing their own uniforms or source. Invalid shaders fail
with material, effect, stage and anchor; fragment-only effects remain supported.

Concrete modules do not import siblings. Cross-module information uses narrow
contracts such as `WorldSurface`, `UnlitMaterialEffect`, `MotionPointSource`,
`ScentSource`, and `ConnectionNodeSource`; the composition root performs the
wiring in `src/levels/level-composition.ts`.

Scent providers name plant groups and animal species through the existing shared
contract; only the Scent field maps groups to its GPU palette. World recipes
exclude simultaneous visible and invisible vegetation at the type boundary.

Under #77, the unchanged `TerrainMaterialEffect` contract now lives beside the
semantically distinct `UnlitMaterialEffect` in the existing shared material-effect
file. Terrain, Mycelium and Level Composition import it directly; the old Terrain
export is removed without a shim. The early #11 gate reports zero boundary
violations and still rejects an intentional sibling import. Browser/counter
verification is complete: smoke passes, counters match both prior runs, and
all 106 production files are byte-identical. See [#77 evidence](evidence/issue-77/README.md).
The user accepted the reviewed local package on 2026-09-06; the roadmap records
the remaining numerical-reference and physical acceptance.

Mycelium retains rejected gather jobs only until the existing StreamQueue
accepts them, bounded by its current gather-window capacity. Reassignment clears
old node/edge ranges immediately; queued work and worker replies validate the
exact owning stream as well as slot revision. This preserves the existing
queue/worker owners and prevents old work surviving unload/reload. The focused
[#82 evidence](evidence/issue-82/README.md) does not claim full application
lifecycle acceptance.

## Levels and Show

Each `src/levels/*.level.ts` recipe is one self-contained literal parameter
object, with only a type import. Palettes, signatures, placement and warm Motion
values are readable directly in each file. The `authored/` parameter indirection
is retired. Test and Design Test retain their independent diagnostic values.

The Show constructs the Connections preset once, using its background for
material haze. `SHOW_LEVEL_STATES` contains only presentation facts
that can change while that world is running. `PIECE_SCHEDULE` and the show
clock select those states, drive sense intensities and background transitions,
synchronize narration, and fade in the end credits at the authored
`creditsAtSeconds`. The schedule's opening state is also applied before module
construction so fixed spatial pools use its authored view distance. A requested
standalone level or benchmark does not start a show, so neither builds the
credits panel.

`show.runtime.ts` also drives the drone organ in `src/sound/drone-organ/`
through one per-frame contract: the show time sample, the strength of each
voice as `organ-score.ts` derives it, the listener pose, ground height, and
the live bird-flock and fly-swarm centres that Motion Sense reports through
`ShowWorldReach`. Sound never reads the schedule and keeps no clock: the
organ's rhythmic voices step on grids of show seconds that the runtime places
onto audio time each frame. Tone.js arrives through a dynamic import inside
`drone-organ.ts`, and the organ plays on the context Tone builds for itself —
see [Architecture Decisions](architecture-decisions.md).

## Station and Control Boundaries

Conductor reads one local view state per draw and invokes direct owner commands.
Show owns playback/language/time, and Run owns complete termination and the
current time/flight reset. The concrete fresh-visitor operation remains #9/#46;
a reset does not establish a new lifetime.

The M5 runtime owns one cancellable HTTP host lifetime. ControlSource owns the
identity/firmware/calibration/sequence/freshness gate. UI reads one non-consuming
`readObservation()` snapshot: `status` is a string tag, `sample` is the accepted
device reading and `control` holds effective steering/quality. Only Run calls
`consumeFrame()` for button edges. Rejected input is neutral and cannot publish
old edges; UI neither validates devices nor unloads the runtime.

Flash runs independently of Run. `src/entry/flash.entry.ts` owns connection
startup, commands and page-exit cleanup; `src/ui/flash/flash.page.ts` owns form
bindings and the bounded log. `src/m5/setup/serial-setup.ts` owns the port and
streams. `send()` confirms a write; only `configureResult.ok` confirms applied
configuration. `close()` awaits resource release. Typed responses and fixed
notices keep raw serial text and credentials out of the page log. The page
persists only SSID/device ID and removes legacy saved passwords.

Entry fetches deployment settings through `src/entry/deployment-config.ts`;
`shared/deployment-config.ts` defines and parses the shared contract. A configured fact is deployment authority;
without `/config`, browser pages fail soft to development defaults.

## Configuration and Assets

Authored settings, definitions, and presets are TypeScript. Environment
variables configure the station process only. JSON under `public/` records
asset provenance and firmware metadata, not authored runtime configuration.

Static GLTF definitions are loaded before World Runtime starts and passed into
the modules that own their instanced or cloned resources. Asset provenance is
recorded in adjacent `provenance.json` files; [docs/assets](assets/README.md)
defines the shipping directory structure and naming rules.
