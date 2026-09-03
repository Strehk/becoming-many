<!--
Purpose: Diagnose the conflation of authored levels, runtime show states, and the preloaded show composition.
Context: The level system grew from a small static composition root into a show runtime with cumulative presets.
Responsibility: Record the current information flow, the resulting semantic defects, and a KISS migration path.
Boundary: This document proposes no event bus, dependency-injection container, generic scene graph, or dynamic resource reload system.
-->

# Separate Authored Level States From Show Composition

**Status:** Open
**Priority:** Architecture
**Issue:** [#34](https://github.com/Strehk/becoming-many/issues/34)
**Related:** GitHub issue #15 covers the physical responsibilities of
`level-runtime.ts`; this document covers the distinct level-semantics problem.

## Executive Summary

The current implementation uses `LevelPreset` for three different concepts:

1. a complete startup recipe for a development or benchmark level;
2. an authored world state selected by the narration schedule;
3. the complete module and asset union preloaded for the show.

Those concepts do not have the same lifecycle or consumers. A static
`?level=<name>` run reads the complete preset and constructs only its modules.
The default show instead constructs one cumulative final preset and reads the
individual scheduled presets only for `backgroundColor` and `viewDistance`.
Sense presence and transitions come from separate lookup tables.

The result works because later presets inherit every earlier preset and the
last preset happens to be the complete module union. It is not a clear level
model: changing one earlier preset silently changes every later preset, while
most fields in the selected show preset are never applied at runtime.

The smallest viable correction is to keep one preloaded world and one render
loop, but give the three concepts separate names and contracts:

- `LevelPreset`: an independent, complete startup recipe for development and
  benchmark runs;
- `ShowComposition`: the one explicit module/asset configuration constructed
  before the show starts;
- `ShowLevelState`: only the values that the running show can actually change.

This preserves the current performance-safe lifecycle while removing cumulative
level inheritance and duplicated sources of truth.

## Evidence Base

This diagnosis compares the current repository with the reference repository
at commit
[`41ace8de5b2006ebf50a965d0f12600ea5760e11`](https://github.com/dweigend/becoming_many_new/tree/41ace8de5b2006ebf50a965d0f12600ea5760e11).

The reference was the smaller static-level architecture:

- `src/levels/level-runtime.ts`: 329 lines;
- `src/levels/test.level.ts`: 89 lines;
- available presets: White World, Test, and Design Test;
- one preset selected assets, modules, presentation, and controls at startup.

The current `level-runtime.ts` has 1,089 lines. The Fallow audit reports 47
functions and a fan-out of 47. Its size is not caused by one difficult
algorithm; it is caused by accumulated responsibilities and contracts.

## Current File Responsibilities

`src/levels/level-runtime.ts` currently contains five layers:

| Lines | Current responsibility |
| --- | --- |
| 124-269 | Public level, show, and running-runtime contracts |
| 271-386 | Startup, controls, M5 arbitration, metrics, benchmark, and frame update |
| 394-534 | Audio timebase, narration, show clock, backgrounds, and transitions |
| 556-704 | Sense gates and adapters from dramaturgy to module handles |
| 711-1089 | Concrete module factories, cross-module wiring, and asset loading |

Keeping one composition root is correct. Keeping all of these implementation
details in one physical file is not required to preserve that ownership.

## Current Information Flows

### Static Development or Benchmark Run

```text
URL ?level=echo
    |
    v
LEVEL_CATALOG["echo"]
    |
    v
startLevel(level)
    |-- loadLevelAssets(level)
    |-- createWorldSurface()
    |-- createConfiguredModules(level)
    |-- load and activate modules
    `-- frame update
          |-- controls or benchmark camera
          |-- ground clearance
          `-- diagnostics overlay
```

In this mode the preset has direct and consistent meaning:

- absence of a module block means that the module is not constructed;
- vegetation, rock, and animal blocks determine which assets are loaded;
- module blocks are passed to their concrete factories;
- presentation values are applied to the renderer and camera;
- the preset is effectively a complete startup recipe even though its
  TypeScript properties are optional.

### Default Show Run

```text
SHOW_LEVEL (= cumulative Connections preset)
    |
    |-- load every required asset once
    |-- construct every required module once
    `-- initially activate all modules

Narration schedule
    |-- showLevelAt()
    |     `-- selected preset -> backgroundColor and viewDistance only
    |
    `-- senseIntensityAt()
          `-- SHOW_LEVEL_SENSES
                |-- setIntensity() handles
                `-- GATE_SENSE -> module activation/deactivation
```

The show does not replace or fully apply `white-world.level.ts`,
`scent.level.ts`, `echo.level.ts`, and the later presets as cues advance.

At startup, `main.ts` passes `SHOW_LEVEL` to `startLevel()`. `SHOW_LEVEL` is a
spread of `connectionsLevel`, and `connectionsLevel` inherits from
`magneticLevel`, which inherits from `thermalLevel`, and so on. Assets and
modules are therefore selected only from this final cumulative object.

During playback, `createShow()` reads the preset mapped to the current cue only
for:

- `backgroundColor`;
- `viewDistance`.

It does not reapply module parameters, colors, densities, terrain presentation,
animal settings, or other authored values. Sense strength comes from
`SHOW_LEVEL_SENSES`, while module visibility comes from `GATE_SENSE`.

Preloading one world is a sound performance decision. Describing its runtime
states as complete `LevelPreset` objects is the semantic defect.

## Multiple Sources of Truth

The cumulative sense ladder is currently represented in four places:

1. narration cues select a `ShowLevelName`;
2. level files import and spread previous level files;
3. `SHOW_LEVEL_SENSES` repeats which senses every level contains;
4. `GATE_SENSE` repeats which sense controls every module.

The final show composition adds a fifth convention: the last narrative level
must contain the union of every module needed by the entire show.

These copies can drift independently. TypeScript verifies that names exist, but
it does not prove that the inherited modules, sense table, gates, and schedule
describe the same world.

## Problems in the Authored Level Files

### Cumulative Level Inheritance

The current inheritance chain is:

```text
echo
  -> motion
      -> thermal
          -> magnetic
              -> connections / SHOW_LEVEL
```

This makes every later file depend on all earlier implementation choices. A
change to Echo colors or Air Particle density can alter Motion, Thermal,
Magnetic, Connections, static preview pages, benchmarks, and the boot-time show
composition without any edit in those files.

The current level tests explicitly lock this inheritance with assertions such
as "Motion Level layers ... onto the carried Echo world". The coupling is
therefore intentional and regression-tested, but it remains the wrong
technical representation for independently controllable world states.

### `test.level.ts` Is No Longer the Original Reference Preset

The
[`test.level.ts` in the reference repository](https://github.com/dweigend/becoming_many_new/blob/41ace8de5b2006ebf50a965d0f12600ea5760e11/src/levels/test.level.ts)
is fully explicit and imports only the `LevelPreset` type. The current file
imports Air Particle values, Grass zones, Vegetation densities, and Rock
densities from `shared-level-values.ts`.

The direct diff contains 22 additions and 39 deletions. Most effective Test
values still match the reference:

- Air Particle density is still overridden to 80 particles per chunk;
- Air Particle appearance and motion still have the reference values;
- Grass, Vegetation, and Rock densities still match;
- the landscape and animal colors still match.

The important regression is ownership: the diagnostic reference can now drift
when a narrative shared value changes.

Magnetic Sense is a separate semantic migration. The reference Test preset
configured Terrain field lines through `terrain.magneticSense`. The current
runtime intentionally keeps Magnetic Sense off Terrain and renders a sky dome
through the top-level `magnetic` block. Restoring the reference structure must
therefore not blindly restore the obsolete Terrain API.

The current Test preset should be restored as a self-contained, API-current
reference. Whether the magnetic sky belongs in a landscape diagnostic should
be an explicit Test-level decision.

### `shared-level-values.ts` Is a Coupling Hub

The file mixes different reasons for reuse:

- global-looking Air Particle defaults;
- per-level artistic palettes and effect settings;
- population densities;
- complete carried sense configurations;
- the unused future block `sharedEchoGrass`.

The name `shared` states implementation reuse, not domain ownership. Some
values may be genuinely global, but others are copied because the current
inheritance model needs the same block in multiple cumulative presets.

One concrete behavior change already demonstrates the risk: the reference
White World explicitly used 192 Air Particles per chunk; the current White
World points to `sharedAirParticles`, which currently uses 270.

### Contract Ownership Is Reversed

Every `*.level.ts` file imports `LevelPreset` from `level-runtime.ts`. Authored
data therefore depends on the largest implementation file merely to name its
data shape. The contract should be independently owned by `level-preset.ts`,
and the runtime should depend on that contract.

## KISS Target Model

### 1. Keep Static Presets Independent

`LevelPreset` remains the contract used by development pages and benchmarks.
Each preset is a complete startup recipe: omitted modules are intentionally
off. A level must not import or spread another level.

`test.level.ts` remains fully explicit because it is the diagnostic reference.
Small duplication in authored configuration is preferable to invisible
cross-level behavior.

Only genuinely global facts should be shared. Those facts should live with
their domain owner and have intent-revealing names. For example, a universal
population density belongs with the population definition, not in a generic
level-value grab bag.

### 2. Name the Preloaded World Explicitly

Replace the misleading `SHOW_LEVEL` convention with one explicit
`ShowComposition` or `show-composition.ts` value. It owns only construction
facts required before playback:

- which modules exist;
- which assets are loaded;
- fixed capacities and immutable construction parameters;
- cross-module sources required by Connections and Scent.

It is not a narrative level and must not be derived by assuming that the last
level inherits the complete show.

Do not build a generic deep-merge engine. An explicit typed composition is
shorter and makes performance budgets reviewable.

### 3. Make Show States Truthful

Introduce a narrow `ShowLevelState` containing only values that the running
show can currently apply:

```ts
interface ShowLevelState {
  readonly backgroundColor: number;
  readonly viewDistance: number;
  readonly senses: Readonly<Record<ShowSense, boolean>>;
}
```

The exact representation can use booleans or normalized targets, but it should
have one source of truth. The runtime derives both intensity ramps and module
gates from the same `senses` state.

Do not put colors, population densities, asset definitions, or immutable
factory parameters into `ShowLevelState` until a real level transition can and
must change them. YAGNI means the contract describes present runtime
capability, not an imagined fully dynamic scene system.

### 4. Preserve the Performance-Safe Lifecycle

The correction must preserve:

- one `renderer.setAnimationLoop()`;
- one World Surface;
- one shared Stream Queue;
- fixed-capacity module pools;
- module-owned resource lifecycle;
- one asset-loading and module-construction phase before playback;
- allocation-free per-frame show following.

The goal is not to unload and rebuild the world at every cue. It is to separate
what is constructed once from what changes over time.

## Minimal File Structure

```text
src/levels/
|-- level-preset.ts          # LevelPreset and TerrainPreset only
|-- level-catalog.ts         # independent narrative preview presets
|-- level-runtime.ts         # thin composition entrypoint
|-- level-modules.ts         # module factories and asset requests
|-- show-composition.ts      # one explicit preloaded show recipe
|-- show-runtime.ts          # clock followers, transitions, and gates
`-- *.level.ts               # only if retained as independent static presets

src/test/
|-- test.level.ts            # explicit all-feature diagnostic reference
`-- level-catalog.ts         # narrative previews plus the Test preset
```

This is a physical separation, not a framework. It requires no registry,
dependency injection, event bus, ECS, service locator, or plugin system.

## Migration Sequence

### Step 1: Restore the Diagnostic Reference

- Move the diagnostic preset to `src/test/test.level.ts` as issue #19 isolates
  the browser entries, then inline its current effective Air Particle, Grass,
  Vegetation, and Rock values.
- Keep the current module APIs; do not restore obsolete Terrain magnetic fields.
- Keep the current diagnostic magnetic sky in the all-feature Test preset; it
  is the only retained integration reference after `designTest.level.ts` is
  removed.
- Add a regression test proving that Test values are self-contained and do not
  alias narrative configuration objects.

This step changes ownership, not the intended Test appearance.

### Step 2: Extract the Preset Contract

- Move `TerrainPreset` and `LevelPreset` to `level-preset.ts`.
- Update data files and runtime imports.
- Change no behavior.

### Step 3: Separate Show State From Static Presets

- Define one `ShowLevelState` map for all `ShowLevelName` values.
- Move `backgroundColor`, `viewDistance`, and sense presence into it.
- Derive intensity targets and module gates from that state.
- Remove the separate cumulative `SHOW_LEVEL_SENSES` representation.

### Step 4: Make Show Composition Explicit

- Rename or replace `SHOW_LEVEL` with `ShowComposition`.
- Author the required modules and fixed setup parameters directly.
- Stop deriving show resources from `connectionsLevel`.
- Verify that all scheduled states have every required runtime handle.

### Step 5: Remove Cross-Level Spreads

- Remove `...echoLevel`, `...motionLevel`, `...thermalLevel`, and
  `...magneticLevel`.
- Keep narrative `*.level.ts` files only if they remain useful as independent
  static preview presets.
- Otherwise rename them to honest show-state files and remove unused startup
  fields.
- Rewrite tests around independent state and composition invariants instead of
  object equality with the previous level.

### Step 6: Split the Runtime Physically

- Move show following to `show-runtime.ts`.
- Move concrete factories and preload requests to `level-modules.ts`.
- Keep `level-runtime.ts` as the single owner that connects World, modules,
  controls, diagnostics, and the optional show.

This step overlaps with issue #15 and should be coordinated with it rather than
implemented as a second competing split.

## Verification

### Contract Tests

- Every static preset can start without importing another preset.
- Test and Design Test own their complete effective values.
- Every `ShowLevelName` has exactly one `ShowLevelState`.
- Every sense required by a show state has a module and runtime driver in the
  show composition.
- The show composition is independent of narrative level order.

### Runtime Tests

- A static `?level=<name>` run constructs only the requested modules.
- A show run loads assets and constructs modules once.
- Cue changes apply background, view distance, sense targets, and gates from
  one state object.
- Seek and scrub remain deterministic inside transitions.
- The per-frame show path creates no new collections.

### Project Gates

- `bun test`
- `bun run check`
- `bun run lint`
- `bun run build`
- Fallow full, dead-code, duplication, and health passes
- browser smoke test for static Test and the default show
- physical Windows-to-PICO PCVR validation across all cold and warm cue
  transitions

## Explicit Non-Goals

- no dynamic asset loading at cue boundaries;
- no module reconstruction during playback;
- no generic preset inheritance or deep-merge utility;
- no generalized parameter animation system;
- no event bus, ECS, DI container, service locator, or plugin architecture;
- no change to the artistic order of senses;
- no restoration of obsolete Magnetic Terrain effects without a separate
  product decision;
- no unrelated shader, population, or performance tuning.

## Acceptance Criteria

The architecture is corrected when:

1. `src/test/test.level.ts` is an explicit, self-contained, API-current
   reference and is absent from the production catalog;
2. no authored level imports or spreads another authored level;
3. static presets, show composition, and show states have separate contracts;
4. only one data structure defines sense presence for each show state;
5. the show composition no longer depends on Connections being the final
   cumulative preset;
6. selected show-state values are either actually applied or absent from the
   state contract;
7. the single preloaded world and module-owned lifecycles remain intact;
8. all automated gates and physical PCVR transition checks pass.
