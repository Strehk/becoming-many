/*
 * Purpose: Supply the per-fragment temperature detail shared by every sensed surface.
 * Context: A vertex attribute can never be finer than the mesh carrying it; a thermal image is.
 * Responsibility: Evaluate two continuous noise octaves and the hotspot tail taken from them.
 * Boundary: Where the field is sampled is each vertex variant's choice; the ramp stays in the fragment stage.
 *
 * The field is a sum of three plane waves per octave rather than a hashed
 * lattice noise. Three reasons, in order of weight for this target: it is
 * continuous and differentiable everywhere by construction, so no octave can
 * ever show a cell seam or a grid; it costs three sines and three dot products
 * instead of eight hashes and a trilinear blend; and its high tail already
 * falls into isolated, smoothly-bounded lobes, which is what the hotspots are
 * taken from instead of thresholding a second field.
 *
 * The wave directions are deliberately not axis-aligned and share no rational
 * ratio, so the three waves never repeat together into a visible weave.
 */

uniform vec2 thermalDetailWavelengthMeters;
uniform vec2 thermalDetailWarmth;
uniform vec2 thermalDetailFadeMeters;
uniform float thermalHotspotWarmth;
uniform float thermalHotspotThreshold;

/*
 * Where this surface samples the field. Terrain and grass publish world
 * position, so neighbouring ground and neighbouring tufts differ; props
 * publish their instance-local position pushed to a per-instance place in the
 * field; animals publish their bind-pose body offset, so the pattern stays
 * attached to the body instead of swimming through it as the walk cycle plays.
 */
varying vec3 thermalDetailPosition;

/*
 * How much of this surface is warm body rather than cool extremity, 0..1.
 * Hotspots are weighted by it, so they gather where a body is actually hot.
 */
varying float thermalWarmWeight;

const float THERMAL_DETAIL_TAU = 6.2831853;

/*
 * Roughly -1..1, with the bulk of its mass well inside that. `turn` is a
 * precomputed (cosine, sine) pair rather than an angle: the octaves differ
 * only by a fixed rotation, and paying for it once in the source beats paying
 * for two more transcendentals per fragment.
 */
float thermalWaves(vec3 phase, vec2 turn) {
  vec3 turned = vec3(
    phase.x * turn.x - phase.z * turn.y,
    phase.y,
    phase.x * turn.y + phase.z * turn.x
  );
  return (
    sin(dot(turned, vec3(0.98, 0.21, -0.13))) +
    sin(dot(turned, vec3(-0.24, 0.87, 0.43))) +
    sin(dot(turned, vec3(0.37, -0.29, 0.88)))
  ) * 0.41;
}

/*
 * The two octaves, kept separate because the caller needs the coarse one on
 * its own: it is both the patch-scale texture and the source of the hotspots.
 */
vec2 thermalDetailOctaves() {
  vec3 coarse =
    thermalDetailPosition *
    (THERMAL_DETAIL_TAU / thermalDetailWavelengthMeters.x);
  vec3 fine =
    thermalDetailPosition *
    (THERMAL_DETAIL_TAU / thermalDetailWavelengthMeters.y);
  // The rotation on the fine octave keeps the two wave sets from lining up
  // into a single stronger interference pattern.
  return vec2(
    thermalWaves(coarse, vec2(1.0, 0.0)),
    thermalWaves(fine, vec2(-0.323, 0.946))
  );
}

/*
 * The fine octave is finer than a pixel well before the sense radius ends, and
 * an unfiltered high frequency at that size shimmers on a moving head-mounted
 * display. It fades out with distance; the coarse octave carries on.
 */
float thermalDetailWarmthAt(vec2 octaves, float viewDistance) {
  float fineReach = 1.0 - smoothstep(
    thermalDetailFadeMeters.x,
    thermalDetailFadeMeters.y,
    viewDistance
  );
  return octaves.x * thermalDetailWarmth.x +
    octaves.y * thermalDetailWarmth.y * fineReach;
}

/*
 * The high tail of the coarse octave, remapped so a hotspot rises out of the
 * surrounding texture rather than being cut out of it: below the threshold it
 * contributes nothing, above it the same continuous field carries the value up
 * to the peak, which is what gives every hotspot a gradual falloff on all
 * sides instead of an edge.
 */
float thermalHotspotWarmthAt(vec2 octaves) {
  float tail = smoothstep(thermalHotspotThreshold, 1.0, octaves.x);
  return thermalHotspotWarmth * thermalWarmWeight * tail;
}
