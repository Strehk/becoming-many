/*
 * Purpose: Clip an Air Particle point primitive to a circular shape.
 * Context: Square particles use PointsMaterial unchanged and circles opt into this fragment work.
 * Responsibility: Discard only point fragments outside the requested circle.
 * Boundary: Color, opacity, animation, visibility, and material lifecycle stay elsewhere.
 */

void discardOutsideAirParticleCircle() {
  vec2 centerOffset = gl_PointCoord - vec2(0.5);
  if (dot(centerOffset, centerOffset) > 0.25) discard;
}
