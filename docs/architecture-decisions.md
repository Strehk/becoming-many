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

- Confirmed 2026-09-08: consolidate all browser surfaces under `src/ui/`, with
  declarative HTML/SVG, central CSS and TypeScript behavior bindings. Entry lives
  under `src/entry/`; shared deployment and route contracts live outside browser
  source. World borrows a page-declared canvas/viewport and owns WebGL lifetime.
  Texture canvases remain content resources. Shared transport gestures replace
  duplicate UI mechanics; the root Experience document replaces the separate
  diagnostics document and exposes one diagnostics overlay for standalone runs. No new
  framework or global store is introduced.
- Confirmed 2026-09-07: separate browser Entry, operator UI and experience
  Engine. Conductor is a control/display surface; the existing Run owns
  experience orchestration and Show owns transport/language. The Engine runs
  in the browser; the Station backend remains file/config/health delivery.
  No server-side Show, command broker or additional engine coordinator is added.
- Confirmed 2026-09-07: #84 is part of the UI architecture migration. Central
  `src/ui/app.css` owns authored DOM styling; remove replaced CSS and inline styles
  while preserving each surface's operation. The [Engineering Standards](engineering-standards.md#application-styling)
  own styling details; the roadmap owns execution order.
- Confirmed 2026-09-07: architectural filenames use `<domain-name>.<role>.ts`.
  The [Engineering Standards](engineering-standards.md#file-names-and-architectural-roles)
  define the small role vocabulary, responsibility contracts and scoped
  migration. Plain domain algorithm names remain valid; roles require no
  companion files or new runtime owners.
- `src/levels/level.runtime.ts` is the single startup and frame-coordination
  owner. `src/levels/level-composition.ts` is its concrete construction owner;
  it is not a parallel runtime.
- Concrete content modules never import sibling modules. Level Composition
  connects them through small directional contracts.
- Confirmed 2026-09-10: structure first, with existing observable behavior held
  fixed. Run connects experience lifetimes, Show owns playback policy and Start
  alone coordinates local learning. Motion, Course, Arrows, Crossing and particle
  presentation exchange narrow facts through Start; the effect owns its geometry
  and shaders. Composition passes motion constraints and resolves shared arrow
  length. No new hub, clock, feature, shader path or movement model is authorized
  by this block. The later calm ending in #122 and guidance changes in #117 stay
  deferred. Function limits are defined in the existing engineering standards.
- Confirmed 2026-09-06, D3: level files state their modules and desired settings
  explicitly and independently, using `diagnostic.level.ts` as the reading model.
  Confirmed 2026-09-07: one level is one self-contained literal parameter object.
  Only type-only imports are allowed. Remove imported parameter blocks, helpers,
  spreads and inheritance; extra explicit configuration lines are approved.
  This retires `authored/` as well as the earlier `sense-layers.ts` convention.
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
  diagnostic levels. #13 migrated Diagnostic/Visual Integration and removed the complete
  legacy implementation, contracts, configuration, loading path and exclusive
  tests. Actual Windows-PCVR/USB-C acceptance remains outstanding; owner
  selection is settled.
- World Surface owns zone conditions, thresholds and shared continuous transition
  weights. Grass Clipmap, Vegetation and Rocks derive their coverage/density from
  those weights under #71; genuine habitat exclusions retain hard classification
  from the same conditions. No consumer-local zone authority is permitted.
  Vegetation owns one plant-placement decision shared by rendering, scent and
  Mycelium. Confirmed 2026-09-07 after the #81 bank comparison: 1 m lateral
  clearance from the existing analytic channel boundary; canopy overhang is
  allowed. Remove model footprints and separate 2.5 m projection checks. No new
  distance algorithm or species-specific footprint rule. #72 culling remains
  a separate concern.
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
- The root page runs the complete show by default and selects its standalone-level
  entry for explicit level, benchmark, diagnostics, or direct-M5 requests.
- The viewer rig owns locomotion while the camera owns local desktop-look or
  headset pose. Desktop and M5 controls move the same rig.
- D2: all interfaces call the same domain commands. Show owns playback,
  language and time; existing Run owns complete visitor restart; UI owns only
  presentation/input. Remove forwarding adapters, duplicate reset/language/play
  rules and competing UI state. No command bus or generic control framework.
- Tutorial and credits are required, using existing owners and one Show clock.
  The 2026-09-09 user revision replaces the earlier unlimited/operator-only flow:
  integrated practice has 60 playing seconds. The later kiosk revision removed
  direct UI skipping. Four passages in right/left/up/down order before the cutoff
  play the full successful closing voice and automatically enter the experience
  (about 74 seconds is an estimate, not a speech cutoff). Timeout does not award passages or play false
  success speech. Missed sections continue recycling within the remaining budget.
  Pause and suspended audio hold time and flight; practice language changes repeat
  the instruction without restarting the budget. Closing-language changes retain
  its offset. Tutorial seeks/rate changes stay disabled; Run reset begins held
  orientation and a fresh budget. The public timeline retains actual tutorial
  duration, then offsets the unchanged main score; seeking into retired training
  clamps to the start of that score. Standalone Start remains an independent test.
  Run retires exclusive training while retaining the prepared main world. EN
  voice policy, physical acceptance, credits and visitor replacement stay separate.
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
- The organ plays on the `AudioContext` Tone.js builds, not on the
  show timebase's. Tone's `AudioWorklet` nodes only come up on a context its
  own audio library created; sharing the timebase's context was measured to
  silence every voice room. The two contexts never mix audio, and both resume
  on the same first gesture. A master gain across narration and organ remains
  unbuilt. Run's `spatial-audio.runtime.ts` now owns that Tone-created context and its
  single Three.js listener; organ and training sound borrow it and end their
  own nodes before Run closes it. This does not combine the contexts or change
  Show's timebase. Listener writes preserve the existing three-frame cadence
  and omit unchanged poses; the listener stays outside World's rendered graph.
- Tone.js loads through a dynamic import. Benchmarks and ordinary standalone
  presets build no audio graph. Standalone Start borrows Show's native timebase
  and creates shared spatial sound only when `startAudio` is configured. The
  current recipe omits it and `startNarration` pending audio-content acceptance;
  locating the predecessor recordings does not authorize their production use.
  The production build keeps the organ separate from static content.
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

### Gaze-aligned spoken tutorial — 2026-09-09

The user requests slower tutorial flight and an arrow directly in the current
view when the narrator gives the movement instruction. Start therefore captures
the published eye direction at each cue's formation onset, generates that section
inside the conservative camera view cone, and retains world-fixed ring/arrow
anchors afterwards. This replaces a preplanned rig-heading course. Show supplies
the authored spoken onset independently from the cue-completion gate; it remains
the sole clock/narration owner. Run passes 2 m/s translation to the existing
controls while training exists and restores their ordinary speeds on handoff.
Input sensitivity, head pose, main timing and lifecycle ownership are unchanged.
If the flight ceiling makes the current gaze infeasible, formation waits for a
reachable visible target. Retrying repeats the instruction portion of its clip.


## M5 acceptance in the closed installation — 2026-09-09

The user explicitly replaces the strict #18 device-eligibility policy. The
configured HTTP host selects the controller. Every parsed state is accepted
without expected-ID matching, firmware-version matching, calibration status or
sequence-progress requirements. Extreme-resume and abrupt-step rejection are
removed. Metadata remains visible in technician diagnostics. Raw device quality is
also diagnostic; effective control quality denotes a fresh parsed response. Existing schema
parsing, response timeout, host-lifetime cancellation, smoothing, rest-pose
neutralization and single-consumer button edges retain their existing owners.
This requires no additional adapter, compatibility mode or firmware flash.
