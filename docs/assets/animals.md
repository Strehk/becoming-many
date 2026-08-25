# Animal Assets

The first animal set contains four unique animated GLB files. The Deer URL was supplied twice and is stored once.

## Current Runtime Status

The files and manifest exist under `public/animals`. Test Level loads all four
models from `/animals/...`; authored species counts produce ten actors while
only the nearest four animation mixers advance.

## Inventory

| Animal | Source | File | Triangles | Estimated draw calls | Source clips |
| --- | --- | --- | ---: | ---: | ---: |
| Deer | [Poly Pizza](https://poly.pizza/m/T6Cs7tmMHJ) | `deer.glb` | 2,096 | 7 | 26 |
| Stag | [Poly Pizza](https://poly.pizza/m/tQdzbZ1Cmw) | `stag.glb` | 3,667 | 6 | 26 |
| Fox | [Poly Pizza](https://poly.pizza/m/Bc97C66HKi) | `fox.glb` | 1,848 | 5 | 24 |
| Rat | [Poly Pizza](https://poly.pizza/m/iltq5bVNaV) | `rat.glb` | 4,004 | 2 | 6 |

All models are by Quaternius and published under CC0. The files contain no textures and use material colors.

## Animation Requirement

Animation data is required runtime content. Preserve skeletons, skins, clip names, and clips through every optimization step.

Deer and Stag provide attack, death, eating, gallop, jump, walk, hit-reaction, and idle clips. Fox provides the same core set with one attack clip. Rat provides attack, death, idle, jump, run, and walk clips.

Deer, Stag, and Fox contain both plain clip names and matching `AnimalArmature|...` names. Keep the source files unchanged for now. The animal module must later map semantic actions to one verified clip family without playing duplicate aliases.

## Runtime Rules

- Level Runtime loads only species named by the active preset. The manifest is
  attribution and inspection metadata, not runtime configuration.
- Verify the configured walk clip while creating each actor.
- Keep the population and nearest-visible count explicitly bounded.
- Spread actors across separate player-relative territories and choose the
  nearest species-compatible habitat instead of clustering around one sample.
- Stop and uncache animation state when an animal unloads.
- Any optimized derivative must preserve required clips and pass a visual check.

The manifest records source URLs, checksums, local metrics, and exact clip names.
