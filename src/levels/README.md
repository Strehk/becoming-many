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
not narrative states. The Diagnostic preset uses Grass Clipmap; the browser diagnostics UI
is an explicit standalone URL option.

## Catalog and Entries

`level-catalog.ts` names standalone presets. The Show uses the Connections
preset for its once-prepared world; changing these module parameters affects both
runs. `show-levels.ts` owns the presentation states the running Show can change. The bare `src/entry/rehearsal.entry.ts` route starts that show; `?level=<name>` and
matching path names enter through `src/entry/standalone-level.entry.ts` and select one
development preset. Standalone presets and benchmarks remain showless.

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
- passes frame delta to entry-owned diagnostics before input/Show work;
- delegates optional show time, narration, transitions, sense fades, and the
  drone organ's per-frame contract to `show.runtime.ts`;
- starts the World loop only after preparation and returns the narrow
  `Run` command/query surface currently used by pages.

Its local frame handles benchmark placement or live input, Show updates and
height limits in order. Run supplies the active flight speed and limits, while
Composition only wires sources. World then publishes the resulting rig and eye
facts, updates modules and streaming, renders, and reports the finished
benchmark frame.
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

Run owns experience startup, frame coordination and complete end; Show owns
transport and language. Browser Entry chooses requests and connects a Run to
UI. Page/panel code receives narrow public capabilities under the
[Development guide](../../docs/development.md).

Run owns loaded GLTF sources until all borrowers finish. Composition constructs
and connects; World coordinates module lifecycle; modules release their own
derivatives. UI releases only its own presentation resources. The existing
`unload()` path is implemented; full next-visitor operation remains #9/#46.

## Standalone Start

`start.level.ts` supplies a free-flight Air Particles environment to `/start`,
`/tutorial`, and `/?level=start`. `/tutorial` remains a route alias. Start has no
learning goals, ring or arrow presentation, tutorial audio, or Show transport.
It uses the same Run, global flight control, and Air Particles module as other
standalone presets. Air keeps 48 particles per 16 m chunk and fades its 16 m local
field before recycling. The complete Show starts with its main schedule.
