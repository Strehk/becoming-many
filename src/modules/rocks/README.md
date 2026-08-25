# Rocks

This module contains rock content, including placement, instanced geometry,
materials, and bounded variation.

It consumes World Surface facts and owns its rock resources. Surface
generation, world streaming, and the global render loop remain outside this
module.

## Current MVP

- `rocks-definition.ts` owns the seed, candidate spacing, four CC0 GLBs,
  authored sizes, and weighted variants. Level Runtime loads them only when a
  level enables Rocks.
- Stable 64-metre chunk candidates are placed at `groundYAt(x, z)`.
- The level supplies instances per hectare for each enabled land zone. The
  module definition selects variation; water always receives no rocks.
- Authored target heights normalize source files with different native units.
- Multi-part GLTF Groups use the same compact instancing mechanism as
  Vegetation, while Rocks keeps separate content and transform decisions.
- Outgoing slots disappear before Terrain recycles their supporting ground;
  completed replacements still appear atomically.
- Recycled rows run through `StreamQueue`; unload releases every owned resource.

Runtime mesh simplification, LOD, and terrain alignment beyond vertical
placement remain deferred until target-device measurement requires them.
