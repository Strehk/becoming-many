<!--
Purpose: Record confirmed architecture decisions for Becoming Many.
Context: Separate durable decisions from sketches, proposals, and current status reporting.
Responsibility: Preserve constraints that guide implementation.
Boundary: The running architecture is documented in architecture.md.
-->

# Architecture Decisions

The [current architecture](architecture.md) describes what is implemented.
This file records decisions that constrain current and upcoming work.

## Applied Decisions

### WebGL2 and GLSL Rendering Stack

- The rendering stack is Three.js on WebGL2 with raw GLSL ES 3.00 shaders in
  dedicated `*.vert.glsl` / `*.frag.glsl` files, as the engineering standards
  require.
- WebGPU and TSL were evaluated and rejected (2026-08-25). Do not add
  `three/webgpu`, TSL, or WGSL code paths; TSL reference material is rewritten
  as GLSL when extracted.

### One Composition Root and Render Loop

- `src/main.ts` only selects level data and starts the Level Runtime.
- `src/levels/level-runtime.ts` creates enabled modules and connects controls.
- The permanent world runtime owns one `renderer.setAnimationLoop()`.
- Modules never start their own render loop.

### Narrow Ownership

- The World Engine owns execution mechanisms: rendering, time, lifecycle,
  chunk assignments, and bounded scheduling.
- Levels contain data only.
- Modules own their concrete CPU and GPU resources.
- Device input remains outside the World Engine.
- Chunk assignment, job scheduling, and rendering stay independent.

### Minimal Streaming Foundation

- All module chunk sizes are power-of-two multiples of the 16-metre base grid.
- Flat X/Z and volumetric X/Y/Z windows recycle fixed slot pools instead of
  growing the scene.
- Slot revisions invalidate delayed work.
- The shared queue knows neither chunk content nor Three.js.
- Terrain uses one foundational queue priority because generated content must
  not publish before its supporting ground. Distance priorities, prefetching,
  asynchronous loading, and workers still require a concrete measured need.

### World Surface Before Rendering

- `src/world-surface` defines deterministic ground, visible-surface, and zone
  facts without chunks, lifecycle, camera state, materials, or narrative levels.
- `WorldSurface` exposes separate height, surface, continuous-zone-condition,
  and hard-zone queries so consumers pay only for the facts they need.
- Hard zones derive from continuous absolute-coordinate conditions. Chunks and
  terrain vertices never define zone boundaries.
- Physical surface settings and zone thresholds live separately; neither owns
  colors or other visual properties.
- Terrain queries only solid ground height and owns its material. Future
  render modules own their colors and consume surface or zone facts directly.
- Concrete content modules never import concrete sibling modules.

### Layered Landscape Modules

- World Surface is the shared read-only source for physical and zone facts.
- Chunk windows assign finite areas but never decide what content belongs there.
- Each landscape module owns its deterministic placement rules, authored
  parameters, fixed resources, presentation, and complete lifecycle.
- Every wind-reactive component imports the immutable `WORLD_WIND` configuration
  from `src/world/wind.ts`; components do not define separate wind values.
- Rivers consume the existing river path and water facts instead of generating
  a parallel river model.
- Vegetation, Grass, and Rocks remain separate because their density, geometry,
  animation, and performance profiles differ.
- Animals consume shared world facts rather than concrete landscape modules.
- Shared placement infrastructure is introduced only after at least two
  implemented consumers demonstrate the same operation and contract.

### Any Module Shader May Be a Material-Effect Target

Decided 2026-08-30, when Grass gained the anchors.

- A sense effect targets the three.js chunk anchors `<common>`,
  `<project_vertex>`, and `<color_fragment>` — not a material class. A module
  that writes its own `ShaderMaterial` opts into every sense by carrying those
  anchors in its GLSL and handing `<project_vertex>` a `transformed` position;
  `applyShaderPatch` then decorates it exactly as it decorates a built-in
  pass, including the shared uniform objects that a future intensity driver
  will reach every consumer through.
- The alternative was rejected: a module must not import a sibling sense's
  GLSL and paste the response into its own shader. The composition root stays
  the only place that knows which sense decorates which surface.
