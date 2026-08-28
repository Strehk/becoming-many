/*
 * Purpose: Give animated animals their constant living-body warmth.
 * Context: Being alive means giving off heat; animals are the strongest signatures.
 * Responsibility: Write the radial view distance and the authored actor warmth.
 * Boundary: Skinning happens before projection; ramp colors stay in the fragment shader.
 */

uniform float thermalActorWarmth;

varying float thermalViewDistance;
varying float interpolatedThermalWarmth;

void passThermalPerception(vec4 viewPosition) {
  thermalViewDistance = length(viewPosition.xyz);
  interpolatedThermalWarmth = thermalActorWarmth;
}
