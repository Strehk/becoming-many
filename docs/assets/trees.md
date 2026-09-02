# Tree and Shrub Assets

The vegetation source set contains eight CC0 GLBs from Quaternius. They cover
individual conifers, conifer packs, birches, general trees, dead trees, bushes,
and flowering bushes.

## Current Runtime Status

The files and manifest exist under `public/trees`. Every level that renders
Vegetation loads seven conifer variants, five deciduous variants, three birch
variants, two dead-tree variants, Bush, and Bush with Flowers. Shared source
URLs are loaded only once, so the four added conifers and the two added
deciduous crowns come out of `pine-trees-01.glb` and `trees.glb`, which were
already being fetched, and cost no additional transfer.

One of those seven conifers, `pine-7` (`PineTree_4` inside
`pine-trees-01.glb`), is not an upright cone: its trunk drifts more than two
units sideways over its own height and carries a nearly horizontal limb. At a
full share it put visibly crooked trees through the whole conifer forest, so
it is weighted at 0.15 against the other conifers' 1 — the rare leaning tree a
wood has, rather than a defect. Nothing in the placement path tilts a plant:
instances are rotated around the vertical axis only, so a visibly leaning tree
is always the model.

`birch-trees.glb` and `dead-trees.glb` are the only newly fetched files. They
were brought in for silhouette variety: the source crowns are low-poly solids
drawn with an unlit material, so a stand built from few variants reads as one
constructed shape repeated. Both carry fewer triangles per instance than the
deciduous trees whose share they take, so the mix does not raise the visible
triangle count that
[the 2026-08-24 performance audit](../performance-audit-2026-08-24.md) records
as the dominant bottleneck. It does raise the startup transfer by about 6.9 MB
against the roughly 19.4 MB that audit measured, which lands on the same
document's P2 finding that startup waits for all enabled assets. Dropping
either file from `variantsByZone` reverses that cost on its own.

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

All models are by Quaternius and published under CC0. The GLBs are stored as source files and are not yet PICO-optimized.

## Runtime Rules

- Treat each configured named object as a model, not as a scene to clone.
- Configure one tree object per variant. Multi-tree source groups are not valid
  placement units because every trunk needs its own terrain sample.
- Preserve every Mesh below a named Group and instance each model part.
- Normalize native model units through authored target heights in metres.
- Compact accepted placements so unused pool capacity produces no vertex work.
- Convert embedded textures to the selected runtime format only after PICO measurement.
- Do not create per-tree materials, textures, or scene graphs in the streaming hot path.
- Use shader-based wind or compact instance data for motion; these sources contain no skeletal animation clips.
- Unload complete vegetation sets through the module lifecycle.

The manifest records source URLs, checksums, mesh names, geometry counts, and
texture counts. It is stored at
[`public/trees/manifest.json`](../../public/trees/manifest.json).