- A module with no per-instance transform reuses the nearest existing
  consumer variant rather than gaining its own. Grass takes the Vegetation
  heat variant — same band, same warmth, same uniforms — because it is the
  same living plant matter as the bushes it grows between. A new variant needs
  a measured visual reason, not a structural difference.
- Modules keep their own base color. It is what shows below full sense
  intensity, so it is authored from the same palette the sense ramps through.
- The decision stands without a live consumer. Grass was parked out of the
  narrative levels on 2026-08-31 on cost grounds, so the anchors it carries
  are currently exercised by tests only. What was decided here is where the
  seam sits, not which module happens to sit on it.

### Grass Carries Its Own Range

Decided 2026-08-30, applying the 2026-08-24 audit's P1 finding.

- Grass sets its visible range as a module constant (64 metres) instead of
  deriving it from the level view distance, bounded by `camera.far` so a
  nearer-seeing level still wins. The resident window is 5 x 5 chunks and
  304,200 triangles instead of 9 x 9 and 985,608.
- Range and preload are the first lever, density the last: the authored zone
  densities are unchanged, and the preload ring stays so recycled chunks fill
  in before they are seen.
- A per-module range is not yet a general contract. Terrain, Vegetation, and
  Rocks still follow the level view distance; each further split needs its own
  measured need, as the audit records.

### Independent Grass and a Self-Contained Magnetic Sense

- Grass owns one fixed streamed instance field and consumes only World Surface
  height and hard-zone facts. Magnetic Sense never imports or recolors Grass,
  and Grass imports no sense module in return.
- Magnetic Sense owns its own dome and decorates no other module's material,
  so Zone Visualizer, Thermal Perception, Echo Depth, and future ground
  presentations remain independently selectable.
- Physical lights, transparent overlays, bloom, and additional terrain
  geometry remain outside the MVP.
- Since level 06, line, pulse, and sky glow colors are preset-authored like
  every other sense palette, and `magnetic` is a top-level `LevelPreset`
  field beside `echoDepth`, `motion`, and `thermal`.
- Until 2026-09-01 the field was a composable Terrain stripe effect; see
  Magnetic Field on the Sky Only below.

### Magnetic Sky Cue and Contract Promotion (2026-08-31)

- The field-direction, intensity, and time uniform objects are created once
  in `magnetic-sense.ts` and reach the dome material by identity, so a future
  dramaturgy driver steers the whole sense through single values. Until
  2026-09-01 the same objects were shared with a second, terrain-side
  consumer.
- The sky cue is an analytic opaque dome instead of a transparent overlay or
  bloom: a back-side sphere with `depthWrite` off and `renderOrder` −1 draws
  first, every later opaque fragment paints over it, and the intensity fade
  mixes the glow back into the level haze inside the fragment shader. One
  added draw call, no extra render pass.
- The dome follows the full camera position each frame; the world uses
  absolute coordinates (no floating origin), so no shift compensation
  exists or is needed.
- The sky glow centres on `+fieldDirection`, the direction the pulses travel
  toward.
- The composition root skips the sense entirely at intensity zero, matching
  Echo Depth, Motion, and Thermal.

### Magnetic Sky Ported From the Previous Version (2026-09-01)

- The field left the ground. Magnetic Sense no longer patches the Terrain
  material and no longer appears in Terrain's effect list; a
  camera-following dome carries the whole sense. `createMagneticSense`
  returns one `WorldModule` instead of `{ terrain, sky }`, and
  `magnetic-sense.frag.glsl` / `magnetic-sense.vert.glsl` are deleted.
- The sky is ported from the previous version of the piece (`bm-base`,
  `src/senses/magnetfeld/sky.ts`), which offered nine blendable sky modes
  behind a dev console. Its saved state (`src/senses/state.json`, module
  `magnetfeld`) had exactly one active — `birdspec`, the radical-pair
  shimmer, at weight 1 — and those authored values are hardcoded in
  `magnetic-sense-settings.ts`. The nine-mode machinery, its uniform
  registry, its per-parameter bus commands, and its UI are not ported.
- The previous version is TSL on `three/webgpu`. It is rewritten as GLSL ES
  3.00 here, as the WebGL2 decision above requires. The noise, its four
  octaves, the pole-zone exponent, the grain thresholds, and the iridescent
  phase offsets carry over unchanged; the fbm loop is unrolled.
