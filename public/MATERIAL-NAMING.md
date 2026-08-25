<!--
Purpose: Define semantic material names for runtime GLB assets.
Context: Level presets control colors without depending on vendor-specific names.
Responsibility: Document the exact names understood by the rendering modules.
Boundary: Mesh, object, animation, and file naming are outside this contract.
-->

# GLB material naming

Material names describe visual roles, not source assets or colors. They are
case-sensitive and use lower camel case where more than one word is needed.

## Vegetation

| Material | Level color |
| --- | --- |
| `trunk` | `trunkColor` |
| `leaf` | `leafColor` or `leafAccentColor`, selected per model variant |
| `flower` | `flowerColor` |

## Rocks

| Material | Level color |
| --- | --- |
| `dark` | `darkColor` |
| `light` | `lightColor` |

## Animals

| Material | Level color |
| --- | --- |
| `fur` | `furColor` |
| `furLight` | `lightFurColor` |
| `furDark` | `darkFurColor` |
| `feature` | `featureColor` |

`feature` covers small contrasting parts such as hooves, horns, eyes, noses,
and exposed skin. All materials in production GLBs must use one name from the
corresponding table. Level-controlled materials ignore their embedded base
color texture so that the authored level color remains exact.
