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

`shared-level-values.ts` holds the blocks that several presets carry verbatim
— the White World air layer, the Scent World layer, the echo-world vegetation
and rock palettes, the Echo Depth ramp, the Motion Sense response, and the
decided population densities and grass distribution. Level files compose these
constants and overwrite single values with object spreads where they diverge;
values unique to one level stay in its file.

From Echolocation onward the narrative levels also inherit literally:
`motion.level.ts` spreads the echo preset and adds the motion block,
`thermal.level.ts` spreads the motion preset and adds the animal and thermal
blocks, `magnetic.level.ts` spreads the thermal preset and adds the
magnetic block, and `connections.level.ts` spreads the magnetic preset and
adds the connections block. Editing an earlier level in that chain therefore
carries into every later one ("senses layer, never swap"). These preset
imports stay data-only and do not break the module-boundary rule.

`white-world.level.ts` owns the narrative White World values and does not
activate Terrain. `scent.level.ts` is the Scent World base experiment and
activates Scent Particles and the White World Air Particles layer beside the
test overlay; its invisible ground flag clamps flight above the shared world
surface without rendering Terrain. `echo.level.ts` is the Echolocation level
and decorates the rendered landscape materials with the shared Echo Depth
distance ramp. `motion.level.ts` is the Motion Perception level and layers
the Motion Sense fly swarms and their printed trails onto the carried Echo
world. `thermal.level.ts` is the Thermal Perception level and layers the
radius-bounded false-color heat view onto the carried Motion world while
adding the warm animal population. `magnetic.level.ts` is the Magnetic Field
Perception level and layers the directional ground field lines and the
northern sky glow onto the carried Thermal world. `connections.level.ts` is
the Connections level and layers the radius-bounded underground reveal and
the pulsing mycelium web onto the carried Magnetic world. `test.level.ts` is the
diagnostic development preset and activates Terrain and Grass, uses Zone
Visualizer as the base presentation, and authors its own diagnostic magnetic
block.

Presentation values can include the background, the camera view distance, and
optional module parameters. The view distance is also the hard visibility
boundary used to size streamed module windows with an additional preparation
margin. It is level data; the permanent runtime does not invent a world look.

`level-catalog.ts` names every preset so a run can select one without editing
the entry point. It holds the default the browser opens and resolves an
unknown request back to that default rather than failing. `?level=<name>` in
the URL is a runtime request, not authored configuration.

Preset files do not create Three.js resources, start render loops, or import
concrete module implementations. `main.ts` only selects one preset and passes
it to `startLevel()`.
