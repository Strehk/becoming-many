/*
 * Purpose: Derive a warmth that varies across each instanced surface prop.
 * Context: Vegetation and rocks need temperature structure inside one model, not one flat tone.
 * Responsibility: Hash a stable base warmth per instance and vary it across the model.
 * Boundary: Instance transforms stay with the model pools; fine detail and colors stay in the fragment stage.
 */

uniform float thermalBaseWarmth;
uniform float thermalWarmthSpread;
uniform float thermalHashCellMeters;
uniform float thermalHeightReferenceMeters;
uniform float thermalHeightWarmthHalfDrop;
uniform float thermalAxisReferenceMeters;
uniform float thermalAxisWarmthHalfDrop;
uniform float thermalDetailPhaseMeters;

varying float thermalViewDistance;
varying float interpolatedThermalWarmth;
varying float thermalSurfaceShade;
varying vec3 thermalDetailPosition;
varying float thermalWarmWeight;

float thermalInstanceHash(vec2 cell) {
  return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453123);
}

void passThermalPerception(vec4 viewPosition) {
  thermalViewDistance = length(viewPosition.xyz);

  vec3 modelOffsetMeters = position;
  vec3 objectNormal = normal;
  float variation = 0.0;
  float detailPhase = 0.0;
#ifdef USE_INSTANCING
  // Quantizing the instance origin lets every part of one plant or rock
  // hash into the same cell and agree on a single base warmth.
  vec4 instanceOrigin = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec2 instanceWorldXZ = (modelMatrix * instanceOrigin).xz;
  vec2 hashCell = floor(instanceWorldXZ / thermalHashCellMeters);
  float instanceHash = thermalInstanceHash(hashCell);
  variation = (instanceHash - 0.5) * 2.0;
  // Every instance of one model otherwise samples the fragment detail field at
  // the same model-local coordinates and comes out identically textured, which
  // is exactly the "two nearby surfaces at the same temperature" the sense has
  // to avoid. This moves each instance to its own place in the field.
  detailPhase = instanceHash * thermalDetailPhaseMeters;
  // Metres from the instance's own base, so the structure below follows the
  // model's placed orientation and scale rather than its authored units.
  modelOffsetMeters =
    (instanceMatrix * vec4(position, 1.0)).xyz - instanceOrigin.xyz;
  objectNormal = mat3(instanceMatrix) * objectNormal;
#endif

  // Ground-warmed base grading into sky-facing canopy, and warm inner volume
  // grading into cooler outer foliage. Both terms are zero-mean, so the
  // authored base warmth stays the average temperature of the instance.
  float heightProgress =
    clamp(modelOffsetMeters.y / thermalHeightReferenceMeters, 0.0, 1.0);
  float axisProgress =
    clamp(length(modelOffsetMeters.xz) / thermalAxisReferenceMeters, 0.0, 1.0);
  float structure =
    (1.0 - 2.0 * heightProgress) * thermalHeightWarmthHalfDrop +
    (1.0 - 2.0 * axisProgress) * thermalAxisWarmthHalfDrop +
    thermalGrain(modelOffsetMeters) * thermalGrainWarmth -
    thermalGrazing(normalMatrix * objectNormal, viewPosition.xyz) *
      thermalGrazingCoolness;

  interpolatedThermalWarmth =
    thermalBaseWarmth + variation * thermalWarmthSpread + structure;
  // Model-local, so the pattern turns and scales with the plant rather than
  // sliding across it, and phase-shifted so no two instances match.
  thermalDetailPosition = modelOffsetMeters + detailPhase;
  // Hotspots gather in the inner mass a plant or rock actually holds heat in,
  // not on the thin outer foliage.
  thermalWarmWeight = clamp(1.0 - 0.5 * heightProgress - 0.5 * axisProgress, 0.0, 1.0);
  thermalSurfaceShade = thermalHemisphericShade(mat3(modelMatrix) * objectNormal);
}
