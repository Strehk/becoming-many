/*
 * Purpose: Replace surface color with the warmth-driven false-color ramp.
 * Context: Level 05 shows heat directly; the sense reaches only a bounded radius.
 * Responsibility: Texture the warmth, map it onto the palette, and feather out at the edge.
 * Boundary: Warmth measurement stays in the vertex shaders; base colors stay with owners.
 */

uniform float thermalIntensity;
uniform float thermalRadiusMeters;
uniform float thermalEdgeFeatherMeters;
uniform vec4 thermalRampStops;
uniform vec4 thermalTextureShape;
uniform float thermalTextureWarmth;
uniform vec3 thermalColdestColor;
uniform vec3 thermalColdColor;
uniform vec3 thermalCoolColor;
uniform vec3 thermalWarmColor;
uniform vec3 thermalHotColor;
uniform vec3 thermalHottestColor;

varying float thermalViewDistance;
varying float interpolatedThermalWarmth;
varying vec3 thermalTexturePosition;

/*
 * Hashing without sin(): world coordinates reach into the hundreds of metres,
 * where a driver's sin approximation loses precision and bands the field.
 */
float thermalTextureHash(vec3 cell) {
  vec3 point = fract(cell * 0.1031);
  point += dot(point, point.yzx + 33.33);
  return fract((point.x + point.y) * point.z);
}

/** One octave of value noise; quintic weights keep the lattice off the image. */
float thermalTextureNoise(vec3 samplePosition) {
  vec3 cell = floor(samplePosition);
  vec3 local = fract(samplePosition);
  vec3 weight = local * local * local * (local * (local * 6.0 - 15.0) + 10.0);
  float lower = mix(
    mix(
      thermalTextureHash(cell + vec3(0.0, 0.0, 0.0)),
      thermalTextureHash(cell + vec3(1.0, 0.0, 0.0)),
      weight.x
    ),
    mix(
      thermalTextureHash(cell + vec3(0.0, 1.0, 0.0)),
      thermalTextureHash(cell + vec3(1.0, 1.0, 0.0)),
      weight.x
    ),
    weight.y
  );
  float upper = mix(
    mix(
      thermalTextureHash(cell + vec3(0.0, 0.0, 1.0)),
      thermalTextureHash(cell + vec3(1.0, 0.0, 1.0)),
      weight.x
    ),
    mix(
      thermalTextureHash(cell + vec3(0.0, 1.0, 1.0)),
      thermalTextureHash(cell + vec3(1.0, 1.0, 1.0)),
      weight.x
    ),
    weight.y
  );
  return mix(lower, upper, weight.z);
}

/*
 * Three octaves, centred on zero. Each octave is turned by an orthonormal
 * rotation and stepped by a non-integer factor, so neither the lattice axes
 * nor the octave periods can ever line up: no grid, no checkerboard, and no
 * repeat, only irregular patches at three sizes at once.
 */
float thermalTextureField(vec3 samplePosition) {
  mat3 turn = mat3(
    0.00, 0.80, 0.60,
    -0.80, 0.36, -0.48,
    -0.60, -0.48, 0.64
  );
  vec3 point = samplePosition;
  float amplitude = 1.0;
  float total = 0.0;
  float sum = 0.0;
  for (int octave = 0; octave < 3; octave++) {
    sum += amplitude * thermalTextureNoise(point);
    total += amplitude;
    point = turn * point * thermalTextureShape.x;
    amplitude *= thermalTextureShape.y;
  }
  return sum / total * 2.0 - 1.0;
}

vec3 applyThermalPerception(vec3 baseColor) {
  float senseReach = 1.0 - smoothstep(
    thermalRadiusMeters - thermalEdgeFeatherMeters,
    thermalRadiusMeters,
    thermalViewDistance
  );
  float sensed = senseReach * thermalIntensity;
  // Surfaces outside the sensed radius keep the carried color and pay for
  // neither the texture nor the ramp.
  if (sensed <= 0.0) {
    return baseColor;
  }

  float warmth = clamp(interpolatedThermalWarmth, 0.0, 1.0);
  // The texture eases off across the hottest surfaces, so a living body core
  // keeps its defined shape while cooler surfaces carry the fine variation.
  float textureGain =
    1.0 -
    smoothstep(thermalTextureShape.z, 1.0, warmth) * thermalTextureShape.w;
  warmth = clamp(
    warmth +
      thermalTextureField(thermalTexturePosition) *
        thermalTextureWarmth *
        textureGain,
    0.0,
    1.0
  );

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
  return mix(baseColor, ramp, sensed);
}
