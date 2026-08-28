/*
 * Purpose: Forward the CPU-sampled ground warmth and view distance for Terrain.
 * Context: Terrain streams a per-vertex warmth attribute from elevation and zone facts.
 * Responsibility: Write the radial view distance and pass the warmth attribute through.
 * Boundary: Warmth sampling stays on the CPU; ramp colors stay in the fragment shader.
 */

attribute float thermalWarmth;

varying float thermalViewDistance;
varying float interpolatedThermalWarmth;

void passThermalPerception(vec4 viewPosition) {
  thermalViewDistance = length(viewPosition.xyz);
  interpolatedThermalWarmth = thermalWarmth;
}
