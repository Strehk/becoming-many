/*
 * Purpose: Replace surface color with the warmth-driven false-color ramp.
 * Context: Level 05 shows heat directly; the sense reaches only a bounded radius.
 * Responsibility: Map warmth onto the authored palette and feather out at the radius edge.
 * Boundary: Warmth measurement stays in the vertex shaders; base colors stay with owners.
 */

uniform float thermalIntensity;
uniform float thermalRadiusMeters;
uniform float thermalEdgeFeatherMeters;
uniform vec4 thermalRampStops;
uniform vec3 thermalColdestColor;
uniform vec3 thermalColdColor;
uniform vec3 thermalCoolColor;
uniform vec3 thermalWarmColor;
uniform vec3 thermalHotColor;
uniform vec3 thermalHottestColor;

varying float thermalViewDistance;
varying float interpolatedThermalWarmth;

vec3 applyThermalPerception(vec3 baseColor) {
  float warmth = clamp(interpolatedThermalWarmth, 0.0, 1.0);
  vec3 ramp = mix(
    thermalColdestColor,
    thermalColdColor,
    smoothstep(0.0, thermalRampStops.x, warmth)
  );
  ramp = mix(
    ramp,
    thermalCoolColor,
    smoothstep(thermalRampStops.x, thermalRampStops.y, warmth)
  );
  ramp = mix(
    ramp,
    thermalWarmColor,
    smoothstep(thermalRampStops.y, thermalRampStops.z, warmth)
  );
  ramp = mix(
    ramp,
    thermalHotColor,
    smoothstep(thermalRampStops.z, thermalRampStops.w, warmth)
  );
  ramp = mix(
    ramp,
    thermalHottestColor,
    smoothstep(thermalRampStops.w, 1.0, warmth)
  );
  float senseReach = 1.0 - smoothstep(
    thermalRadiusMeters - thermalEdgeFeatherMeters,
    thermalRadiusMeters,
    thermalViewDistance
  );
  return mix(baseColor, ramp, senseReach * thermalIntensity);
}
