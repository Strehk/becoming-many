# Thermal Perception

This module contains the Level 05 thermal response as a composable unlit
material effect family.

The effect shows heat directly as a false-color ramp, but only inside an
authored radius around the viewer: the vertex stage writes the camera-space
radial distance (rotation-invariant, exactly like Echo Depth, so the radius
still needs no camera position uniform), and the fragment stage feathers
the six-stop palette ramp back into the underlying carried color at the radius
edge. The carried color also keeps an authored share of every sensed surface,
so the false color reads as heat seen through the grey echo world rather than
painted over it, and that ramp's own near-dark to far-pale shading stays
underneath as a quiet depth cue. The warmth value 0..1 comes from a different source per consumer, and
in every case it varies across the surface rather than flooding it with one
tone. Terrain samples elevation plus zone conditions on the CPU into a
per-vertex `thermalWarmth` attribute during row streaming (water reads cold
and colder with depth; dry ground warms with elevation, forest, and slope).
Vegetation and Rocks hash their quantized instance world position into a
stable variation around an authored base warmth, so a plant keeps its
temperature across restreaming, and then shade that base by the vertex's own
height and axis distance measured in metres: because the instance matrix
carries the per-object scale, one authored gradient per metre reads the same
on a 0.6 m shrub and a 10 m tree: warmth climbs toward an exposed crown and
its fine outer branches, and toward the face of a rock the sun reaches, while
a shaded trunk or a rock's flank stays near its own base temperature.

Plants come in two statures, and each carries its own set of those values.
The gradient is shed over a plant's own metres, so a bush a metre tall and a
metre across sheds almost nothing over its own size and reads at very nearly
its base everywhere: given the canopy's values it was the one thing in the
landscape holding a single warm color across its whole body, and no per-metre
value could fix that, because it has no metres to lose warmth over. The
`undergrowth` effect authors it from the grass upward instead, with its own
band, so a bush reads as the meadow it stands in at two thicknesses and keeps
only a little held heat in its middle. Vegetation asks which effect a model
takes once per model at load, by stature.

Animals are warmest at a body core:
the consumer supplies, per animated mesh, the matrix mapping mesh space onto
its actor's normalized body space (y 0..1 from lowest point to crown), and
the actor shader falls off from an authored core inside that space, so legs,
snouts, tails, and antlers cool with how far they reach away from the torso.
Skinning runs before the injection anchor, so the measurement reads the posed
body; expressing the core in fractions of each actor's own height keeps one
authored shape valid for every species. Grass has no material-effect hook
(raw shader) and is excluded, as it is from Echo Depth.

On top of that measured warmth, the fragment stage lays one organic texture:
several octaves of value noise spanning roughly six metres down to a quarter
of one, each turned by an orthonormal rotation and
stepped by a non-integer factor, so neither the lattice axes nor the octave
periods can line up into a grid, a checkerboard, or a repeat. It is sampled
per fragment rather than per vertex, so its detail is not bounded by mesh
density, and the hash avoids `sin()` because world coordinates reach far
enough for a driver's approximation to band the field. Ground, plants, and
rocks sample it in world space, so the variation belongs to the place and
neighbouring objects share one continuous field; animals sample it in body
space at a feature size expressed as a share of body height, so the texture
travels with the animal instead of sliding over its coat, and a fox carries
the same density of detail as a stag. Each consumer authors its own texture
depth, and the shader eases the texture off above an authored quiet warmth so
the hottest surfaces — a living body core above all — keep a defined shape.
Fragments outside the sensed radius return the carried color before either
the texture or the ramp is evaluated.

Living bodies also warm what stands around them. `setHeatSources` takes the
warm bodies now in the world and packs each one as an oriented segment on its
own body axis — centre, half length, facing, reach, and strength — into
uniform objects every patched program shares, so one call reaches every
sensed surface. Ground, plants, and rocks add the radiated warmth on top of
their own reading, which keeps their variation inside a warm pool instead of
flooding it flat; a living body does not radiate onto itself. Because the
emitter is a segment rather than a point, the pool is as long as the animal
and turns with it, and displacing the measured distance by the texture field
pulls the bloom out of symmetry so it never reads as a shape laid on the
ground. The falloff has a gaussian tail and a spread several times the
animal's own height, so the warmth thins out over many metres and never
reaches a distance where it stops: there is no boundary anywhere that could
read as a ring. The spread follows each animal's height, so a stag blooms
wider than a rat. This is
the module's one per-frame input: the consumer reports its bodies each frame
and nothing else about the field changes over time.

Every reading a surface computes for itself is then folded into the warmth
band its material belongs to. Both ends of the band are approached
asymptotically inside a soft knee, so a surface can never leave the
temperature range its substance would occupy however its base warmth,
gradient, texture, and contrast happen to add up, and nothing piles into a
flat plateau at the edge of the band. The bands carry the material hierarchy:
ground and rock are held in the violet-to-cyan end, plants climb into magenta
and orange where they are exposed, and only a living body owns the hottest
colors. Terrain's own mapping is scaled to that end rather than left to the
band to catch, so the band stays a guarantee instead of a routine clamp.
Warmth radiated by a nearby body is added after the band and is the one thing
allowed to carry a surface past its own range: heat borrowed from an animal is
not the ground's own temperature, so a warm pool reads as exactly that.

Each surface is also given definition. A monotone contrast curve pulls the
finished reading away from an authored pivot: two halves meet there, each flat
at its own end and steepest where they join, so cold, pivot, and full heat all
stay in place while everything between them separates. Warmth that changes
quickly across a surface therefore separates the most, and warmth that barely
changes stays where it was — contrast without an outline, and without a
plateau anywhere that could posterize into a band. The pivot belongs to the
module (it is ramp shape, and each consumer's pivot sits on the warmth its own
readings cluster around); the amount is authored per level. Living bodies
carry the strongest curve, which pushes a core toward full heat while limbs
fall back to the warm stop, so an animal reads as a contoured shape rather
than a warm blob. Because the curve acts last, the body core, the radiated pool, and
the surface texture all gain their definition from the same temperature
difference instead of from separate treatments.

One shared uniform set (intensity, radius, feather, ramp stops, palette,
texture shape, heat sources) is merged into every patched program, so all
consumers respond to one sense intensity; texture depth, heat response, and
contrast are authored per consumer. The composition root applies the terrain variant through
`TerrainMaterialEffect` (whose optional `warmthAt` sampler triggers the
attribute) and the other variants through the shared `UnlitMaterialEffect`
contract; this module never imports a sibling module. All variants patch
through the shared `applyShaderPatch` helper — the composition root orders
thermal first in each effect list so it wins the final surface color over the
carried echo ramp (first-applied executes last; see
`src/utils/asset-loader/material-shader-patch.ts`).

The show drives the shared runtime intensity through `setIntensity()`; a
showless preset uses its authored static value and skips the effect entirely at
zero. Deliberately absent are temporal heat variation or heat trails (a body warms its
surroundings only where it stands now, and leaves nothing behind when it
moves on), any surface texture or material map beyond the procedural warmth
texture described above, and any additional thermal camera or duplicate
render pass. The per-fragment texture costs four noise octaves inside the
sensed radius; its headroom on PICO needs runtime acceptance.
