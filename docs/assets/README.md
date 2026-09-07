# Shipping Assets

`public/` contains shipping files grouped by kind and subject.

| Directory | Contents | Runtime consumer |
| --- | --- | --- |
| `public/models/animals/` | Four ground animals, bat and bird | [Animals](animals.md) and Animal Passages |
| `public/models/vegetation/` | Trees and bushes | [Vegetation](vegetation.md) |
| `public/models/rocks/` | Rocks and rock pack | [Rocks](rocks.md) |
| `public/routes/animal-passages/` | Bat, bird and mosquito flight tracks | Animal Passages |
| `public/audio/narration/{en,de}/` | Eight cue-named MP3s per language | [Narration](audio.md) |
| `public/fonts/rubik/` | Bold font, provenance and original `OFL.txt` | End Credits |
| `public/firmware/m5-controller/` | Merged binary and installation manifest | [Flash page](../../firmware/m5/README.md) |
| `public/favicon.svg` | Browser icon | HTML entries |

- Use English lowercase kebab-case. Preserve the original license filename.
- Use `-pack` for a model file containing several selectable objects and
  two-digit suffixes for file variants (`pine-01.glb`).
- Name narration files after their cue and tracks with `-route`.
- Keep source recordings, authoring files and documentation outside `public/`.
- Preserve internal model names, transforms, runtime IDs and definition order;
  see [material naming](material-naming.md).

`provenance.json` records attribution and current file hashes. Shared attribution
applies to the whole file; mixed origins are recorded per asset. GLB metrics
describe stored geometry, not measured runtime draw calls. Original `sourcePath`
values refer to the predecessor repository. Bat, bird and routes retain
`UNRECORDED` attribution pending the [content decisions](../direction/open-decisions.md).

The firmware's `manifest.json` is consumed by esp-web-tools; its binary path is
relative to that manifest. Provenance files are not runtime configuration.
