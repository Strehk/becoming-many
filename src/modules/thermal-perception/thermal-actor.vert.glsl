/*
 * Purpose: Give animated animals a warm body core that cools toward extremities.
 * Context: Being alive means giving off heat, and a body is never one temperature.
 * Responsibility: Map the posed vertex into body space and fall off from the core.
 * Boundary: Skinning happens before projection; ramp colors stay in the fragment shader.
 */

uniform float thermalActorWarmth;
uniform float thermalActorExtremityFalloff;
uniform mat4 thermalActorBodyMatrix;
uniform vec4 thermalActorBodyShape;
uniform float thermalTextureFeatureSize;

varying float thermalViewDistance;
varying float interpolatedThermalWarmth;
varying vec3 thermalTexturePosition;
varying vec3 thermalWorldPosition;

void passThermalPerception(vec4 viewPosition, vec3 localPosition) {
  thermalViewDistance = length(viewPosition.xyz);
  // Skinning has already posed the vertex, so the authored body matrix maps
  // the living pose onto normalized body space: y runs 0..1 from hoof to
  // crown and xz stay isotropic around the body's own vertical axis. The
  // measurement therefore fits every species without per-species values.
  vec3 bodyPosition = (thermalActorBodyMatrix * vec4(localPosition, 1.0)).xyz;
  float axisDistance = length(bodyPosition.xz) * thermalActorBodyShape.w;
  float coreOffset = bodyPosition.y - thermalActorBodyShape.x;
  float coreDistance = length(vec2(axisDistance, coreOffset));
  // One smooth falloff: the torso holds the peak, and legs, snouts, tails,
  // and antlers cool with how far they reach away from it.
  float falloff = smoothstep(
    thermalActorBodyShape.y,
    thermalActorBodyShape.z,
    coreDistance
  );
  interpolatedThermalWarmth = clamp(
    thermalActorWarmth - falloff * thermalActorExtremityFalloff,
    0.0,
    1.0
  );
  // Body space, not world space: the fine variation belongs to the animal
  // and travels with it, instead of sliding over its coat as it walks. The
  // feature size is a share of body height, so a fox and a stag carry the
  // same density of detail.
  thermalTexturePosition = bodyPosition / thermalTextureFeatureSize;
  thermalWorldPosition = (modelMatrix * vec4(localPosition, 1.0)).xyz;
}
