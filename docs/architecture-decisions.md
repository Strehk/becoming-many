# Architecture Decisions

Only current confirmed decisions are recorded here. Superseded implementation
history belongs in Git; unresolved product and deployment questions belong in
[direction/open-decisions.md](direction/open-decisions.md).

## Rendering and Runtime

- The application uses Three.js with one WebGL2 renderer and one
  `renderer.setAnimationLoop()` for desktop and WebXR.
- The WebGL context is created XR-compatible. No second renderer or private
  module loop is allowed.
- `src/world` owns permanent execution mechanisms; `src/modules` owns unloadable
  content; `src/control` owns navigation; `src/levels` owns typed authored
  presets.
- The creator of a resource owns its complete lifecycle and disposal.
- Runtime work and memory stay bounded through fixed pools, recyclable chunk
  windows, cooperative stream jobs, and stable capacities.

## Composition and Contracts

- `src/levels/level-runtime.ts` is the single current composition root. Its
  responsibilities may be split by issue #15, but a parallel runtime must not
  be introduced.
- Concrete content modules never import sibling modules. The composition root
  connects them through small directional contracts.
- World facts flow from `WorldSurface` and permanent world contracts into
  modules. Modules do not mutate those facts.
- Material effects cross module boundaries through the shared shader-patch
  contract. Patch failure must become explicit rather than silently changing a
  rendered result.
- Authored configuration is typed TypeScript. Public JSON is reserved for asset
  or firmware provenance.

## Landscape and Perception

- The deterministic World Surface owns ground height and continuous zone facts;
  Terrain owns their rendering.
- Spatial assignment, scheduling, generation, and rendering remain separate
  responsibilities.
- Narrative senses layer in one composition. The show gates and fades their
  runtime intensities instead of rebuilding the world at every cue.
- Grass Clipmap is the narrative grass path from Echolocation onward. The older
  Grass module remains only until current measurements support one owner; the
  choice is tracked in issue #13.
- Magnetic Sense is self-contained and sky-only. It does not patch Terrain,
  Grass, or other module materials.
- Connections topology is generated in a module-owned worker and published into
  fixed render pools. Providers expose anchors through contracts rather than
  module imports.

## Show, Input, and Station

- The show clock and typed narration schedule are the sole authorities for show
  time, cues, and world-state timing.
- The default page runs the complete show; explicit level and benchmark routes
  are showless development surfaces.
- Content a sense reveals is stood up before that sense, hidden: a module runs
  and streams while warming, and its visibility is what the fade raises. No
  layer may first build on the frame its cue arrives.
- The viewer rig owns locomotion while the camera owns local desktop-look or
  headset pose. Desktop and M5 controls move the same rig.
- The conductor is one station window that hosts the show in-process. Its panels
  command a typed actions surface and do not maintain an independent clock.
- The Bun station server serves files, health, and deployment facts. It carries
  no show transport or session state.
- Browser pages validate deployment and controller data at their boundaries.
  Installation secrets must not be persisted or logged.

## Performance Evidence

- Stable 90 Hz on physical PICO 4 is the primary target. A measured 72 Hz mode
  may be accepted only as an explicit fallback.
- Deterministic benchmark counters detect rendering changes; their frame times
  are comparable only on the same machine and rendering path.
- Desktop results and static gates do not constitute headset or PCVR acceptance.
- A performance regression blocks completion until removed or explicitly
  accepted with measured evidence.
