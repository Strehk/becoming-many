<!--
Purpose: Document the Thermal Perception level (05) as designed and as built.
Context: Thermal Perception is the fourth sense level, following Motion Perception.
Responsibility: Keep narrative intent, the exact preset, and open decisions in one place.
Boundary: The Level Guide owns the cross-level sequence; modules own their implementations.
-->

# 05 — Thermal Perception

## Narrative Intent and Experience Goal

Reveal the world through temperature differences ("Snake"). Some snakes
have pit organs whose heat signal merges with vision; here that merged view
becomes a false-color heat image, and living animals stand out like prey
because being alive means giving off heat, and heat cannot keep a secret
(see `script/en.md`, "Infrared"). Heat is a near sense: the false-color
view exists only inside a bounded radius around the traveler and feathers
back into the carried grayscale world beyond it.

## Entry, Exit, and Timeline Cues

- Enters from Motion Perception: the depth-ramped world and the printed
  motion trails stay exactly as they were; the heat view fades in around
  the traveler, and warm animal bodies join the world for the first time.
- Exits toward Magnetic Field Perception: thermal values later fade as
  large-scale directional magnetic patterns become visible.
- The timeline driver (audio clock / schedule) is unresolved — see
  `docs/direction/open-decisions.md` §2. Until then the sense intensity is
  authored statically in the preset and this level runs standalone from
  `src/main.ts`; no cross-level transition machinery exists yet.

## Visual and Audio Direction

Palette (see [moodboard](mood/moodboard.png)):
`#2E1386` `#0C47D1` `#2EB4E8` `#D5198A` `#FB5F16` `#FCCE43`

Decided art direction (2026-08-28): the documented level-05 palette maps
cold to hot across a six-stop ramp. The temperature field is expressive
but physically motivated — water reads coldest and colder with depth, dry
ground warms with elevation, forest regions and steep faces hold extra
warmth — and it is fully static (no temporal variation or heat trails in
this step). The heat view reaches 30 metres and feathers over 10 metres
back into the carried echo grayscale, so distance keeps its established
meaning outside the thermal radius. Animals carry one constant near-hot
warmth (0.92) and read as magenta-to-yellow signatures; their base fur
colors come from the level-03 dark stops so they sit inside the echo
palette outside the radius. No audio counterpart exists yet.

Continuous temperature field (decided 2026-08-28, revising the above):
the first build assigned one warmth per object, which read as flat color
regions rather than a thermal image. Warmth became a continuous field that
varies across every sensed surface.

Per-fragment temperature field (decided 2026-08-28, revising both of the
above and reversing a ruling below): that continuous field was still
carried entirely by vertex attributes, so on terrain nothing finer than
the 2-metre vertex grid could exist and the ground still read as broad
flat regions. Temperature is now measured in the fragment stage as well —
two octaves of continuous noise, localized hotspots taken from the high
tail of the coarse one, and the ground pools under warm bodies. The
warmth axis was also split into two bands that cannot meet, because the
old terrain budget could saturate the top of the ramp and let a sunlit
forest slope read hotter than a deer standing on it.

The palette itself is unchanged: the six documented moodboard stops still
map cold to hot. They are now anchors rather than visible colors — the
ramp interpolates between them in gamma space with a C1 easing, so what
the level shows is the continuous gradient through them.

## Exact Typed Preset and Active Modules

- Preset: `src/levels/thermal.level.ts` (`testUi: true`, 128-metre view
  distance, background `0xF1F1F1` equal to the carried ramp haze stop).
- Fields: `terrain`, `vegetation`, `rocks`, `airParticles`,
  `scentParticles`, `echoDepth`, and `motion` copied unchanged from
  `motion.level.ts`, plus `animals` (echo-palette fur colors) and
  `thermal: ThermalPerceptionParameters` (intensity 1, 30-metre radius,
  10-metre edge feather, the six documented palette stops, vegetation
  warmth 0.44 ± 0.14, rock warmth 0.31 ± 0.11, actor warmth 0.95). The
  three warmth values are the centre of a distribution, not a color
  anyone sees; `actorWarmth` is a body core and validation rejects a
  value that does not clear the module's environment ceiling.
