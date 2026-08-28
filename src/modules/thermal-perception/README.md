# Thermal Perception

This module contains the Level 05 thermal response as a composable unlit
material effect family.

The effect shows heat directly as a false-color ramp, but only inside an
authored radius around the viewer: the vertex stage writes the camera-space
radial distance (rotation-invariant, exactly like Echo Depth, so no camera
position uniform or per-frame update exists), and the fragment stage feathers
the palette ramp back into the underlying carried color at the radius edge. The
feather boundary is displaced by the detail field, so the heat view ends in a
ragged front rather than drawing a circle around the viewer.

## The temperature model

Every sensed surface reaches its final warmth the same way, and
`thermal-perception-settings.ts` holds the whole budget in one place:

```
  material baseline          what this kind of surface is, before anything local
+ environmental variation    elevation, exposure, canopy shade, water depth
+ within-object structure    per-vertex: body core, canopy height, blade root
+ spatial detail             per-fragment: two octaves of continuous noise
+ localized hotspots         the high tail of that same noise field
+ external heat sources      warm bodies bleeding into the ground under them
```

The split between the stages is the important part. **A vertex attribute can
never be finer than the mesh carrying it**, and terrain vertices sit two metres
apart: anything below roughly eight metres aliases against that grid instead of
reading as texture. So the vertex stage carries only what it can — the coarse
mottling and the within-object structure — and everything finer is measured per
fragment from a sampling position each variant publishes.

### Two bands that must not meet

The warmth axis is split. Everything that is not alive passes through a **soft
ceiling** it approaches but never reaches: below the knee the value is
untouched, above it an accumulation of boosts compresses asymptotically instead
of clipping. Living bodies start above that ceiling, and validation rejects an
authored `actorWarmth` that does not clear it.

This is what fixes two failures at once. Ground that could saturate the top of
the ramp made a sunlit forest slope read hotter than a deer standing on it, and
it left the heat pools warm bodies leave behind nowhere to go but a flat clipped
disc. Living bodies get a knee at one, where warmth is already clamped, so the
same expression leaves them untouched without a branch or a second program.

### Per consumer

- **Terrain** samples water depth, elevation, slope, and canopy shade on the CPU
  into a per-vertex `thermalWarmth` attribute during row streaming, plus two
  octaves of mottling. Canopy shade *scales* the solar-exposure gain rather than
  subtracting from the floor, so shaded forest ground reads cooler than open
  ground at the same elevation while dry land still never drops into the water
  band. The mottling only ever adds warmth, so the semantic order of water, low
  ground, and high ground survives. Floor, exposure, and mottling together reach
  0.62 — deliberately short of the ceiling, which leaves the whole compression
  range above it for the ground pools.
- **Vegetation and Rocks** hash their quantized instance world position into a
  stable base warmth, so a plant keeps its temperature across restreaming, and
  then vary it across the model: ground-warmed base grading into sky-facing
  canopy, warm inner volume grading into cooler outer foliage, plus an organic
  grain. Both gradients are zero-mean, so the level-authored warmth stays the
  instance average. The same hash also shifts where each instance samples the
  fragment detail field — without it, every instance of one model comes out
  identically textured, which is exactly the "two nearby surfaces at the same
  temperature" this sense has to avoid.
- **Animals** hold a torso band and a separate head-and-neck lobe, both placed
  as fractions of the species' own body height, with a cooler slice at the very
  top for ears and antler tips. The profile falls off smoothly downward, which
  is what makes a hoof colder than a knee and a knee colder than a haunch with
  no step anywhere between them.

  Normalized height is the *only* body coordinate the profile uses, and that is
  a deliberate limit: the actor's world offset turns with its heading, so height
  is the one coordinate that survives without the sense having to learn which
  way a given species faces. It also carries almost all of the information in a
  thermal image of a standing quadruped. Dividing by body height rather than
  working in metres is what lets one profile fit a 0.25 m rat and a 1.6 m stag.
  Animals is therefore handed the species height alongside the material, through
  the `ActorMaterialEffect` contract; every actor material carries its own copy
  of that one value while sharing the program.

  The pattern is anchored to the bind pose so it stays fixed to the body instead
  of swimming through it as the walk cycle plays.
- **Grass** is sensed through the hook it now carries. Its hand-written shaders
  expose the same injection anchors a three.js material does, so this module
  patches them like any other consumer. Grass is the only sensed surface that
  never stops moving, and its variant is the only one that reads values the
  consumer publishes about the current vertex — the deformed world position, the
  blade progress from root to tip, and the signed sway. Roots read warm against
  ground that has been warming all day, tips read cool in moving air, and the
  sway modulates the reading so the field twinkles. The shimmer therefore rides
  the grass's own motion and needs no time uniform here: the heat field itself
  stays static, exactly as the level decided, and only the thing that moves
  shimmers. The sward has no per-tuft warmth source of its own — what makes one
  tuft differ from the next is sampling the detail field in world space.

All surface consumers also carry a grazing-angle term: surfaces seen edge-on
read cooler, which is what gives a thermal image its soft cool rims and keeps an
object's silhouette and roundness readable once flat per-object color is gone.

## The detail field

