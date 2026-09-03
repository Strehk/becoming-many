# Vegetation

This module streams deterministic trees and bushes. Grass remains owned by the
dedicated Grass module.

It consumes World Surface facts and owns its bounded vegetation resources. It
does not define stream-cell policy or the permanent world coordinate system.

## Current Behavior

- `vegetation-definition.ts` owns the seed, candidate spacing, GLB details,
  authored sizes, and weighted model variants. Level Runtime preloads these
  fixed assets only when a level enables Vegetation.
- One 64-metre `ChunkWindow` surrounds the camera and queues recycled rows.
- The level supplies only instances per hectare for the zones it wants. The
  shared candidate grid recreates absolute positions; Vegetation applies its
  fixed species weights, rotation, and authored metre heights.
- Water receives no vegetation. The scaled model footprint must also fit
  outside the analytical river edge, so wide or rotated crowns cannot hang
  over the channel. Meadows mix sparse trees and bushes, while the two forest
  zones and shrub slopes use their configured populations.
- Multi-part GLTF Groups become one compact `InstancedMesh` per mesh part.
  Rejected candidate capacity is not included in the draw count.
- Outgoing chunk slots disappear before Terrain recycles their ground. A new
  slot appears only after its deterministic replacement is complete.
- Stable world-cell random values choose tree shape, full Y rotation, target
  height, crown width, and crown depth without changing during streaming.
- Conifer and deciduous forests use the same weighted individual-tree contract.
  A model variant never contains several trunks sharing one terrain anchor.
- The module owns its pool, unlit materials, source assets, and full disposal.
- `vegetation-nodes.ts` and `vegetation-scent.ts` replay the same placement
  walk for senses that decorate the plants without loading them: the web gets
  positions, the scent sense also gets the model standing there and its
  authored height, so a plant's scent belongs to that plant. Both cross the
  boundary only through the shared source contracts, and both share the
  documented 2.5-metre river-footprint stand-in, because the true footprint
  radius needs the loaded asset.

GPU wind and LOD are absent. Add either only when a current visual or measured
performance need justifies it.
