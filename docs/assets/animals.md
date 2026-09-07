# Animal Assets

The animal directory contains six animated GLB files: four ground animals,
a bat and a bird. The original duplicate Deer URL is stored once.

## Current Runtime Status

Files and per-asset provenance live under `public/models/animals`. Levels with
Animals load the four ground models; authored species counts produce ten actors
while only four visible animation mixers advance. Animal Passages loads the
bat and bird separately, with tracks from `public/routes/animal-passages/`.
The mosquito passage is a procedural swarm and needs only a route, no model.

## Inventory

| Animal | Source | File | Triangles | Estimated draw calls | Source clips |
| --- | --- | --- | ---: | ---: | ---: |
| Deer | [Poly Pizza](https://poly.pizza/m/T6Cs7tmMHJ) | `deer.glb` | 2,096 | 7 | 26 |
| Stag | [Poly Pizza](https://poly.pizza/m/tQdzbZ1Cmw) | `stag.glb` | 3,667 | 6 | 26 |
| Fox | [Poly Pizza](https://poly.pizza/m/Bc97C66HKi) | `fox.glb` | 1,848 | 5 | 24 |
| Rat | [Poly Pizza](https://poly.pizza/m/iltq5bVNaV) | `rat.glb` | 4,004 | 2 | 6 |
| Bat | Predecessor repository, attribution unrecorded | `bat.glb` | 498 | 1 | 2 |
| Bird | Predecessor repository, attribution unrecorded | `bird.glb` | 316 | 4 | 1 |

The four ground models are by Quaternius and recorded as CC0. They contain no
textures and use material colors. Bat and bird attribution remains unrecorded
in `provenance.json`; the bat contains one texture, the bird uses part colors.
See [material naming](material-naming.md) for the two rendering contracts.

## Animation Requirement

Animation data is required runtime content. Preserve skeletons, skins, clip names, and clips through every optimization step.

Deer and Stag provide attack, death, eating, gallop, jump, walk, hit-reaction, and idle clips. Fox provides the same core set with one attack clip. Rat provides attack, death, idle, jump, run, and walk clips.

Deer, Stag, and Fox contain both plain clip names and matching
`AnimalArmature|...` names. The current definition selects and verifies one
walk clip per species and does not play duplicate aliases.

## Runtime Rules

- Level Runtime loads only species named by the active preset. The manifest is
  attribution and inspection metadata, not runtime configuration.
- Verify the configured walk clip while creating each actor.
- Keep the population and nearest-visible count explicitly bounded.
- Spread actors across separate player-relative territories and choose the
  nearest species-compatible habitat instead of clustering around one sample.
- Stop and uncache animation state when an animal unloads.
- Any optimized derivative must preserve required clips and pass a visual check.

Provenance records source URLs, checksums, local metrics, and exact clip names.
