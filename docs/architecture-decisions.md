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
- Every authored block exists once, in `src/levels/authored/`, typed against
  the module contract it configures. `src/levels/sense-layers.ts` groups those
  blocks into one layer per sense of the ladder. A standalone `LevelPreset` is
  its own presentation values plus the layers up to its rung, spread in ladder
  order; `ShowComposition.world` is the spread of every layer. A change to a
  block therefore reaches every level that carries that sense, which is what
  "senses layer, never swap" means. `ShowComposition` and `ShowLevelState` are
  separate contracts because they have different lifecycles and consumers.
- Layers only add keys, with one named exception: `THERMAL_LAYER.motion` is
  `HEAT_MOTION_SENSE`, derived beside `MOTION_SENSE` with the bird trail
  repainted, so the deviation is one greppable value rather than a nested
  override inside a level. The opening show state is still applied before
  view-dependent resources are allocated.
- The design stays simple: there is no preset inheritance, deep merge, module
  registry, dependency-injection container, or second runtime. A level file
  says which senses it carries; the values live where the sense is authored.
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
- The default page runs only the complete show. The explicit Test entry owns
  standalone levels, benchmarks, headset diagnostics, and direct-M5 requests.
- The viewer rig owns locomotion while the camera owns local desktop-look or
  headset pose. Desktop and M5 controls move the same rig.
- The conductor is one station window that hosts the show in-process. Its panels
  command a typed actions surface and do not maintain an independent clock.
- The Bun station server serves files, health, and deployment facts. It carries
  no show transport or session state.
- Browser pages validate deployment and controller data at their boundaries.
  Installation secrets must not be persisted or logged.
- The drone organ lives in `src/sound/drone-organ/` as a sound engine without
  the patch-cable interface it was played through. Its composed piece is typed
  configuration in `drone-organ-settings.ts`, and the port carries only the
  voices and world signals that composition reaches for.
- The organ plays on the `AudioContext` Tone.js builds for itself, not on the
  show timebase's. Tone's `AudioWorklet` nodes only come up on a context its
  own audio library created; sharing the timebase's context was measured to
  silence every voice room. The two contexts never mix audio, and both resume
  on the same first gesture. A master gain across narration and organ remains
  unbuilt.
- Tone.js loads through a dynamic import, so a benchmark run and a bare
  `?level=` page build no audio graph. The production build emits the organ as
  its own chunk.
- Organ layers are gated, not faded: a layer opens when its sense passes half
  strength, as the composition authored. Fading each voice with the sense
  intensity is the documented direction and a separate step.

## Performance Evidence

- Stable 90 Hz on physical PICO 4 is the primary target. A measured 72 Hz mode
  may be accepted only as an explicit fallback.
- Deterministic benchmark counters detect rendering changes; their frame times
  are comparable only on the same machine and rendering path.
- Desktop results and static gates do not constitute headset or PCVR acceptance.
- A performance regression blocks completion until removed or explicitly
  accepted with measured evidence.
