<!--
Purpose: Record source, license, and runtime use of the first rock assets.
Context: Rocks are loaded as zone-driven instanced content in Test Level.
Responsibility: Keep asset provenance and current technical boundaries visible.
Boundary: Placement settings and runtime ownership remain in src/modules/rocks.
-->

# Rock Assets

`public/rocks` contains four Quaternius GLBs from Poly Pizza. All are CC0 and
their source pages, direct downloads, and checksums are recorded in
`public/rocks/manifest.json`.

| Runtime ID | Source | File | Selected object |
| --- | --- | --- | --- |
| Rock pack | [Poly Pizza](https://poly.pizza/m/gYhoEOKItJ) | `rocks-pack.glb` | `Rock_2` |
| Medium rock | [Poly Pizza](https://poly.pizza/m/KZdEP3uUpa) | `rock-medium.glb` | `Rock_Medium_2` |
| Small rocks | [Poly Pizza](https://poly.pizza/m/OQvi8PIZ40) | `rocks.glb` | `Rock_3` |
| Gold rock | [Poly Pizza](https://poly.pizza/m/49NgnJzOHc) | `gold-rocks.glb` | `Resource_Gold_3` |

The named object may be a Mesh or a multi-part Group. Rocks preserves every
mesh part, applies an authored target height in metres, and compacts accepted
zone placements into fixed instanced buffers. Runtime mesh simplification and
LOD remain deferred until physical PICO measurement requires them.
