<!--
Purpose: Document what the Ruins module owns.
Context: A landmark is placed by refusal: one candidate per try, most of them turned down.
Responsibility: Explain the placement rule, the pool, and what is deliberately absent.
Boundary: Level density lives in the authored preset; the model's provenance in its manifest.
-->

# Ruins

One ruined temple, standing where the open landscape has room for it. Unlike
Vegetation and Rocks, which scatter many small models across every zone, a
ruin is a **landmark**: large, rare, and refused far more often than it is
placed.

## How a ruin is placed

- The world is read on the 128-metre cell grid, and each cell offers a fixed
  number of candidate places drawn from its own coordinates. Placement is
  therefore deterministic: the same landscape carries the same ruins in every
  run and on every machine.
- A candidate stands only if the ground agrees. Its centre and the four
  corners of its footprint must all be meadow, and the fall between them must
  stay inside what a stepped platform can carry. Most candidates are refused,
  which is what makes a ruin something the landscape offered rather than
  something scattered onto it.
- A placed ruin is founded on the lowest corner it covers, so it is dug into
  the slope rather than floating over it.

## Cost

The whole window is one `InstancedMesh` and one draw call, with the refused
candidates compacted away rather than drawn at zero scale. The model is one
merged geometry: the authored FBX is a cell fracture of 132 pieces, which
would otherwise be 132 draw calls for every ruin standing.

Placement runs only when the traveller crosses a 128-metre cell boundary, and
costs five ground samples per candidate. There is no stream job: a window this
coarse holds a handful of cells, so the work of a crossing fits in the frame
that finds it.

## Deliberately absent

No interior, no collision, no second ruin model, and no wear or variation
beyond scale and heading. A ruin is scenery on a flight, not a place to land;
give it more only when a product issue asks for it.
