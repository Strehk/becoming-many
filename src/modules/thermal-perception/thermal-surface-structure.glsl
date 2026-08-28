/*
 * Purpose: Provide the shared within-object warmth terms for sensed surfaces.
 * Context: Vegetation, rocks, and animals all need heat that varies across one model.
 * Responsibility: Supply the organic grain field and the grazing-angle coolness term.
 * Boundary: Per-consumer warmth sources stay in their vertex variants; colors stay in the fragment stage.
 */

uniform float thermalGrainWavelengthMeters;
uniform float thermalGrainWarmth;
uniform float thermalGrazingCoolness;
uniform float thermalGroundShade;
uniform float thermalSkyShade;

const float THERMAL_TAU = 6.2831853;

/*
 * The scene is unlit, so nothing in the pipeline tells a leaf's upper face
 * from its underside. This is the one geometric light the sense adds: a
 * hemispheric gradient from ground-facing to sky-facing, which is what lets
 * branches and foliage read as volume instead of a flat cutout.
 *
 * Foliage cards are often double-sided, and a back face carries the opposite
 * normal, so the contrast is kept moderate: a wrong-facing leaf then reads as
 * a slightly odd tone rather than an inverted one.
 */
float thermalHemisphericShade(vec3 worldNormal) {
  float skyFacing = normalize(worldNormal).y * 0.5 + 0.5;
  return mix(thermalGroundShade, thermalSkyShade, skyFacing);
}

/*
 * A separable sine field rather than a hashed value noise: it is continuous
 * everywhere by construction, so interpolating it across a triangle can never
 * produce a seam, and it costs three sines in the vertex stage instead of a
 * hash lattice per fragment. The irrational-ish axis ratios keep the three
 * waves from repeating together into a visible grid.
 */
float thermalGrain(vec3 positionMeters) {
  vec3 phase = positionMeters * (THERMAL_TAU / thermalGrainWavelengthMeters);
  return sin(phase.x) * sin(phase.y * 1.31) * sin(phase.z * 0.77);
}

/*
 * Surfaces seen at a grazing angle emit less toward the viewer and read
 * cooler. This is what gives a thermal image its soft cool rims, and it is the
 * term that keeps an object's silhouette and roundness readable once flat
 * per-object color is gone.
 */
float thermalGrazing(vec3 viewNormal, vec3 viewPosition) {
  return 1.0 - abs(dot(normalize(viewNormal), normalize(-viewPosition)));
}
