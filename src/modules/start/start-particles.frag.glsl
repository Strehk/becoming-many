/* Fine, readable grains and a small fraction of soft haze share one bounded draw.
 * A neutral local silver accent supplies feedback without bloom or extra lights. */
uniform float startGlow;
varying float startBrightness;
varying float startShapePresence;
varying float startDistanceFade;
varying float startHazePresence;
varying float startLocalPulse;
varying float startVisibility;

void applyStartParticleAppearance(inout vec4 particleColor) {
  float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
  if (radius >= 1.0 || startVisibility <= 0.0) discard;
  float accent = min(0.2, startBrightness + radius * startGlow * 0.2);
  particleColor.rgb = mix(particleColor.rgb, vec3(0.87), accent + startLocalPulse * 0.42);
  particleColor.rgb = mix(particleColor.rgb, vec3(0.8), startHazePresence * 0.5);
  float opacity;
  if (startHazePresence > 0.5) {
    opacity = 0.10 * exp(-radius * radius * 4.5) * (1.0 - smoothstep(0.7, 1.0, radius));
  } else {
    opacity = 0.56 * (1.0 - smoothstep(0.3, 1.0, radius));
  }
  particleColor.a *= opacity * mix(0.22, 1.0, startShapePresence) * startDistanceFade * startVisibility;
}
