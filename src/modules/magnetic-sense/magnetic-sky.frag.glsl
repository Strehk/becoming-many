/*
 * Purpose: Paint an opaque horizon glow toward the magnetic field direction.
 * Context: The dome carries the level haze everywhere outside the glow lobe.
 * Responsibility: Blend the haze toward the glow color by elevation and azimuth.
 * Boundary: Ground stripes, terrain, and every lit surface stay elsewhere.
 */

uniform vec2 magneticFieldDirection;
uniform float magneticIntensity;
uniform vec3 magneticSkyHazeColor;
uniform vec3 magneticSkyGlowColor;
uniform float magneticSkyGlowElevationSpan;
uniform float magneticSkyBelowHorizonElevation;
uniform float magneticSkyAzimuthExponent;

varying vec3 magneticSkyDirection;

void main() {
  vec3 direction = normalize(magneticSkyDirection);
  float aboveFade =
    1.0 - smoothstep(0.0, magneticSkyGlowElevationSpan, direction.y);
  float belowFade =
    smoothstep(magneticSkyBelowHorizonElevation, 0.0, direction.y);
  // Guard the azimuth near the zenith where the horizontal direction vanishes.
  vec2 horizontal = direction.xz / max(length(direction.xz), 0.0001);
  float alignment = max(dot(horizontal, magneticFieldDirection), 0.0);
  float azimuthGlow = pow(alignment, magneticSkyAzimuthExponent);
  float glow = aboveFade * belowFade * azimuthGlow * magneticIntensity;
  gl_FragColor = vec4(
    mix(magneticSkyHazeColor, magneticSkyGlowColor, glow),
    1.0
  );
}
