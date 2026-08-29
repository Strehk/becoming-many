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
uniform float thermalHeatResponse;
uniform int thermalHeatCount;
uniform vec4 thermalHeatBodies[THERMAL_HEAT_SOURCES];
uniform vec4 thermalHeatAxes[THERMAL_HEAT_SOURCES];
uniform float thermalHeatEdgeMeters;
uniform vec2 thermalContrast;
uniform vec2 thermalBand;
uniform float thermalBandKnee;
uniform vec3 thermalColdestColor;
uniform vec3 thermalColdColor;
uniform vec3 thermalCoolColor;
uniform vec3 thermalWarmColor;
uniform vec3 thermalHotColor;
uniform vec3 thermalHottestColor;

varying float thermalViewDistance;
varying float interpolatedThermalWarmth;
varying vec3 thermalTexturePosition;
varying vec3 thermalWorldPosition;

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

/*
 * Warmth radiated onto this surface by the living bodies near it. Each body
 * emits along a segment on its own axis, so the pool is as long as the animal
 * and turns with it; displacing the measured distance by the texture field
 * breaks the boundary into an irregular bloom instead of an oval.
 */
float thermalRadiatedWarmth(float edgeOffsetMeters) {
  float radiated = 0.0;
  for (int index = 0; index < THERMAL_HEAT_SOURCES; index++) {
    if (index >= thermalHeatCount) {
      break;
    }
    vec4 body = thermalHeatBodies[index];
    vec4 axis = thermalHeatAxes[index];
    vec3 toSurface = thermalWorldPosition - body.xyz;
    float along = clamp(dot(toSurface.xz, axis.xy), -body.w, body.w);
    vec3 nearestOnBody = vec3(axis.x, 0.0, axis.y) * along;
    float distanceMeters =
      length(toSurface - nearestOnBody) + edgeOffsetMeters;
    // Squared falloff concentrates the heat where the body actually is and
    // lets it thin out early, so the ground stays its own temperature.
    float reach = 1.0 - smoothstep(0.0, axis.z, distanceMeters);
    radiated += axis.w * reach * reach;
  }
  return radiated;
}

/*
 * Pull warmth away from an authored pivot so nearby readings separate. Two
 * halves meet at the pivot, each flat at its own end and steepest where they
 * join, which fixes cold, pivot, and full heat in place while expanding
 * everything between them. The curve is monotone and smooth, so structures
 * gain contrast without an outline or a posterized band appearing: warmth
 * that changes quickly across a surface separates the most, and warmth that
 * barely changes stays where it was.
 */
float thermalDefinedWarmth(float warmth) {
  float pivot = thermalContrast.y;
  float shaped;
  if (warmth < pivot) {
    float local = warmth / max(pivot, 0.0001);
    shaped = pivot * local * local;
  } else {
    float local = (warmth - pivot) / max(1.0 - pivot, 0.0001);
    float remaining = 1.0 - local;
    shaped = pivot + (1.0 - pivot) * (1.0 - remaining * remaining);
  }
  return mix(warmth, shaped, thermalContrast.x);
}

/*
 * Fold a reading into the temperature range its own material belongs to.
 * Both ends approach asymptotically inside a soft knee, so ground cannot
 * climb into the colors of a living body however its elevation, texture, and
 * contrast happen to add up, and nothing piles into a flat plateau at the
 * edge of the band. Outside the knees the reading passes through untouched.
 */
float thermalBandedWarmth(float warmth) {
  float knee = max(thermalBandKnee, 0.0001);
  float overCeiling = warmth - (thermalBand.y - knee);
  if (overCeiling > 0.0) {
    return thermalBand.y - knee * exp(-overCeiling / knee);
  }
  float underFloor = (thermalBand.x + knee) - warmth;
  if (underFloor > 0.0) {
    return thermalBand.x + knee * exp(-underFloor / knee);
  }
  return warmth;
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
  float texture = thermalTextureField(thermalTexturePosition);
  // The texture eases off across the hottest surfaces, so a living body core
  // keeps its defined shape while cooler surfaces carry the fine variation.
  float textureGain =
    1.0 -
    smoothstep(thermalTextureShape.z, 1.0, warmth) * thermalTextureShape.w;
  warmth = clamp(warmth + texture * thermalTextureWarmth * textureGain, 0.0, 1.0);
  // Definition next: the curve acts on the surface's own finished reading, so
  // its base warmth, its internal gradient, and its texture all gain contrast
  // from the same natural temperature difference.
  warmth = thermalDefinedWarmth(warmth);
  // Then the material's own range closes over all of it.
  warmth = thermalBandedWarmth(warmth);
  // Radiated warmth is added last and outside the band: heat borrowed from a
  // body nearby is not the surface's own temperature, and it is the one thing
  // that may carry ground past the range its substance would ever reach. It
  // is added on top of the surface's reading, so ground inside a warm pool
  // keeps the variation it had rather than flooding flat.
  warmth = clamp(
    warmth +
      thermalHeatResponse *
        thermalRadiatedWarmth(texture * thermalHeatEdgeMeters),
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
