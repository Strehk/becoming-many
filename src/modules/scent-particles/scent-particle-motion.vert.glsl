/*
 * Purpose: Apply Scent Particle rise, sway, and lifecycle fade in the vertex stage.
 * Context: Scent clouds animate without CPU uploads from one looping time uniform.
 * Responsibility: Offset points along their life cycle and scale faded points to nothing.
 * Boundary: Emitter placement, colors, point shape, and lifecycle stay in TypeScript.
 */

uniform float scentTime;
uniform float scentIntensity;
uniform float scentRiseHeight;
uniform float scentRiseDuration;
uniform float scentDriftAmplitude;
attribute float scentPhase;
attribute float scentVisible;

// 7 * TAU / 60 keeps the sway seamless at the 60-second time-uniform wrap.
const float SCENT_SWAY_RATE = 0.7330383;
const float SCENT_SWAY_PHASE_SCALE = 1.7;
const float SCENT_FADE_PORTION = 0.25;
const float SCENT_MINIMUM_VISIBLE_SCALE = 0.01;

float scentSizeScale = 0.0;

vec3 animateScentParticle(vec3 restingPosition) {
  float age = fract(scentTime / scentRiseDuration + scentPhase);
  float swayPhase = dot(restingPosition, vec3(0.083, 0.059, 0.101));

  // Particles of emitters without a source-zone anchor never rasterize.
  scentSizeScale = scentVisible * scentIntensity
    * smoothstep(0.0, SCENT_FADE_PORTION, age)
    * (1.0 - smoothstep(1.0 - SCENT_FADE_PORTION, 1.0, age));

  vec3 lifeOffset = vec3(
    cos(scentTime * SCENT_SWAY_RATE + swayPhase) * scentDriftAmplitude,
    age * scentRiseHeight,
    sin(scentTime * SCENT_SWAY_RATE + swayPhase * SCENT_SWAY_PHASE_SCALE)
      * scentDriftAmplitude
  );

  return restingPosition + lifeOffset;
}

vec4 getScentParticleClipPosition(vec4 visibleClipPosition) {
  if (scentSizeScale > SCENT_MINIMUM_VISIBLE_SCALE) return visibleClipPosition;

  // Fully faded points stay in the fixed GPU buffer but are moved beyond
  // clip space so intensity zero rasterizes nothing.
  return vec4(2.0, 2.0, 2.0, 1.0);
}

float getScentParticleSizeScale() {
  return scentSizeScale;
}
