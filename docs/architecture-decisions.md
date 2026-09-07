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
- Confirmed 2026-09-06, D3: level files state their modules and desired settings
  explicitly and independently, using `test.level.ts` as the reading model.
  Remove layer spreads, inheritance, hidden overrides and exclusively required
  helpers. This supersedes the old `authored/` plus `sense-layers.ts` convention.
- Missing module means absent from that level. A present module uses its
  documented module-owned defaults for omitted optional settings. Missing
  required or invalid settings fail clearly during preparation before the visit.
  No generic deep merge or silent repair. Technical defaults live once at modules.
- Confirmed 2026-09-07: Show uses the explicit Connections preset through the
  common `preset` request. Remove the separate Show composition file/type/field.
  Show states retain presentation and timing, including state zero before pool
  allocation. Shared module settings affect both runs. Compare effective values
  and remove replaced layer consumers and exclusive tests in the same step.
- Startup and the local frame/end remain directly readable at existing owners.
  No registry, dependency-injection container, helper chain or second runtime.
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
- Confirmed 2026-09-05 in [target D5](target-architecture.md#d5--clipmap-only-world-surface-owns-all-zone-transitions):
  Grass Clipmap is the sole target renderer for Show and all Grass-bearing
  diagnostic levels. #13 migrates Test/Design Test and removes the complete legacy
  implementation, contracts, configuration, loading path and exclusive tests.
  Migration and actual Windows-PCVR/USB-C acceptance remain outstanding; owner selection
  is settled.
- World Surface owns zone conditions, thresholds and shared continuous transition
  weights. Grass Clipmap, Vegetation and Rocks derive their coverage/density from
  those weights under #71; genuine habitat exclusions retain hard classification
  from the same conditions. No consumer-local zone authority is permitted.
  Vegetation owns one plant-placement decision shared by rendering, scent and
  Mycelium. Remove separate riverbank checks and stand-in footprints. Prefer a
  ground-distance rule independent of loaded models; per-species distances
  belong to existing definitions. Before changing appearance, decide the actual
  distance and crown overhang from a small comparable riverbank. #72's precise
  culling correction remains a separate focused comparison.
- Magnetic Sense is self-contained and sky-only. It does not patch Terrain,
  Grass, or other module materials.
- Connections topology is generated in a module-owned worker and published into
  fixed render pools. Providers expose anchors through contracts rather than
  module imports. D4 retirement is approved: Mycelium connects trees and fixed
  world points, never animals. Remove animal-only position projections,
  contracts, wiring, reserved buffers, settings and tests; preserve movement,
  animation and animal body information needed by scent/heat. Describe current
  fixed anchor classes before any further content removal.

## Show, Input, and Station

- The show clock and typed narration schedule are the sole authorities for show
  time, cues, and world-state timing.
- A staged one-shot moment is scheduled data, not a triggered event. The animal
  passages are the second facet of the one authored schedule, read by the pure
  lookup `passageProgressAt(schedule, id, showTime)`, so a scrub lands an animal
  where playing through would have put it — which a rising edge over an event
  bus could not. Their authored routes and constants are transcribed from the
  predecessor project rather than re-derived, because direction and closeness
  are the tuning. A passage is ungated and undecorated: a crossing happens
  between senses, so no sense strength may put it away and it wears none of
  their effects.
- The default page runs only the complete show. The explicit Test entry owns
  standalone levels, benchmarks, headset diagnostics, and direct-M5 requests.
- The viewer rig owns locomotion while the camera owns local desktop-look or
  headset pose. Desktop and M5 controls move the same rig.
- D2: all interfaces call the same domain commands. Show owns playback,
  language and time; existing Run owns complete visitor restart; UI owns only
  presentation/input. Remove forwarding adapters, duplicate reset/language/play
  rules and competing UI state. No command bus or generic control framework.
- Tutorial and credits are required. Complete/consolidate existing owners;
  there is no second tutorial, credits or time system. Concrete content,
  duration, audio rights, start interaction and credits movement need small
  proposals before their implementation.
- The Bun station server serves files, health, and deployment facts. It carries
  no show transport or session state.
- Browser pages validate deployment and controller data at their boundaries.
  Installation secrets must not be persisted or logged.
- The drone organ lives in `src/sound/drone-organ/` as a sound engine without
  the patch-cable interface it was played through. How its voices sound is
  typed configuration in `drone-organ-settings.ts`; which voice sounds when,
  and to what pulse, is the score in `src/dramaturgy/organ-score.ts`. The port
  carries only the voices and world signals the composition reaches for.
- The show clock is the organ's only clock. Tone's transport is not used:
  every rhythmic voice steps on a grid of show seconds placed onto audio time
  just ahead of the playhead, and every generative draw is a hash of its step,
  so pause, seek, and rehearsal speed reach the organ exactly as they reach
  the narration.
- The organ plays on the `AudioContext` Tone.js builds for itself, not on the
  show timebase's. Tone's `AudioWorklet` nodes only come up on a context its
  own audio library created; sharing the timebase's context was measured to
  silence every voice room. The two contexts never mix audio, and both resume
  on the same first gesture. A master gain across narration and organ remains
  unbuilt.
- Tone.js loads through a dynamic import, so a benchmark run and a bare
  `?level=` page build no audio graph. The production build emits the organ as
  its own chunk.
- Organ voices fade on the score's derived ramp, the same ramp a sense fades
  on. A voice at zero strength puts its lane to sleep and schedules nothing.

## Complete Visitor Lifetime and Diagnostics

- D1 direction is confirmed: keep start, frame, end and restart directly readable
  in existing Level Runtime. Retain one prepared world within a visit; end that
  run completely and construct a fresh run between visitors. Time/position reset
  alone is insufficient.
- Preparation, resource use and bounded background work share one strategy at
  existing owners. No per-level transition workaround, uncontrolled rebuild or
  extensive first-use work during transitions.
- The creator owns complete release. Run owns loaded source assets and keeps
  them valid until every borrower has ended. Failed/cancelled starts and late
  asynchronous results obey the same lifetime; no partial disposal promise.
- Full page reload is a simple restart candidate to evaluate, not an approved
  implementation. Present the concrete operating sequence before changing it;
  verify Windows-PCVR/USB-C XR termination/re-entry, audio permission and the
  visitor/operator flow. Never assume automatic XR restart after reload.
- D6: diagnostic entries own measurement/display. Normal Experience operation
  creates no extra GPU probe, probe renderer or expensive diagnostic measurement.
  World provides necessary existing facts through small read-only access;
  remove Runtime round trips for the UI's own measurements. Preserve visible
  operating states and understandable startup failures.

## Performance Evidence

- The installation runs on a Windows PC with VR transmission over USB-C. Stable
  90 Hz must be proved on the actual PC, transport and headset. Prioritize basic
  PCVR operation and restart validation early enough to inform architecture.
- Standalone PICO belongs to another project after the PC version is complete.
  Add no speculative standalone path or automatic lower-rate substitute.
- Deterministic benchmark counters detect rendering changes; their frame times
  are comparable only on the same machine and rendering path.
- Mac browser results and static gates are development/regression evidence,
  not actual Windows-PCVR acceptance.
- #78 uses a bounded fixed-pose/conditions investigation of intended scene,
  available content and repeatable counters. Explain relevant differences and
  propose the checked scene as the replacement reference. The existing numeric
  candidate is not approved; keep old failures/comparisons and never overwrite
  a reference merely to pass. Exhaustive historical triangle reconstruction
  is not required.
- A performance regression blocks completion until removed or explicitly
  accepted with measured evidence.

## Simplicity and Decision Gates

- Before a substantial change, name what becomes simpler, what disappears,
  which existing owner retains responsibility and why any new structure is
  necessary. Structural simplification normally reduces production logic,
  dependencies, states, forwarding and required file jumps.
- Report production logic, explicit configuration, tests/tooling and
  documentation/measurement artifacts separately in the existing issue review.
  More production logic needs a concrete explanation; a claimed simplification
  with more structure must be revised or explicitly decided. Clear explicit
  level parameters are allowed only with real removal and setting comparison.
- Remove replaced implementations, contracts, settings and exclusive tests in
  the same change. Keep tests only while they protect relevant current risks;
  retire temporary probes after preserving essential findings, never to hide
  failures. No additional audit infrastructure or line-count gaming.
- Implement a coherent issue before targeted testing; the
  [workflow](refactor-workflow.md) and [test plan](refactor-test-plan.md) own
  verification cadence. No fixed three-issue review is required. User testing
  is optional. Routine choices are autonomous. New owners,
  abstractions, unplanned content and unexplained growth need a conscious
  decision. Remaining gates are concrete proposals with consequences, as mapped
  in the [target architecture](target-architecture.md#10-decisions-issuepr-evidence-and-critical-review)
  and [roadmap](roadmap.md); confirmed direction is not proof of implementation.
