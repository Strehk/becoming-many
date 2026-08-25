/*
 * Purpose: Replace surface color with the distance-driven echolocation ramp.
 * Context: Level 03 shows the result of echolocation directly; no visible echo waves.
 * Responsibility: Map view distance onto the authored palette between near and far.
 * Boundary: Distance measurement stays in the vertex shader; base colors stay with owners.
 */

uniform float echoIntensity;
uniform float echoNearDistance;
uniform float echoFarDistance;
uniform vec3 echoRampStops;
uniform vec3 echoNearColor;
uniform vec3 echoNearShadeColor;
uniform vec3 echoMidColor;
uniform vec3 echoFarColor;
uniform vec3 echoHazeColor;

varying float echoViewDistance;

vec3 applyEchoDepth(vec3 baseColor) {
  float rampProgress = clamp(
    (echoViewDistance - echoNearDistance) /
      (echoFarDistance - echoNearDistance),
    0.0,
    1.0
  );
  vec3 ramp = mix(
    echoNearColor,
    echoNearShadeColor,
    smoothstep(0.0, echoRampStops.x, rampProgress)
  );
  ramp = mix(
    ramp,
    echoMidColor,
    smoothstep(echoRampStops.x, echoRampStops.y, rampProgress)
  );
  ramp = mix(
    ramp,
    echoFarColor,
    smoothstep(echoRampStops.y, echoRampStops.z, rampProgress)
  );
  ramp = mix(
    ramp,
    echoHazeColor,
    smoothstep(echoRampStops.z, 1.0, rampProgress)
  );
  return mix(baseColor, ramp, echoIntensity);
}