- North is +Z here, where the previous version used −Z. Declination and
  inclination are its own values (0° and 7.5°); `fieldElevationDegrees` is a
  new preset field, validated to stay between horizon and zenith.
- Preset surface: the level authors the field axis, the intensity, and three
  colors (north pole, south pole, zenith). Every shape and motion value is
  module-owned, which reverses part of the 2026-08-31 contract promotion —
  deliberately, because the ported look is finished art, not a level knob.
- The ported pole colors are black and white and the zenith is a pale blue.
  They sit outside the level-06 moodboard palette; the preset test no longer
  checks magnetic colors against it. This reverses the decided art direction
  of 2026-08-31 (monochromatic blue, terrain-draped lines) on the author's
  instruction.
- Colors: the dome now ends with `#include <colorspace_fragment>`, so it
  converts on output like every other material instead of writing linear
  values straight to the framebuffer. Hex values that carry a ported linear
  literal are the sRGB encoding of it, noted at each site.
- Performance: no draw call is added or removed. The four-octave noise is
  the most expensive fragment work in the frame, so the shader takes one
  coherent early-out where the pole zone cannot reach a displayable value —
  a deliberate exception to the no-dynamic-branch rule, justified because
  the branch follows large contiguous screen regions. The PICO 4 gate is
  unmeasured for this level, as before.
- The clock wraps at one hour, far outside the length of a show: the noise
  drift is linear, so any wrap is a visible step, and the only job of the
  wrap is to keep the noise input inside float precision.

### Module-Owned Web Worker for Connection Topology (2026-08-31)

- The Connections web topology (kNN plus minimum spanning tree over up to
  512 nodes) is O(n²) and runs in the repository's first Web Worker instead
  of stream-queue steps. The Mycelium module owns the worker completely:
  created on `load`, terminated on `unload`, reached only through the typed
  transferable messages in `topology-messages.ts`. No global worker
  infrastructure, registry, or shared channel exists.
- The pure math lives worker-free in `network-topology.ts`, so Bun tests
  cover it directly; the worker entry only relays one request. Tests inject
  a synchronous fake through the narrow `TopologyPort` seam and never
  construct a real worker.
- Staleness is judged by an aggregate window generation the module owns
  (per-slot chunk revisions cannot version a graph spanning all slots);
  replies for an outdated generation are discarded, mirroring the
  chunk-window currentness rule. Anchor gathering stays on the main thread
  as bounded stream-queue steps, one 32-metre chunk per step, with the
  stream queue's same-key replacement as the regather debounce.
- The worker scope is typed locally in `topology.worker.ts`; the conflicting
  `WebWorker` TypeScript lib is not added beside `DOM`.
- Node anchors cross module boundaries only through the shared
  `ConnectionNodeSource` / `ConnectionActorSource` contracts in
  `src/modules/connection-nodes.ts`; providers replay their own
  deterministic placement math and never import Mycelium.

### Show Clock and Schedule Authority (2026-09-01)

Resolves the clock-and-schedule half of
[open decision 2](direction/open-decisions.md); the session state machine and
the command bus stay open.

- **One virtual clock, one schedule authority.** `src/dramaturgy` owns show
  time and baked schedule data; `src/sound` owns the audio context and the
  media elements. Neither imports the other's concerns:
  `narrationCueAt(schedule, showTime)` is the entire contract between them,
  and `level-runtime.ts` is the only place that knows both.
- **The audio hardware clock is the timebase; the show clock is the
  authority.** Show time is derived from `AudioContext.currentTime` on every
  read rather than accumulated from frame deltas, so a long frame or a paused
  XR session cannot drift the show away from its narration. Pause, seek, and
  time scale are commands on the clock, and the narration follows. A seek
  therefore lands *inside* a recording instead of retriggering it, which is
  what makes rehearsal scrubbing work.
- A suspended audio context stalls the timebase and so freezes show time. That
  is the intended behavior, not a fault: if the audio is not running, the show
  is not advancing.
- **Schedules are typed TypeScript data**, per the configuration rule. A cue
  holds the timeline until the next cue, so no cue carries a duration — the
  same section runs up to nine seconds longer in German while cue times stay
  shared, and deriving the slot from neighbours makes that mismatch harmless.
