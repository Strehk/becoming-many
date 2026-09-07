# Shipping Assets

`public/` contains files delivered unchanged with the application. Group by
asset kind, then subject; runtime module ownership stays in TypeScript.

| Directory | Contents | Runtime consumer |
| --- | --- | --- |
| `public/models/animals/` | Four ground animals, bat and bird | Animals and Animal Passages |
| `public/models/vegetation/` | Trees and bushes | Vegetation |
| `public/models/rocks/` | Rocks and rock pack | Rocks |
| `public/routes/animal-passages/` | Bat, bird and mosquito flight tracks | Animal Passages |
| `public/audio/narration/{en,de}/` | Eight cue-named MP3s per language | Narration |
| `public/fonts/rubik/` | Bold font, provenance and original `OFL.txt` | End Credits |
| `public/firmware/m5-controller/` | Merged binary and installation manifest | Flash page |
| `public/favicon.svg` | Browser icon | HTML entries |

## Naming and boundaries

- Use English lowercase kebab-case. Preserve the original license filename.
- Use `-pack` for a model file containing several selectable objects and
  two-digit suffixes for otherwise equivalent file variants (`pine-01.glb`).
- Name narration files after their cue and tracks with `-route`.
- Keep source recordings, authoring files and documentation outside `public/`.
  There are currently no standalone shipping textures; see [textures](textures.md).
- File names are independent of internal mesh, skeleton, animation and material
  names. Preserve those names and authored transforms when reorganizing files.
- Keep array order and runtime IDs stable: vegetation and rock color selection
  can depend on definition order.

## Provenance

`provenance.json` beside the models, routes and font records attribution per
asset. It is inspection metadata, never runtime configuration. The firmware's
`manifest.json` remains the installation document consumed by esp-web-tools;
its binary path is relative to that manifest.

`sha256` and `metrics` describe the actual shipped bytes. GLB counts refer to
stored meshes/primitives, not the selected runtime instance or measured draw
calls. `previouslyRecordedSha256` preserves the mismatching value from an older
manifest for 16 ground-animal, rock and vegetation files. Its relationship to
the source download is unverified; it must not be presented as a source hash.
No binary content was changed during directory cleanup.

Original `sourcePath` values identify files in the predecessor repository and
must not follow local renames. Bat, bird and their three routes retain
`UNRECORDED` attribution pending the existing [content decisions](../direction/open-decisions.md).
Do not infer their license from the Quaternius models stored beside them.

## Content notes

- [Animals](animals.md)
- [Vegetation](vegetation.md)
- [Rocks](rocks.md)
- [Narration audio](audio.md)
- [Material naming](material-naming.md)
- [Firmware export](../../firmware/m5/README.md)
