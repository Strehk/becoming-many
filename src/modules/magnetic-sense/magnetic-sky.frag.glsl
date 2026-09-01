/*
 * Purpose: Paint the radical-pair shimmer of the geomagnetic field on one sky dome.
 * Context: Ported from the previous version's sky mode "birdspec", its saved state hardcoded.
 * Responsibility: Grade the dome by view direction and condense a grain pattern at the field axis.
 * Boundary: Terrain, ground presentation, and every lit surface stay elsewhere.
 */

uniform vec3 magneticFieldAxis;
uniform float magneticIntensity;
uniform float magneticTime;
uniform vec3 magneticHorizonColor;
uniform vec3 magneticZenithColor;
uniform vec3 magneticNorthColor;
uniform vec3 magneticSouthColor;
uniform vec3 magneticNeutralColor;
uniform vec3 magneticDriftVelocity;
uniform float magneticGrainFrequency;
uniform float magneticBaseAmount;
uniform float magneticPoleAmount;
uniform float magneticPoleWidth;
uniform float magneticContrast;
uniform float magneticIridescence;
uniform float magneticBreathe;
uniform float magneticStretch;

varying vec3 magneticSkyDirection;

// Below this the pattern cannot reach a displayable value, and the four-octave
// noise behind it is by far the most expensive work on the dome.
const float PATTERN_CUTOFF = 0.002;

float magneticHash(vec3 cell) {
  return fract(sin(dot(cell, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

/** Trilinear value noise; the previous version's `noise3`, unchanged. */
float magneticNoise(vec3 position) {
  vec3 cell = floor(position);
  vec3 offset = fract(position);
  vec3 weight = offset * offset * (3.0 - 2.0 * offset);
  float n000 = magneticHash(cell);
  float n100 = magneticHash(cell + vec3(1.0, 0.0, 0.0));
  float n010 = magneticHash(cell + vec3(0.0, 1.0, 0.0));
  float n110 = magneticHash(cell + vec3(1.0, 1.0, 0.0));
  float n001 = magneticHash(cell + vec3(0.0, 0.0, 1.0));
  float n101 = magneticHash(cell + vec3(1.0, 0.0, 1.0));
  float n011 = magneticHash(cell + vec3(0.0, 1.0, 1.0));
  float n111 = magneticHash(cell + vec3(1.0, 1.0, 1.0));
  float x00 = mix(n000, n100, weight.x);
  float x10 = mix(n010, n110, weight.x);
  float x01 = mix(n001, n101, weight.x);
  float x11 = mix(n011, n111, weight.x);
  return mix(mix(x00, x10, weight.y), mix(x01, x11, weight.y), weight.z);
}

/** Four octaves, unrolled; the previous version's `fbm` with its exact constants. */
float magneticFbm(vec3 position) {
  vec3 step = vec3(11.5, 21.7, 31.9);
  vec3 point = position;
  float value = magneticNoise(point) * 0.5;
  point = point * 2.07 + step;
  value += magneticNoise(point) * 0.25;
  point = point * 2.07 + step;
  value += magneticNoise(point) * 0.125;
  point = point * 2.07 + step;
  value += magneticNoise(point) * 0.0625;
  return value;
}

void main() {
  vec3 direction = normalize(magneticSkyDirection);
  vec3 sky = mix(
    magneticHorizonColor,
    magneticZenithColor,
    smoothstep(0.0, 0.75, direction.y)
  );

  // Signed position on the field axis: +1 at the magnetic north point, −1 at
  // the southern counter-pole. The shimmer condenses at both.
  float along = dot(direction, magneticFieldAxis);
  float axial = abs(along);
  float breathe = sin(magneticTime * 0.5) * 0.05 * magneticBreathe;
  float poleZone = pow(clamp(axial + breathe, 0.0, 1.0), magneticPoleWidth);
  float amount = clamp(
    magneticBaseAmount + poleZone * magneticPoleAmount,
    0.0,
    1.2
  ) * magneticIntensity;

  // One coherent branch: the open sky between the poles carries no pattern, and
  // skipping the noise there costs nothing in divergence but saves the frame.
  if (amount > PATTERN_CUTOFF) {
    // Anisotropy stretches or squashes the grain along the field axis.
    vec3 anisotropic =
      direction + magneticFieldAxis * (along * (magneticStretch - 1.0));
    float noise = magneticFbm(
      anisotropic * magneticGrainFrequency +
        magneticDriftVelocity * magneticTime
    );
    float grain = smoothstep(0.34, 0.66, noise);
    float pattern = clamp(grain * amount * magneticContrast, 0.0, 1.0);

    vec3 poleColor = mix(
      magneticSouthColor,
      magneticNorthColor,
      smoothstep(-0.6, 0.6, along)
    );
    vec3 grainColor = mix(
      magneticNeutralColor,
      poleColor,
      smoothstep(0.15, 0.75, axial)
    );
    sky = mix(sky, grainColor, pattern);

    // Iridescent breathing over the grain, inside the pole zones only.
    float phase = noise * 25.0 - magneticTime * 1.4;
    vec3 iridescent =
      vec3(sin(phase), sin(phase + 2.09), sin(phase + 4.18)) * 0.5 + 0.5;
    sky += iridescent *
      grain *
      poleZone *
      magneticIridescence *
      0.6 *
      magneticIntensity;
  }

  // Meet the carried level haze at the horizon so the dome and the fogged
  // distance agree instead of showing a seam.
  sky = mix(
    sky,
    magneticHorizonColor,
    (1.0 - smoothstep(0.0, 0.1, abs(direction.y))) * 0.6
  );

  gl_FragColor = vec4(sky, 1.0);
  // Uniform colors arrive linear and the world's other materials convert on
  // output; without this the dome alone would skip the conversion.
  #include <colorspace_fragment>
}
