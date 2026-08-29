/*
 * Purpose: Supply the per-fragment temperature detail shared by every sensed surface.
 * Context: A vertex attribute can never be finer than the mesh carrying it; a thermal image is.
 * Responsibility: Evaluate two continuous noise octaves and the hotspot tail taken from them.
 * Boundary: Where the field is sampled is each vertex variant's choice; the ramp stays in the fragment stage.
 *
 * The field is a sum of plane waves per octave rather than a hashed lattice
 * noise. Three reasons, in order of weight for this target: it is continuous
 * and differentiable everywhere by construction, so no octave can ever show a
 * cell seam or a grid; it costs a handful of sines and dot products instead of
 * eight hashes and a trilinear blend per octave; and its high tail already
 * falls into isolated, smoothly-bounded lobes, which is what the hotspots are
 * taken from instead of thresholding a second field.
 *
 * Wave sums have one failure mode, and avoiding it is what most of this file
 * is about: waves of equal wavelength interfere into a crystal, and a crystal
 * reads as a regular dot grid with aligned rows and columns — a pixel pattern,
 * not sensor noise. Three things break it, in the order they are applied:
 *
 *   1. No two waves in an octave share a wavelength, a direction, an amplitude,
 *      or a phase. Their wave vectors have deliberately incommensurate lengths,
 *      so the sum has no repeat period at all in the sizes that fit on screen,
 *      and no shared origin where every wave peaks together.
 *   2. The sampling position is domain-warped by a longer, slower wave field
 *      before either octave is measured. The lobes then wander, stretch, and
 *      vary in size and spacing instead of sitting on a fixed pitch.
 *   3. The coarse octave warps the fine one a second time and modulates its
 *      amplitude, both for free from a value already in hand. Grain therefore
 *      drifts and gathers rather than covering everything at one strength.
 *
 * All three are smooth functions of position, so the result stays continuous
 * and stays coherent across a surface: it is the same field, unevenly walked.
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
 * The domain warp, as fractions of the coarse wavelength: every consumer sets
 * its own scale, from a stag's 0.16 m grain to the ground's 2.6 m patches, and
 * the warp has to arrive at the same relative strength on all of them.
 *
 * The amplitude and the wavelength are chosen together. Their ratio sets the
 * steepest slope the displacement can reach, and that has to stay under one:
 * at one the warp folds the field back over itself, which shows up as a crease
 * with an edge — the one artefact this field exists to avoid. At 0.31 of a
 * wavelength of travel across 3.1 wavelengths of distance the peak slope is
 * about 0.63, which is a thorough scrambling with folding still out of reach.
 */
const float THERMAL_WARP_WAVELENGTHS = 3.1;
const float THERMAL_WARP_TRAVEL = 0.31;

/*
 * How far the coarse octave displaces the fine one, in fine-octave radians,
 * and how far it swings the fine amplitude about its mean. Both come free from
 * a value already computed; together they are what stops the grain from
 * reading as one even film laid over everything.
 */
const vec3 THERMAL_FINE_DRIFT = vec3(1.09, -0.73, 1.51);
const float THERMAL_FINE_GATHER = 0.45;

/*
 * Where the field is actually read: the sampling position, pushed around by a
 * slow wave field of its own. Three sines, one per axis of the displacement,
 * on three unrelated directions and phases, so the displacement is a genuine
 * vector field rather than one shear applied everywhere.
 *
 * This is the single most expensive thing in the file and the first dial to
 * turn if the frame budget needs it: dropping it costs the wandering, not the
 * texture.
 */
vec3 thermalWarpedPosition(float coarseWavelengthMeters) {
  vec3 phase =
    thermalDetailPosition *
    (THERMAL_DETAIL_TAU / (coarseWavelengthMeters * THERMAL_WARP_WAVELENGTHS));
  vec3 offset = vec3(
    sin(dot(phase, vec3(0.83, -0.46, 0.31)) + 1.11),
    sin(dot(phase, vec3(0.27, 0.71, -0.65)) + 3.87),
    sin(dot(phase, vec3(-0.55, 0.36, 0.75)) + 5.62)
  );
  return thermalDetailPosition +
    offset * (coarseWavelengthMeters * THERMAL_WARP_TRAVEL);
}

/*
 * Roughly -1..1, with the bulk of its mass well inside that. `turn` is a
 * precomputed (cosine, sine) pair rather than an angle: the octaves differ
 * only by a fixed rotation, and paying for it once in the source beats paying
 * for two more transcendentals per fragment.
 *
 * The four wave vectors have lengths near 1.01, 1.36, 1.7 and 2.09 — no rational
 * ratio between any pair, so no two of them ever come back into step — and the
 * amplitudes fall as the wavelengths shorten, which is the spectral slope that
 * makes a noise field read as natural rather than as a texture with one size
 * of feature in it. The phase offsets displace each wave's peaks from the
 * others': without them all four crest together at the origin and the field
 * carries one anomalously bright lobe. The trailing factor sets the spread to
 * about 0.5, which is where the hotspot threshold and the edge breakup in the
 * settings file are tuned.
 */
float thermalWaves(vec3 phase, vec2 turn) {
  vec3 turned = vec3(
    phase.x * turn.x - phase.z * turn.y,
    phase.y,
    phase.x * turn.y + phase.z * turn.x
  );
  return (
    sin(dot(turned, vec3(0.98, 0.21, -0.13))) +
    sin(dot(turned, vec3(-0.34, 1.19, 0.57)) + 2.19) * 0.83 +
    sin(dot(turned, vec3(0.61, -0.44, 1.53)) + 4.71) * 0.67 +
    sin(dot(turned, vec3(-1.77, -0.62, 0.93)) + 1.28) * 0.52
  ) * 0.455;
}

/*
 * The two octaves, kept separate because the caller needs the coarse one on
 * its own: it is both the patch-scale texture and the source of the hotspots.
 */
vec2 thermalDetailOctaves() {
  vec3 warped = thermalWarpedPosition(thermalDetailWavelengthMeters.x);
  // The rotation on the fine octave keeps the two wave sets from lining up
  // into a single stronger interference pattern.
  float coarse = thermalWaves(
    warped * (THERMAL_DETAIL_TAU / thermalDetailWavelengthMeters.x),
    vec2(1.0, 0.0)
  );
  /*
   * The fine octave rides the coarse one twice over: displaced by it, so the
   * grain flows around the patch structure instead of lying across it in even
   * rows, and scaled by it, so grain gathers in the warmer patches and thins
   * out between them. The displacement is a fraction of a fine wavelength per
   * fine wavelength travelled, well short of folding it.
   */
  float fine = thermalWaves(
    warped * (THERMAL_DETAIL_TAU / thermalDetailWavelengthMeters.y) +
      coarse * THERMAL_FINE_DRIFT,
    vec2(-0.323, 0.946)
  );
  return vec2(coarse, fine * (1.0 + THERMAL_FINE_GATHER * coarse));
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
