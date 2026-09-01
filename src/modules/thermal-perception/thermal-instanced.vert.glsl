/*
 * Purpose: Give instanced surface props a stable temperature and an internal gradient.
 * Context: Vegetation and rocks need variation between objects and across each one.
 * Responsibility: Hash the instance around a base warmth, then shade it by local position.
 * Boundary: Instance transforms stay with the model pools; ramp colors stay in the fragment shader.
 */

uniform float thermalBaseWarmth;
uniform float thermalWarmthSpread;
uniform float thermalHashCellMeters;
uniform float thermalHeightWarmthPerMeter;
uniform float thermalAxisWarmthPerMeter;
uniform float thermalTextureFeatureSize;

varying float thermalViewDistance;
varying float interpolatedThermalWarmth;
varying vec3 thermalTexturePosition;
varying vec3 thermalWorldPosition;

float thermalInstanceHash(vec2 cell) {
  return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453123);
}

void passThermalPerception(vec4 viewPosition, vec3 localPosition) {
  thermalViewDistance = length(viewPosition.xyz);
  float variation = 0.0;
  float gradient = 0.0;
#ifdef USE_INSTANCING
  vec3 worldPosition =
    (modelMatrix * instanceMatrix * vec4(localPosition, 1.0)).xyz;
  // Quantizing the instance origin lets every part of one plant or rock
  // hash into the same cell and agree on a single base warmth.
  vec3 instanceOrigin =
    (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec2 hashCell = floor(instanceOrigin.xz / thermalHashCellMeters);
  variation = (thermalInstanceHash(hashCell) - 0.5) * 2.0;
  // Metres from the object's own base and axis. The instance matrix carries
  // the per-object scale, so one authored gradient per metre reads the same
  // on a 0.6 m shrub and a 10 m tree: warmth held near the ground and near
  // the trunk, shed toward an outer canopy that radiates to the sky.
  vec3 offsetMeters = worldPosition - instanceOrigin;
  gradient =
    offsetMeters.y * thermalHeightWarmthPerMeter +
    length(offsetMeters.xz) * thermalAxisWarmthPerMeter;
#else
  vec3 worldPosition = (modelMatrix * vec4(localPosition, 1.0)).xyz;
#endif
  interpolatedThermalWarmth = clamp(
    thermalBaseWarmth + variation * thermalWarmthSpread + gradient,
    0.0,
    1.0
  );
  // World space, like the ground: neighbouring plants sample one continuous
  // field, so a stand varies across itself instead of repeating per model.
  thermalTexturePosition = worldPosition / thermalTextureFeatureSize;
  thermalWorldPosition = worldPosition;
}
