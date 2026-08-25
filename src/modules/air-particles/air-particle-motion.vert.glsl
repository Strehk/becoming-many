/*
 * Purpose: Apply Air Particles movement and visibility in the vertex stage.
 * Context: Particles drift without CPU uploads and underground candidates remain invisible.
 * Responsibility: Offset visible points and move hidden points outside clip space.
 * Boundary: Surface classification, point size, color, shape, and lifecycle stay in TypeScript.
 */

uniform float airParticleTime;
uniform float airParticleHorizontalAmplitude;
uniform float airParticleVerticalAmplitude;
attribute float airParticleVisible;

const float AIR_PARTICLE_VERTICAL_RATE = 0.45;
const float AIR_PARTICLE_HORIZONTAL_RATE = 0.31;
const float AIR_PARTICLE_PHASE_SCALE = 1.7;

vec3 animateAirParticle(vec3 restingPosition) {
  float phase = dot(restingPosition, vec3(0.071, 0.113, 0.053));
  float verticalDrift = sin(
    airParticleTime * AIR_PARTICLE_VERTICAL_RATE + phase
  ) * airParticleVerticalAmplitude;
  float horizontalDrift = cos(
    airParticleTime * AIR_PARTICLE_HORIZONTAL_RATE + phase * AIR_PARTICLE_PHASE_SCALE
  ) * airParticleHorizontalAmplitude;

  return restingPosition + vec3(horizontalDrift, verticalDrift, 0.0);
}

vec4 getAirParticleClipPosition(vec4 visibleClipPosition) {
  if (airParticleVisible > 0.5) return visibleClipPosition;

  // Points below the sampled world surface remain in the fixed GPU buffer but
  // are moved beyond clip space before rasterization.
  return vec4(2.0, 2.0, 2.0, 1.0);
}
