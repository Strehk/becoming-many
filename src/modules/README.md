<!--
Purpose: Document ownership rules for unloadable world and perception modules.
Context: Level Composition constructs enabled features over permanent World infrastructure.
Responsibility: Summarize current module categories and cross-module contracts.
Boundary: Concrete modules do not import siblings or own the global render loop.
-->

# Modules

This folder owns unloadable feature content. Resource-owning modules follow the
shared `load`, `activate`, `update`, `deactivate`, and `unload` lifecycle and
dispose everything they create.

## Current Content

- Terrain renders World Surface height in recycled meshes.
- Vegetation and Rocks render deterministic compact instanced populations.
- Animals owns ten bounded actors, visibility, animation, and movement.
- Air and Scent Particles own bounded points buffers.
- Grass Clipmap is the sole grass renderer for narrative and diagnostic presets.
- Motion Sense owns point actors and GPU-aged trail rings.
- Magnetic Sense owns one camera-following sky dome and patches no sibling.
- Mycelium/Connections owns fixed network draws and a module-specific topology
  worker.
- End Credits shows the closing panel that ends a show.
- Echo Depth, Thermal Perception, and World Fade are composable material
  effects; Zone Visualizer is a diagnostic Terrain presentation.

## Boundaries

Concrete modules never import siblings. Level Composition wires narrow neutral
contracts for world facts, material effects, live bodies, motion positions,
scent sources, and connection nodes. Consumer-specific placement, rendering,
settings, capacity, and disposal remain with the consumer.

Configured GLTF definitions are loaded before World Runtime starts. Modules may
submit small replaceable jobs to the shared StreamQueue, but retain ownership of
their data and fixed pools.

`atmosphere`, `paths`, and `rivers` are README-only reserved extension
boundaries. They are not implemented modules and should remain empty until a
concrete issue requires them.

## Public interface and resource ownership

`WorldModule` describes the shared content lifecycle. A returned handle may
also expose specific drivers or sources; material effects and pure sources do
not need an artificial module lifecycle. Their inputs/outputs are wired by
Composition and must state any borrowed-buffer validity. Run-owned GLTF sources
are borrowed; module-created derivatives, pools and workers are released locally.
Operator UI never imports a concrete content implementation. Adopt role names
with the affected owner refactor under the [Engineering Standards](../../docs/engineering-standards.md),
without generating companion files or recreating retired modules.
