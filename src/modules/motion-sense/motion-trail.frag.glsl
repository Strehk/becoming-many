/*
 * Purpose: Shape and fade Motion Trail point primitives in the fragment stage.
 * Context: Trails read as soft ink specks that dissolve while drifting outward.
 * Responsibility: Discard fragments outside the circle and fade alpha with particle age.
 * Boundary: Age math, spawn intensity, colors, and material lifecycle stay elsewhere.
 */

varying float motionTrailFade;

const float MOTION_ALPHA_EASE = 0.6;

void discardOutsideMotionTrailCircle() {
  vec2 centerOffset = gl_PointCoord - vec2(0.5);
  if (dot(centerOffset, centerOffset) > 0.25) discard;
}

float getMotionTrailAlpha() {
  return pow(motionTrailFade, MOTION_ALPHA_EASE);
}