- **The show is a run mode, not level data.** It reaches the runtime through
  `LevelOptions.show`, beside `benchmark`, because the nine presets are a sense
  development ladder rather than the shipped piece, and because they spread
  each other — a field on one would silently carry into every later preset.
  Language is a session parameter, armed once per session. *Amended 2026-09-01:*
  the operator page can re-arm it while the piece is loaded, which pauses the
  show and re-seats the narration at the same instant; a visitor session still
  fixes it at `arm` time.
- A benchmark never creates a show: audio decoding would add nondeterministic
  work to the samples, and a fixed timestep is not the real time the show is
  cut to.
- **A show exposes the clock as `window.showClock`.** Nothing under `src`
  reads it back, so removing it changes no behavior — the same one-way handoff
  the benchmark report already uses. It is set at runtime rather than gated on
  the build mode because rehearsal happens in the headset, against a production
  build, where a conductor page on another machine is not reachable.
  *Amended 2026-09-01:* `startLevel()` now returns the running level and
  `main.ts` sets the global from it, so the runtime no longer touches a global
  at all. *Amended again the same day:* the show is now the default page, so
  the global is set on every default run; only `?level` and `?benchmark` runs
  go without it.

### Station Transport and the Conductor Page (2026-09-01)

Extends [open decision 2](direction/open-decisions.md) and settles the first
part of [open decision 3](direction/open-decisions.md). The session state
machine stays open.

- **The operator page is the conductor.** One page holds the show transport and
  the station status, rather than a rehearsal timeline and a separate
  performance surface that would have to be kept in step.
  [Session and Operator](direction/session-operator.md) is amended accordingly:
  the timeline is in scope.
- **A running level is returned, not reported through a callback.** The World
  Runtime invokes its setup synchronously, so `startLevel()` can hand back a
  `RunningLevel` — the show's clock and language, a flight reset, and a frame
  metrics reader. `ShowRequest.onClockReady` is gone. One value, returned once,
  is a smaller contract than an optional callback, and it keeps the composition
  root free of the global that `?show` sets.
- **The wire is a transport, not an event bus.** The broker relays a closed
  message union between two windows: commands one way, status the other, plus
  peer presence. There are no topics, no registration, and no lookup, and each
  side has exactly one owner. The in-process command bus the engineering
  standards forbid remains forbidden.
- **Split by runtime, not by feature.** The protocol and the browser client are
  browser source under `src/station`; the Bun broker is a root-level `station/`
  process that imports them and exports nothing, mirroring how
  `tests/benchmark/` drives `src/benchmark`.
- **The show never depends on the station.** With no broker running the link
  retries quietly and the piece plays exactly as it does without one, matching
  the degraded-state rule in [Headset](direction/headset.md).
  *Amended 2026-09-01:* because the link fails soft, the show window now
  connects it unconditionally — `?station` only overrides the broker address —
  and a small corner widget (`src/station/station-widget.ts`) shows the
  socket state and links to the conductor page. The widget is DOM, so it
  never enters the `immersive-vr` view.
- **The show reports on a timer, not per frame.** Show time derives from the
  audio clock, which keeps running when the show window is unfocused or
  occluded and its animation frames stop. The conductor projects the playhead
  forward between reports, so the readout stays smooth at ten messages a second.
- **The conductor reads schedule data and never authors it.** It imports
  `PIECE_SCHEDULE` and the slot arithmetic in `schedule-layout.ts`; the show
  length is deliberately not on the wire, because sending it would make the show
  a second schedule authority. Cue times change by editing the typed data file.
- **The conductor page must not import `src/levels` or `src/world`.** A single
  value import would pull Three.js into a bundle that is otherwise a few
  kilobytes.
- **A flight reset is desktop rehearsal only.** Inside an `immersive-vr`
  session Three.js overwrites the camera pose from the headset every frame, so
  the reset has no effect there — as, today, ground clearance does not either.
  A camera rig would fix both and belongs with the XR view-state contract,
  which stays undecided.

### The Timeline Sets the World State (2026-09-01)

During a show, the schedule is the world authority as well as the narration
authority. `?level` keeps selecting presets for development, benchmarks, and
review — showless runs by definition. *(Amended 2026-09-01: the show was first
opted into with `?show`; it is now the default page, and requesting a level or
a benchmark is what opts out.)*

