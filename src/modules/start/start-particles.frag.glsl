/* Restrained point-local edge glow and slow sparkle preserve dark silhouettes
 * against white. No extra pass, lights, textures or postprocessing resources. */
uniform float startSparkle;
uniform float startGlow;
uniform float startCompletion;
varying float startBrightnessPhase;
varying float startShapePresence;

void applyStartParticleAppearance(inout vec4 particleColor) {
  float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
  if (radius >= 1.0) discard;
  float edge = smoothstep(0.48, 1.0, radius);
  float sparkle = (0.5 + 0.5 * sin(startBrightnessPhase)) * startSparkle;
  float accent = min(0.22, sparkle + edge * startGlow * 0.3);
  particleColor.rgb = mix(particleColor.rgb, vec3(0.78, 0.86, 0.88), accent);
  particleColor.rgb = mix(particleColor.rgb, vec3(0.055, 0.26, 0.23), clamp(startCompletion, 0.0, 1.0) * 0.3);
  float coreAlpha = mix(0.55, 0.96, startShapePresence);
  particleColor.a *= coreAlpha * (1.0 - smoothstep(0.72, 1.0, radius));
}
