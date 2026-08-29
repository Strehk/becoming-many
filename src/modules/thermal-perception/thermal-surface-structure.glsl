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
 * A wave field rather than a hashed value noise: it is continuous everywhere
 * by construction, so interpolating it across a triangle can never produce a
 * seam, and it costs three sines in the vertex stage instead of a hash lattice
 * per fragment.
 *
 * A sum of obliquely-travelling waves rather than the product of one wave per
 * axis. The product is separable, and a separable field is a checkerboard: its
 * light and dark cells sit in rows and columns squarely on the model axes,
 * which is the one thing a body's own heat pattern never does. Summing waves
 * that travel across all three axes at once, at wavelengths with no rational
 * ratio and with their peaks phase-shifted apart, leaves patches that drift
 * over the surface instead. The amplitudes hold the spread near that of the
 * product they replace, so the authored grain warmths still land the same.
 */
float thermalGrain(vec3 positionMeters) {
  vec3 phase = positionMeters * (THERMAL_TAU / thermalGrainWavelengthMeters);
  return sin(dot(phase, vec3(0.94, 0.28, -0.19)) + 0.87) * 0.34 +
    sin(dot(phase, vec3(-0.37, 1.19, 0.61)) + 2.41) * 0.29 +
    sin(dot(phase, vec3(0.53, -0.46, 1.57)) + 4.16) * 0.23;
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
