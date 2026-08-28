/*
 * Purpose: Give wind-moved grass a heat reading that shimmers as it sways.
 * Context: Grass is the only sensed surface that never stops moving.
 * Responsibility: Warm the roots, cool the tips, and modulate warmth by the current lean.
 * Boundary: Wind, time, and placement stay in Grass; detail and colors stay in the fragment stage.
 *
 * Grass publishes three values at the injection point (see its vertex shader):
 * the deformed world position, the blade progress from root to tip, and the
 * signed sway. This variant reads only those, so the sense never learns how
 * the wind works — and the shimmer needs no time uniform of its own, which
 * keeps the heat field itself static.
 *
 * The sward has no per-tuft warmth source: nothing here distinguishes one
 * blade from the next. That difference comes entirely from sampling the
 * fragment detail field in world space, where neighbouring tufts land on
 * different parts of the field.
 */

uniform float thermalBaseWarmth;
uniform float thermalRootWarmthBoost;
uniform float thermalShimmerWarmth;
uniform float thermalGrassRootShade;

varying float thermalViewDistance;
varying float interpolatedThermalWarmth;
varying float thermalSurfaceShade;
varying vec3 thermalDetailPosition;
varying float thermalWarmWeight;

void passThermalPerception(
  vec4 viewPosition,
  vec3 worldPosition,
  float bladeProgress,
  float sway
) {
  thermalViewDistance = length(viewPosition.xyz);

  // Roots sit in still air against ground that has been warming all day; tips
  // stand in moving air and radiate to the sky.
  float rootWeight = 1.0 - bladeProgress;
  float warmth = thermalBaseWarmth + rootWeight * thermalRootWarmthBoost;

  // The shimmer. A leaning blade turns a different face toward the viewer and
  // exchanges heat with the air it moves through, so its reading rises and
  // falls with the sway. Signed, so the field twinkles both ways rather than
  // pulsing in one direction.
  warmth += sway * thermalShimmerWarmth;

  interpolatedThermalWarmth = warmth;
  // Neighbouring tufts land on different parts of the field, which is the
  // only thing that keeps the sward from reading as one temperature.
  thermalDetailPosition = worldPosition;
  thermalWarmWeight = rootWeight;

  // Grass carries no normals, so its depth comes from the sward itself: the
  // base of the blade sits in shadow between its neighbours, the tip stands
  // clear.
  thermalSurfaceShade = mix(thermalGrassRootShade, 1.0, bladeProgress);
}