- Active modules: everything the Motion level activates, plus Animals and
  Thermal Perception (`src/modules/thermal-perception/`): one shared
  material-effect family applied by the composition root to Terrain
  (per-vertex CPU-sampled warmth attribute), Vegetation and Rocks (stable
  hashed per-instance warmth), and Animals (a body-height profile). The
  composition root orders thermal first in every effect list so it wins
  the final surface color over the carried echo ramp, and skips the module
  entirely at intensity zero. The sense never imports or recolors a
  sibling.
- Grass is now sensed (decided 2026-08-28, reversing its exclusion). It
  was excluded because its hand-written shaders had none of the anchors
  `applyShaderPatch` needs; they now carry those anchors, so both the echo
  ramp and the heat view reach grass like any other surface. Grass also
  publishes its blade progress and current sway at the injection point,
  which is how the heat reading shimmers as the wind moves it.
- Grass still sits in the wrong level. Ground cover is a world element,
  not a sense, so if it stays it belongs in `echo.level.ts` and levels 03
  and 04 should carry it too; today it appears for the first time when
  thermal starts. Three test assertions currently lock grass out of those
  levels.

## Asset and Shader Requirements

- No new external assets; the level reuses the existing animal, tree, and
  rock GLBs.
- Eight module-owned GLSL files. Fragment stage:
  `thermal-perception.frag.glsl` (the eased gamma-space ramp, the soft
  ceiling, the slot-tone warmth, and the radius feather mask),
  `thermal-detail-field.glsl` (the two noise octaves and the hotspot
  tail, shared by every consumer), `thermal-ground-heat.glsl` (compiled
  only into Terrain's program). Vertex stage:
  `thermal-surface-structure.glsl` (grain field, grazing-angle term, and
  hemispheric shade, shared by the instanced and actor variants) plus
  four variants — `thermal-terrain.vert.glsl` (warmth attribute and world
  sampling position), `thermal-instanced.vert.glsl` (instance-position
  hash, within-model gradients, per-instance detail phase),
  `thermal-actor.vert.glsl` (the body-height temperature profile),
  `thermal-grass.vert.glsl` (root-to-tip warmth and sway shimmer). All
  patch consumers' existing materials through the shared
  `applyShaderPatch` helper; the radius needs no camera uniform because
  the camera-space view distance is already camera-relative.
- The injected GLSL is a function at global scope and cannot read a local
  of three.js's `main()`, which is why the animal grazing term uses the
  bind-pose normal instead of the skinned one.

## Performance Budget and Measured Evidence

- No additional thermal camera, render pass, geometry, texture, or draw
  call; the effect rides the existing opaque surface passes.
- **Per-fragment cost rose substantially, and this is the open risk in
  the level.** Every sensed surface now evaluates six sines and three dot
  products for the two detail octaves, two smoothsteps (detail distance
  fade, hotspot tail), one `sqrt` for the slot tone, one `exp` for the
  soft ceiling, and five eased ramp segments instead of five plain
  `mix`es. Terrain adds a constant-bounded four-iteration pool loop, now
  per fragment rather than per vertex; the kernel is a compact cubic with
  no square root and no smoothstep to keep that affordable.
- The lever for that cost is compiled, not multiplied by zero: a consumer
  whose three detail amplitudes in `THERMAL_PERCEPTION_SETTINGS` are all
  zero compiles no detail field at all (`#define THERMAL_DETAIL` is
  omitted), and it can be pulled per surface kind. Grass carries the
  worst overdraw in the scene and is the cheapest one to give up.
- Removed per-vertex cost: the ground-heat loop left the terrain vertex
  stage. Remaining added per-vertex cost: three sines and a dot product
  for the grain and grazing terms on instanced props and animals. Terrain
  carries roughly 27k vertices at the level's 128-metre view distance.
- Terrain warmth sampling gained two `ImprovedNoise` lookups per streamed
  vertex, inside the existing row-bounded chunk jobs.
- Terrain streaming samples one extra `zoneConditionsAt` per vertex during
  row-bounded chunk generation (the same order of work as the Terrain
  Colors presentation path) and uploads one extra float attribute
  (~4 KB per 33×33 chunk).
- Animals add their bounded population cost (at most six visible actors, the
  same budget the Test Level now carries), and terrain fragments evaluate one
  ground heat pool per visible actor.
- No hardware desktop measurement has been recorded for this level yet.
- The standalone PICO 4 / 90 FPS gate is not yet measured; no 72 Hz or
  90 Hz headset claim is approved.

## Decisions, Risks, and Open Questions

- Radius through view distance (decided 2026-08-28): "thermal only near
  the viewer" is implemented as the camera-space radial distance already
  used by Echo Depth, so the effect needs no per-frame uniform updates and
  no update hook on Vegetation or Rocks effects.
- Static field (decided 2026-08-28, refined): the sense still has no time
  uniform and no heat trails. Two things move anyway, and both borrow
  motion that already exists rather than adding a clock — the ground heat
  pools follow the animals, and grass warmth shimmers with its own sway.
  Temporal variation of the field itself remains an open art decision.
- The echo ramp is carried verbatim (senses layer, never swap) even though
  the thermal ramp covers it inside the radius; the composition-root
  ordering comment and a regression test lock the thermal-wins behavior.
- Terrain warmth samples zone conditions during streaming; if a future
  preset combines the Terrain Colors presentation with thermal, the same
  conditions are sampled twice per vertex (bounded by row streaming, noted
  in the module README).
- Per-part warmth (decided 2026-08-28, closing the open question below):
  vegetation warmth reads per part, not per plant. The instance hash still
  fixes one stable base temperature per plant, and zero-mean height and
  axis gradients plus an organic grain vary it across trunk, branches, and
  foliage, so the authored value keeps its meaning as the plant average.
- Transparent cold end (decided 2026-08-29): the coldest end of the ramp
  stopped being a color. Below 0.18 warmth the heat view is fully
  transparent and the carried echo depth map shows through untouched;
  the false color fades in with temperature and is fully opaque by 0.62.
  Heat is now a highlight inside the depth world rather than an image
  that replaces it: water and cold ground carry no false color at all,
  warm ground is tinted, and a living body is the only thing solid enough
  to hide the depth map underneath it. The stop sits below the
  environment ceiling on purpose, so no part of an animal is ever
  half-there; a test locks that. This is a second fade independent of the
  radius feather, and the two multiply — one bounds the sense in space,
  the other in temperature. It also settles what the first ramp anchor is
  for: it now only ever appears part-way faded, as a cool wash over the
  depth image rather than as a color anything actually reads as.
- Ground budget lowered (decided 2026-08-29): terrain's floor, exposure,
  and mottling were cut from 0.62 to 0.48 at the top, with water dropping
  from 0.11 to 0.07 at the shoreline. Ground is the backdrop bodies are
  read against, and the warmest patch in the world belongs in the cool
  half of the ramp. Together with the transparent cold end this is what
  leaves a typical meadow reading as almost pure echo depth.
- Ironbow palette (tried and reverted 2026-08-29): the six anchors were
  briefly replaced with a camera-style ironbow ramp — `#200A4E` `#2E3CC8`
  `#D0342C` `#F97B14` `#FFD84A` `#FFFFFF`, dark purple and blue at the
  cold end, red and orange through the middle, bright yellow and white at
  the top — and the documented moodboard palette was restored the same
  day. The level keeps `#2E1386` `#0C47D1` `#2EB4E8` `#D5198A` `#FB5F16`
  `#FCCE43`.

  One observation from the attempt is worth keeping, because it is a real
  property of the moodboard ramp rather than an argument for replacing
  it: brightness does not rise monotonically across the anchors. The cyan
  stop is brighter (0.39 relative luminance) than the magenta above it
  (0.17), so a mid temperature can look brighter than a higher one, and
  ordering two readings by eye depends on hue rather than on brightness.
  The transparent cold end and the lowered ground budget both reduce how
  often that matters, since the cyan band now mostly appears part-way
  faded over the depth image.
- Animal body profile (decided 2026-08-28, revised 2026-08-29):
  `actorWarmth` is the core body temperature, and the distribution around
  it is a torso core plus a separate head-and-neck lobe, both placed as
  fractions of the species' own body height, with a cooler slice at the
  top for ears and antler tips and a smooth falloff downward through legs
  into cold hooves.

  The 2026-08-29 revision added the second body coordinate and took the
  texture off the animals. The torso core is now a lobe in *two*
  coordinates — normalized height and distance from the body's own
  vertical axis — because the actor's world offset turns with its heading
  and those are the two coordinates that survive it: rotating a body
  turns it around exactly that axis. Height alone made one horizontal
  slab of body read equally hot end to end, so a deer's head and its rump
  sat in the same warm band; the radial term keeps the heat in the deep
  trunk and lets it fall away through the flanks toward nose and tail.
  The core's inner width also narrowed, so the top of the ramp is a place
  on the animal rather than a plateau across a third of it, and
  `actorWarmth` was authored up to 1.0: a living core and a face are now
  the only things in this world that reach `#FCCE43`. The remaining cost
  is that the profile still cannot tell a head from a tail — the head
  lobe is a height, so a species carrying its head low would need a
  forward axis the sense does not have.
- Animal texture subordinate to the gradient (decided 2026-08-29): the
  fragment detail on animals is now roughly a third of its previous
  amplitude at two thirds of its wavelength, and the hotspot tail dropped
  from the strongest in the scene (0.085) to 0.02. Animals were carrying
  the same texture as the ground, and the hotspots in particular put
  bright patches wherever the noise field happened to peak — heat that
  the viewer reads as coming from somewhere on the body rather than from
  the body's own structure. An animal is the one thing in this world
  heated from inside, so on a body the detail is grain over a temperature
  and never the temperature itself; a test locks the whole detail budget
  under a third of the profile's core-to-hoof span.
- Species body height crosses the boundary (decided 2026-08-28): a
  distribution in fractions of body height needs the body height, so
  Animals now hands effects the species height alongside the material
  through a new `ActorMaterialEffect` contract in
  `src/utils/asset-loader/material-effect.ts`. An `UnlitMaterialEffect`
  satisfies it unchanged, and every actor material carries its own copy
  of that one value while sharing the program. Extending the contract was
  chosen over the alternative of authoring thermal anatomy per species in
  `animals-definition.ts`, which would have put sense knowledge inside
  the Animals module.
- Two warmth bands (decided 2026-08-28): everything that is not alive
  passes through a soft ceiling it approaches but never reaches, and
  living bodies start above it. The old terrain budget summed floor,
  elevation, forest, slope, and mottling to exactly 1.0, so a high
  forested slope saturated the hottest palette color while an animal sat
  at 0.92 — the environment could read hotter than the animals the level
  exists to reveal, and clipping at the top also parked large regions on
  one flat value. Terrain now reaches 0.48 (lowered from 0.62 on
  2026-08-29: ground is the backdrop bodies are read against, and the
  warmest patch in the world belongs in the cool half of the ramp), and
  the compression above the knee is what absorbs the ground pools
  instead of clipping them. Forest
  cover also changed sign: canopy shade now scales the solar-exposure
  gain down rather than adding warmth, which is both more physical and
  keeps dry land above the water band.
- Ramp continuity (decided 2026-08-28, refining the linear segments):
  every segment is still linear but is now eased by a cubic whose end
  slopes match, so the chained ramp is C1 across each stop — no Mach band
  at a corner — while never reaching zero slope, which is what a
  smoothstep chain does and why it is still not used. The easing is only
  C1 while neighbouring segments are the same width, so the stops must
  stay evenly spaced; a test locks that. Interpolation also moved to
  gamma space, because in linear light the cyan-to-magenta crossing
  collapses into grey and reads as a dead zone between two solid regions.
- Material tone as temperature (decided 2026-08-28): a thermal camera has
  no albedo, so the surface-slot brightness that used to only darken the
  false color now also shifts the temperature, and the brightness share
  was reduced. The tone is read on a gamma rather than a linear scale
  because the carried echo palette authors its dark stops close enough
  together that in linear light a trunk and a leaf differ by four
  thousandths. That cue stays weak on vegetation for the same reason —
  it is level data, and separating trunk and leaf colors in the level
  would widen it.
- Grass `diffuse` declaration (fixed 2026-08-28): `grass.frag.glsl`
  declared its `diffuse` uniform *after* `#include <common>`, which is
  exactly where every material effect injects, so any effect reading the
  documented base tone referenced an identifier declared below it. The
  declaration moved above the include.
- Ground heat pools (decided 2026-08-28, revised 2026-08-29): warm
  bodies warm the ground under them through a fixed-size uniform array on
  the terrain variant, republished each frame by the composition root
  from the positions Animals publishes. This adds the one per-frame
  uniform update the original design avoided. The pool moved from the
  vertex stage to the fragment stage: at 2-metre vertex spacing a short
  pool resolved into three or four samples and read as the flat faceted
  disc it was meant to replace. Its squared radius is displaced by the
  ground's own detail field so the edge wanders instead of drawing a
  circle. The 2026-08-29 revision halved it again, from 3.2 metres and
  0.26 warmth to 1.8 and 0.15: at the old size an animal read as standing
  in the middle of a warm clearing, which is the same failure as the
  faceted disc in a softer form. The pool is a body length across, the
  cubic falloff has given up most of its strength inside that, and the
  ground under an animal now stays clearly below the animal's own coolest
  skin.
- Surface tone through the ramp (decided 2026-08-28): the false color is
  shaded by the material's authored `diffuse` luminance, so trunk, foliage,
  fur, and feature slots stay distinguishable instead of flattening onto
  one tone. It reads `diffuse` rather than the incoming `diffuseColor`
  because the carried echo ramp at intensity 1 replaces `diffuseColor`
  with a pure camera-distance value before thermal runs — there is no
  lighting, shadow, or texture left in the pipeline at that point, and the
  authored material color is the last place surface identity survives.
- Hemispheric shade (decided 2026-08-28): Thermal Perception adds one
  geometric light — a ground-to-sky gradient from the world normal on
  Vegetation, Rocks, and Animals — so branches and foliage read as volume.
  This is the first shading in the piece, which is otherwise entirely
  unlit; it was taken deliberately because per-part material tone alone
  cannot separate leaves inside one canopy material. It stays a vertex
  term on normals already fetched for the grazing coolness, so it adds no
  fragment work, no light object, and no material change. The contrast is
  kept moderate because double-sided foliage cards carry inverted normals
  on their back faces. If the piece later wants its unlit look back, the
  two shade values in `THERMAL_PERCEPTION_SETTINGS.surfaceShade` set to 1
  remove it.
- Ruled out (2026-08-28): heat bleeding into the air *around* a body. It
  is a screen-space effect needing the scene rendered to a texture and a
  blur pass, which contradicts this level's no-extra-pass budget while the
  PICO 4 / 90 FPS gate is still unmeasured. The ground pools are the cheap
  stand-in; the grazing-angle rim carries the rest of the read.
- Ruled out (2026-08-28): a wider rainbow ramp reaching green and white.
  The documented six-stop moodboard palette stands; the flatness was
  caused by per-object warmth, by smoothstep plateaus at the ramp stops,
  and by the absence of any temperature detail below mesh resolution —
  not by the number of colors.
- Reversed (2026-08-28): "finer ground texture would need per-fragment
  noise on the largest fill-rate consumer in the scene, which the
  performance rules rule out." Per-fragment noise is now in, on every
  sensed surface, on an explicit instruction to make the temperature
  field itself finer. The earlier ruling was made on PICO 4 / 90 FPS
  grounds and **that gate is still unmeasured**, so the reversal is a
  deliberate open risk rather than a settled trade: the noise is a
  three-wave sum rather than a hashed lattice, the fine octave fades out
  with distance, and the whole field compiles out per surface kind. If
  the headset measurement fails, that switch is the first thing to pull —
  before raising terrain segments per chunk, which remains the
  alternative for ground texture specifically.
- Open art decisions: physical versus expressive temperature mapping
  tuning against real headset contrast; radius and feather width against
  the dramaturgy; temporal variation and heat trails.
