/*
 * Purpose: Age, fade, and expand Motion Trail particles in the vertex stage.
 * Context: The CPU prints one ring slot per frame; everything older animates GPU-only.
 * Responsibility: Derive age from the frame uniform, drift points outward, and collapse dead ones.
 * Boundary: Ring bookkeeping, spawn intensity, thinning, and colors stay in TypeScript.
 */

uniform float motionFrame;
uniform float motionIntensity;
uniform float motionLifetimeFrames;
uniform float motionExpansionMeters;
uniform float motionFadePower;
attribute vec3 motionExpansionDirection;
attribute float motionSpawnIntensity;
attribute float motionSpawnFrame;
varying float motionTrailFade;

const float MOTION_EXPANSION_EASE = 1.25;
const float MOTION_MINIMUM_VISIBLE_FADE = 0.005;
const float MOTION_MINIMUM_SIZE_SCALE = 0.3;

vec3 expandMotionTrailParticle(vec3 printedPosition) {
  float age = clamp(
    (motionFrame - motionSpawnFrame) / max(motionLifetimeFrames - 1.0, 1.0),
    0.0,
    1.0
  );

  // Thinned particles carry zero spawn intensity and never rasterize.
  motionTrailFade = pow(1.0 - age, motionFadePower)
    * motionSpawnIntensity * motionIntensity;

  return printedPosition
    + motionExpansionDirection * pow(age, MOTION_EXPANSION_EASE) * motionExpansionMeters;
}

vec4 getMotionTrailClipPosition(vec4 visibleClipPosition) {
  if (motionTrailFade > MOTION_MINIMUM_VISIBLE_FADE) return visibleClipPosition;

  // Fully faded points stay in the fixed ring buffer but are moved beyond
  // clip space so an expired slot rasterizes nothing.
  return vec4(2.0, 2.0, 2.0, 1.0);
}

float getMotionTrailSizeScale() {
  return MOTION_MINIMUM_SIZE_SCALE
    + (1.0 - MOTION_MINIMUM_SIZE_SCALE) * motionTrailFade;
}
