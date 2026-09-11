# Shipping Assets

`public/` contains files shipped by Vite. Authored source recordings, modelling
files, intermediate exports, and design documents stay outside `public/`.

| Directory | Contents |
| --- | --- |
| `public/models/animals/` | Ground animals, bat, and bird GLBs |
| `public/models/vegetation/` | Tree and bush GLBs |
| `public/models/rocks/` | Rock GLBs and selectable packs |
| `public/routes/animal-passages/` | Authored passage tracks |
| `public/audio/narration/{en,de}/` | Cue-named narration recordings |
| `public/audio/tutorial/{en,de}/` | Spoken training recordings |
| `public/audio/granular/` | Approved granular source derivatives and provenance |
| `public/fonts/rubik/` | Credit font, licence, and provenance |
| `public/firmware/m5-controller/` | Merged firmware image and Flash manifest |

Adjacent `provenance.json` files record attribution, source URLs, hashes, and
stored asset facts. They are evidence, not runtime configuration. Preserve
licence files and unresolved attribution markers until their owning issue is
resolved.

Use English lowercase kebab-case names. Use `-pack` for files containing several
selectable objects and two-digit suffixes for variants. Narration file stems
match cue IDs; route files use `-route`.

## Speech loudness

Narration and tutorial speech use offline two-pass FFmpeg loudness normalization
targeting -16 LUFS, -2 dBTP and 11 LU loudness range. Verify the encoded output
within 1 LU of the loudness target and below -1 dBTP, including MP3 overshoot.
Preserve recording duration, sample rate and channel count so authored cues stay
aligned. No additional runtime gain or processing is required.

## GLB material contract

Material names are case-sensitive visual roles:

| Content | Material roles |
| --- | --- |
| Vegetation | `trunk`, `leaf`, `flower` |
| Rocks | `dark`, `light` |
| Ground animals | `fur`, `furLight`, `furDark`, `feature` |

Level-controlled materials ignore embedded base-colour textures where necessary
to preserve authored colour. Bat and bird belong to Animal Passages and retain
their authored material treatment.

## Runtime rules

- Preserve selected object names, child mesh transforms, material roles,
  skeletons, skins, required animation clips, and definition order.
- Treat a configured named Group as one model and preserve every mesh below it.
- Normalise model scale through typed target heights in metres.
- Load source assets before live streaming work and share identical URLs within
  one preload request.
- Keep actor counts, visible animation mixers, instances, voices, and decoded
  buffers explicitly bounded.
- Release animation, material, texture, geometry, and decoded audio resources at
  their owning lifetime.
- Any optimised derivative keeps provenance and passes relevant visual,
  animation, and performance checks.

Exact inventories and geometry metrics live in the provenance files and current
module definitions, not in a duplicated Markdown catalogue.
