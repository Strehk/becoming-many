<!--
Purpose: Document ownership of typed level presets and their composition root.
Context: Narrative states layer inside one running show composition.
Responsibility: Explain what belongs in src/levels and how entries select it.
Boundary: Runtime mechanisms and concrete content implementations live elsewhere.
-->

# Levels

This folder owns typed level configuration, concrete world construction and the
existing runtime that turns a static or show request into one world.

Each typed level lists its module keys explicitly, following `test.level.ts`.
Shared content in `authored/` keeps repeated palettes, scent signatures and plant
placement consistent. Thermal levels choose the warm Motion variant explicitly;
there are no layer spreads or hidden overrides. Required fields are typed;
optional defaults and runtime parameter checks belong to the concrete module.
See the [target architecture](../../docs/target-architecture.md).

Narrative names remain ordered as:

```text
white-world → scent → echo → motion → thermal → magnetic → connections
```

`test.level.ts` and `designTest.level.ts` are diagnostic/integration presets,
not narrative states. The Test preset still uses the older Grass module and
the browser Test UI.

## Catalog and Entries

`level-catalog.ts` names standalone presets. The Show uses the Connections
preset for its once-prepared world; changing these module parameters affects both
runs. `show-levels.ts` owns the presentation states the running Show can change. The bare `src/main.ts` route starts that show; `?level=<name>` and
matching path names enter through `src/test-main.ts` and select one showless
development preset. Benchmarks use that Test entry too.

An unknown requested name warns and falls back to Connections. That fallback is
for explicit development selection, not the behavior of the bare show route.

## Runtime and Composition

`level-preset.ts` owns the data contracts. `level-runtime.ts` owns startup and
frame coordination. It:

- creates the stopped World Runtime after loading required assets;
- applies the initial static or show presentation before module loading;
- loads and activates the configured module list;
- awaits World-owned shader compilation and first-use uploads for a show;
- connects desktop and M5 input, selecting exactly one source per frame;
- accepts entry-owned Test UI metrics and overlay creation only when requested;
- delegates optional show time, narration, transitions, sense fades, and the
  drone organ's per-frame contract to `show-runtime.ts`;
- starts the World loop only after preparation and returns the narrow
  `RunningLevel` command/query surface used by pages.

Its local frame reads metrics, benchmark placement or live input, Show updates,
height limits and Test UI in order. World then publishes the viewpoint, updates
modules and streaming, renders, and reports the finished benchmark frame.
Existing flight reset remains unchanged pending the separate fresh-run gate.

`level-composition.ts` loads the required GLTF assets, creates the shared World
Surface, constructs the concrete modules, orders material effects, and wires
neutral provider contracts. It returns only the surface, module list, ground
presence, and `ShowWorldReach` needed by the runtime.

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
