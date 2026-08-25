<!--
Purpose: Document ownership of source-level narrative presets.
Context: Narrative levels are continuous world states, not separate scenes.
Responsibility: Explain what belongs in src/levels.
Boundary: Runtime mechanisms and module implementations live elsewhere.
-->

# Levels

This folder contains typed, data-only presets for narrative world states.

`level-runtime.ts` owns the sparse `LevelPreset` input contract and is the
single composition boundary beside the presets. It starts the permanent World
Runtime, applies the selected preset, creates only the enabled modules, and
connects desktop controls.

Every `*.level.ts` file exports its preset as a named `level` constant that
satisfies the shared `LevelPreset` contract. Presets are sparse: omitted values
remain unchanged.

`white-world.level.ts` owns the narrative White World values and does not
activate Terrain. `scent.level.ts` is the Scent World base experiment and
activates Scent Particles and the White World Air Particles layer beside the
test overlay; its invisible ground flag clamps flight above the shared world
surface without rendering Terrain. `test.level.ts` is the
diagnostic development preset and activates Terrain and Grass, uses Zone
Visualizer as the base presentation, and overlays the Magnetic Sense stripe
effect.

Presentation values can include the background, the camera view distance, and
optional module parameters. The view distance is also the hard visibility
boundary used to size streamed module windows with an additional preparation
margin. It is level data; the permanent runtime does not invent a world look.

Preset files do not create Three.js resources, start render loops, or import
concrete module implementations. `main.ts` only selects one preset and passes
it to `startLevel()`.
