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
See the [binding architecture](../../docs/architecture.md).

Narrative names remain ordered as:

```text
white-world → scent → echo → motion → thermal → magnetic → connections
```

`diagnostic.level.ts` and `visual-integration.level.ts` are diagnostic/integration presets,
not narrative states. The Diagnostic preset uses Grass Clipmap.

## Catalog and Entries

`level-catalog.ts` names the original level recipes for standalone runs and Show. The Show uses the Connections
preset for its once-prepared world; changing these module parameters affects both
runs. `show-levels.ts` reads presentation values and sense targets directly from those
same recipes. It owns transition calculations, not another configuration table. The bare `src/entry/rehearsal.entry.ts` route starts that show; `?level=<name>` and
matching path names enter through `src/entry/standalone-level.entry.ts` and select one
development preset. Standalone presets remain showless.

An unknown requested name warns and falls back to Connections. That fallback is
for explicit development selection, not the behavior of the bare show route.

## Runtime and Composition

`level-preset.ts` owns the data contracts. `level.runtime.ts` owns startup and
frame coordination. It:

- creates the stopped World Runtime after loading required assets;
- applies the initial static or show presentation before module loading;
- loads and activates the configured module list;
- awaits World-owned shader compilation and first-use uploads for a show;
- connects ordered M5 and desktop sources to the shared two-axis contract;
- asks the one global flight model to apply continuous thrust and combined tilt
  on each live frame, for Start, standalone levels, and the complete Show;
- delegates optional show time, narration, transitions, sense fades, and the
  drone organ's per-frame contract to `show.runtime.ts`;
- starts the World loop only after preparation and returns the narrow
  `Run` command/query surface currently used by pages.

Its local frame handles live input, Show updates and
height limits in order. Run supplies the active flight speed and limits, while
Composition only wires sources. World then publishes the resulting rig and eye
facts, updates modules and streaming, and renders.
Flight reset restores rig orientation/position;
the complete fresh-visitor operation remains a separate gate.

`level-composition.ts` loads the required GLTF assets, creates the shared World
Surface, constructs the concrete modules, orders material effects, and wires
neutral provider contracts. It returns the surface, module list, ground presence,
and `ShowWorldReach`. A Show prepares and activates its main composition once.

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

Run owns experience startup, transport, frame coordination and complete end;
Show owns main playback and language. Run exposes `readLanguage` and
`setLanguage` independently of the main Show handle, which remains unavailable
during training. Browser Entry chooses requests and connects a Run to
UI. Page/panel code receives narrow public capabilities under the
[Development guide](../../docs/development.md).

Run owns loaded GLTF sources until all borrowers finish. Composition constructs
and connects; World coordinates module lifecycle; modules release their own
derivatives. UI releases only its own presentation resources. The existing
`unload()` path is implemented; full next-visitor operation remains #9/#46.

## Tutorial entry and handoff

The audience routes `/`, `/start`, `/tutorial` and `/?level=start` prepare the
main show and run `start.level.ts` first. `LevelRun` waits for the complete
closing narration and final route exit, fades Start, disposes its voice and
atmosphere, resets the existing rig with eight meters of terrain clearance, and
starts the main Show at zero. `handoff-settings.ts` owns these transition values.
The same renderer, listener and XR session remain active throughout.

Start exposes completion and presentation presence through its public contract.
Composition connects resources; Run owns the handoff. Main modules stay inactive
during the tutorial. Entry mounts transport once; `subscribeShow` reports main
Show availability without remounting UI. Conductor prepares the same tutorial
but waits for Play; audience entry starts automatically.

Language changes update Show and refresh Start's current recording through its
injected language query. They never invoke the restart path. Start retains the
initial course and cue timeline while Sound replaces native speech. A tutorial
constructed by Stop reads the current language, including changes made while
its assets load. `ShowLevelRequest` carries language only in `show.language`;
the separate `StaticLevelRequest.language` selects a fixed standalone language.
