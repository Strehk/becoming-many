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

#ifdef AIR_PARTICLE_DISTANCE_FADE
uniform float airParticleFadeStart;
uniform float airParticleFadeEnd;
varying float airParticleDistanceOpacity;
const float AIR_PARTICLE_NEAR_FADE_START_METERS = 0.5;
const float AIR_PARTICLE_NEAR_FADE_END_METERS = 2.0;
const float AIR_PARTICLE_MAXIMUM_SIZE_PIXELS = 12.0;
#endif

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

vec4 getAirParticleClipPosition(vec4 visibleClipPosition, vec3 viewPosition) {
  #ifdef AIR_PARTICLE_DISTANCE_FADE
  float distanceMeters = length(viewPosition);
  airParticleDistanceOpacity = 1.0 - smoothstep(
    airParticleFadeStart, airParticleFadeEnd, distanceMeters
  );
  airParticleDistanceOpacity *= smoothstep(
    AIR_PARTICLE_NEAR_FADE_START_METERS, AIR_PARTICLE_NEAR_FADE_END_METERS, distanceMeters
  );
  if (airParticleDistanceOpacity <= 0.0) return vec4(2.0, 2.0, 2.0, 1.0);
  #endif

  if (airParticleVisible > 0.5) return visibleClipPosition;

  // Points below the sampled world surface remain in the fixed GPU buffer but
  // are moved beyond clip space before rasterization.
  return vec4(2.0, 2.0, 2.0, 1.0);
}
