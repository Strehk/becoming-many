# Tree and Shrub Assets

`public/trees` contains eight Quaternius CC0 GLBs from Poly Pizza. Source pages,
download URLs, checksums, mesh names, geometry counts, and texture counts are
recorded in `public/trees/manifest.json`.

## Current Runtime Use

Vegetation definitions select individual conifer, deciduous, birch, dead-tree,
bush, and flowering-bush objects from these files. Shared URLs are fetched once
per preload request. Multi-part objects remain complete and become compact
instanced mesh parts; source groups containing multiple trees are not treated as
one placement unit.

The shipping GLBs remain their source-quality versions. No current physical
PICO measurement has justified a derived mesh or texture optimization set.

## Inventory

| Set | Source | File | Mesh variants | Triangles | Estimated draw calls | Textures |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| Pine 4 | [Poly Pizza](https://poly.pizza/m/79gmlLnweB) | `pine-single-01.glb` | 1 | 3,370 | 2 | 3 |
| Pine 5 | [Poly Pizza](https://poly.pizza/m/igSu0cPoBz) | `pine-single-02.glb` | 1 | 1,646 | 2 | 3 |
| Pine Trees 01 | [Poly Pizza](https://poly.pizza/m/w8ZaiYjK8C) | `pine-trees-01.glb` | 5 | 10,366 | 10 | 3 |
| Dead Trees | [Poly Pizza](https://poly.pizza/m/F5I0Q7TwO5) | `dead-trees.glb` | 5 | 15,464 | 5 | 2 |
| Birch Trees | [Poly Pizza](https://poly.pizza/m/R7qMWzb7nk) | `birch-trees.glb` | 5 | 27,158 | 10 | 3 |
| Trees | [Poly Pizza](https://poly.pizza/m/etFGNvsiFv) | `trees.glb` | 5 | 32,220 | 10 | 3 |
| Bush | [Poly Pizza](https://poly.pizza/m/EoTERLq3z2) | `bush.glb` | 1 | 900 | 1 | 1 |
| Bush with Flowers | [Poly Pizza](https://poly.pizza/m/U1ymDy8tbY) | `bush-with-flowers.glb` | 1 | 1,368 | 2 | 2 |

## Runtime Rules

- Treat each configured named object as one model, not as a scene to clone.
- Preserve every Mesh below a named Group and its authored local transform.
- Normalize source units through authored target heights in metres.
- Compact accepted placements so rejected pool capacity is not drawn.
- Keep asset loading outside the streaming hot path.
- Any optimized derivative must preserve provenance, selected objects, material
  roles, and visual acceptance.