- **Each cue carries the level it speaks over.** `NarrationCue` gains a
  `level: ShowLevelName` field; timing and world changes stay in the one typed
  schedule file. The piece opens and closes in White World, the five sense
  cues map one to one, and the finale stands in the full Connections
  synthesis.
- **One composition, gated.** The show world is composed once from
  `SHOW_LEVEL` — the ladder's last preset, which "senses layer, never swap"
  makes the union — minus the development overlay. Standing in an earlier
  world state means closing module gates and dropping sense intensities, never
  recomposing. `showLevelAt` and `senseIntensityAt` are pure show-time
  lookups, so a seek lands inside a world state and mid-fade exactly where
  playing through would have.
- **Everything fades; nothing cuts** *(amended 2026-09-01; the first landing
  cut structure hard)*. The senses ramp their runtime intensity drivers over
  `SENSE_FADE_SECONDS` from each cue boundary — Thermal, Magnetic, and
  Connections through their shared shader uniforms, Scent and Motion through
  sense-fade uniforms that scale their particles away. Echo Depth alone keeps
  no driver: the surfaces its ramp decorates are exactly what the World Fade
  dissolves on the same echo strength, so the depth response materializes
  with them at full contrast instead of fading twice into mud. Solid
  structure dissolves into and out of the background through the World Fade
  effect (`src/modules/world-fade`): an opaque final-color mix toward the
  live background, applied first so it wins over every sense decoration, and
  never a transparent material — the mobile GPU sees no transition-time
  overdraw. Terrain, Vegetation, and Rocks ride the echo strength; Animals
  ride thermal. The background lerps between the states' colors over the
  same window (`levelTransitionAt`), the magnetic sky dome's haze chases it
  through `setSkyBackground`, and a gated module stays active exactly while
  its introducing sense carries any strength, so a dissolving world keeps
  rendering to the end of its fade. World fades are composed only for shows;
  a static run's materials stay bare. Authored keyframed envelopes
  ([Dramaturgy and Audio](direction/dramaturgy-audio.md)) remain the planned
  evolution of the shared ramp constant.
- **Flight stays clamped above the surface for the whole show**, including the
  White World phases whose standalone preset has no ground: terrain that will
  arrive at the echo cue must not find the visitor beneath it.
- **The status reports the live world state.** `ShowStatus.levelName` now
  carries the level the timeline currently holds, read from the running show,
  so the operator watches the world move through its cues.

### One Station Container (2026-09-02)

A deployed station is one Docker container running one Bun process: the
station server serves the built pages from `dist/` and is the WebSocket
broker, on one port and one origin.

- **One process, not two.** The broker is a stateless relay of ~150 lines;
  process isolation between it and a static file server buys nothing, while
  one origin removes cross-origin socket configuration entirely: both pages
  derive the broker address from `location.host` (`/station`), and Vite
  proxies the same paths in development so one URL rule holds everywhere.
  `?station=<url>` stays the escape hatch for conducting another machine.
- **Deployment env vars are network identity, not configuration.** `M5_HOST`,
  `M5_DEVICE_ID`, and `STATION_NAME` name which physical devices a station is
  wired to — facts of the room, not authored tunables, so the
  TypeScript-only configuration rule does not extend to them. They reach the
  pages through the server's `/config` endpoint
  (`src/station/deployment-config.ts`); a set fact is deployment authority:
  the show applies it on load, the matching conductor control renders
  read-only, and the station drops commands that would overwrite it. Absent
  vars change nothing — the UI decides, as before.
- **Health is liveness.** `/health` reports the process and its socket
  counts, never the show or the M5: an unreachable controller is an
  operator-visible warning in the conductor, not a reason for Docker to
  restart a station mid-visit.

## Approved Navigation Boundary

### Input and Navigation

The next navigation refactor will keep this narrow flow:

```text
device adapter → normalized input → navigation state → world update
```

- Desktop and ICAROS adapters translate device data into one input contract.
- Navigation produces position, orientation, and velocity.
- Terrain queries, collisions, streaming, and content logic remain outside
  navigation.
- Runtime and world modules do not branch on the active input device.

A separate XR view-state contract remains undecided and should not be added as
part of this refactor.
