<!--
Purpose: Document ownership of typed level presets and their composition root.
Context: Narrative states layer inside one running show composition.
Responsibility: Explain what belongs in src/levels and how entries select it.
Boundary: Runtime mechanisms and concrete content implementations live elsewhere.
-->

# Levels

This folder owns sparse typed `LevelPreset` data and the current composition
root that turns one preset into a running world.

Every `*.level.ts` exports a data-only `level`. Narrative presets layer in this
order:

```text
white-world → scent → echo → motion → thermal → magnetic → connections
```

From Motion onward each preset spreads its predecessor. Echolocation is the
first solid landscape and the first narrative Grass Clipmap state. Magnetic
Sense adds only its sky dome. Connections adds the final network layer.

`test.level.ts` and `designTest.level.ts` are diagnostic/integration presets,
not narrative states. The Test preset still uses the older Grass module and
the browser Test UI.

`shared-level-values.ts` owns only authored blocks reused verbatim by multiple
presets. Values unique to one level remain in that level file.

## Catalog and Entries

`level-catalog.ts` names every preset and constructs `SHOW_LEVEL`, the complete
Connections composition without Test UI. The bare `src/main.ts` route starts
that full show. `?level=<name>` and matching path names select one showless
development preset; a benchmark is also showless.

An unknown requested name warns and falls back to Connections. That fallback is
for explicit development selection, not the behavior of the bare show route.

## Composition Root

`level-runtime.ts` owns the `LevelPreset` boundary and currently:

- preloads fixed GLTF definitions;
- creates the shared World Surface and permanent World Runtime;
- creates only configured modules and wires neutral provider contracts;
- connects desktop and M5 flight;
- connects optional show time, narration, level transitions, and sense fades;
- returns the narrow `RunningLevel` command/query surface used by pages.

Preset files create no resources and import no module implementation. Concrete
modules do not import siblings; Level Runtime performs cross-boundary wiring.

During a show, the schedule selects the active level data and drives module
activation, sense intensity, background blending, and World Fade without
recreating the composition. Flight remains constrained against the shared
surface through White World and every transition.
