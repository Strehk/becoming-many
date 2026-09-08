<!--
Purpose: Document ownership of typed level presets and their composition root.
Context: Narrative states layer inside one running show composition.
Responsibility: Explain what belongs in src/levels and how entries select it.
Boundary: Browser presentation and concrete content implementations live elsewhere.
-->

# Levels

This folder owns typed level configuration, concrete world construction and the
existing runtime that turns a static or show request into one world.

Each level is one self-contained literal parameter object, following
`diagnostic.level.ts`: only type imports, no imported values, helpers, calls, spreads
or inheritance. All authored settings can be read and changed in that file.
Repeated configuration is intentional; `authored/` is retired. Required fields
are typed; technical defaults and validation belong to the concrete module.
See the [target architecture](../../docs/target-architecture.md).

Narrative names remain ordered as:

```text
white-world → scent → echo → motion → thermal → magnetic → connections
```

`diagnostic.level.ts` and `visual-integration.level.ts` are diagnostic/integration presets,
not narrative states. The Diagnostic preset uses Grass Clipmap; the browser diagnostics UI
is an explicit standalone URL option.

## Catalog and Entries

`level-catalog.ts` names standalone presets. The Show uses the Connections
preset for its once-prepared world; changing these module parameters affects both
runs. `show-levels.ts` owns the presentation states the running Show can change. The bare `src/entry/rehearsal.entry.ts` route starts that show; `?level=<name>` and
matching path names enter through `src/entry/standalone-level.entry.ts` and select one
development preset. Standalone Start borrows the same Show transport and narration
owner without constructing the main experience. Other standalone presets and
benchmarks remain showless.

An unknown requested name warns and falls back to Connections. That fallback is
for explicit development selection, not the behavior of the bare show route.

## Runtime and Composition

`level-preset.ts` owns the data contracts. `level.runtime.ts` owns startup and
frame coordination. It:

- creates the stopped World Runtime after loading required assets;
- applies the initial static or show presentation before module loading;
- loads and activates the configured module list;
- awaits World-owned shader compilation and first-use uploads for a show;
- connects desktop and M5 input, selecting exactly one source per frame;
- passes frame delta to entry-owned diagnostics before input/Show work;
- delegates optional show time, narration, transitions, sense fades, and the
  drone organ's per-frame contract to `show.runtime.ts`;
- starts the World loop only after preparation and returns the narrow
  `Run` command/query surface currently used by pages.

Its local frame handles benchmark placement or live input, Show updates and
height limits in order. World then publishes the viewpoint, updates
modules and streaming, renders, and reports the finished benchmark frame.
Flight reset restores rig orientation/position and restarts active training;
the complete fresh-visitor operation remains a separate gate.

`level-composition.ts` loads the required GLTF assets, creates the shared World
Surface, constructs the concrete modules, orders material effects, and wires
neutral provider contracts. It returns the surface, module list, ground presence, `ShowWorldReach` and
an optional Start handle and its exclusive module list. Start stays outside Show
sense gates. A Show prepares its main composition once and activates training
first. At the approved handoff, Run unloads training, removes its module
registrations and references, and activates the already prepared main modules.

Preset files create no resources and import no module implementation. Concrete
modules do not import siblings; Level Composition performs cross-boundary
wiring.

During a show, the schedule selects a `ShowLevelState` and drives module
activation, sense intensity, background blending, and World Fade without
recreating the composition or rereading the construction preset. The opening
show state is applied before modules size fixed spatial
windows; later states remain driven by the same schedule and state map. Flight
remains constrained against the shared surface through White World and every
transition.

## UI boundary and resources

Run owns experience startup, frame coordination and complete end; Show owns
transport and language. Browser Entry chooses requests and connects a Run to
UI. Page/panel code receives narrow public capabilities under the
[Engineering Standards](../../docs/engineering-standards.md).

Run owns loaded GLTF sources until all borrowers finish. Composition constructs
and connects; World coordinates module lifecycle; modules release their own
derivatives. UI releases only its own presentation resources. The existing
`unload()` path is implemented; full next-visitor operation remains #9/#46.

## Required Flight Tutorial

`start.level.ts` supplies the same training content to `/start`, `/?level=start`
and the opening of the full Show. Existing route/catalog registration is retained.
The approved sequence is right, left, up, down, without a deadline. Consecutive
world poses detect passage through each ring with the existing desktop or M5/XR
locomotion. A missed ring and its world-anchored arrow remain active. Device-specific neutral/held gestures and the opaque guide are removed.

Start's learning module owns goal progression and one crossing observation.
Its optional particle effect owns 1,400 fixed particles in one draw: a drifting
cloud gathers into a ring and compact arrow sharing one world-fixed goal pose, then
disperses with a bounded trajectory wake. Background Air Particles stays independent
at 80 particles per chunk. Composition can omit the effect without changing
learning or creating presentation resources.

Show owns Play/Pause, language, current instruction and the completion command.
The same clock supports an interactive tutorial of unbounded duration, then
rebases to the main schedule at handoff; public main-show time remains zero
during training. Entry initially presents Play. Pause holds training and flight,
seek/rate commands are blocked, and changing language repeats the current cue.
Presentation waits for an active instruction to finish before advancing to the
next goal, preserving the introduction even after a fast first crossing. Audio
duration never supplies the required spatial passage.
Only completing all goals and the final configured recording makes the full Show's
operator handoff available. Standalone Start exposes the same transport without
chapters or a main-experience handoff.

Run owns the shared spatial-audio context/listener and releases training sound
before retiring training. The organ borrows that context; Show's native timebase
remains separate. Stop resets time/orientation and holds. If training was already
retired, only its exclusive content is recreated; the main world is retained.
Playback waits for World-owned graphics preparation and the optional sample,
with visible failure and retry. Main narration preloads during training and stays
with its existing owner across handoff.
This is the existing interim reset, not complete visitor replacement or fresh
headset calibration (#9/#46).

Five DE narration recordings were located in the predecessor tutorial repository.
Audio rights, the language fallback and final sample selection still require their
specific content acceptance; locating the files does not approve shipping them.
The recipe therefore omits `startAudio` and `startNarration`: production training
is silent, and standalone Start creates only Show's native timebase. Tone spatial
audio is acquired for standalone training only when `startAudio` is configured.
Visitor comprehension, listening, XR comfort and Windows-PCVR 90 Hz remain
physical acceptance. The existing benchmark measures a fixed waiting scene,
not visitor completion, and its numerical reference is unchanged.
