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

- `src/levels/level-runtime.ts` is the single startup and frame-coordination
  entry. `src/levels/level-composition.ts` is its concrete construction owner;
  it is not a parallel runtime.
- Concrete content modules never import sibling modules. Level Composition
  connects them through small directional contracts.
- Every standalone `LevelPreset` owns a complete object literal and does not
  import, spread, or share configuration objects with another authored level.
  `ShowComposition` and `ShowLevelState` are separate contracts because they
  have different lifecycles and consumers.
- This deliberate separation favors robustness over deduplicating authored
  values: changing a standalone level cannot mutate a later level or the show,
  and the opening show state is applied before view-dependent resources are
  allocated.
- The design stays simple: there is no preset inheritance, deep merge, module
  registry, dependency-injection container, or second runtime. Repeated level
  values remain visible data when that is clearer than another abstraction.
- The execution path is directly traceable: a static request points to one
  `LevelPreset`; a show request points to one `ShowComposition` and one state
  map; Level Composition constructs the world; Level Runtime starts and updates
  it; Show Runtime follows the schedule.
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
