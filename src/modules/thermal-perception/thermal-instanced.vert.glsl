/*
 * Purpose: Derive a stable per-instance warmth for instanced surface props.
 * Context: Vegetation and rocks need temperature variation that survives restreaming.
 * Responsibility: Hash the instance's quantized world position around an authored base warmth.
 * Boundary: Instance transforms stay with the model pools; ramp colors stay in the fragment shader.
 */

uniform float thermalBaseWarmth;
uniform float thermalWarmthSpread;
uniform float thermalHashCellMeters;

varying float thermalViewDistance;
varying float interpolatedThermalWarmth;

float thermalInstanceHash(vec2 cell) {
  return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453123);
}

void passThermalPerception(vec4 viewPosition) {
  thermalViewDistance = length(viewPosition.xyz);
  float variation = 0.0;
#ifdef USE_INSTANCING
  // Quantizing the instance origin lets every part of one plant or rock
  // hash into the same cell and agree on a single warmth.
  vec2 instanceWorldXZ =
    (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
  vec2 hashCell = floor(instanceWorldXZ / thermalHashCellMeters);
  variation = (thermalInstanceHash(hashCell) - 0.5) * 2.0;
#endif
  interpolatedThermalWarmth = clamp(
    thermalBaseWarmth + variation * thermalWarmthSpread,
    0.0,
    1.0
  );
}
