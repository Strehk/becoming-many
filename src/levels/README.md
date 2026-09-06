<!--
Purpose: Document ownership of typed level presets and their composition root.
Context: Narrative states layer inside one running show composition.
Responsibility: Explain what belongs in src/levels and how entries select it.
Boundary: Runtime mechanisms and concrete content implementations live elsewhere.
-->

# Levels

This folder owns typed level configuration, concrete world construction and the
existing runtime that turns a static or show request into one world.

D3/#85 requires explicit, independently readable TypeScript levels following
`test.level.ts`. An absent module is not requested; omitted optional settings use
its documented defaults; invalid required settings fail during preparation.
Before migration, review the smallest mapping into one prepared show world and
compare effective settings. Remove layer spreads, hidden override order and
exclusive helpers/tests together. See the binding
[target architecture](../../docs/target-architecture.md).

The current implementation still uses `authored/` blocks and `sense-layers.ts`,
including a thermal motion override. This is the migration source, not the rule
for new configuration. Narrative names remain ordered as:

```text
white-world → scent → echo → motion → thermal → magnetic → connections
```

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
