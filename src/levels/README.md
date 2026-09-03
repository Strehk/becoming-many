<!--
Purpose: Document ownership of typed level presets and their composition root.
Context: Narrative states layer inside one running show composition.
Responsibility: Explain what belongs in src/levels and how entries select it.
Boundary: Runtime mechanisms and concrete content implementations live elsewhere.
-->

# Levels

This folder owns the authored configuration blocks, the sense layers built from
them, the typed standalone level presets, the preloaded show composition,
concrete world construction, and the runtime that turns either request into one
running world.

Every `*.level.ts` exports one data-only `LevelPreset`: its own presentation
values followed by the sense layers it carries, spread in ladder order. Omitted
layers are intentionally off. The narrative names remain ordered as:

```text
white-world → scent → echo → motion → thermal → magnetic → connections
```

`authored/` holds each configuration block exactly once, typed against the
module contract it configures. `sense-layers.ts` groups those blocks into one
layer per sense. A level names layers, never another level, so the ordering is
the experience and not code inheritance — and a retune of a sense is one edit
that reaches every level carrying it. Layers only add keys, with one named
exception: the thermal layer carries `HEAT_MOTION_SENSE`, the motion sense with
its bird trail repainted, defined beside the base value it deviates from.
Scent's invisible plants take their placement from `authored/vegetation.ts`,
so a trail a traveler follows in Scent rises where Echo later shows a plant.

`test.level.ts` and `designTest.level.ts` are diagnostic/integration presets,
not narrative states. The Test preset still uses the older Grass module and
the browser Test UI.

## Catalog and Entries

`level-catalog.ts` names only standalone presets. `show-composition.ts` owns the
separate construction-only `ShowComposition` loaded once for the complete
show. `show-levels.ts` owns the narrow presentation states the running show can
change. The bare `src/main.ts` route starts that show; `?level=<name>` and
matching path names enter through `src/test-main.ts` and select one showless
development preset. Benchmarks use that Test entry too.

An unknown requested name warns and falls back to Connections. That fallback is
for explicit development selection, not the behavior of the bare show route.

## Runtime and Composition

`level-preset.ts` owns the data contracts. `level-runtime.ts` owns startup and
frame coordination. It:

- starts the permanent World Runtime;
- applies the initial static or show presentation before module loading;
- loads and activates the configured module list;
- connects the selected desktop or M5 flight source;
- accepts entry-owned Test UI metrics and overlay creation only when requested;
- delegates optional show time, narration, transitions, sense fades, and the
  drone organ's per-frame contract to `show-runtime.ts`;
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
