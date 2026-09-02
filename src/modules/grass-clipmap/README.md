# Grass Clipmap

This module contains the clipmap grass field, ported from the standalone
grass demo. It is the grass of the narrative chain: `echo.level.ts` authors
it and every later preset carries it by spreading that one. The older
`grass/` module stays in the repository, authored only by the test and
design presets; two implementations cannot both answer the open question
about cost, and this one reaches further for less.

The blades answer to the senses like any other surface. Nothing here
authors a look beyond a base gradient: Echo Depth takes their color
outright, Thermal covers it inside its radius, and the World Fade dissolves
them with the rest of the world.

## What it does

Concentric rings of square chunks follow the camera. Level 0 carries the
smallest chunks; every further level doubles the edge length and encloses
the previous one as a ring, so the covered area grows exponentially while
the chunk count grows linearly. At the authored layout — ring 4, four
levels, 32-metre coverage — the chunks are 8, 16, 32, and 64 metres, the
field reaches 256 metres, and grass is *guaranteed* to stand for 128 of
them, which is exactly where the blades fade out.

One blade is one instance and exactly one `vec3` leaves memory for it: its
low-discrepancy cell in the chunk plus its rank. World position, facing,
height, bend, wind, colour, and the whole lighting are derived in the
vertex shader from a hash of the world position. Every chunk of every
level shares one instance buffer of 65,536 entries, 786 KB for the entire
field, and no vertex buffer is ever touched again while walking.

Density falls with the square of the distance. Each level allocates what
that law demands at its inner edge, in quarter steps, and the shader thins
the rest continuously by rank — because the instances follow a
low-discrepancy sequence, every subset "rank < f" is spread evenly, so `f`
can come straight from the distance without leaving holes. Blades crossing
the threshold shrink to zero over a band instead of vanishing, so the
thinning dissolves spatially instead of travelling as a visible edge.

Culling happens per blade in the shader, before any hash, sample, or sine:
rank, distance, and the four frustum side planes. A rejected blade costs
about twenty instructions instead of three hundred, and all its vertices
take the same branch, so the triangle degenerates at setup. That is what
makes the chunk size a free parameter — the culling accuracy no longer
depends on how finely the field is cut.

## The height field

The source demo reads its ground from an analytical sine sum, identical in
GLSL and JS, so nothing per blade ever leaves memory. This world's ground
is `getGroundY`: four Perlin lookups against a permutation table plus a
carved river. Ported to GLSL that would be roughly 160 table reads with a
dynamic index per vertex, which the target device cannot pay.

So the ground arrives sampled, in a camera-following texture
(`grass-height-field.ts`). Its texel grid is Terrain's own vertex spacing —
64-metre chunks with 32 segments, so two metres — which means the samples
are the same points the terrain mesh is built from: the grass follows the
surface the viewer actually sees, closer than an approximate analytical
function would. The second channel carries how much grass the zone allows,
so one fetch answers both questions and water and forest stay bare.

The window is 192 texels square, snapped to its own texel grid so a refill
never shifts the sample points. Leaving its safe radius starts a refill
through the shared stream queue, and the new window is published only once
it is complete — a half-filled one would root blades in two worlds at
once. The first window is filled synchronously during `load`, measured at
**35.8 ms**; streaming it instead would trade that one-time cost for grass
appearing a second into the level.

## What was not ported

The demo's nine-way quality UI, its runtime layout and density API, its
benchmark harness, its own sky, ground, and controls, its additive zone
mode, and its flat single-colour blade mode. The flat mode is measured at
7 % faster and unusable at these blade widths, where unshaded overlapping
blades merge into one green surface.

Wind direction and strength come from the shared `WORLD_WIND`, as they
must for every wind-reactive module; the travelling gust wave that carries
them across the field is this module's own.

## Senses and the lighting block

The shaders carry the three.js chunk anchors `<common>`,
`<project_vertex>`, and `<color_fragment>`. That is the whole
material-effect hook: a sense patches this `ShaderMaterial` through
`applyShaderPatch` exactly as it patches a built-in pass. The chunk matrix
is a pure translation, so the vertex stage hands `<project_vertex>` the
local position, and every effect gets the `mvPosition` and `transformed` it
measures against.

The field carries a full lighting model from the demo — wrap lighting,
ambient occlusion, translucency, a specular tip, and fog. Wherever a sense
is patched in, `GRASS_LIT` compiles all of it out: the sense replaces the
color anyway, so roughly eighty instructions per vertex would be computed
and discarded. What remains is the root-to-tip gradient that shows below
full sense intensity. The lit path is what a level without senses gets.

Grass takes its own heat response, not vegetation's. It grows out of the
ground and holds the ground's temperature; a canopy holds its own. Carrying
the bushes' values made a whole meadow read as one flat hot surface, so
Thermal Perception gained a `grass` consumer authored just above the
ground's own reading. It carries no spread and no internal gradient: both
come from an instance matrix, and a blade derived entirely in the vertex
shader has none.

## What is still open

- Nothing is measured on a PICO 4. The 2026-08-24 performance audit parked
  the older grass because the heat view's per-fragment cost over a dense
  field was unmeasured. That question is unchanged, and the field is now
  running in every level from echolocation on rather than waiting.
- The frustum planes come from the base camera. Under WebXR each eye has
  its own frustum, so the cull radius carries the difference for now.
- Two grass modules now exist. Retiring one is a decision, not a cleanup.