`thermal-detail-field.glsl` is a sum of three plane waves per octave rather than
a hashed lattice noise. It is continuous and differentiable everywhere by
construction, so no octave can show a cell seam or a grid; it costs three sines
and three dot products instead of eight hashes and a trilinear blend; and its
high tail already falls into isolated, smoothly-bounded lobes, which is where
the **hotspots** are taken from instead of thresholding a second field. A
hotspot therefore rises out of the surrounding texture with a gradual falloff on
all sides rather than being cut out of it.

Each variant publishes its own sampling position: terrain and grass publish
world position, props their instance-local position pushed to a per-instance
phase, animals their bind-pose body offset. Hotspots are weighted by a published
"warm weight", so they gather on a torso and a face rather than on hooves.

The fine octave is finer than a pixel well before the sense radius ends and
would shimmer on a moving head-mounted display, so it fades out with distance
while the coarse octave carries on.

## Ground heat

Warm bodies bleed heat into the ground under them, from a fixed-size uniform
array sized by `THERMAL_GROUND_HEAT_SOURCE_COUNT` and mirrored as a compile-time
constant in `thermal-ground-heat.glsl`; unused slots carry zero strength, so the
constant loop needs no branch over a live count. This module never learns where
the positions come from: it exposes `clearHeatSources`/`addHeatSource` on the
terrain variant, Animals publishes the world positions of its rendered actors,
and the composition root is the only place that joins the two.

The pool is measured **per fragment**, and only terrain's program defines
`THERMAL_GROUND_HEAT`, so nothing else compiles the loop. The previous
vertex-stage version could not be this small: at two-metre vertex spacing a
short pool resolved into three or four samples and read as a flat faceted disc.
The kernel is a compact cubic — no square root, no smoothstep — and its squared
radius is displaced by the ground's own detail field so the edge wanders with
the texture underneath it. This is still the cheap ground-only stand-in for a
real screen-space thermal bloom, which would require a second render pass.

## The ramp

The six authored anchors are **anchors, not the visible colors**. Two things
make the gradient between them read as temperature rather than as segmentation:

- Every segment rises linearly and is then eased by a cubic whose end slopes
  match. The chained ramp is therefore continuous in its first derivative — no
  Mach band at a stop — while never reaching zero slope, which is what parks
  neighbouring temperatures on one color and reads as a band. A smoothstep chain
  does exactly that and is why it is not used. The easing is only C1 across a
  join while neighbouring segments are the same width, so the stops stay evenly
  spaced.
- Interpolation happens in gamma space: the uniforms arrive pre-encoded on the
  CPU and the result is squared back. In linear light every crossing is dragged
  through a desaturated midpoint — the cyan-to-magenta crossing in particular
  collapses into grey, which reads as a dead zone between two solid regions.

## Surface shading

The finished ramp is shaded so the surface stays faintly visible through the
false color, from the material's authored `diffuse` luminance plus the vertex
stage's hemispheric shade. It reads `diffuse` rather than the incoming
`diffuseColor` because the scene is unlit and the carried echo ramp runs before
this effect, at full intensity replacing `diffuseColor` outright with a pure
camera-distance value; `diffuse` is the last place surface identity survives.

That shade is deliberately weak, because **a thermal camera has no albedo**. The
per-part identity a lit scene would carry as color is carried as temperature
instead: the same tone drives a small warmth offset, which is what keeps a trunk
from reading identical to the foliage around it. The tone is read on a gamma
rather than a linear scale, because the carried echo palette authors its dark
stops close enough together that in linear light a trunk and a leaf are
separated by four thousandths.

The hemispheric shade is the one geometric light this sense adds, without which
a leaf's upper face and its underside are indistinguishable and foliage reads as
a flat cutout. Terrain deletes its normal attribute and passes the neutral
value. Both shades are bounded rather than raw products, because multiplying
would crush the darkest material slots to black and blow the palest ones past
the palette.

## Composition

One shared uniform set (intensity, radius, feather, ramp stops, palette) is
merged into every patched program, so all consumers respond to one sense
intensity. The composition root applies the terrain variant through
`TerrainMaterialEffect` (whose optional `warmthAt` sampler triggers the
attribute), the animal variant through `ActorMaterialEffect`, and the rest
through the shared `UnlitMaterialEffect` contract; this module never imports a
sibling module. All variants patch through the shared `applyShaderPatch` helper
— the composition root orders thermal first in each effect list so it wins the
final surface color over the carried echo ramp (first-applied executes last; see
`src/utils/asset-loader/material-shader-patch.ts`). The injected GLSL is a
function at global scope, so it can read attributes and uniforms but never a
local of three.js's `main()` — which is why the animal grazing term uses the
bind-pose normal rather than the skinned one, and why grass publishes its
deformed position as a call argument.

## Not part of this version

A runtime intensity driver (the preset authors intensity statically and the
composition root skips the effect entirely at intensity zero), temporal heat
variation or heat trails (the field is fully static apart from the ground pools
following the actors), heat bleeding into the air around a body, and any
additional thermal camera or duplicate render pass.

Two limits are worth naming because they are level data, not code. The per-slot
tone cue is weak on vegetation because the carried echo palette authors trunk
and leaf almost the same darkness; separating those two colors in the level
would widen it. And an animal's heat profile is vertical only, so a deer's head
and its rump sit in the same warm band — telling them apart would require the
sense to learn each species' forward axis.
