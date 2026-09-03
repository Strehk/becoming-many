<!--
Purpose: Document ownership of typed level presets and their composition root.
Context: Narrative states layer inside one running show composition.
Responsibility: Explain what belongs in src/levels and how entries select it.
Boundary: Runtime mechanisms and concrete content implementations live elsewhere.
-->

# Levels

This folder owns typed standalone level data, the preloaded show composition,
concrete world construction, and the runtime that turns either request into one
running world.

Every `*.level.ts` exports one complete, data-only `LevelPreset`. A preset
imports only its contract: it never imports, spreads, or shares configuration
objects with another authored level. Omitted module blocks are intentionally
off. The narrative names remain ordered as:

```text
white-world → scent → echo → motion → thermal → magnetic → connections
```

This ordering describes the experience, not code inheritance. Repeated values
are explicit so changing one level cannot silently change another.

`test.level.ts` and `designTest.level.ts` are diagnostic/integration presets,
not narrative states. The Test preset still uses the older Grass module and
the browser Test UI.

## Catalog and Entries

`level-catalog.ts` names only standalone presets. `show-composition.ts` owns the
separate construction-only `ShowComposition` loaded once for the complete
show. `show-levels.ts` owns the narrow presentation states the running show can
change. The bare `src/main.ts` route starts that show; `?level=<name>` and
matching path names select one showless development preset, and a benchmark is
also showless.

An unknown requested name warns and falls back to Connections. That fallback is
for explicit development selection, not the behavior of the bare show route.

## Runtime and Composition

`level-preset.ts` owns the data contracts. `level-runtime.ts` owns startup and
frame coordination. It:

- starts the permanent World Runtime;
- applies the initial static or show presentation before module loading;
- loads and activates the configured module list;
- connects the selected desktop or M5 flight source;
- delegates optional show time, narration, transitions, and sense fades to
  `show-runtime.ts`;
- returns the narrow `RunningLevel` command/query surface used by pages.

`level-composition.ts` loads the required GLTF assets, creates the shared World
Surface, constructs the concrete modules, orders material effects, and wires
neutral provider contracts. It returns only the surface, module list, ground
presence, and `ShowWorldReach` needed by the runtime.

Preset files create no resources and import no module implementation. Concrete
modules do not import siblings; Level Composition performs cross-boundary
wiring.

During a show, the schedule selects a `ShowLevelState` and drives module
activation, sense intensity, background blending, and World Fade without
recreating the composition. Static `LevelPreset` objects are not read by the
show. The opening show state is applied before modules size fixed spatial
windows; later states remain driven by the same schedule and state map. Flight
remains constrained against the shared surface through White World and every
transition.
